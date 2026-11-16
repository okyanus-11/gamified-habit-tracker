const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dataFile = path.join(os.tmpdir(), `habit-quest-test-${process.pid}-${Date.now()}.json`);
process.env.HABIT_DATA_FILE = dataFile;
const { app, sessions } = require("../server");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const token of sessions.keys()) sessions.delete(token);
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  try { fs.unlinkSync(dataFile); } catch (_) {}
});

test("account data requires an authenticated session bound to the account", async () => {
  const signup = await fetch(`${baseUrl}/api/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "tester",
      password: "test-password",
      gender: "Prefer not to say",
      birthdate: "2000-01-01",
    }),
  });
  assert.equal(signup.status, 201);
  const created = await signup.json();
  assert.equal(typeof created.token, "string");
  assert.equal(created.token.length, 64);

  const unauthenticated = await fetch(`${baseUrl}/api/habits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: created.user.id, title: "unauthorized" }),
  });
  assert.equal(unauthenticated.status, 401);

  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${created.token}`,
  };
  const toggled = await fetch(`${baseUrl}/api/habits/toggle`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId: "another-account", habitId: "study" }),
  });
  assert.equal(toggled.status, 200);
  const result = await toggled.json();
  assert.equal(result.user.id, created.user.id);
  assert.equal(result.gained, 10);
  assert.equal(result.user.totalExp, 10);
  assert.equal(result.user.habits.find((habit) => habit.id === "study").doneOn !== null, true);

  const undone = await fetch(`${baseUrl}/api/habits/toggle`, {
    method: "POST",
    headers,
    body: JSON.stringify({ habitId: "study" }),
  });
  assert.equal(undone.status, 200);
  const undoResult = await undone.json();
  assert.equal(undoResult.gained, -10);
  assert.equal(undoResult.user.totalExp, 0);
  assert.equal(undoResult.user.level, 1);

  const loggedOut = await fetch(`${baseUrl}/api/logout`, { method: "POST", headers });
  assert.equal(loggedOut.status, 204);
  const afterLogout = await fetch(`${baseUrl}/api/habits`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "should fail" }),
  });
  assert.equal(afterLogout.status, 401);
});

test("oversized JSON requests are rejected before reaching API handlers", async () => {
  const response = await fetch(`${baseUrl}/api/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "large", password: "test-password", gender: "unspecified", birthdate: "2000-01-01", extra: "x".repeat(20_000) }),
  });
  assert.equal(response.status, 413);
});

test("habit titles are rendered as text, never interpolated as HTML", () => {
  const frontend = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.match(frontend, /title\.textContent\s*=\s*habit\.title/);
  assert.doesNotMatch(frontend, /\.innerHTML\s*=/);
});
