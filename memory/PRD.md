# Mystic XP — Product Requirements

## Overview
A Duolingo-style mobile learning app that teaches tarot card meanings via bite-sized lessons and quizzes.

## Tech Stack
- Frontend: Expo SDK 54, Expo Router, React Native
- Backend: FastAPI + MongoDB (Motor)
- Auth: JWT (bcrypt-hashed passwords) — custom email/password

## Features (MVP)
- Email/password signup & login (JWT)
- 10 hand-curated Major Arcana cards seeded on startup
- Lesson path with locked/unlocked nodes (Duolingo-style)
- Multi-step lesson screen (intro + sections)
- Multiple-choice quiz, 3 questions per lesson
- XP, level, daily streak, hearts/lives gamification
- Card library with upright/reversed toggle
- Progress screen (stats, level, mastery %)
- Profile screen with logout

## Design
- Deep midnight indigo (#0B081A) + gold (#D4AF37) palette
- Serif display + sans body
- Starry background, moon/star Ionicons

## Backend Endpoints (all `/api`)
- POST /auth/signup, /auth/login
- GET /auth/me
- GET /cards, /cards/{id}
- GET /lessons, /lessons/{id}
- GET /quizzes/{lesson_id} (auth) — questions without answers
- POST /quizzes/submit — returns updated XP, level, hearts, streak
- POST /users/refill-hearts
- GET /users/progress
