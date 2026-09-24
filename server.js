const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const FIXED_HABITS = [
  { id: "workout", title: "Working Out", icon: "🏋️" },
  { id: "study", title: "School / Studying / Job", icon: "📚" },
  { id: "teeth", title: "Brushing Teeth", icon: "🪥" },
  { id: "water", title: "Hydration", icon: "💧" },
  { id: "shower", title: "Showering", icon: "🚿" },
];
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
function readData() { if (!fs.existsSync(DATA_FILE)) return { users: [] }; return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function today() { return new Date().toISOString().slice(0, 10); }
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") }; }
function safeUser(user) { const { passwordHash, passwordSalt, ...publicUser } = user; return publicUser; }
function ageFrom(birthdate) { const birth = new Date(`${birthdate}T00:00:00`); if (Number.isNaN(birth.getTime())) return -1; const now = new Date(); let age = now.getFullYear() - birth.getFullYear(); const passed = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate()); return passed ? age : age - 1; }
app.post("/api/signup", (req, res) => {
  const { username, password, gender, birthdate } = req.body;
  if (!username || !password || !gender || !birthdate) return res.status(400).json({ error: "All fields are required." });
  if (ageFrom(birthdate) < 13) return res.status(400).json({ error: "You must be at least 13 years old to create an account." });
  const data = readData(); if (data.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "That username is already taken." });
  const credentials = hashPassword(password); const user = { id: crypto.randomUUID(), username: username.trim(), gender, birthdate, level: 1, exp: 0, totalExp: 0, habits: FIXED_HABITS.map((habit) => ({ ...habit, doneOn: null })), lastReset: today(), passwordHash: credentials.hash, passwordSalt: credentials.salt };
  data.users.push(user); writeData(data); res.status(201).json({ user: safeUser(user) });
});
app.post("/api/login", (req, res) => { const { username, password } = req.body; const user = readData().users.find((item) => item.username.toLowerCase() === String(username || "").toLowerCase()); if (!user || !crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.passwordSalt).hash, "hex"), Buffer.from(user.passwordHash, "hex"))) return res.status(401).json({ error: "Invalid username or password." }); res.json({ user: safeUser(user) }); });
app.get("/api/leaderboard", (_req, res) => { const users = readData().users.map(safeUser).sort((a, b) => b.level - a.level || b.totalExp - a.totalExp).map((user, index) => ({ rank: index + 1, username: user.username, level: user.level, totalExp: user.totalExp })); res.json(users); });
app.post("/api/habits/toggle", (req, res) => { const { userId, habitId } = req.body; const data = readData(); const user = data.users.find((item) => item.id === userId); if (!user) return res.status(404).json({ error: "User not found." }); if (user.lastReset !== today()) { user.habits.forEach((habit) => { habit.doneOn = null; }); user.lastReset = today(); } const habit = user.habits.find((item) => item.id === habitId); if (!habit) return res.status(404).json({ error: "Habit not found." }); if (!habit.doneOn) { habit.doneOn = today(); user.totalExp += 10; user.exp += 10; if (user.exp >= 100) { user.level += Math.floor(user.exp / 100); user.exp %= 100; } } writeData(data); res.json({ user: safeUser(user), gained: 10 }); });
app.post("/api/habits", (req, res) => { const { userId, title } = req.body; const data = readData(); const user = data.users.find((item) => item.id === userId); if (!user || !title?.trim()) return res.status(400).json({ error: "A habit title is required." }); user.habits.push({ id: crypto.randomUUID(), title: title.trim(), icon: "⚡", doneOn: null }); writeData(data); res.json({ user: safeUser(user) }); });
app.listen(PORT, () => console.log(`Habit Tracker running at http://localhost:${PORT}`));

