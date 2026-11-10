const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.HABIT_DATA_FILE || path.join(__dirname, "data.json");
const SESSION_COOKIE = "habit_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be set in production.");
}
if (Buffer.byteLength(AUTH_SECRET) < 32) {
  throw new Error("AUTH_SECRET must be at least 32 bytes.");
}
const FIXED_HABITS = [
  { id: "workout", title: "Working Out", icon: "🏋️" },
  { id: "study", title: "School / Studying / Job", icon: "📚" },
  { id: "teeth", title: "Brushing Teeth", icon: "🪥" },
  { id: "water", title: "Hydration", icon: "💧" },
  { id: "shower", title: "Showering", icon: "🚿" },
];

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readData() {
  if (!fs.existsSync(DATA_FILE)) return { users: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
function safeUser(user) {
  const { passwordHash, passwordSalt, ...publicUser } = user;
  return publicUser;
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function ageFrom(birthdate) {
  if (!validDate(birthdate)) return -1;
  const birth = new Date(`${birthdate}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const passed = now.getUTCMonth() > birth.getUTCMonth()
    || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!passed) age -= 1;
  return age;
}
function requestBody(req) {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
}
function signSession(userId) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function sessionUserId(req) {
  const cookie = (req.headers.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;
  const [payload, signature, extra] = cookie.slice(SESSION_COOKIE.length + 1).split(".");
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof session.userId !== "string" || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session.userId;
  } catch {
    return null;
  }
}
function setSessionCookie(res, userId) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${signSession(userId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}
function requireUser(req, res, next) {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Please log in to continue." });
  const data = readData();
  const user = data.users.find((item) => item.id === userId);
  if (!user) return res.status(401).json({ error: "Please log in to continue." });
  req.authenticatedUser = user;
  next();
}
function resetDailyHabits(user) {
  if (user.lastReset === today()) return false;
  user.habits.forEach((habit) => {
    habit.doneOn = null;
    habit.rewardedOn = null;
  });
  user.lastReset = today();
  return true;
}
function passwordHashIsValid(user) {
  return typeof user.passwordSalt === "string"
    && /^[a-f\d]{32}$/i.test(user.passwordSalt)
    && typeof user.passwordHash === "string"
    && /^[a-f\d]{128}$/i.test(user.passwordHash);
}

app.post("/api/signup", (req, res) => {
  const { username, password, gender, birthdate } = requestBody(req);
  const normalizedUsername = typeof username === "string" ? username.trim() : "";
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(normalizedUsername)) {
    return res.status(400).json({ error: "Username must be 3-24 letters, numbers, underscores, or hyphens." });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be 8-128 characters." });
  }
  if (!["Female", "Male", "Non-binary", "Prefer not to say"].includes(gender)) {
    return res.status(400).json({ error: "Select a valid gender option." });
  }
  const age = ageFrom(birthdate);
  if (age < 0) return res.status(400).json({ error: "Enter a valid birthdate." });
  if (age < 13) return res.status(400).json({ error: "You must be at least 13 years old to create an account." });

  const data = readData();
  if (data.users.some((user) => user.username.toLowerCase() === normalizedUsername.toLowerCase())) {
    return res.status(409).json({ error: "That username is already taken." });
  }
  const credentials = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username: normalizedUsername,
    gender,
    birthdate,
    level: 1,
    exp: 0,
    totalExp: 0,
    habits: FIXED_HABITS.map((habit) => ({ ...habit, doneOn: null, rewardedOn: null })),
    lastReset: today(),
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
  };
  data.users.push(user);
  writeData(data);
  setSessionCookie(res, user.id);
  res.status(201).json({ user: safeUser(user) });
});

app.post("/api/login", (req, res) => {
  const { username, password } = requestBody(req);
  if (typeof username !== "string" || typeof password !== "string" || password.length > 128) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const data = readData();
  const user = data.users.find((item) => item.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || !passwordHashIsValid(user)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const actualHash = Buffer.from(hashPassword(password, user.passwordSalt).hash, "hex");
  const expectedHash = Buffer.from(user.passwordHash, "hex");
  if (!crypto.timingSafeEqual(actualHash, expectedHash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  if (resetDailyHabits(user)) writeData(data);
  setSessionCookie(res, user.id);
  res.json({ user: safeUser(user) });
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

app.post("/api/habits/toggle", requireUser, (req, res) => {
  const { habitId } = requestBody(req);
  const data = readData();
  const user = data.users.find((item) => item.id === req.authenticatedUser.id);
  if (!user) return res.status(401).json({ error: "Please log in to continue." });
  resetDailyHabits(user);
  const habit = user.habits.find((item) => item.id === habitId);
  if (!habit) return res.status(404).json({ error: "Habit not found." });

  let gained = 0;
  if (habit.doneOn === today()) {
    habit.doneOn = null;
    habit.rewardedOn = today();
  } else {
    habit.doneOn = today();
    if (habit.rewardedOn !== today()) {
      habit.rewardedOn = today();
      gained = 10;
      user.totalExp += gained;
      user.exp += gained;
      if (user.exp >= 100) {
        user.level += Math.floor(user.exp / 100);
        user.exp %= 100;
      }
    }
  }
  writeData(data);
  res.json({ user: safeUser(user), gained });
});

app.post("/api/habits", requireUser, (req, res) => {
  const { title } = requestBody(req);
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  if (!normalizedTitle || normalizedTitle.length > 80) {
    return res.status(400).json({ error: "Habit titles must be 1-80 characters." });
  }
  const data = readData();
  const user = data.users.find((item) => item.id === req.authenticatedUser.id);
  if (!user) return res.status(401).json({ error: "Please log in to continue." });
  resetDailyHabits(user);
  user.habits.push({ id: crypto.randomUUID(), title: normalizedTitle, icon: "⚡", doneOn: null, rewardedOn: null });
  writeData(data);
  res.json({ user: safeUser(user) });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  next(error);
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Habit Tracker running at http://localhost:${PORT}`));
}

module.exports = { app };
