# Habit Quest — Gamified Habit Tracker

Habit Quest is a dark, neon RPG-style daily habit tracker with local accounts and a global leaderboard.

## Features

- Username, password, gender, and birthdate signup with strict 13+ validation.
- Required warning: account recovery is not possible; forgotten passwords cannot be retrieved.
- Fixed daily targets: Working Out, School/Studying/Job, Brushing Teeth, Hydration, and Showering.
- Custom daily targets, +10 EXP per completed target, level-up every 100 EXP.
- Daily completion state resets automatically when the date changes.
- Public leaderboard sorted by level, then total EXP, with the current player highlighted.
- Responsive cyberpunk UI, progress bar, level-up feedback, and neon palette.

## Stack

Node.js + Express backend, vanilla HTML/CSS/JavaScript frontend, JSON persistence, and Node `crypto.scrypt` password hashing.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm start
```

Open http://localhost:3000. The server creates `data.json` on first use; it is ignored by Git because it contains local account data.

Use `npm run dev` for Node's watch mode. This is a self-hosted educational app. A production deployment should add HTTPS, sessions or signed tokens, rate limiting, CSRF protection, and a real database.

