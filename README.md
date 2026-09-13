# Setu — Academia–Industry Collaboration Portal

Setu connects students with industry internships using **explainable, skill-based matching**: students build a verified skill profile, and every internship match comes with a score, coverage ratio, and per-skill have/need breakdown.

## Tech stack

- **Frontend:** React 19 + Vite (SPA, custom CSS)
- **Backend:** Node.js + Express 5
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (bcrypt password hashing, role-based access: student / industry)

## Project structure

```text
.freebuff/
  backend/
    server.js              Express app + DB connection + auto-seed
    controllers/           auth, assessment, postings
    models/                User, StudentProfile, Posting, Application
    data/store.js          Data access layer (all Mongoose queries)
    data/db.js             Mongo connection helper
    utils/seed.js          Idempotent demo seed (npm run seed)
    utils/matchingEngine.js  Weighted skill-match scoring
    scripts/smoke-test.js  Behavioral test: boots real server, asserts 36 checks
  client/
    src/App.jsx            Landing page + role dashboards
    src/App.css            Styling (responsive, desktop-first cap at 1240px)
```

## Run locally

Requirements: Node 18+, and a MongoDB instance (local `mongod` or a free [Atlas](https://www.mongodb.com/atlas) cluster).

```bash
# 1. Backend
cd .freebuff/backend
npm install
cp .env.example .env        # set MONGO_URI if not using localhost:27017
npm run dev                 # connects, seeds demo data, serves on :5000

# 2. Frontend (new terminal)
cd .freebuff/client
npm install
npm run dev                 # serves on :5175, proxies /api to :5000
```

### Demo accounts (auto-seeded)

| Role | Email | Password |
|---|---|---|
| Student | `student@setu.dev` | `password123` |
| Industry | `industry@setu.dev` | `password123` |

## Tests

The backend has a behavioral smoke test that spins up an **in-memory MongoDB**, boots the real server twice, and asserts the full API lifecycle — auth, assessment saves + history snapshots, exact match-score math, role guards, and restart persistence:

```bash
cd .freebuff/backend
npm test                    # 36 assertions, exits non-zero on failure
```

## API overview

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Register (student or industry) |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/assessment/me` | JWT | Get own skill profile |
| POST | `/api/assessment/submit` | JWT | Save skill assessment (snapshots history) |
| GET | `/api/postings/all` | JWT | All open postings |
| GET | `/api/postings/mine` | Industry | Own postings |
| POST | `/api/postings/create` | Industry | Create posting |
| GET | `/api/postings/matches` | Student | Ranked matches with score math |

