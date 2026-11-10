# Habit Quest — Gamified Habit Tracker

A dark, neon RPG-style daily habit tracker with local accounts, custom habits, and experience points.

## Features

- Sign up with a validated username, password, gender, and birthdate (13+).
- Authenticated, HTTP-only sessions protect private habit changes.
- Fixed daily targets plus custom targets.
- Earn 10 EXP the first time each target is completed per day; level up every 100 EXP. Completion can be toggled off without losing EXP or earning it repeatedly.
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

This is an educational, single-server demo and should not be exposed to the public internet with real user data. Set a stable, secret `AUTH_SECRET` (at least 32 random bytes) when running in production; production startup fails if it is missing. In development, a random session secret is generated at startup, so logging in again is required after a server restart. Production deployments must also terminate HTTPS so the session cookie's `Secure` attribute is honored.
