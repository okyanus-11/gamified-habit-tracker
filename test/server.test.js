const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "habit-tracker-test-"));
process.env.HABIT_DATA_FILE = path.join(tempDir, "data.json");

const { app } = require("../server.js");
let server;
let baseUrl;
let token;
let habitId;

describe("authenticated habit API", () => {
  before(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates an account and returns no password material", async () => {
    const response = await fetch(`${baseUrl}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test-user",
        password: "correct-horse-battery",
        gender: "Prefer not to say",
        birthdate: "2000-01-01",
      }),
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.match(result.token, /^[a-f0-9]{64}$/);
    assert.equal(result.user.username, "test-user");
    assert.equal("passwordHash" in result.user, false);
    assert.equal("passwordSalt" in result.user, false);
    token = result.token;
  });

  it("rejects account mutations without a session", async () => {
    const response = await fetch(`${baseUrl}/api/habits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unauthorized habit" }),
    });
    assert.equal(response.status, 401);
  });

  it("binds habit creation to the authenticated account", async () => {
    const response = await fetch(`${baseUrl}/api/habits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: "Read", userId: "attacker-controlled-id" }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    const habit = result.user.habits.find((item) => item.title === "Read");
    assert.ok(habit);
    habitId = habit.id;
  });

  it("awards experience once per completion and supports undo", async () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const first = await fetch(`${baseUrl}/api/habits/toggle`, {
      method: "POST", headers, body: JSON.stringify({ habitId }),
    });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).gained, 10);

    const second = await fetch(`${baseUrl}/api/habits/toggle`, {
      method: "POST", headers, body: JSON.stringify({ habitId }),
    });
    assert.equal(second.status, 200);
    assert.equal((await second.json()).gained, -10);
  });

  it("invalidates the session on logout", async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const logout = await fetch(`${baseUrl}/api/logout`, { method: "POST", headers });
    assert.equal(logout.status, 204);

    const afterLogout = await fetch(`${baseUrl}/api/habits`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Should not be created" }),
    });
    assert.equal(afterLogout.status, 401);
  });
});
