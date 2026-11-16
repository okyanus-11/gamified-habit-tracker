const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.HABIT_DATA_FILE || path.join(__dirname, "data.json");
const sessions = new Map();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FIXED_HABITS = [
  { id: "workout", title: "Working Out", icon: "🏋️" },
  { id: "study", title: "School / Studying / Job", icon: "📚" },
  { id: "teeth", title: "Brushing Teeth", icon: "🪥" },
  { id: "water", title: "Hydration", icon: "💧" },
  { id: "shower", title: "Showering", icon: "🚿" },
];
// Bound request parsing so oversized JSON cannot exhaust memory on the small self-hosted server.app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Every account-data endpoint requires a random, in-memory bearer session.
// The client never gets to choose which account an API request modifies.
app.use("/api", (req, res, next) => {
  if (req.path === "/signup" || req.path === "/login") return next();
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") || "");
  const session = match ? sessions.get(match[1]) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (match) sessions.delete(match[1]);
    return res.status(401).json({ error: "Please log in again." });
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  // Refresh insertion order so capacity eviction is least-recently-used.
  sessions.delete(match[1]);
  sessions.set(match[1], session);
  req.authenticatedUserId = session.userId;
  next();
});

function createSession(userId) {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  // Bound memory use even if a local demo is left running for months.
  while (sessions.size >= 5000) {
    const oldest = sessions.keys().next().value;
    if (!oldest) break;
    sessions.delete(oldest);
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId, expiresAt: now + SESSION_TTL_MS });
  return token;
}
function readData() { if (!fs.existsSync(DATA_FILE)) return { users: [] }; return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function writeData(data) { const temp = `${DATA_FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`; fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 }); fs.renameSync(temp, DATA_FILE); }
function today() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, "0"); const day = String(now.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; }
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") }; }
function safeUser(user) { const { passwordHash, passwordSalt, ...publicUser } = user; return publicUser; }
function ageFrom(birthdate) { const birth = new Date(`${birthdate}T00:00:00`); if (Number.isNaN(birth.getTime())) return -1; const now = new Date(); let age = now.getFullYear() - birth.getFullYear(); const passed = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate()); return passed ? age : age - 1; }
app.post("/api/signup", (req, res) => {
  const { username, password, gender, birthdate } = req.body;
  const cleanUsername = typeof username === "string" ? username.trim() : "";
  if (!cleanUsername || cleanUsername.length > 32 || typeof password !== "string" || password.length < 6 || !gender || !birthdate) {
    return res.status(400).json({ error: "Enter a username (1–32 characters), password (at least 6 characters), gender and birthdate." });
  }
  if (ageFrom(birthdate) < 13) return res.status(400).json({ error: "You must be at least 13 years old to create an account." });
  const data = readData();
  if (data.users.some((user) => user.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return res.status(409).json({ error: "That username is already taken." });
  }
  const credentials = hashPassword(password);
  const user = { id: crypto.randomUUID(), username: cleanUsername, gender, birthdate, level: 1, exp: 0, totalExp: 0, habits: FIXED_HABITS.map((habit) => ({ ...habit, doneOn: null })), lastReset: today(), passwordHash: credentials.hash, passwordSalt: credentials.salt };
  data.users.push(user);
  writeData(data);
  const token = createSession(user.id);
  res.status(201).json({ user: safeUser(user), token });
});
app.post("/api/login", (req, res) => {
  const data = readData();
  const { username, password } = req.body;
  const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "";
  const user = data.users.find((item) => item.username.toLowerCase() === normalizedUsername);
  if (!user || typeof password !== "string") return res.status(401).json({ error: "Invalid username or password." });
  const candidate = Buffer.from(hashPassword(password, user.passwordSalt).hash, "hex");
  const stored = Buffer.from(user.passwordHash || "", "hex");
  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  if (user.lastReset !== today()) {
    user.habits.forEach((habit) => { habit.doneOn = null; });
    user.lastReset = today();
    writeData(data);
  }
  const token = createSession(user.id);
  res.json({ user: safeUser(user), token });
});
app.post("/api/habits/toggle", (req, res) => {
  const { habitId } = req.body;
  const data = readData();
  const user = data.users.find((item) => item.id === req.authenticatedUserId);
  if (!user) return res.status(404).json({ error: "User not found." });

  if (user.lastReset !== today()) {
    user.habits.forEach((item) => { item.doneOn = null; });
    user.lastReset = today();
  }

  const habit = user.habits.find((item) => item.id === habitId);
  if (!habit) return res.status(404).json({ error: "Habit not found." });

  // Make this a real toggle: completing earns 10 XP; undoing completion
  // removes the same XP and recalculates the level/progress consistently.
  const wasDone = habit.doneOn === today();
  const delta = wasDone ? -10 : 10;
  habit.doneOn = wasDone ? null : today();
  user.totalExp = Math.max(0, (Number(user.totalExp) || 0) + delta);
  user.level = Math.floor(user.totalExp / 100) + 1;
  user.exp = user.totalExp % 100;

  writeData(data);
  res.json({ user: safeUser(user), gained: delta });
});
app.post("/api/habits", (req, res) => {
  const { title } = req.body;
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!cleanTitle || cleanTitle.length > 80) return res.status(400).json({ error: "A habit title (1–80 characters) is required." });
  const data = readData();
  const user = data.users.find((item) => item.id === req.authenticatedUserId);
  if (!user) return res.status(404).json({ error: "User not found." });
  user.habits.push({ id: crypto.randomUUID(), title: cleanTitle, icon: "⚡", doneOn: null });
  writeData(data);
  res.json({ user: safeUser(user) });
});
app.post("/api/logout", (req, res) => {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") || "");
  if (match) sessions.delete(match[1]);
  res.status(204).end();
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Habit Tracker running at http://localhost:${PORT}`));
}

module.exports = { app, sessions };
