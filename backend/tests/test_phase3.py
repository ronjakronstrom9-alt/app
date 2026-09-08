"""Phase 3 additions: 6-question quiz variants, achievements, streak bonus, perfect flag."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def new_user(session):
    email = f"test_p3_{uuid.uuid4().hex[:8]}@mystic.app"
    payload = {"email": email, "password": "mystic123", "name": "TEST_P3"}
    r = session.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email}


@pytest.fixture()
def auth_headers(new_user):
    return {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}


# ---------- Quiz: 6 questions with variants ----------
class TestQuizVariants:
    def test_quiz_has_6_questions_with_types(self, session, auth_headers):
        lessons = session.get(f"{API}/lessons").json()
        r = session.get(f"{API}/quizzes/{lessons[0]['id']}", headers=auth_headers)
        assert r.status_code == 200, r.text
        quiz = r.json()
        qs = quiz["questions"]
        assert len(qs) == 6, f"expected 6 questions, got {len(qs)}"
        types = {q.get("question_type") for q in qs}
        # Must include at least one non-mcq type
        non_mcq = [t for t in types if t and t != "mcq"]
        assert non_mcq, f"expected at least one non-mcq question type, got {types}"
        # match_image type must include image_url
        image_qs = [q for q in qs if q.get("question_type") == "match_image"]
        for q in image_qs:
            assert q.get("image_url"), "match_image question missing image_url"
        # Correct index must never leak
        for q in qs:
            assert "correct_index" not in q
            assert "options" in q and len(q["options"]) >= 2


# ---------- Achievements ----------
class TestAchievements:
    def test_achievements_endpoint(self, session, auth_headers):
        r = session.get(f"{API}/achievements", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] == 15, f"expected 15 achievements, got {data['total']}"
        assert isinstance(data["unlocked"], int)
        assert len(data["items"]) == 15
        first = data["items"][0]
        for k in ("id", "title", "description", "icon", "category", "target",
                  "progress", "unlocked", "pct"):
            assert k in first, f"missing key {k}"
        # New user should have unlocked=0
        assert data["unlocked"] == 0

    def test_achievements_requires_auth(self, session):
        r = session.get(f"{API}/achievements")
        assert r.status_code in (401, 403)


# ---------- Quiz submission: perfect + achievements + streak bonus ----------
class TestQuizSubmitPhase3:
    def _fetch_correct_answers(self, session, auth_headers, lesson_id):
        """Fetch quiz + inspect DB via server admin? No — we brute-force by
        trying each combination is expensive. Instead we use the fact that we
        can submit answers and check `correct` count. For perfect submit, we
        need real correct indices. Since correct_index is hidden, we submit
        each single-option variant and pick the one that scored best.
        For simplicity: iterate answer[i] over range(len(options)) for each q,
        submitting minimal test submissions is wasteful. Instead we bruteforce
        per-question with independent submissions -- but that mutates state.

        Approach: try [0]*6 first. If not perfect, incrementally try higher
        indices for wrong questions. But server updates XP/streak on every
        submit... We use a fresh user for each submit? Too many users.

        Practical approach: read from DB directly via a helper endpoint if
        exists; else use option scan against a *single* known question at a
        time via multiple fresh users. To keep runtime low, we accept that
        without direct DB access we CAN'T guarantee perfect. So we test
        perfect via crafted answers by scanning options per index on
        SEPARATE fresh users, then combining."""
        return None

    def test_submit_response_has_new_fields(self, session, auth_headers):
        lessons = session.get(f"{API}/lessons").json()
        lesson_id = lessons[0]["id"]
        quiz = session.get(f"{API}/quizzes/{lesson_id}", headers=auth_headers).json()
        n = len(quiz["questions"])
        r = session.post(f"{API}/quizzes/submit", headers=auth_headers, json={
            "lesson_id": lesson_id, "answers": [0] * n, "hearts_lost": 0,
        })
        assert r.status_code == 200, r.text
        res = r.json()
        for k in ("correct", "total", "xp_earned", "xp_streak_bonus",
                  "new_xp", "new_level", "new_hearts", "new_streak",
                  "lesson_completed", "perfect", "achievements_unlocked"):
            assert k in res, f"missing key: {k}"
        assert isinstance(res["achievements_unlocked"], list)
        assert isinstance(res["perfect"], bool)
        assert isinstance(res["xp_streak_bonus"], int)
        # First day: streak bonus should be 0 (streak becomes 1, tier starts at 3)
        assert res["xp_streak_bonus"] == 0, f"expected 0 streak bonus on first day, got {res['xp_streak_bonus']}"

    def test_perfect_submission_unlocks_first_lesson(self, session):
        """Discover the correct answer for each question by using fresh users."""
        # Create a fresh user to keep isolation
        email = f"test_perf_{uuid.uuid4().hex[:8]}@mystic.app"
        signup = session.post(f"{API}/auth/signup", json={
            "email": email, "password": "mystic123", "name": "PERF"
        }).json()
        headers = {"Authorization": f"Bearer {signup['token']}", "Content-Type": "application/json"}

        lessons = session.get(f"{API}/lessons").json()
        lesson_id = lessons[0]["id"]
        quiz = session.get(f"{API}/quizzes/{lesson_id}", headers=headers).json()
        qs = quiz["questions"]

        # Discover correct answer per question via probe users
        correct = []
        for i, q in enumerate(qs):
            best_idx, best_flag = 0, False
            for opt_idx in range(len(q["options"])):
                probe_email = f"test_probe_{uuid.uuid4().hex[:6]}@mystic.app"
                p_signup = session.post(f"{API}/auth/signup", json={
                    "email": probe_email, "password": "mystic123", "name": "P"
                }).json()
                p_headers = {"Authorization": f"Bearer {p_signup['token']}",
                             "Content-Type": "application/json"}
                # answer for question i is opt_idx, others 0
                answers = [0] * len(qs)
                answers[i] = opt_idx
                res = session.post(f"{API}/quizzes/submit", headers=p_headers, json={
                    "lesson_id": lesson_id, "answers": answers, "hearts_lost": 0,
                }).json()
                # If this q's answer contributes, correct increments beyond baseline.
                # We need baseline: q[i]=0 gives some correct count. So we do a
                # smarter approach: probe each opt independently. Track the
                # index producing highest `correct`.
                if res["correct"] > best_flag:
                    best_flag = res["correct"]
                    best_idx = opt_idx
            correct.append(best_idx)

        # Now submit the discovered correct answers with the original user
        r = session.post(f"{API}/quizzes/submit", headers=headers, json={
            "lesson_id": lesson_id, "answers": correct, "hearts_lost": 0,
        })
        assert r.status_code == 200, r.text
        res = r.json()
        # Should be perfect
        assert res["perfect"] is True, f"expected perfect, got correct={res['correct']}/{res['total']}"
        assert res["correct"] == res["total"]
        assert res["xp_earned"] >= 25, f"xp_earned={res['xp_earned']} (expected >=25 for perfect)"
        assert res["lesson_completed"] is True
        # First lesson achievement should have unlocked
        unlocked_ids = [a["id"] for a in res["achievements_unlocked"]]
        assert "first_lesson" in unlocked_ids, f"first_lesson missing from {unlocked_ids}"
