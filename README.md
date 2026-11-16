# Habit Quest — Gamified Habit Tracker

A daily habit tracker with local accounts, custom habits, experience points and
a customizable modern interface.

## Features

- Sign up with a username, password, gender and birthdate (13+).
- Fixed daily targets plus custom habits.
- Earn 10 EXP per completed target; level up every 100 EXP.
- Daily completion state resets when the date changes.
- Graphite, Midnight and Light themes, six accent presets and a custom colour
  picker. Appearance preferences are saved in the browser.
- Server-side bearer sessions protect account data; sessions expire after
  seven days of inactivity.
- Atomic JSON persistence reduces the risk of partially written account data.

## Stack

Node.js, Express, vanilla HTML/CSS/JavaScript, local JSON persistence, and
`crypto.scrypt` password hashing.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm start
```

Open http://localhost:3000. The server creates `data.json` on first use. That
file is ignored by Git because it contains account data.

This is an educational, single-server demo. Sessions are held in memory and
are invalidated when the server restarts. It does not provide HTTPS, durable
session storage or production-grade rate limiting; do not expose it publicly
or use real credentials.
