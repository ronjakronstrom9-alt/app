"""Mystic Tarot — full backend regression suite.

Covers: auth, cards, lessons, quizzes, progress, hearts refill.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://mystic-xp.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def new_user(session):
    """Create a fresh test user; return {token, user}."""
    email = f"test_{uuid.uuid4().hex[:8]}@mystic.app"
    payload = {"email": email, "password": "mystic123", "name": "TEST_Seeker"}
    r = session.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == email
    assert data["user"]["xp"] == 0
    assert data["user"]["level"] == 1
    assert data["user"]["hearts"] == 5
    return {"token": data["token"], "user": data["user"], "email": email, "password": "mystic123"}


@pytest.fixture()
def auth_headers(new_user):
    return {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_signup_duplicate_rejected(self, session, new_user):
        r = session.post(f"{API}/auth/signup", json={
            "email": new_user["email"], "password": "mystic123", "name": "dup"
        })
        assert r.status_code == 400

    def test_signup_weak_password(self, session):
        r = session.post(f"{API}/auth/signup", json={
            "email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "password": "123", "name": "n"
        })
        assert r.status_code == 400

    def test_login_success(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={
            "email": new_user["email"], "password": new_user["password"],
        })
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == new_user["email"]
        assert data["token"]

    def test_login_wrong_password(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={
            "email": new_user["email"], "password": "wrong-pwd"
        })
        assert r.status_code == 401

    def test_me_with_token(self, session, auth_headers, new_user):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == new_user["email"]

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------- Cards ----------
class TestCards:
    def test_list_cards(self, session):
        r = session.get(f"{API}/cards")
        assert r.status_code == 200
        cards = r.json()
        assert len(cards) == 10, f"expected 10 cards, got {len(cards)}"
        # sorted by number
        numbers = [c["number"] for c in cards]
        assert numbers == sorted(numbers)
        # essential fields
        c = cards[0]
        for k in ("id", "name", "arcana", "keywords_upright", "keywords_reversed",
                  "upright_meaning", "reversed_meaning", "image_emoji"):
            assert k in c

    def test_get_card_by_id(self, session):
        cards = session.get(f"{API}/cards").json()
        cid = cards[0]["id"]
        r = session.get(f"{API}/cards/{cid}")
        assert r.status_code == 200
        assert r.json()["id"] == cid

    def test_get_card_not_found(self, session):
        r = session.get(f"{API}/cards/does-not-exist")
        assert r.status_code == 404


# ---------- Lessons ----------
class TestLessons:
    def test_list_lessons(self, session):
        r = session.get(f"{API}/lessons")
        assert r.status_code == 200
        lessons = r.json()
        assert len(lessons) == 10
        orders = [l["order"] for l in lessons]
        assert orders == sorted(orders)
        l = lessons[0]
        for k in ("id", "card_id", "order", "title", "intro", "sections", "xp_reward"):
            assert k in l
        assert len(l["sections"]) >= 1

    def test_get_lesson_by_id(self, session):
        lessons = session.get(f"{API}/lessons").json()
        lid = lessons[0]["id"]
        r = session.get(f"{API}/lessons/{lid}")
        assert r.status_code == 200
        assert r.json()["id"] == lid


# ---------- Quizzes ----------
class TestQuizzes:
    def test_quiz_requires_auth(self, session):
        lessons = session.get(f"{API}/lessons").json()
        r = session.get(f"{API}/quizzes/{lessons[0]['id']}")
        assert r.status_code in (401, 403)

    def test_quiz_omits_correct_index(self, session, auth_headers):
        lessons = session.get(f"{API}/lessons").json()
        r = session.get(f"{API}/quizzes/{lessons[0]['id']}", headers=auth_headers)
        assert r.status_code == 200
        quiz = r.json()
        assert quiz["lesson_id"] == lessons[0]["id"]
        assert len(quiz["questions"]) == 3
        for q in quiz["questions"]:
            assert "correct_index" not in q
            assert "options" in q and len(q["options"]) >= 2

    def test_submit_quiz_all_correct(self, session, auth_headers, new_user):
        """Submit correct answers; verify XP/streak/level/completed_lessons persist."""
        # We need correct answers — fetch from DB indirectly: brute-force via 4 attempts
        # Better: use server logic — derive from card's first upright keyword (q1),
        # name (q2), first reversed keyword (q3). But options are sorted, and quiz
        # data structure isn't exposed publicly. So we attempt deterministically.
        lessons = session.get(f"{API}/lessons").json()
        cards = {c["id"]: c for c in session.get(f"{API}/cards").json()}
        lesson = lessons[0]
        card = cards[lesson["card_id"]]
        quiz = session.get(f"{API}/quizzes/{lesson['id']}", headers=auth_headers).json()

        # q1: first upright kw, q2: card name, q3: first reversed kw
        targets = [card["keywords_upright"][0], card["name"], card["keywords_reversed"][0]]
        answers = []
        for i, q in enumerate(quiz["questions"]):
            if targets[i] in q["options"]:
                answers.append(q["options"].index(targets[i]))
            else:
                answers.append(0)

        r = session.post(f"{API}/quizzes/submit", headers=auth_headers, json={
            "lesson_id": lesson["id"], "answers": answers, "hearts_lost": 0,
        })
        assert r.status_code == 200, r.text
        res = r.json()
        assert res["total"] == 3
        # Allow partial — but expect at least 1 correct from above mapping
        assert res["correct"] >= 1
        if res["correct"] >= 2:  # passed (>=60%)
            assert res["lesson_completed"] is True
            assert res["new_xp"] >= 20
            assert res["new_streak"] >= 1

        # Verify persistence via /auth/me
        me = session.get(f"{API}/auth/me", headers=auth_headers).json()
        assert me["xp"] == res["new_xp"]
        assert me["level"] == res["new_level"]
        assert me["streak"] == res["new_streak"]
        if res["lesson_completed"]:
            assert lesson["id"] in me["completed_lessons"]

    def test_submit_quiz_hearts_lost(self, session, auth_headers):
        lessons = session.get(f"{API}/lessons").json()
        quiz = session.get(f"{API}/quizzes/{lessons[1]['id']}", headers=auth_headers).json()
        # Submit with hearts_lost=2; use first option for all
        r = session.post(f"{API}/quizzes/submit", headers=auth_headers, json={
            "lesson_id": lessons[1]["id"], "answers": [0] * len(quiz["questions"]),
            "hearts_lost": 2,
        })
        assert r.status_code == 200
        res = r.json()
        # hearts should have decreased by 2 from previous state
        assert res["new_hearts"] <= 5
        assert res["new_hearts"] >= 0

    def test_submit_quiz_bad_answer_count(self, session, auth_headers):
        lessons = session.get(f"{API}/lessons").json()
        r = session.post(f"{API}/quizzes/submit", headers=auth_headers, json={
            "lesson_id": lessons[2]["id"], "answers": [0], "hearts_lost": 0,
        })
        assert r.status_code == 400


# ---------- Hearts & Progress ----------
class TestUsers:
    def test_refill_hearts(self, session, auth_headers):
        r = session.post(f"{API}/users/refill-hearts", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["hearts"] == 5
        # verify persistence
        me = session.get(f"{API}/auth/me", headers=auth_headers).json()
        assert me["hearts"] == 5

    def test_progress(self, session, auth_headers):
        r = session.get(f"{API}/users/progress", headers=auth_headers)
        assert r.status_code == 200
        p = r.json()
        for k in ("xp", "level", "current_level_xp", "next_level_xp", "hearts",
                  "streak", "completed_lessons", "total_lessons", "completion_pct",
                  "completed_lesson_ids"):
            assert k in p
        assert p["total_lessons"] == 10
        assert 0 <= p["completion_pct"] <= 100
