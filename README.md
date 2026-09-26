# Habit Quest — Gamified Habit Tracker

A dark, neon RPG-style daily habit tracker with local accounts, custom habits, and experience points.

## Features

- Sign up with a username, password, gender, and birthdate (13+).
- Fixed daily targets plus custom targets.
- Earn 10 EXP per completed target; level up every 100 EXP.
- Daily completion state resets when the date changes.
- Responsive cyberpunk interface with a progress bar and level-up feedback.

## Stack

Node.js, Express, vanilla HTML/CSS/JavaScript, local JSON persistence, and `crypto.scrypt` password hashing.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm start
```

Open http://localhost:3000. The server creates `data.json` on first use. That file is ignored by Git because it contains account data.

Use `npm run dev` for watch mode or `npm run desktop` to open the Electron desktop shell.

This is an educational, single-server demo. It does not implement authenticated sessions or HTTPS and should not be exposed to the public internet with real user data.
