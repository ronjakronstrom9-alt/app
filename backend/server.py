from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone, date
import bcrypt
import jwt as pyjwt
import urllib.request
import time as _time
from io import BytesIO
from PIL import Image as PILImage
from minor_arcana import build_seed_entries


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'mystic-tarot-secret-key-change-me')
JWT_ALG = 'HS256'
JWT_EXPIRE_DAYS = 30
SEED_VERSION = 10  # bump to re-seed (adds question_type + extra question variants)

STATIC_CARDS_DIR = ROOT_DIR / "static_cards"
STATIC_CARDS_DIR.mkdir(exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


# ===== MODELS =====
class SignupReq(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    xp: int
    level: int
    hearts: int
    streak: int
    last_active_date: Optional[str] = None
    completed_lessons: List[str] = []
    favorites: List[str] = []
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class TarotCard(BaseModel):
    id: str
    name: str
    number: int
    arcana: str
    suit: Optional[str] = None
    keywords_upright: List[str]
    keywords_reversed: List[str]
    upright_meaning: str
    reversed_meaning: str
    description: str
    symbolism: str
    image_emoji: str
    image_url: str
    element: str

class Lesson(BaseModel):
    id: str
    card_id: str
    order: int
    title: str
    intro: str
    subtitle: str
    sections: List[dict]
    xp_reward: int

class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    question_type: str = "mcq"  # mcq | match_image | match_meaning | reversed_detect | keyword_pick
    image_url: Optional[str] = None  # for match_image / reversed_detect
    reversed_hint: Optional[bool] = None  # for reversed_detect (correct answer)

class QuizSubmission(BaseModel):
    lesson_id: str
    answers: List[int]
    hearts_lost: int

class QuizResult(BaseModel):
    correct: int
    total: int
    xp_earned: int
    xp_streak_bonus: int = 0
    new_xp: int
    new_level: int
    new_hearts: int
    new_streak: int
    lesson_completed: bool
    perfect: bool = False
    achievements_unlocked: List[dict] = []


# ===== AUTH HELPERS =====
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_token(user_id: str) -> str:
    return pyjwt.encode({
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        'iat': datetime.now(timezone.utc),
    }, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get('sub')
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def user_to_out(user: dict) -> UserOut:
    return UserOut(
        id=user['id'], email=user['email'], name=user['name'],
        xp=user.get('xp', 0), level=user.get('level', 1),
        hearts=user.get('hearts', 5), streak=user.get('streak', 0),
        last_active_date=user.get('last_active_date'),
        completed_lessons=user.get('completed_lessons', []),
        favorites=user.get('favorites', []),
        created_at=user.get('created_at', ''),
    )


def xp_to_level(xp: int) -> int:
    thresholds = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]
    lvl = 1
    for i, t in enumerate(thresholds):
        if xp >= t:
            lvl = i + 1
    return lvl


# ===== AUTH ROUTES =====
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupReq):
    email = req.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id, "email": email, "name": req.name.strip() or "Seeker",
        "password_hash": hash_password(req.password),
        "xp": 0, "level": 1, "hearts": 5, "streak": 0,
        "last_active_date": None, "completed_lessons": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    user_doc.pop('_id', None)
    return AuthResponse(token=create_token(user_id), user=user_to_out(user_doc))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginReq):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(req.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return AuthResponse(token=create_token(user['id']), user=user_to_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)


# ===== CARDS =====
@api_router.get("/cards", response_model=List[TarotCard])
async def list_cards():
    # Sort Major arcana first (by number 0-21), then Minor arcana grouped by
    # suit (Wands, Cups, Swords, Pentacles) and within each by number (1-14).
    cards = await db.cards.find({}, {"_id": 0}).to_list(200)
    suit_order = {None: 0, "Wands": 1, "Cups": 2, "Swords": 3, "Pentacles": 4}
    def sort_key(c):
        return (0 if c.get('arcana') == "Major" else 1,
                suit_order.get(c.get('suit'), 99),
                c.get('number', 0))
    cards.sort(key=sort_key)
    return [TarotCard(**c) for c in cards]

@api_router.get("/cards/{card_id}", response_model=TarotCard)
async def get_card(card_id: str):
    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return TarotCard(**card)


# ===== LESSONS =====
@api_router.get("/lessons", response_model=List[Lesson])
async def list_lessons():
    lessons = await db.lessons.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return [Lesson(**doc) for doc in lessons]

@api_router.get("/lessons/{lesson_id}", response_model=Lesson)
async def get_lesson(lesson_id: str):
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return Lesson(**lesson)


# ===== QUIZ =====
@api_router.get("/quizzes/{lesson_id}")
async def get_quiz(lesson_id: str, user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    public_qs = [
        {
            "id": q['id'],
            "question": q['question'],
            "options": q['options'],
            "question_type": q.get('question_type', 'mcq'),
            "image_url": q.get('image_url'),
        }
        for q in quiz['questions']
    ]
    return {"id": quiz['id'], "lesson_id": quiz['lesson_id'], "questions": public_qs}


@api_router.post("/quizzes/submit", response_model=QuizResult)
async def submit_quiz(sub: QuizSubmission, user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"lesson_id": sub.lesson_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    lesson = await db.lessons.find_one({"id": sub.lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    questions = quiz['questions']
    if len(sub.answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count mismatch")

    correct = sum(1 for i, q in enumerate(questions) if sub.answers[i] == q['correct_index'])
    total = len(questions)
    passed = correct >= max(1, int(total * 0.6))

    xp_earned = 0
    xp_streak_bonus = 0
    completed_lessons = list(user.get('completed_lessons', []))
    lesson_completed = sub.lesson_id in completed_lessons

    if passed:
        base_xp = lesson.get('xp_reward', 20)
        if correct == total:
            base_xp += 10
        xp_earned = base_xp
        if sub.lesson_id not in completed_lessons:
            completed_lessons.append(sub.lesson_id)
            lesson_completed = True

    new_xp = user.get('xp', 0) + xp_earned
    new_level = xp_to_level(new_xp)
    new_hearts = max(0, user.get('hearts', 5) - max(0, sub.hearts_lost))

    today = date.today().isoformat()
    last_active = user.get('last_active_date')
    current_streak = user.get('streak', 0)
    new_streak = current_streak
    if passed:
        if last_active == today:
            pass
        elif last_active is None:
            new_streak = 1
        else:
            try:
                delta_days = (date.today() - date.fromisoformat(last_active)).days
                if delta_days == 1:
                    new_streak = current_streak + 1
                elif delta_days == 0:
                    pass
                else:
                    new_streak = 1
            except Exception:
                new_streak = 1

    # Streak bonus XP tiers
    if passed and new_streak > current_streak:
        if new_streak >= 30:
            xp_streak_bonus = 25
        elif new_streak >= 14:
            xp_streak_bonus = 15
        elif new_streak >= 7:
            xp_streak_bonus = 10
        elif new_streak >= 3:
            xp_streak_bonus = 5
    xp_earned_total = xp_earned + xp_streak_bonus
    new_xp = user.get('xp', 0) + xp_earned_total
    new_level = xp_to_level(new_xp)

    update = {
        "xp": new_xp, "level": new_level, "hearts": new_hearts,
        "streak": new_streak, "completed_lessons": completed_lessons,
    }
    if passed:
        update["last_active_date"] = today
    await db.users.update_one({"id": user['id']}, {"$set": update})

    # Compute newly-unlocked achievements
    prev_user = dict(user)
    new_user = {**user, **update}
    achievements_unlocked = _diff_achievements(prev_user, new_user)

    return QuizResult(
        correct=correct, total=total, xp_earned=xp_earned_total,
        xp_streak_bonus=xp_streak_bonus,
        new_xp=new_xp, new_level=new_level, new_hearts=new_hearts,
        new_streak=new_streak, lesson_completed=lesson_completed,
        perfect=(correct == total),
        achievements_unlocked=achievements_unlocked,
    )


@api_router.post("/users/refill-hearts")
async def refill_hearts(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user['id']}, {"$set": {"hearts": 5}})
    return {"hearts": 5}


# ===== FAVORITES =====
class FavoriteReq(BaseModel):
    card_id: str

@api_router.post("/favorites/toggle")
async def toggle_favorite(req: FavoriteReq, user: dict = Depends(get_current_user)):
    favorites = list(user.get('favorites', []))
    is_fav = req.card_id in favorites
    if is_fav:
        favorites.remove(req.card_id)
    else:
        favorites.append(req.card_id)
    await db.users.update_one({"id": user['id']}, {"$set": {"favorites": favorites}})
    return {"favorited": not is_fav, "favorites": favorites}

@api_router.get("/favorites", response_model=List[TarotCard])
async def list_favorites(user: dict = Depends(get_current_user)):
    fav_ids = user.get('favorites', [])
    if not fav_ids:
        return []
    cards = await db.cards.find({"id": {"$in": fav_ids}}, {"_id": 0}).to_list(200)
    return [TarotCard(**c) for c in cards]


# ===== NOTES =====
class NoteReq(BaseModel):
    card_id: str
    text: str

@api_router.get("/notes/{card_id}")
async def get_note(card_id: str, user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"user_id": user['id'], "card_id": card_id}, {"_id": 0})
    return note or {"card_id": card_id, "text": ""}

@api_router.post("/notes")
async def save_note(req: NoteReq, user: dict = Depends(get_current_user)):
    doc = {"user_id": user['id'], "card_id": req.card_id, "text": req.text,
           "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.notes.update_one({"user_id": user['id'], "card_id": req.card_id},
                              {"$set": doc}, upsert=True)
    return {"ok": True}


# ===== DAILY CARD =====
import hashlib as _hashlib
@api_router.get("/daily-card")
async def daily_card(user: dict = Depends(get_current_user)):
    """Deterministic 'card of the day' — same card all day per user, different
    next day. Uses SHA1(user_id + iso_date) modulo card count to pick.
    Also upserts an entry into daily_history so the user can browse past draws."""
    today = date.today().isoformat()
    total = await db.cards.count_documents({})
    if total == 0:
        raise HTTPException(status_code=404, detail="No cards")
    seed = _hashlib.sha1(f"{user['id']}:{today}".encode()).hexdigest()
    idx = int(seed, 16) % total
    all_cards = await db.cards.find({}, {"_id": 0}).to_list(200)
    card = all_cards[idx]
    # Record the draw (idempotent per user+date)
    await db.daily_history.update_one(
        {"user_id": user['id'], "date": today},
        {"$setOnInsert": {
            "user_id": user['id'], "date": today, "card_id": card['id'],
            "card_name": card['name'], "image_url": card['image_url'],
            "card_number": card.get('number', 0),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"date": today, "card": card, "prompt": "What does this card invite you to focus on today?"}


class DailyReflectionReq(BaseModel):
    date: str  # ISO YYYY-MM-DD
    text: str


@api_router.post("/daily-history/reflect")
async def save_reflection(req: DailyReflectionReq, user: dict = Depends(get_current_user)):
    """Attach or replace the user's written reflection for a given daily draw."""
    entry = await db.daily_history.find_one({"user_id": user['id'], "date": req.date})
    if not entry:
        raise HTTPException(status_code=404, detail="No draw recorded for that date")
    await db.daily_history.update_one(
        {"user_id": user['id'], "date": req.date},
        {"$set": {"reflection": req.text,
                  "reflection_updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@api_router.get("/daily-history")
async def daily_history(
    year: int, month: int,
    user: dict = Depends(get_current_user),
):
    """Return all daily draws for user in given calendar month (1-indexed)."""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    # Build ISO date prefix like 2026-06 for a simple prefix match.
    prefix = f"{year:04d}-{month:02d}"
    entries = await db.daily_history.find(
        {"user_id": user['id'], "date": {"$regex": f"^{prefix}"}},
        {"_id": 0, "user_id": 0},
    ).sort("date", 1).to_list(50)
    return {
        "year": year,
        "month": month,
        "entries": entries,
        "count": len(entries),
    }


@api_router.get("/users/progress")
async def progress(user: dict = Depends(get_current_user)):
    total_lessons = await db.lessons.count_documents({})
    completed = len(user.get('completed_lessons', []))
    xp = user.get('xp', 0)
    level = user.get('level', 1)
    thresholds = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]
    next_threshold = thresholds[min(level, len(thresholds) - 1)] if level < len(thresholds) else thresholds[-1] + 300
    current_threshold = thresholds[level - 1] if level - 1 < len(thresholds) else thresholds[-1]
    return {
        "xp": xp, "level": level,
        "current_level_xp": current_threshold, "next_level_xp": next_threshold,
        "hearts": user.get('hearts', 5), "streak": user.get('streak', 0),
        "completed_lessons": completed, "total_lessons": total_lessons,
        "completion_pct": round((completed / total_lessons) * 100) if total_lessons else 0,
        "completed_lesson_ids": user.get('completed_lessons', []),
    }


# ===== ACHIEVEMENTS =====
# Achievements are computed dynamically from user state — no DB storage needed.
# Each entry: id, title, description, icon (Ionicons name), category, target,
# and a function to evaluate progress from user dict.
ACHIEVEMENTS = [
    {"id": "first_lesson", "title": "First Step", "desc": "Complete your first lesson",
     "icon": "footsteps", "category": "beginner", "target": 1,
     "getter": lambda u: len(u.get('completed_lessons', []))},
    {"id": "five_lessons", "title": "Novice Reader", "desc": "Complete 5 lessons",
     "icon": "book-outline", "category": "learning", "target": 5,
     "getter": lambda u: len(u.get('completed_lessons', []))},
    {"id": "ten_lessons", "title": "Devoted Student", "desc": "Complete 10 lessons",
     "icon": "school", "category": "learning", "target": 10,
     "getter": lambda u: len(u.get('completed_lessons', []))},
    {"id": "major_master", "title": "Major Arcana Master", "desc": "Complete all 22 Major Arcana lessons",
     "icon": "diamond", "category": "mastery", "target": 22,
     "getter": lambda u: len(u.get('completed_lessons', []))},
    {"id": "full_deck", "title": "Full Deck", "desc": "Complete all 78 lessons",
     "icon": "trophy", "category": "mastery", "target": 78,
     "getter": lambda u: len(u.get('completed_lessons', []))},
    {"id": "streak_3", "title": "Rising Flame", "desc": "Maintain a 3-day streak",
     "icon": "flame-outline", "category": "streak", "target": 3,
     "getter": lambda u: u.get('streak', 0)},
    {"id": "streak_7", "title": "Weekly Devotion", "desc": "Maintain a 7-day streak",
     "icon": "flame", "category": "streak", "target": 7,
     "getter": lambda u: u.get('streak', 0)},
    {"id": "streak_30", "title": "Lunar Cycle", "desc": "Maintain a 30-day streak",
     "icon": "moon", "category": "streak", "target": 30,
     "getter": lambda u: u.get('streak', 0)},
    {"id": "xp_100", "title": "First Spark", "desc": "Earn 100 XP",
     "icon": "sparkles", "category": "xp", "target": 100,
     "getter": lambda u: u.get('xp', 0)},
    {"id": "xp_500", "title": "Rising Star", "desc": "Earn 500 XP",
     "icon": "star", "category": "xp", "target": 500,
     "getter": lambda u: u.get('xp', 0)},
    {"id": "xp_1000", "title": "Celestial", "desc": "Earn 1,000 XP",
     "icon": "star-outline", "category": "xp", "target": 1000,
     "getter": lambda u: u.get('xp', 0)},
    {"id": "level_5", "title": "Adept", "desc": "Reach level 5",
     "icon": "trending-up", "category": "level", "target": 5,
     "getter": lambda u: u.get('level', 1)},
    {"id": "level_10", "title": "Oracle", "desc": "Reach level 10",
     "icon": "eye", "category": "level", "target": 10,
     "getter": lambda u: u.get('level', 1)},
    {"id": "first_favorite", "title": "Bound by Fate", "desc": "Save your first favorite card",
     "icon": "heart", "category": "collection", "target": 1,
     "getter": lambda u: len(u.get('favorites', []))},
    {"id": "five_favorites", "title": "Sacred Selection", "desc": "Save 5 favorite cards",
     "icon": "heart-circle", "category": "collection", "target": 5,
     "getter": lambda u: len(u.get('favorites', []))},
]


def _compute_achievement(a: dict, user: dict) -> dict:
    """Serialize a single achievement for the given user."""
    current = int(a['getter'](user))
    target = a['target']
    return {
        "id": a['id'], "title": a['title'], "description": a['desc'],
        "icon": a['icon'], "category": a['category'],
        "target": target, "progress": min(current, target),
        "unlocked": current >= target,
        "pct": min(100, int(current * 100 / max(1, target))),
    }


def _diff_achievements(prev: dict, new: dict) -> list:
    """Return list of achievements that were newly unlocked by the transition
    from `prev` to `new` user state. Used to trigger celebration UI."""
    unlocked = []
    for a in ACHIEVEMENTS:
        was = int(a['getter'](prev)) >= a['target']
        is_now = int(a['getter'](new)) >= a['target']
        if is_now and not was:
            unlocked.append(_compute_achievement(a, new))
    return unlocked


@api_router.get("/achievements")
async def list_achievements(user: dict = Depends(get_current_user)):
    items = [_compute_achievement(a, user) for a in ACHIEVEMENTS]
    return {
        "total": len(items),
        "unlocked": sum(1 for i in items if i['unlocked']),
        "items": items,
    }


# ===== SEED DATA — Rider-Waite-Smith deck (public domain, 1909) =====
WIKI_BASE = "https://upload.wikimedia.org/wikipedia/commons"

# Wikimedia source URLs and local filename slugs per card
WIKI_SOURCES = {
    "The Fool":          ("9/90/RWS_Tarot_00_Fool.jpg",          "00-fool.jpg"),
    "The Magician":      ("d/de/RWS_Tarot_01_Magician.jpg",      "01-magician.jpg"),
    "The High Priestess":("8/88/RWS_Tarot_02_High_Priestess.jpg","02-high-priestess.jpg"),
    "The Empress":       ("d/d2/RWS_Tarot_03_Empress.jpg",       "03-empress.jpg"),
    "The Emperor":       ("c/c3/RWS_Tarot_04_Emperor.jpg",       "04-emperor.jpg"),
    "The Hierophant":    ("8/8d/RWS_Tarot_05_Hierophant.jpg",    "05-hierophant.jpg"),
    "The Lovers":        ("d/db/RWS_Tarot_06_Lovers.jpg",        "06-lovers.jpg"),
    "The Chariot":       ("9/9b/RWS_Tarot_07_Chariot.jpg",       "07-chariot.jpg"),
    "Strength":          ("f/f5/RWS_Tarot_08_Strength.jpg",      "08-strength.jpg"),
    "The Hermit":        ("4/4d/RWS_Tarot_09_Hermit.jpg",        "09-hermit.jpg"),
    "Wheel of Fortune":  ("3/3c/RWS_Tarot_10_Wheel_of_Fortune.jpg","10-wheel-of-fortune.jpg"),
    "Justice":           ("e/e0/RWS_Tarot_11_Justice.jpg",       "11-justice.jpg"),
    "The Hanged Man":    ("2/2b/RWS_Tarot_12_Hanged_Man.jpg",    "12-hanged-man.jpg"),
    "Death":             ("d/d7/RWS_Tarot_13_Death.jpg",         "13-death.jpg"),
    "Temperance":        ("f/f8/RWS_Tarot_14_Temperance.jpg",    "14-temperance.jpg"),
    "The Devil":         ("5/55/RWS_Tarot_15_Devil.jpg",         "15-devil.jpg"),
    "The Tower":         ("5/53/RWS_Tarot_16_Tower.jpg",         "16-tower.jpg"),
    "The Star":          ("d/db/RWS_Tarot_17_Star.jpg",          "17-star.jpg"),
    "The Moon":          ("7/7f/RWS_Tarot_18_Moon.jpg",          "18-moon.jpg"),
    "The Sun":           ("1/17/RWS_Tarot_19_Sun.jpg",           "19-sun.jpg"),
    "Judgement":         ("d/dd/RWS_Tarot_20_Judgement.jpg",     "20-judgement.jpg"),
    "The World":         ("f/ff/RWS_Tarot_21_World.jpg",         "21-world.jpg"),
}


def download_card_images():
    """Download Wikimedia images to local static folder. Downsized to 600px
    wide JPEG q82 for fast mobile transfer. Small pause between requests to
    stay under Wikimedia's per-client rate limit."""
    downloaded_this_run = 0
    for name, (path_or_url, fname) in WIKI_SOURCES.items():
        dest = STATIC_CARDS_DIR / fname
        if dest.exists() and 5000 < dest.stat().st_size < 300000:
            continue
        url = path_or_url if path_or_url.startswith("http") else f"{WIKI_BASE}/{path_or_url}"
        # Space out live downloads to avoid HTTP 429 from Wikimedia
        if downloaded_this_run > 0:
            _time.sleep(1.5)
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={
                    "User-Agent": "MysticXP-Tarot-App/1.0 (educational; contact@mystic.app)"
                })
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                img = PILImage.open(BytesIO(data)).convert("RGB")
                if img.width > 600:
                    r = 600 / img.width
                    img = img.resize((600, int(img.height * r)), PILImage.LANCZOS)
                out = BytesIO()
                img.save(out, format="JPEG", quality=82, optimize=True, progressive=True)
                dest.write_bytes(out.getvalue())
                downloaded_this_run += 1
                logger.info(f"Optimized {fname} ({len(data)}B -> {dest.stat().st_size}B)")
                break
            except Exception as e:
                if attempt < 2:
                    _time.sleep(4 * (attempt + 1))
                    continue
                logger.warning(f"Failed to download {fname}: {e}")

SEED_CARDS = [
    {
        "name": "The Fool", "number": 0, "arcana": "Major", "element": "Air",
        "image_emoji": "🃏",
        "image_url": f"{WIKI_BASE}/9/90/RWS_Tarot_00_Fool.jpg",
        "keywords_upright": ["beginnings", "innocence", "spontaneity", "free spirit", "leap of faith", "adventure"],
        "keywords_reversed": ["recklessness", "naivety", "foolishness", "missed opportunity", "fear of change", "carelessness"],
        "upright_meaning": "The Fool represents pure, unwritten potential — the moment before action, when anything is still possible. Drawing this card invites you to begin with an open heart, trust the unknown, and take that first uncertain step. It is the energy of the eternal beginner: curious, weightless, and unafraid of looking ridiculous in pursuit of something new.",
        "reversed_meaning": "Reversed, the Fool warns that openness has tipped into recklessness. You may be ignoring real risks, refusing to plan, or repeating the same naive mistake. Alternatively, you might be so afraid of stumbling that you refuse to begin at all — paralyzed at the cliff's edge while the journey waits.",
        "description": "A youthful figure stands at the edge of a high cliff, gazing upward into the sun with a white rose in one hand and a slim travel satchel slung over the shoulder. A small white dog leaps beside them, both companion and warning. Behind them rise distant snow-capped mountains; below them, an unseen drop.",
        "symbolism": "The white rose signifies purity of intent — desire untainted by greed. The satchel, small enough to hold only essentials, suggests the Fool carries wisdom from past lives but not the weight of yesterday. The dog represents loyalty and instinct, both encouraging the leap and barking caution. The sun behind illuminates the path forward, while the cliff is the threshold between known and unknown — a sacred edge crossed by every hero.",
    },
    {
        "name": "The Magician", "number": 1, "arcana": "Major", "element": "Air",
        "image_emoji": "🪄",
        "image_url": f"{WIKI_BASE}/d/de/RWS_Tarot_01_Magician.jpg",
        "keywords_upright": ["manifestation", "willpower", "skill", "focus", "resourcefulness", "concentration", "action"],
        "keywords_reversed": ["manipulation", "untapped talent", "poor planning", "deception", "illusion", "scattered energy"],
        "upright_meaning": "The Magician is the conscious creator — proof that you already possess everything you need to bring a vision into form. With one hand reaching toward heaven and the other pointing to earth, this card affirms 'as above, so below': your inner intention shapes outer reality. Use this moment to focus your will, gather your tools, and act with precision.",
        "reversed_meaning": "Reversed, the Magician suggests power misused or unrealized. Talents may lie dormant from self-doubt, or charisma may have curdled into manipulation and half-truths. Watch for plans that look bold but lack the discipline to execute, and beware of charmers (yourself included) selling illusions.",
        "description": "A robed figure stands at an altar with one arm raised, holding a double-pointed wand to the sky, while the other arm points toward the earth. On the altar before them lie the four suit symbols — cup, pentacle, sword, and wand. Above the figure floats a lemniscate (infinity symbol), and a belt shaped like the ouroboros encircles the waist.",
        "symbolism": "The four suits represent the four elements (water, earth, air, fire) and remind you that all the raw material of creation is already at your command. The lemniscate signifies infinite consciousness — divine inspiration flowing without end. The ouroboros belt (a snake eating its tail) symbolizes eternity and the unity of beginning and end. The dual gesture channels heavenly energy down into manifest reality.",
    },
    {
        "name": "The High Priestess", "number": 2, "arcana": "Major", "element": "Water",
        "image_emoji": "🌙",
        "image_url": f"{WIKI_BASE}/8/88/RWS_Tarot_02_High_Priestess.jpg",
        "keywords_upright": ["intuition", "mystery", "subconscious", "inner voice", "sacred knowledge", "stillness", "the divine feminine"],
        "keywords_reversed": ["secrets", "withdrawal", "repressed feelings", "disconnection from intuition", "hidden agendas", "blocked psychic insight"],
        "upright_meaning": "The High Priestess is the keeper of the veil between conscious and unconscious worlds. She does not give answers — she invites you to listen, dream, and wait. This card calls you to slow down and trust what you already know but cannot yet explain. Insight here comes in symbols, sleep, and silence, not in spreadsheets.",
        "reversed_meaning": "Reversed, the Priestess suggests you have severed contact with your inner knowing — drowning intuition in noise, logic, or other people's opinions. It can also reveal secrets ready to surface, or a fear of looking inward at what you've buried. The pool has stilled because you refuse to approach it.",
        "description": "A serene woman is seated between two pillars — one black (Boaz) and one white (Jachin) — at the entrance to a hidden temple. A crescent moon rests at her feet, a crown of crescents adorns her head, and she holds a partially concealed scroll labeled TORA. Behind her hangs a veil patterned with pomegranates, hinting at the mysteries beyond.",
        "symbolism": "The black and white pillars represent duality — known and unknown, light and shadow — and the Priestess sits at the threshold. The pomegranate veil echoes Persephone's underworld pact, marking the cyclic descent into the subconscious. Her partially hidden scroll signifies that truth is revealed selectively, only to those who quiet themselves enough to hear. The moon connects her to tides, cycles, and the receptive mind.",
    },
    {
        "name": "The Empress", "number": 3, "arcana": "Major", "element": "Earth",
        "image_emoji": "👑",
        "image_url": f"{WIKI_BASE}/d/d2/RWS_Tarot_03_Empress.jpg",
        "keywords_upright": ["abundance", "nurturing", "fertility", "creativity", "sensuality", "nature", "maternal care"],
        "keywords_reversed": ["dependence", "smothering", "creative block", "neglect", "burnout", "disconnection from body"],
        "upright_meaning": "The Empress is the sovereign of the senses and the abundant earth. She rules through generosity rather than force — what she touches grows, ripens, and feeds others. Drawing this card invites you to slow down, savor, and create from a full vessel: nourish your body, beautify your space, tend a project as you would a garden, and remember that pleasure is not a detour but the destination.",
        "reversed_meaning": "Reversed, the Empress signals a disrupted relationship with your own well-being and creative flow. Either you are overgiving — smothering loved ones, sacrificing yourself dry — or you have abandoned the gentle care your body, art, or home needs to thrive. Burnout, creative block, and feeling 'cut off' from joy are her warnings.",
        "description": "A regal woman reclines on cushions in a sunlit field, crowned with twelve stars and wearing a flowing gown patterned with pomegranates. A heart-shaped shield bearing the symbol of Venus rests beside her. Golden wheat ripens at her feet, and behind her a forest opens into a flowing waterfall.",
        "symbolism": "The twelve stars represent the twelve months and zodiac signs — the rhythms of nature she presides over. Pomegranates on her gown signify fertility and the seeds of future abundance. The Venus shield ties her to love, beauty, and the magnetism of desire. Ripening wheat and the waterfall behind her represent ongoing creation: nourishment that pours forth continuously when one is in harmony with natural law.",
    },
    {
        "name": "The Emperor", "number": 4, "arcana": "Major", "element": "Fire",
        "image_emoji": "⚜️",
        "image_url": f"{WIKI_BASE}/c/c3/RWS_Tarot_04_Emperor.jpg",
        "keywords_upright": ["authority", "structure", "stability", "leadership", "discipline", "father figure", "command"],
        "keywords_reversed": ["tyranny", "rigidity", "loss of control", "abuse of power", "stubbornness", "absent father"],
        "upright_meaning": "The Emperor builds and protects what the Empress nourishes — he is order, law, and stable command. Drawing this card calls you to claim authority over your domain: set clear rules, plan with rigor, defend boundaries, and lead from grounded confidence rather than reaction. He reminds you that structure, in its right place, is a form of love.",
        "reversed_meaning": "Reversed, the Emperor warns that authority has become domination. Rigidity, control issues, micromanagement, or an inability to delegate trust may all be at play. Alternatively, his reversal can speak of a missing or wounding father figure, an unstable foundation in your life, or a refusal to take responsibility when leadership is required.",
        "description": "A stern, bearded ruler sits on a stone throne carved with four ram's heads, holding an ankh-tipped scepter in one hand and a globe in the other. He wears a crown and red robes over armor. Behind him rise barren, rust-colored mountains under a clear sky.",
        "symbolism": "The ram heads connect him to Aries — initiating fire, courage, and pioneering will. The ankh scepter represents life under sovereignty; the globe in his other hand signifies dominion over manifest reality. His stone throne speaks of immovable foundations. The barren mountains behind him show that his rule extends even where life is hardest, and that his strength was forged through endurance, not gentleness.",
    },
    {
        "name": "The Lovers", "number": 6, "arcana": "Major", "element": "Air",
        "image_emoji": "💞",
        "image_url": f"{WIKI_BASE}/3/3a/TheLovers.jpg",
        "keywords_upright": ["love", "harmony", "choices", "alignment of values", "union", "partnership", "commitment"],
        "keywords_reversed": ["disharmony", "imbalance", "misalignment", "broken trust", "indecision", "values conflict"],
        "upright_meaning": "The Lovers represent more than romance — they signify any meaningful union and the conscious choice that sustains it. This card asks you to align your actions with what you truly value, choose with eyes open rather than longing, and recognize that real love (in any form) is the merging of opposites without either being erased. A pivotal choice often accompanies this card.",
        "reversed_meaning": "Reversed, the Lovers warn of misalignment — between you and a partner, between your stated values and your behavior, or between head and heart. Trust may be fraying through small dishonesties, or you may be avoiding a decision that demands clarity. Reconnect with what you actually want, not what you've been told to want.",
        "description": "A naked man and woman stand in a paradise, separated by a flowing stream. Above them, an angel with red wings (Raphael) spreads its arms in blessing, framed by sun and cloud. Behind the woman grows the tree of knowledge with its serpent; behind the man, the tree of life with twelve flames.",
        "symbolism": "The angel Raphael — whose name means 'God heals' — blesses the union from above, signifying that conscious love is a healing force. The tree of knowledge (behind the woman) and tree of life (behind the man) recall Eden and represent the choice between innocence and wisdom that every committed relationship requires. The figures' nakedness is vulnerability without shame: love demands being fully seen.",
    },
    {
        "name": "The Star", "number": 17, "arcana": "Major", "element": "Air",
        "image_emoji": "⭐",
        "image_url": f"{WIKI_BASE}/d/db/RWS_Tarot_17_Star.jpg",
        "keywords_upright": ["hope", "inspiration", "renewal", "serenity", "spiritual guidance", "healing", "faith restored"],
        "keywords_reversed": ["despair", "lack of faith", "discouragement", "hopelessness", "creative drought", "disconnection from purpose"],
        "upright_meaning": "The Star arrives after the storm — she is the soft, certain light that returns when you thought it was gone. Drawing this card is a promise: you are being guided, healing is underway, and the long night has not been wasted. Trust the slow miracle. Pour what you have back into the world; there is more where it came from.",
        "reversed_meaning": "Reversed, the Star reveals that hope has dimmed and the inner light feels far away. You may be exhausted from giving without replenishment, or so focused on what went wrong that you can no longer see what is gently rising. Faith is not lost — it is buried under fatigue. Stop, rest, and remember why you started.",
        "description": "A nude woman kneels at the edge of a pool, one foot in the water and one on the land. She pours water from two jugs — one back into the pool, one onto the earth. Above her, one large eight-pointed star and seven smaller stars shine in a clear night sky. A bird perches on the tree behind her.",
        "symbolism": "Her nakedness signifies that, after the upheaval of the preceding Tower card, all pretense has fallen away. The water poured into the pool returns to the source (the subconscious); the water poured on land nourishes outer life — a perfect balance of inner and outer giving. The eight-pointed star represents Venus or the eternal soul; the seven smaller stars are the chakras now realigned. The single foot in the water signifies one foot in intuition, one in the world.",
    },
    {
        "name": "The Moon", "number": 18, "arcana": "Major", "element": "Water",
        "image_emoji": "🌕",
        "image_url": f"{WIKI_BASE}/7/7f/RWS_Tarot_18_Moon.jpg",
        "keywords_upright": ["illusion", "intuition", "dreams", "subconscious", "uncertainty", "hidden fears", "psychic insight"],
        "keywords_reversed": ["confusion lifted", "clarity", "release", "truth revealed", "anxiety eased", "fears confronted"],
        "upright_meaning": "The Moon casts a beautiful, deceptive light. Things are not what they seem — and yet what stirs beneath the surface is real and worth your attention. This card asks you to walk the misty path anyway, feeling rather than seeing. Old fears, ancestral patterns, and prophetic dreams may all rise. Don't run from the howling — listen.",
        "reversed_meaning": "Reversed, the Moon signals fog beginning to clear. Truths long obscured surface; what was projected onto others is recognized as your own. Anxieties named lose their grip. There may still be discomfort in seeing clearly, but the worst of the illusion is breaking.",
        "description": "A full moon shines over a winding path that leads between two stone towers and disappears toward distant mountains. A dog and a wolf howl at the moon below. In the foreground, a crayfish crawls out of a pool, beginning the long journey of the path.",
        "symbolism": "The two towers are the gates of the conscious world — what lies beyond them is the deep unconscious. The dog represents domesticated mind; the wolf, the wild instinct — both howling at the same mystery. The crayfish emerging from the pool is the most ancient part of the psyche, beginning its slow journey upward toward awareness. The moon's face — both kind and watchful — reminds you that the path of the unconscious illuminates by reflected light, not direct truth.",
    },
    {
        "name": "The Sun", "number": 19, "arcana": "Major", "element": "Fire",
        "image_emoji": "☀️",
        "image_url": f"{WIKI_BASE}/1/17/RWS_Tarot_19_Sun.jpg",
        "keywords_upright": ["joy", "success", "vitality", "clarity", "confidence", "warmth", "celebration"],
        "keywords_reversed": ["temporary gloom", "delayed success", "overoptimism", "ego inflation", "burnout", "loss of enthusiasm"],
        "upright_meaning": "The Sun is the most unambiguous yes in the deck — clarity, vitality, the warmth of being fully yourself in the open. Drawing this card affirms that the doubt of the Moon has lifted, and what is true about you can finally be seen. Celebrate without apology, share your warmth, and let yourself be witnessed in joy.",
        "reversed_meaning": "Reversed, the Sun's brightness is dimmed — not extinguished. Success may be delayed, optimism may be papering over real concerns, or you may be performing happiness rather than feeling it. Alternatively, ego can outshine substance: too much certainty, not enough humility. Step into actual sunlight, not the idea of it.",
        "description": "A radiant sun with a serene face shines high above a stone wall lined with sunflowers. A naked child sits on a white horse, arms outstretched, holding a red banner aloft. The child is crowned with a wreath and a single red feather.",
        "symbolism": "The sun's anthropomorphic face symbolizes divine consciousness witnessing creation with joy. The white horse stands for purity, strength, and innocence harnessed; the child rides without saddle or fear. The red feather is the same feather worn by the Fool — a sign that innocence has matured into embodied truth without losing its spark. The sunflowers turn toward the child, suggesting that life itself reorients toward your authentic light when you stop hiding it.",
    },
    {
        "name": "The World", "number": 21, "arcana": "Major", "element": "Earth",
        "image_emoji": "🌍",
        "image_url": f"{WIKI_BASE}/f/ff/RWS_Tarot_21_World.jpg",
        "keywords_upright": ["completion", "wholeness", "achievement", "integration", "fulfillment", "travel", "graduation"],
        "keywords_reversed": ["incompletion", "loose ends", "shortcuts", "stagnation", "unfinished business", "fear of closure"],
        "upright_meaning": "The World marks the completion of a major cycle — the long journey of the Fool has reached its triumphant close. Drawing this card affirms that something significant has come full circle: integration achieved, lesson absorbed, mastery earned. Celebrate the wholeness, then notice the small gap in the wreath — every ending is also a doorway into the next, larger spiral.",
        "reversed_meaning": "Reversed, the World suggests you are circling near completion but resisting the final step — fear of what comes next, attachment to the journey itself, or skipping the closure that would let you fully claim what you've built. Tie the loose ends. Acknowledge what you've achieved. Then the next door can open.",
        "description": "A dancing figure floats inside an oval wreath of green laurel, draped with a violet sash and holding two wands. In the four corners of the card appear an angel, an eagle, a bull, and a lion — the four fixed signs of the zodiac and the four evangelists.",
        "symbolism": "The dancing figure (often considered hermaphroditic) represents integrated wholeness — masculine and feminine, light and shadow, conscious and unconscious unified at last. The laurel wreath is the victor's crown, but it is open at the top and bottom, marking that completion is also a portal. The four creatures at the corners — angel (Aquarius), eagle (Scorpio), bull (Taurus), lion (Leo) — anchor the four elements and seasons, signifying mastery across every domain of life. The two wands echo the Magician's tool: what began with potential ends in realized power.",
    },
    {
        "name": "The Hierophant", "number": 5, "arcana": "Major", "element": "Earth",
        "image_emoji": "⛪",
        "image_url": f"{WIKI_BASE}/8/8d/RWS_Tarot_05_Hierophant.jpg",
        "keywords_upright": ["tradition", "spiritual teacher", "conformity", "doctrine", "ritual", "institutions", "mentorship"],
        "keywords_reversed": ["rebellion", "unconventional", "breaking tradition", "personal beliefs", "freedom", "dogma rejected"],
        "upright_meaning": "The Hierophant is the keeper of established wisdom — religion, mentorship, marriage, school, the tested paths that came before you. Drawing this card invites you to learn from tradition rather than reinvent the wheel: find a teacher, join a community, accept a rite of passage. There is power in being part of something older than yourself.",
        "reversed_meaning": "Reversed, the Hierophant signals time to step outside the institution — to question doctrine, leave the orthodox path, or trust your own spiritual authority. Inherited rules may have become cages; what was once meaningful ritual has hollowed into performance. Listen to the part of you that won't kneel.",
        "description": "A robed religious figure crowned with a triple tiara sits between two stone pillars, raising one hand in blessing and holding a triple-cross staff in the other. Two tonsured monks kneel before him on a black-and-white tiled floor; crossed keys lie at his feet.",
        "symbolism": "The triple crown and triple cross represent the three worlds — physical, mental, and spiritual — over which the Hierophant claims authority. The two pillars echo the High Priestess but are now solid stone, not veiled: institutional truth replaces intuitive mystery. The crossed keys at his feet symbolize the keys to heaven held by the church, granted to seekers who follow the proper path. The kneeling monks signify discipleship — wisdom passed from teacher to student through humility.",
    },
    {
        "name": "The Chariot", "number": 7, "arcana": "Major", "element": "Water",
        "image_emoji": "🛺",
        "image_url": f"{WIKI_BASE}/9/9b/RWS_Tarot_07_Chariot.jpg",
        "keywords_upright": ["willpower", "victory", "control", "determination", "focus", "direction", "ambition"],
        "keywords_reversed": ["loss of control", "lack of direction", "aggression", "scattered effort", "self-doubt", "obstacles"],
        "upright_meaning": "The Chariot is harnessed will — opposing forces yoked together and driven toward a single goal through sheer determination. Drawing this card promises victory through focus, not luck. The trick is steering: keep your eyes ahead, hold the reins of conflicting impulses, and refuse distraction. You can do this, but only if you choose direction.",
        "reversed_meaning": "Reversed, the Chariot signals lost direction. The sphinxes pull opposite ways; the driver flails the reins without effect. Ambition becomes aggression, momentum becomes recklessness, or the engine simply stalls. Stop, name what you actually want, and re-yoke your inner forces before pushing again.",
        "description": "An armored warrior stands in a stone chariot pulled by two sphinxes — one black, one white. The driver wears a crown of stars, a square breastplate, and holds a wand. Above the chariot hangs a starry canopy; the chariot itself bears a winged solar disc and lunar symbols.",
        "symbolism": "The black and white sphinxes embody opposing forces — light and shadow, conscious and unconscious — that the charioteer must yoke together to move forward. The crown of stars connects the driver to higher purpose; the square breastplate anchors will to earth. The winged solar disc represents the soul's flight protected by divine will. Notably, the driver holds no reins — control comes through inner focus, not external coercion.",
    },
    {
        "name": "Strength", "number": 8, "arcana": "Major", "element": "Fire",
        "image_emoji": "🦁",
        "image_url": f"{WIKI_BASE}/f/f5/RWS_Tarot_08_Strength.jpg",
        "keywords_upright": ["inner strength", "courage", "patience", "compassion", "self-mastery", "gentle power", "endurance"],
        "keywords_reversed": ["self-doubt", "weakness", "raw force", "impatience", "insecurity", "loss of nerve"],
        "upright_meaning": "Strength is power tempered by love. A woman calmly closes the jaws of a lion not by force but by presence — she has tamed the wild within. Drawing this card affirms you have more inner resilience than you realize, and that the gentlest, most patient approach will succeed where brute effort fails. Tame, don't suppress.",
        "reversed_meaning": "Reversed, Strength reveals self-doubt eating away at confidence, or impulsive force masquerading as courage. You may be running from your wild nature instead of befriending it, or pushing through with white-knuckled effort instead of patient mastery. Soften, then continue.",
        "description": "A serene woman in a flowing white gown gently holds the jaws of a great lion. She wears a crown of flowers and the lemniscate (infinity symbol) hovers above her head. Distant mountains rise behind her under a warm sky.",
        "symbolism": "The lion represents primal instinct, passion, and shadow — not to be slain but befriended. The woman's hands rest lightly on its jaws: control through presence, not violence. The lemniscate above her echoes the Magician's mark of infinite consciousness — she draws on the same source but channels it through compassion. The crown of flowers signifies victory earned through gentleness; her white robes, purity of intent that disarms aggression.",
    },
    {
        "name": "The Hermit", "number": 9, "arcana": "Major", "element": "Earth",
        "image_emoji": "🏮",
        "image_url": f"{WIKI_BASE}/4/4d/RWS_Tarot_09_Hermit.jpg",
        "keywords_upright": ["introspection", "solitude", "inner guidance", "wisdom", "soul-searching", "withdrawal", "spiritual seeking"],
        "keywords_reversed": ["isolation", "loneliness", "withdrawal from others", "rejection of guidance", "paranoia", "lost in thought"],
        "upright_meaning": "The Hermit climbs alone with a lamp — the only light is the one he carries. Drawing this card calls you to step back from noise, retreat into yourself, and listen to the wisdom that surfaces only in silence. Solitude here is not loneliness; it's the deliberate cultivation of inner light that will later guide others.",
        "reversed_meaning": "Reversed, the Hermit warns that solitude has soured into isolation — withdrawal that no longer nourishes, only walls you off. Alternatively, you may be refusing genuine wisdom available to you, drowning out the inner voice with distraction or surrounding yourself with people to avoid being alone with yourself.",
        "description": "A cloaked elder stands atop a snow-capped mountain, holding a lit lantern in one hand and a tall staff in the other. His head is bowed, his beard long. The lantern contains a six-pointed star (Seal of Solomon).",
        "symbolism": "The mountaintop represents spiritual achievement and the high vantage that solitude provides. The lantern's six-pointed star — the Seal of Solomon — symbolizes the union of opposites and the inner light that guides without external sources. The Hermit's staff is the same one the Fool carried, now used for steady support rather than youthful adventure. His grey cloak hides him from worldly attention, signifying detachment from ego and embrace of the soul's quieter work.",
    },
    {
        "name": "Wheel of Fortune", "number": 10, "arcana": "Major", "element": "Fire",
        "image_emoji": "🎡",
        "image_url": f"{WIKI_BASE}/3/3c/RWS_Tarot_10_Wheel_of_Fortune.jpg",
        "keywords_upright": ["cycles", "turning point", "fate", "luck", "destiny", "change", "synchronicity"],
        "keywords_reversed": ["bad luck", "resistance to change", "stuck cycle", "external locus of control", "delays", "unwelcome shift"],
        "upright_meaning": "The Wheel turns. What rose will fall; what fell will rise. Drawing this card heralds a pivot point — circumstances shift, fortune favors a new direction, a cycle long-running closes. Cooperate with the turning rather than resisting; the wheel does not stop because you grip it.",
        "reversed_meaning": "Reversed, the Wheel suggests resistance to natural change, or a stuck pattern where you keep meeting the same lesson. Bad luck may seem to dog you, but more often the same wheel is grinding because you haven't learned what this turn was meant to teach. Surrender, learn, move.",
        "description": "A great wheel floats in the clouds, marked with mystical letters (TARO/ROTA/TORA) and the Hebrew name of God. A sphinx sits atop the wheel holding a sword; a snake descends one side, while Anubis (jackal-headed) rises on the other. In the four corners are an angel, an eagle, a bull, and a lion, all reading books.",
        "symbolism": "The wheel itself is the cycle of life, fortune, and karma — eternally turning whether you grip it or not. The letters TARO/ROTA can be rearranged to spell either, marking the deck as a wheel of revolving wisdom. The sphinx with the sword keeps balance at the top; Anubis represents the rise out of the underworld, the snake the descent. The four creatures in the corners are the same as on The World — masters of the elements who study the changing cycles rather than fearing them.",
    },
    {
        "name": "Justice", "number": 11, "arcana": "Major", "element": "Air",
        "image_emoji": "⚖️",
        "image_url": f"{WIKI_BASE}/e/e0/RWS_Tarot_11_Justice.jpg",
        "keywords_upright": ["fairness", "truth", "accountability", "cause and effect", "balance", "legal matters", "honesty"],
        "keywords_reversed": ["injustice", "dishonesty", "lack of accountability", "denial", "bias", "consequences avoided"],
        "upright_meaning": "Justice holds the scales and the sword. Drawing this card affirms that truth and consequence are working in your favor — but only if you have acted with integrity. Decisions, rulings, and contracts come into focus; expect outcomes that match what you have actually sown. Tell the whole truth, even to yourself.",
        "reversed_meaning": "Reversed, Justice signals imbalance — accountability dodged, truth shaded, consequences postponed but not erased. You or someone in your situation is avoiding the honest reckoning. Bias, denial, or unfair treatment may be at play. The scales will rebalance; the only question is whether by choice or by force.",
        "description": "A crowned figure sits on a stone throne between two pillars, holding upright a double-edged sword in one hand and balanced scales in the other. They wear a red robe and a small square crown. A purple veil hangs behind them.",
        "symbolism": "The sword represents truth that cuts cleanly through deception — double-edged because honesty wounds both ways. The scales weigh intention against action, evidence against testimony, mercy against accountability. The crown's square shape signifies ordered thought; the single visible foot beneath the robe shows Justice is grounded in earthly reality, not abstract ideal. The purple veil behind them hides the deeper mystery: ultimate truth is more than human courts can hold.",
    },
    {
        "name": "The Hanged Man", "number": 12, "arcana": "Major", "element": "Water",
        "image_emoji": "🙃",
        "image_url": f"{WIKI_BASE}/2/2b/RWS_Tarot_12_Hanged_Man.jpg",
        "keywords_upright": ["surrender", "new perspective", "pause", "letting go", "sacrifice", "suspension", "enlightenment"],
        "keywords_reversed": ["stalling", "indecision", "resistance", "martyrdom", "delay", "missed insight"],
        "upright_meaning": "The Hanged Man is suspended — willingly, peacefully — and sees the world upside-down. Drawing this card invites surrender, not defeat. Stop pushing. Let things unfold from a new angle. The pause that feels like waste is actually the only position from which the next insight can arrive.",
        "reversed_meaning": "Reversed, the Hanged Man shows stalling masquerading as surrender — refusing to act, refusing to decide, indefinitely delaying the very pause that should yield insight. Alternatively, martyrdom: sacrificing without purpose, suffering for show. Get down from the tree, or actually hang there and learn.",
        "description": "A serene young man hangs upside-down from a T-shaped wooden cross (a living tree) by one foot. His other leg is bent into a figure-four. His hands are bound behind his back. A radiant halo surrounds his head; his face is calm, even faintly smiling.",
        "symbolism": "The willing suspension — hands bound, but the face peaceful — signals that real surrender is chosen, not imposed. The halo marks this as a state of illumination, not punishment. The figure-four leg position is alchemical, signifying the inversion of normal consciousness. The living tree cross suggests that growth comes from being still in the right place, not from constant motion. Sometimes the only way to see clearly is to let the familiar world hang upside-down.",
    },
    {
        "name": "Death", "number": 13, "arcana": "Major", "element": "Water",
        "image_emoji": "💀",
        "image_url": f"{WIKI_BASE}/d/d7/RWS_Tarot_13_Death.jpg",
        "keywords_upright": ["endings", "transformation", "transition", "release", "metamorphosis", "rebirth", "letting go"],
        "keywords_reversed": ["resistance to change", "stagnation", "fear of endings", "clinging", "incomplete transformation", "delayed renewal"],
        "upright_meaning": "Death is the great clearing — what no longer serves must end so what is alive can grow. Drawing this card is almost never literal; it marks the necessary close of a chapter, identity, relationship, or way of being. Mourn what's leaving, then welcome what the empty space allows. Rebirth is on the other side.",
        "reversed_meaning": "Reversed, Death reveals resistance to a transformation that is already underway. You may be clinging to a chapter clearly ending, fearing the void, or refusing to grieve what's gone. The change still happens; the only choice is whether to fight or flow. Let go.",
        "description": "A skeletal figure in black armor rides a white horse across a barren field, carrying a black banner adorned with a white rose. A fallen king lies on the ground; a child, a maiden, and a bishop approach the rider. In the distance, the sun rises between two towers.",
        "symbolism": "The white horse signifies the purity of necessary change — Death rides not in anger but as a natural force. The black armor and banner reflect mourning, the rose on the banner is the rose of renewal — endings always contain the seed of what comes next. The fallen king and varied figures show that transformation comes for everyone regardless of station. The rising sun between the towers (echoing The Moon) is the dawn after the dark passage: rebirth is already inevitable.",
    },
    {
        "name": "Temperance", "number": 14, "arcana": "Major", "element": "Fire",
        "image_emoji": "🍷",
        "image_url": f"{WIKI_BASE}/f/f8/RWS_Tarot_14_Temperance.jpg",
        "keywords_upright": ["balance", "moderation", "patience", "blending", "alchemy", "harmony", "calibration"],
        "keywords_reversed": ["imbalance", "excess", "impatience", "discord", "rushing", "extremes"],
        "upright_meaning": "Temperance is the slow alchemy of mixing opposites until something new and golden emerges. Drawing this card invites measured patience: blend, don't force; calibrate, don't decide all at once. The art is in the proportion. Take what is fiery, take what is watery, and pour them between vessels until they become medicine.",
        "reversed_meaning": "Reversed, Temperance signals lost calibration — extremes, excess, impatience, the spilling of effort because you tried to pour too fast. The medicine becomes poison when proportions break. Pause, restore measured pace, and return to the slow art.",
        "description": "An angel with red wings stands with one foot in a pool of water and the other on dry land, pouring water between two golden cups in a continuous arc that defies physics. Iris flowers grow at the water's edge; a path winds toward distant mountains crowned by a radiant sun.",
        "symbolism": "The angel's two-footed stance — one in water (the subconscious), one on land (conscious life) — embodies perfect calibration between inner and outer. The impossible flow between cups is alchemical: real transformation happens between containers, in the act of pouring itself. The triangle on the angel's chest in a square frames spirit within matter. The path to the sunlit mountains promises that this patient blending leads to true illumination, but only by walking, never sprinting.",
    },
    {
        "name": "The Devil", "number": 15, "arcana": "Major", "element": "Earth",
        "image_emoji": "😈",
        "image_url": f"{WIKI_BASE}/5/55/RWS_Tarot_15_Devil.jpg",
        "keywords_upright": ["addiction", "attachment", "shadow", "materialism", "bondage", "obsession", "unhealthy patterns"],
        "keywords_reversed": ["breaking free", "reclaiming power", "releasing addiction", "awareness", "detachment", "escape"],
        "upright_meaning": "The Devil shows what enslaves you — addiction, obsession, material attachment, the relationship or pattern you keep returning to even when you know better. Drawing this card holds up a mirror: the chains around the figures' necks are loose enough to slip off. You are bound by what you choose to keep believing. Name the chain.",
        "reversed_meaning": "Reversed, the Devil signals the chain being recognized — and broken. An addiction is named, an unhealthy pattern walked away from, a shadow integrated rather than projected. Power once given away is reclaimed. The work is not complete — old hooks still tug — but the cage door is open.",
        "description": "A horned, bat-winged demon perches on a black pedestal, raising one clawed hand in a mock blessing and holding a torch downward in the other. Below him, a naked man and woman are chained to the pedestal — but the chains around their necks are loose enough to lift off. Both figures have small horns and tails of their own.",
        "symbolism": "The Devil is the shadow we've made into a god — addiction, obsession, the comforting story that we are powerless. The loose chains are the central message: bondage is consensual once awareness arrives. The figures' small horns and tails show how we grow to resemble what we worship. The inverted torch is illumination twisted to serve the dark — using light to find more shadow rather than to dispel it. This card never condemns; it reveals.",
    },
    {
        "name": "The Tower", "number": 16, "arcana": "Major", "element": "Fire",
        "image_emoji": "🗼",
        "image_url": f"{WIKI_BASE}/5/53/RWS_Tarot_16_Tower.jpg",
        "keywords_upright": ["sudden upheaval", "revelation", "collapse of falsehood", "shock", "awakening", "breakdown", "liberation"],
        "keywords_reversed": ["averted disaster", "fear of change", "delayed reckoning", "inner upheaval", "near miss", "warning unheeded"],
        "upright_meaning": "The Tower falls — a structure built on a false foundation cannot stand once lightning strikes. Drawing this card heralds sudden, often shocking revelation that topples what couldn't survive truth anyway. It feels catastrophic in the moment; in retrospect it is liberation. What is real cannot be destroyed by lightning. Let the false fall.",
        "reversed_meaning": "Reversed, the Tower's blow is softened — averted disaster, postponed reckoning, or the lightning falling internally rather than externally. You may sense the cracks and act before collapse, or you may be delaying an honest reckoning that only grows more costly. Acknowledge the lightning before it strikes.",
        "description": "A tall stone tower is struck by lightning and burns at the top, its crown blown off. Two figures plunge from the broken windows, falling head-down toward the ground far below. Drops shaped like the Hebrew letter Yod fall from the sky around them.",
        "symbolism": "The crown blowing off the tower represents the collapse of false authority and ego-built structures. The lightning is divine truth — sudden, undeniable, indifferent to whether you were ready. The falling figures are not punished; they are freed from a tower that was always going to fall. The Yod-drops in the air are sparks of divine fire scattered by the strike: even in catastrophe, illumination is being seeded. After the Tower comes the Star.",
    },
    {
        "name": "Judgement", "number": 20, "arcana": "Major", "element": "Fire",
        "image_emoji": "📯",
        "image_url": f"{WIKI_BASE}/d/dd/RWS_Tarot_20_Judgement.jpg",
        "keywords_upright": ["awakening", "rebirth", "calling", "reckoning", "absolution", "second chance", "inner awakening"],
        "keywords_reversed": ["self-doubt", "ignoring the call", "harsh self-judgement", "missed opportunity", "regret", "stagnation"],
        "upright_meaning": "Judgement is the trumpet that wakes you. Drawing this card marks an awakening — a call to rise above an old version of yourself, answer a purpose long whispered, or finally forgive what you've been carrying. It is reckoning as resurrection, not condemnation. Listen. Stand up. Step into the larger life that has been waiting.",
        "reversed_meaning": "Reversed, Judgement reveals a call ignored or self-judgement turned cruel. You may be refusing to rise from an old grave, mistaking harshness for accountability, or doubting an inner summons because it would change too much. The trumpet keeps sounding. Stop arguing with it.",
        "description": "An angel (Gabriel) blows a great trumpet adorned with a red cross banner amid clouds. Below, men, women, and children rise from open coffins floating on grey water, arms raised in welcome. Distant mountains complete the horizon.",
        "symbolism": "The trumpet is the unmistakable call — once heard it cannot be unheard. The opened coffins represent old selves and finished chapters: you do not have to be who you were. The figures rising with arms raised are not commanded but answering willingly — Judgement is invitation, not coercion. The red cross banner symbolizes resurrection through love rather than fear. The grey water beneath the coffins is the dissolved past: nothing real is lost in this rising.",
    },
]


CUSTOM_QUIZ_BY_NAME = {
    "The Fool": [
        {
            "question": "You've been offered a job in a city you've never visited. The Fool appears in your reading. What is its core message to you?",
            "options": [
                "Wait for more certainty before saying yes",
                "Begin with an open heart, even though the outcome is unknown",
                "Refuse — the unknown is too risky",
                "Demand a detailed plan before moving",
            ],
            "correct_index": 1,
            "explanation": "The Fool is the energy of trusting the leap. It doesn't mean ignoring risk — it means stepping forward without demanding the journey be mapped in advance.",
        },
        {
            "question": "Which scenario most clearly shows the Fool REVERSED?",
            "options": [
                "Starting a new creative project with thoughtful research",
                "Quitting a stable job impulsively without any backup plan or savings",
                "Pausing to reflect before a major decision",
                "Listening to your inner voice before acting",
            ],
            "correct_index": 1,
            "explanation": "Reversed Fool is recklessness — openness curdled into refusing to plan or learn from past mistakes. Healthy beginnings still respect basic preparation.",
        },
        {
            "question": "The Fool carries only a small satchel. What does this most powerfully symbolize?",
            "options": [
                "Poverty and being unprepared",
                "That past wisdom is carried lightly — not as heavy baggage",
                "Forgetfulness about what to pack",
                "Inability to commit to a journey",
            ],
            "correct_index": 1,
            "explanation": "The small bag suggests the Fool brings what is essential from past lives but is not weighed down by the past. Wisdom travels light.",
        },
    ],
    "The Magician": [
        {
            "question": "You feel stuck on a project. The Magician appears upright. What is the most accurate reading?",
            "options": [
                "Wait — the universe will provide everything you need eventually",
                "You already have all the tools you need; focus your will and act",
                "Find someone more skilled to take it over",
                "The project is doomed; choose a new one",
            ],
            "correct_index": 1,
            "explanation": "The Magician's central teaching is that the four suits on his altar represent the elements already in your hands. He is conscious creation through focused action.",
        },
        {
            "question": "Which behavior is the clearest warning sign of the Magician REVERSED?",
            "options": [
                "Practicing a skill quietly and patiently",
                "Charismatically pitching a vision while privately knowing the numbers don't work",
                "Asking for honest feedback on your work",
                "Refining a craft over years",
            ],
            "correct_index": 1,
            "explanation": "Reversed Magician is power misused — charisma deployed to obscure truth, talent used to manipulate rather than manifest. The gift becomes a con.",
        },
        {
            "question": "The Magician points one hand to the sky and one to the earth. What esoteric principle does this gesture express?",
            "options": [
                "Indecision between two paths",
                "'As above, so below' — inner intention shapes outer form",
                "Praying for help from higher powers",
                "Balancing on uncertain ground",
            ],
            "correct_index": 1,
            "explanation": "The dual gesture channels divine inspiration into manifest reality. It is the core hermetic principle the Magician embodies.",
        },
    ],
    "The High Priestess": [
        {
            "question": "You face a decision and have done thorough research, but something still feels off. The High Priestess appears. What does she counsel?",
            "options": [
                "Do more research until logic provides a clear answer",
                "Pause, listen inward, and trust what you sense beneath the data",
                "Ask everyone in your life what they think",
                "Pick the option with the most concrete evidence",
            ],
            "correct_index": 1,
            "explanation": "The Priestess teaches that some answers arrive through stillness, dreams, and felt knowing — not more analysis. She rules the space logic cannot reach.",
        },
        {
            "question": "Which situation BEST reflects the High Priestess REVERSED?",
            "options": [
                "Journaling regularly to track inner shifts",
                "Numbing yourself with distractions whenever a gut feeling arises",
                "Sleeping on a decision before responding",
                "Asking a therapist to help process a dream",
            ],
            "correct_index": 1,
            "explanation": "Reversed, the Priestess shows severed contact with intuition — drowning the inner voice in noise, scrolling, or relentless logic. The pool stays still because you refuse to look.",
        },
        {
            "question": "The Priestess sits between a black and white pillar. What threshold do they mark?",
            "options": [
                "The border between two countries",
                "The threshold between conscious and unconscious worlds",
                "The line between good and evil people",
                "Past and future timelines",
            ],
            "correct_index": 1,
            "explanation": "The pillars (Boaz and Jachin) represent duality — known and unknown, light and shadow — and the Priestess guards the passage between them.",
        },
    ],
    "The Empress": [
        {
            "question": "You feel creatively dry and physically depleted. The Empress appears upright. What is her core invitation?",
            "options": [
                "Push harder — discipline will break the block",
                "Slow down, nourish yourself, and create from a full vessel",
                "Compare your work to others to find inspiration",
                "Abandon the project entirely",
            ],
            "correct_index": 1,
            "explanation": "The Empress creates through abundance, not force. She insists that pleasure, rest, and sensual nourishment are prerequisites — not detours — to real creative flow.",
        },
        {
            "question": "Which behavior most clearly signals the Empress REVERSED?",
            "options": [
                "Cooking yourself a meal you actually enjoy",
                "Giving so much to others you've stopped tending to your own body",
                "Tending a houseplant",
                "Buying flowers for yourself",
            ],
            "correct_index": 1,
            "explanation": "Reversed Empress is the smothering caretaker — overgiving until self-care is abandoned, leading to burnout and creative shutdown. Care must include yourself.",
        },
        {
            "question": "The Empress wears a crown of twelve stars. What do they most likely represent?",
            "options": [
                "Twelve children she has raised",
                "The twelve zodiac signs and natural cycles she presides over",
                "The twelve apostles",
                "Twelve years of training",
            ],
            "correct_index": 1,
            "explanation": "The twelve stars connect her to the zodiac and the rhythms of the natural year — the cycles of growth, fruit, and rest that she embodies.",
        },
    ],
    "The Emperor": [
        {
            "question": "Your team is failing because no one knows who is responsible for what. The Emperor appears upright. What does he urge?",
            "options": [
                "Let things sort themselves out organically",
                "Establish clear structure, roles, and boundaries — lead from grounded authority",
                "Replace everyone immediately",
                "Become more emotionally available to bond with the team",
            ],
            "correct_index": 1,
            "explanation": "The Emperor's gift is order. He teaches that clear structure, ownership, and benevolent command are forms of care — they make ambiguity safe to navigate.",
        },
        {
            "question": "Which behavior is the clearest sign of the Emperor REVERSED?",
            "options": [
                "Listening to feedback before adjusting a plan",
                "Insisting on the rules even when reality has obviously changed",
                "Delegating responsibility to a capable team member",
                "Setting healthy boundaries with a colleague",
            ],
            "correct_index": 1,
            "explanation": "Reversed Emperor is rigidity — structure becomes tyranny when it can no longer adapt. Authority frozen into stubbornness loses its protective purpose.",
        },
        {
            "question": "The Emperor's throne is carved with rams. Which zodiac sign and quality does this connect him to?",
            "options": [
                "Cancer — nurturing emotion",
                "Aries — pioneering, initiating fire",
                "Pisces — dreamy intuition",
                "Libra — diplomatic balance",
            ],
            "correct_index": 1,
            "explanation": "The ram is Aries, the first sign of the zodiac — initiating fire, courage, and the will to begin and build. The Emperor channels this drive into stable rule.",
        },
    ],
    "The Lovers": [
        {
            "question": "You're considering a major partnership (romantic or business). The Lovers appears upright. What does the card emphasize most?",
            "options": [
                "Physical attraction is the only thing that matters",
                "Align the choice with your true values — conscious commitment matters more than chemistry",
                "Avoid commitment to stay free",
                "Wait until you feel zero doubt",
            ],
            "correct_index": 1,
            "explanation": "The Lovers represent meaningful union AND the conscious choice to sustain it. The card is fundamentally about values-aligned commitment, not just feeling.",
        },
        {
            "question": "Which scenario most clearly reflects the Lovers REVERSED?",
            "options": [
                "Having a difficult honest conversation with a partner",
                "Acting kindly in public while privately resenting the relationship",
                "Choosing time alone to reflect on what you want",
                "Saying no to a relationship that doesn't fit",
            ],
            "correct_index": 1,
            "explanation": "Reversed Lovers signal misalignment — between values and behavior, between what you say and what you do. Small dishonesties fray the bond.",
        },
        {
            "question": "An angel blesses the figures from above. What does this presence signify?",
            "options": [
                "The relationship is approved by religious authorities",
                "Conscious love is itself a healing, spiritual force",
                "An external rescuer will save the relationship",
                "Romance is doomed without divine luck",
            ],
            "correct_index": 1,
            "explanation": "The angel (Raphael, 'God heals') represents that true union — entered consciously — is a spiritual and healing act, not merely a contract.",
        },
    ],
    "The Star": [
        {
            "question": "You've just come through a difficult period and feel fragile. The Star appears upright. What is its central message?",
            "options": [
                "More hardship is on the way; stay defensive",
                "Healing is underway; trust the slow restoration of hope",
                "You should have prevented the difficulty",
                "Avoid all risk for the next year",
            ],
            "correct_index": 1,
            "explanation": "The Star follows the Tower's upheaval. Her teaching is that quiet restoration has begun — hope returns gently, and what feels fragile is actually new growth.",
        },
        {
            "question": "Which situation BEST reflects the Star REVERSED?",
            "options": [
                "Taking a rest day after a hard week",
                "Believing things will never improve, no matter what you do",
                "Asking for help when overwhelmed",
                "Lowering your expectations realistically",
            ],
            "correct_index": 1,
            "explanation": "Reversed Star is the loss of hope — faith buried under fatigue. Not 'cautious realism' but the inner light feeling extinguished.",
        },
        {
            "question": "The Star pours water both into the pool and onto the land. What does this dual gesture symbolize?",
            "options": [
                "Wasted effort flowing in two directions",
                "A perfect balance between nourishing inner life (the subconscious) and outer life (the world)",
                "She's confused about where to pour",
                "Wasting resources by spreading them too thin",
            ],
            "correct_index": 1,
            "explanation": "Water into the pool returns to the subconscious source; water on land nourishes outer life. Together they show generosity that doesn't deplete because it's circular.",
        },
    ],
    "The Moon": [
        {
            "question": "You feel anxious about a relationship but can't pinpoint why. The Moon appears upright. What does it advise?",
            "options": [
                "Ignore the feeling — it's irrational",
                "The vague unease is real intuition; listen to it without demanding immediate clarity",
                "Confront the other person aggressively",
                "Look at the surface story; the truth is obvious",
            ],
            "correct_index": 1,
            "explanation": "The Moon teaches that uneasy intuition deserves attention, even before logic can explain it. Walk the misty path; clarity comes through staying present, not running.",
        },
        {
            "question": "Which scenario most clearly reflects the Moon REVERSED?",
            "options": [
                "A long-held fear is finally named and loses its grip",
                "Your dreams become more cryptic and unsettling",
                "You doubt your own instincts more than usual",
                "You see hidden threats everywhere",
            ],
            "correct_index": 0,
            "explanation": "Reversed Moon signals the fog clearing — illusions named, anxieties confronted, projections recognized. The mist lifts.",
        },
        {
            "question": "A crayfish emerges from the pool in the foreground. What does this most powerfully represent?",
            "options": [
                "An unrelated decorative detail",
                "The most ancient part of the psyche beginning its slow rise toward awareness",
                "Danger lurking in the water",
                "A failed metamorphosis",
            ],
            "correct_index": 1,
            "explanation": "The crayfish is the primitive unconscious — instinct, memory, old self — beginning the long journey upward through the moonlit path of awareness.",
        },
    ],
    "The Sun": [
        {
            "question": "After a long, foggy chapter, the Sun appears upright in your reading. What is its central affirmation?",
            "options": [
                "Stay cautious — the brightness won't last",
                "Clarity has returned; let yourself be seen and celebrate without apology",
                "Hide your success to avoid envy",
                "Don't trust the good feeling",
            ],
            "correct_index": 1,
            "explanation": "The Sun is the most unambiguous yes in the deck. After the Moon's confusion, this card affirms truth has returned and joy can be expressed openly.",
        },
        {
            "question": "Which behavior is the clearest sign of the Sun REVERSED?",
            "options": [
                "Genuinely enjoying a quiet accomplishment",
                "Performing happiness on social media while privately exhausted",
                "Celebrating a friend's win",
                "Resting after success",
            ],
            "correct_index": 1,
            "explanation": "Reversed Sun is dimmed brightness — performing joy rather than feeling it, or papering over real concerns with forced optimism.",
        },
        {
            "question": "The child on the Sun card wears the same red feather the Fool wore. What does this connection mean?",
            "options": [
                "It's a coincidence in the artwork",
                "Innocence has matured into embodied truth without losing its spark",
                "The child is the Fool's younger sibling",
                "Red is just the artist's favorite color",
            ],
            "correct_index": 1,
            "explanation": "The shared red feather links the Sun's child to the Fool's beginning — but here innocence has been seasoned by the whole journey. Wholeness is innocence regained on the other side of experience.",
        },
    ],
    "The World": [
        {
            "question": "You've just finished a major life chapter. The World appears upright. What is its essential message?",
            "options": [
                "There is nothing more to accomplish; rest forever",
                "A real cycle has closed — acknowledge the wholeness before the next, larger spiral opens",
                "Start a brand new chapter immediately without reflection",
                "Your achievement was a coincidence",
            ],
            "correct_index": 1,
            "explanation": "The World marks genuine completion AND the doorway to the next spiral. The card insists on honoring closure — wholeness is the threshold to what's next.",
        },
        {
            "question": "Which situation most clearly reflects the World REVERSED?",
            "options": [
                "Completing a project thoroughly and celebrating it",
                "Almost finishing a project but always finding 'one more thing' to avoid closure",
                "Knowing when a chapter has truly ended",
                "Reflecting on lessons learned",
            ],
            "correct_index": 1,
            "explanation": "Reversed World is the avoidance of completion — circling near the end but refusing to step through. Loose ends become a strategy to avoid the unknown that follows.",
        },
        {
            "question": "The figure dances inside a wreath that is open at top and bottom. What does this opening signify?",
            "options": [
                "A flaw in the artist's design",
                "Every completion is also a portal — wholeness includes the next beginning",
                "The wreath is unfinished",
                "An escape route from the dance",
            ],
            "correct_index": 1,
            "explanation": "The gaps in the wreath remind you that every cycle's end is also a door. Completion is not stagnation — it is the threshold to a larger spiral.",
        },
    ],
}


def make_lesson_for_card(card: dict, order: int) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "card_id": card['id'],
        "order": order,
        "title": f"Lesson {order + 1} · {card['name']}",
        "intro": f"Discover {card['name']}",
        "subtitle": f"A card of {', '.join(card['keywords_upright'][:2])}",
        "sections": [
            {"heading": "Imagery & Symbolism", "body": card['description'] + "\n\n" + card['symbolism']},
            {"heading": "Upright Meaning", "body": card['upright_meaning']},
            {"heading": "Reversed Meaning", "body": card['reversed_meaning']},
            {"heading": "Keywords to Remember", "body": "Upright: " + ", ".join(card['keywords_upright']) + "\n\nReversed: " + ", ".join(card['keywords_reversed'])},
        ],
        "xp_reward": 25,
    }


def make_quiz_for_card(card: dict, lesson_id: str, other_cards: List[dict] = None) -> dict:
    qs = CUSTOM_QUIZ_BY_NAME.get(card['name'])
    others = other_cards or []
    # Pre-compute reusable pools of "other" data
    other_names = [c['name'] for c in others if c['id'] != card['id']]
    other_kw_up_all: List[str] = []
    other_kw_rev_all: List[str] = []
    for c in others:
        if c['id'] == card['id']:
            continue
        for kw in c.get('keywords_upright', []):
            if kw not in card['keywords_upright'] and kw not in other_kw_up_all:
                other_kw_up_all.append(kw)
        for kw in c.get('keywords_reversed', []):
            if kw not in card['keywords_reversed'] and kw not in other_kw_rev_all:
                other_kw_rev_all.append(kw)

    # Rotating pseudo-random pick without needing `random` (deterministic per card)
    seed = sum(ord(x) for x in card['name'])
    def pick(pool: List[str], n: int, offset: int = 0) -> List[str]:
        if not pool:
            return []
        out = []
        for i in range(min(n, len(pool))):
            out.append(pool[(seed + offset + i * 7) % len(pool)])
        # dedupe while preserving order
        seen = set(); dedup = []
        for x in out:
            if x not in seen:
                seen.add(x); dedup.append(x)
        # top up if dedupe shrunk it
        i = 0
        while len(dedup) < n and i < len(pool):
            if pool[i] not in seen:
                dedup.append(pool[i]); seen.add(pool[i])
            i += 1
        return dedup[:n]

    if qs:
        questions = [{"id": str(uuid.uuid4()), "question_type": "mcq", **q} for q in qs]
        # Augment with 2 image-based & 1 reversed-detect question for richer play
        extras = []
        name_opts = sorted([card['name']] + pick(other_names, 3, 1))
        extras.append({
            "id": str(uuid.uuid4()),
            "question_type": "match_image",
            "question": "Which card is shown in the image?",
            "options": name_opts,
            "correct_index": name_opts.index(card['name']),
            "explanation": f"This is {card['name']}.",
            "image_url": card.get('image_url'),
        })
        # Reversed detection: alternate correct answer by seed parity
        is_reversed = (seed % 2 == 1)
        prompt_kws = card['keywords_reversed'] if is_reversed else card['keywords_upright']
        r_opts = ["Upright", "Reversed"]
        extras.append({
            "id": str(uuid.uuid4()),
            "question_type": "reversed_detect",
            "question": f"The keywords {', '.join(prompt_kws[:3])} describe which orientation of {card['name']}?",
            "options": r_opts,
            "correct_index": 1 if is_reversed else 0,
            "explanation": f"These keywords match the {'reversed' if is_reversed else 'upright'} meaning of {card['name']}.",
        })
        # Keyword pick — 4-option keyword grid
        correct_kw = card['keywords_upright'][0]
        wrong_kws = pick(other_kw_up_all, 3, 2)
        kw_opts = sorted(list(dict.fromkeys([correct_kw] + wrong_kws)))[:4]
        while len(kw_opts) < 4 and other_kw_up_all:
            for k in other_kw_up_all:
                if k not in kw_opts:
                    kw_opts.append(k); break
            if len(kw_opts) >= 4:
                break
        kw_opts = sorted(kw_opts[:4])
        extras.append({
            "id": str(uuid.uuid4()),
            "question_type": "keyword_pick",
            "question": f"Which keyword best captures {card['name']} (upright)?",
            "options": kw_opts,
            "correct_index": kw_opts.index(correct_kw) if correct_kw in kw_opts else 0,
            "explanation": f"{card['name']} centers on '{correct_kw}'.",
        })
        questions = questions + extras
    else:
        # Auto-generate 5 diverse questions from card data for cards without hand-crafted quiz
        picked_names = pick(other_names, 3, 0)
        correct_kw = card['keywords_upright'][0] if card.get('keywords_upright') else card['name']
        wrong_up = pick(other_kw_up_all, 3, 1)
        correct_rev = card['keywords_reversed'][0] if card.get('keywords_reversed') else 'imbalance'
        wrong_rev = pick(other_kw_rev_all, 3, 2)

        opts_kw_up = sorted(list(dict.fromkeys([correct_kw] + wrong_up)))
        opts_kw_rev = sorted(list(dict.fromkeys([correct_rev] + wrong_rev)))
        opts_name = sorted(list(dict.fromkeys([card['name']] + picked_names)))
        snippet = card.get('upright_meaning', '').split('.')[0]
        is_reversed = (seed % 2 == 1)
        prompt_kws = card.get('keywords_reversed', []) if is_reversed else card.get('keywords_upright', [])

        questions = [
            {"id": str(uuid.uuid4()), "question_type": "match_image",
             "question": "Which card is shown in the image?",
             "options": opts_name,
             "correct_index": opts_name.index(card['name']),
             "explanation": f"This is {card['name']}.",
             "image_url": card.get('image_url')},
            {"id": str(uuid.uuid4()), "question_type": "keyword_pick",
             "question": f"Which keyword best captures {card['name']} (upright)?",
             "options": opts_kw_up,
             "correct_index": opts_kw_up.index(correct_kw),
             "explanation": f"{card['name']} centers on '{correct_kw}'."},
            {"id": str(uuid.uuid4()), "question_type": "keyword_pick",
             "question": f"Which keyword arises when {card['name']} is reversed?",
             "options": opts_kw_rev,
             "correct_index": opts_kw_rev.index(correct_rev),
             "explanation": f"Reversed, {card['name']} evokes '{correct_rev}'."},
            {"id": str(uuid.uuid4()), "question_type": "match_meaning",
             "question": f"Which card matches this teaching: \"{snippet}.\"?",
             "options": opts_name,
             "correct_index": opts_name.index(card['name']),
             "explanation": f"This describes {card['name']}."},
            {"id": str(uuid.uuid4()), "question_type": "reversed_detect",
             "question": f"The keywords {', '.join(prompt_kws[:3])} describe which orientation of {card['name']}?",
             "options": ["Upright", "Reversed"],
             "correct_index": 1 if is_reversed else 0,
             "explanation": f"These keywords match the {'reversed' if is_reversed else 'upright'} meaning."},
        ]

    return {"id": str(uuid.uuid4()), "lesson_id": lesson_id, "questions": questions}


@app.on_event("startup")
async def seed_data():
    # Extend WIKI_SOURCES with 56 Minor Arcana entries (name -> (url, filename))
    for _m in build_seed_entries():
        WIKI_SOURCES[_m['name']] = (_m['image_url'], _m['_slug'])

    # Always ensure images are downloaded locally (independent of seed version)
    download_card_images()

    meta = await db.meta.find_one({"_id": "seed"}) or {}
    current = meta.get("version", 0)
    if current >= SEED_VERSION:
        await _repoint_card_images()
        await db.meta.update_one({"_id": "seed"}, {"$set": {"version": SEED_VERSION}}, upsert=True)
        return
    logger.info(f"Seed version {current} -> {SEED_VERSION}; re-seeding...")
    await db.cards.delete_many({})
    await db.lessons.delete_many({})
    await db.quizzes.delete_many({})
    await db.users.update_many({}, {"$set": {"completed_lessons": []}})

    # Combine Major + Minor arcana
    all_cards_raw = list(SEED_CARDS)
    for _m in build_seed_entries():
        entry = {k: v for k, v in _m.items() if not k.startswith("_")}
        entry["image_url"] = f"/api/static/cards/{_m['_slug']}"
        all_cards_raw.append(entry)

    seeded_cards = []
    for c in all_cards_raw:
        doc = {**c, "id": str(uuid.uuid4())}
        slug_pair = WIKI_SOURCES.get(doc['name'])
        if slug_pair:
            doc['image_url'] = f"/api/static/cards/{slug_pair[1]}"
        doc.setdefault('suit', None)
        await db.cards.insert_one(doc)
        doc.pop('_id', None)
        seeded_cards.append(doc)

    for idx, card in enumerate(seeded_cards):
        lesson = make_lesson_for_card(card, idx)
        await db.lessons.insert_one(lesson)
        lesson.pop('_id', None)
        quiz = make_quiz_for_card(card, lesson['id'], seeded_cards)
        await db.quizzes.insert_one(quiz)

    await db.meta.update_one({"_id": "seed"}, {"$set": {"version": SEED_VERSION}}, upsert=True)
    logger.info(f"Re-seed complete ({len(seeded_cards)} cards).")


async def _repoint_card_images():
    """Update existing cards' image_url to use local static path."""
    async for c in db.cards.find({}, {"_id": 0, "id": 1, "name": 1, "image_url": 1}):
        slug_pair = WIKI_SOURCES.get(c.get('name'))
        if not slug_pair:
            continue
        desired = f"/api/static/cards/{slug_pair[1]}"
        if c.get('image_url') != desired:
            await db.cards.update_one({"id": c['id']}, {"$set": {"image_url": desired}})


@api_router.get("/")
async def root():
    return {"message": "Mystic Tarot API", "status": "ok"}


app.include_router(api_router)

class CachedStaticFiles(StaticFiles):
    """Serve cards with long-lived immutable cache so the mobile Image cache
    doesn't refetch them across sessions."""
    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        resp.headers["Cache-Control"] = "public, max-age=2592000, immutable"
        return resp

app.mount("/api/static/cards", CachedStaticFiles(directory=str(STATIC_CARDS_DIR)), name="static_cards")

# Downloadable project archives (source-code export). Files placed in this
# folder are publicly accessible via /api/downloads/<filename>.
DOWNLOADS_DIR = ROOT_DIR / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)
app.mount("/api/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
