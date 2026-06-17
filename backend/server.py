from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone, date
import bcrypt
import jwt as pyjwt


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config
JWT_SECRET = os.environ.get('JWT_SECRET', 'mystic-tarot-secret-key-change-me')
JWT_ALG = 'HS256'
JWT_EXPIRE_DAYS = 30

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


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
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class TarotCard(BaseModel):
    id: str
    name: str
    number: int
    arcana: str
    keywords_upright: List[str]
    keywords_reversed: List[str]
    upright_meaning: str
    reversed_meaning: str
    description: str
    image_emoji: str  # display symbol
    element: str

class Lesson(BaseModel):
    id: str
    card_id: str
    order: int
    title: str
    intro: str
    sections: List[dict]  # {heading, body}
    xp_reward: int

class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str

class Quiz(BaseModel):
    id: str
    lesson_id: str
    questions: List[QuizQuestion]

class QuizSubmission(BaseModel):
    lesson_id: str
    answers: List[int]  # selected index per question
    hearts_lost: int

class QuizResult(BaseModel):
    correct: int
    total: int
    xp_earned: int
    new_xp: int
    new_level: int
    new_hearts: int
    new_streak: int
    lesson_completed: bool


# ===== AUTH HELPERS =====
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        'iat': datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

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
        id=user['id'],
        email=user['email'],
        name=user['name'],
        xp=user.get('xp', 0),
        level=user.get('level', 1),
        hearts=user.get('hearts', 5),
        streak=user.get('streak', 0),
        last_active_date=user.get('last_active_date'),
        completed_lessons=user.get('completed_lessons', []),
        created_at=user.get('created_at', ''),
    )


def xp_to_level(xp: int) -> int:
    # Level 1: 0xp, Level 2: 100, Level 3: 250, Level 4: 450, Level 5: 700, then +300 each
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
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": req.name.strip() or "Seeker",
        "password_hash": hash_password(req.password),
        "xp": 0,
        "level": 1,
        "hearts": 5,
        "streak": 0,
        "last_active_date": None,
        "completed_lessons": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    user_doc.pop('_id', None)
    token = create_token(user_id)
    return AuthResponse(token=token, user=user_to_out(user_doc))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginReq):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(req.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user['id'])
    return AuthResponse(token=token, user=user_to_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)


# ===== TAROT CARDS =====
@api_router.get("/cards", response_model=List[TarotCard])
async def list_cards():
    cards = await db.cards.find({}, {"_id": 0}).sort("number", 1).to_list(100)
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
class QuizPublic(BaseModel):
    id: str
    lesson_id: str
    questions: List[dict]  # without correct_index for public

@api_router.get("/quizzes/{lesson_id}")
async def get_quiz(lesson_id: str, user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    public_qs = [
        {"id": q['id'], "question": q['question'], "options": q['options']}
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
    completed_lessons = list(user.get('completed_lessons', []))
    lesson_completed = sub.lesson_id in completed_lessons

    if passed:
        base_xp = lesson.get('xp_reward', 20)
        # Bonus for perfect
        if correct == total:
            base_xp += 10
        xp_earned = base_xp
        if sub.lesson_id not in completed_lessons:
            completed_lessons.append(sub.lesson_id)
            lesson_completed = True

    new_xp = user.get('xp', 0) + xp_earned
    new_level = xp_to_level(new_xp)

    # Hearts
    current_hearts = user.get('hearts', 5)
    new_hearts = max(0, current_hearts - max(0, sub.hearts_lost))

    # Streak
    today = date.today().isoformat()
    last_active = user.get('last_active_date')
    current_streak = user.get('streak', 0)
    new_streak = current_streak
    if passed:
        if last_active == today:
            pass  # already counted today
        elif last_active is None:
            new_streak = 1
        else:
            try:
                last_dt = date.fromisoformat(last_active)
                delta_days = (date.today() - last_dt).days
                if delta_days == 1:
                    new_streak = current_streak + 1
                elif delta_days == 0:
                    pass
                else:
                    new_streak = 1
            except Exception:
                new_streak = 1

    update = {
        "xp": new_xp,
        "level": new_level,
        "hearts": new_hearts,
        "streak": new_streak,
        "completed_lessons": completed_lessons,
    }
    if passed:
        update["last_active_date"] = today

    await db.users.update_one({"id": user['id']}, {"$set": update})

    return QuizResult(
        correct=correct,
        total=total,
        xp_earned=xp_earned,
        new_xp=new_xp,
        new_level=new_level,
        new_hearts=new_hearts,
        new_streak=new_streak,
        lesson_completed=lesson_completed,
    )


# ===== HEARTS REFILL (every quiz attempt entry) =====
@api_router.post("/users/refill-hearts")
async def refill_hearts(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user['id']}, {"$set": {"hearts": 5}})
    return {"hearts": 5}


# ===== PROGRESS =====
@api_router.get("/users/progress")
async def progress(user: dict = Depends(get_current_user)):
    total_lessons = await db.lessons.count_documents({})
    completed = len(user.get('completed_lessons', []))
    xp = user.get('xp', 0)
    level = user.get('level', 1)
    # next level threshold
    thresholds = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]
    next_threshold = thresholds[min(level, len(thresholds) - 1)] if level < len(thresholds) else thresholds[-1] + 300
    current_threshold = thresholds[level - 1] if level - 1 < len(thresholds) else thresholds[-1]
    return {
        "xp": xp,
        "level": level,
        "current_level_xp": current_threshold,
        "next_level_xp": next_threshold,
        "hearts": user.get('hearts', 5),
        "streak": user.get('streak', 0),
        "completed_lessons": completed,
        "total_lessons": total_lessons,
        "completion_pct": round((completed / total_lessons) * 100) if total_lessons else 0,
        "completed_lesson_ids": user.get('completed_lessons', []),
    }


# ===== SEED =====
SEED_CARDS = [
    {
        "name": "The Fool", "number": 0, "arcana": "Major", "element": "Air",
        "keywords_upright": ["beginnings", "innocence", "spontaneity"],
        "keywords_reversed": ["recklessness", "naivety", "risk"],
        "upright_meaning": "The Fool represents new beginnings, having faith in the future, being inexperienced, not knowing what to expect, and embracing the unknown with optimism.",
        "reversed_meaning": "Reversed, the Fool warns of recklessness, foolish risks, holding back, and a fear of the unknown.",
        "description": "A young figure stands at the edge of a cliff, ready to step into the unknown with only a small bag of belongings.",
        "image_emoji": "🃏",
    },
    {
        "name": "The Magician", "number": 1, "arcana": "Major", "element": "Air",
        "keywords_upright": ["manifestation", "willpower", "skill"],
        "keywords_reversed": ["manipulation", "untapped talent", "illusion"],
        "upright_meaning": "The Magician channels universal energies to manifest goals through skill, focus, and the four elements of the suits.",
        "reversed_meaning": "Reversed, it suggests manipulation, poor planning, or hidden talents that go unused.",
        "description": "A figure stands with one hand pointing up and the other down, surrounded by symbols of the four suits.",
        "image_emoji": "🪄",
    },
    {
        "name": "The High Priestess", "number": 2, "arcana": "Major", "element": "Water",
        "keywords_upright": ["intuition", "mystery", "subconscious"],
        "keywords_reversed": ["secrets", "withdrawal", "disconnection"],
        "upright_meaning": "The High Priestess invites you to listen to intuition and explore the inner world of the subconscious.",
        "reversed_meaning": "Reversed, it warns of ignoring intuition or being out of touch with your inner self.",
        "description": "A serene woman seated between two pillars, holding a scroll of sacred knowledge.",
        "image_emoji": "🌙",
    },
    {
        "name": "The Empress", "number": 3, "arcana": "Major", "element": "Earth",
        "keywords_upright": ["abundance", "nurturing", "fertility"],
        "keywords_reversed": ["dependence", "smothering", "creative block"],
        "upright_meaning": "The Empress symbolizes nurturing, abundance, creativity, and a deep connection to nature.",
        "reversed_meaning": "Reversed, it can mean creative block, neglect, or overbearing care.",
        "description": "A radiant figure crowned with stars, surrounded by lush nature.",
        "image_emoji": "👑",
    },
    {
        "name": "The Emperor", "number": 4, "arcana": "Major", "element": "Fire",
        "keywords_upright": ["authority", "structure", "stability"],
        "keywords_reversed": ["tyranny", "rigidity", "loss of control"],
        "upright_meaning": "The Emperor represents structure, leadership, and the establishment of order and authority.",
        "reversed_meaning": "Reversed, it warns of domineering control or weakness in leadership.",
        "description": "A regal figure seated on a stone throne adorned with rams.",
        "image_emoji": "⚜️",
    },
    {
        "name": "The Lovers", "number": 6, "arcana": "Major", "element": "Air",
        "keywords_upright": ["love", "harmony", "choices"],
        "keywords_reversed": ["disharmony", "imbalance", "misalignment"],
        "upright_meaning": "The Lovers symbolize meaningful connection, choices guided by values, and unity of opposites.",
        "reversed_meaning": "Reversed, it signals conflict, broken trust, or misaligned values.",
        "description": "Two figures stand beneath an angel, representing a union blessed from above.",
        "image_emoji": "💞",
    },
    {
        "name": "The Star", "number": 17, "arcana": "Major", "element": "Air",
        "keywords_upright": ["hope", "inspiration", "renewal"],
        "keywords_reversed": ["despair", "lack of faith", "discouragement"],
        "upright_meaning": "The Star brings hope, healing, and a renewed sense of purpose after difficult times.",
        "reversed_meaning": "Reversed, it can signal hopelessness or lost faith.",
        "description": "A figure pours water into a pool beneath a sky bright with stars.",
        "image_emoji": "⭐",
    },
    {
        "name": "The Moon", "number": 18, "arcana": "Major", "element": "Water",
        "keywords_upright": ["illusion", "intuition", "dreams"],
        "keywords_reversed": ["confusion lifted", "clarity", "release"],
        "upright_meaning": "The Moon represents the subconscious, intuition, and the navigation of illusions and fears.",
        "reversed_meaning": "Reversed, hidden truths come to light and confusion fades.",
        "description": "A moon shines over a winding path between two towers, a dog and wolf howling below.",
        "image_emoji": "🌕",
    },
    {
        "name": "The Sun", "number": 19, "arcana": "Major", "element": "Fire",
        "keywords_upright": ["joy", "success", "vitality"],
        "keywords_reversed": ["temporary gloom", "overoptimism", "delays"],
        "upright_meaning": "The Sun radiates vitality, positivity, and the joy of being fully present in your own light.",
        "reversed_meaning": "Reversed, it suggests temporary clouds over your happiness or delays in success.",
        "description": "A radiant sun shines over a child riding a white horse in a garden of sunflowers.",
        "image_emoji": "☀️",
    },
    {
        "name": "The World", "number": 21, "arcana": "Major", "element": "Earth",
        "keywords_upright": ["completion", "wholeness", "achievement"],
        "keywords_reversed": ["incompletion", "loose ends", "shortcuts"],
        "upright_meaning": "The World marks the completion of a cycle — wholeness, integration, and triumphant accomplishment.",
        "reversed_meaning": "Reversed, it indicates unfinished business or seeking shortcuts to completion.",
        "description": "A dancing figure floats in a wreath surrounded by four creatures of the elements.",
        "image_emoji": "🌍",
    },
]


def make_lesson_for_card(card: dict, order: int) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "card_id": card['id'],
        "order": order,
        "title": f"{card['name']} — Lesson {order + 1}",
        "intro": f"Discover {card['name']}, a card of {', '.join(card['keywords_upright'][:2])}.",
        "sections": [
            {"heading": "The Imagery", "body": card['description']},
            {"heading": "Upright Meaning", "body": card['upright_meaning']},
            {"heading": "Reversed Meaning", "body": card['reversed_meaning']},
            {"heading": "Keywords", "body": "Upright: " + ", ".join(card['keywords_upright']) + "  •  Reversed: " + ", ".join(card['keywords_reversed'])},
        ],
        "xp_reward": 20,
    }


def make_quiz_for_card(card: dict, lesson_id: str, other_cards: List[dict]) -> dict:
    # 3 questions per quiz
    # q1: keyword identification
    correct_kw = card['keywords_upright'][0]
    distractors = []
    for oc in other_cards:
        if oc['id'] != card['id']:
            for kw in oc['keywords_upright']:
                if kw not in card['keywords_upright'] and kw not in distractors:
                    distractors.append(kw)
                    break
        if len(distractors) >= 3:
            break
    opts1 = [correct_kw] + distractors[:3]
    # shuffle deterministically by sort
    opts1_sorted = sorted(opts1)
    correct1 = opts1_sorted.index(correct_kw)

    # q2: identify card by description
    correct_name = card['name']
    name_distractors = [oc['name'] for oc in other_cards if oc['id'] != card['id']][:3]
    opts2 = [correct_name] + name_distractors
    opts2_sorted = sorted(opts2)
    correct2 = opts2_sorted.index(correct_name)
    snippet = card['upright_meaning'].split('.')[0]

    # q3: reversed meaning keyword
    correct_rev = card['keywords_reversed'][0]
    rev_distractors = []
    for oc in other_cards:
        if oc['id'] != card['id']:
            for kw in oc['keywords_reversed']:
                if kw not in card['keywords_reversed'] and kw not in rev_distractors:
                    rev_distractors.append(kw)
                    break
        if len(rev_distractors) >= 3:
            break
    opts3 = [correct_rev] + rev_distractors[:3]
    opts3_sorted = sorted(opts3)
    correct3 = opts3_sorted.index(correct_rev)

    return {
        "id": str(uuid.uuid4()),
        "lesson_id": lesson_id,
        "questions": [
            {
                "id": str(uuid.uuid4()),
                "question": f"Which keyword best represents {card['name']} (upright)?",
                "options": opts1_sorted,
                "correct_index": correct1,
                "explanation": f"{card['name']} is strongly associated with '{correct_kw}'.",
            },
            {
                "id": str(uuid.uuid4()),
                "question": f"Which card matches this meaning: \"{snippet}.\"?",
                "options": opts2_sorted,
                "correct_index": correct2,
                "explanation": f"This describes {card['name']}.",
            },
            {
                "id": str(uuid.uuid4()),
                "question": f"What does {card['name']} suggest when reversed?",
                "options": opts3_sorted,
                "correct_index": correct3,
                "explanation": f"Reversed, {card['name']} evokes '{correct_rev}'.",
            },
        ],
    }


@app.on_event("startup")
async def seed_data():
    count = await db.cards.count_documents({})
    if count > 0:
        return
    logger.info("Seeding tarot cards, lessons, quizzes...")
    seeded_cards = []
    for c in SEED_CARDS:
        doc = {**c, "id": str(uuid.uuid4())}
        await db.cards.insert_one(doc)
        doc.pop('_id', None)
        seeded_cards.append(doc)

    for idx, card in enumerate(seeded_cards):
        lesson = make_lesson_for_card(card, idx)
        await db.lessons.insert_one(lesson)
        lesson.pop('_id', None)
        quiz = make_quiz_for_card(card, lesson['id'], seeded_cards)
        await db.quizzes.insert_one(quiz)
    logger.info("Seed complete.")


@api_router.get("/")
async def root():
    return {"message": "Mystic Tarot API", "status": "ok"}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
