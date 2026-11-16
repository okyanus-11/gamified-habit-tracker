# Installation

## Requirements
- Node.js 18 or newer (includes npm)
- A modern web browser

## Run locally

```bash
git clone https://github.com/okyanus-11/gamified-habit-tracker.git
cd gamified-habit-tracker
npm install
npm start
```

Open http://localhost:3000 in your browser. Stop the server with `Ctrl+C`.

For automatic server restarts while developing, use `npm run dev`. Run the test suite with `npm test`.

The server creates its local `data.json` on first run. It contains account data and is intentionally excluded from Git; back it up privately if you need to preserve local demo data.

## Optional Windows desktop build

The repository also declares an Electron wrapper:

```bash
npm install
npm run desktop
npm run dist:win
```

The portable Windows build is generated under the Electron Builder output directory. Build it on Windows.

## Important

This is an educational, single-server demo. It is not hardened for public deployment: sessions are in memory and there is no HTTPS or production-grade rate limiting. Do not expose it to the public internet or use real passwords.
