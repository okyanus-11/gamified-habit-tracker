const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "habit-tracker-test-"));
process.env.HABIT_DATA_FILE = path.join(dataDirectory, "data.json");
process.env.AUTH_SECRET = "test-only-secret-that-is-at-least-32-bytes";
const { app } = require("../server");
const server = app.listen(0);
const baseUrl = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(dataDirectory, { recursive: true, force: true });
});

async function post(route, body, cookie) {
  return fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function signup(username) {
  const response = await post("/api/signup", {
    username,
    password: "correct-horse-battery",
    gender: "Prefer not to say",
    birthdate: "1990-01-01",
  });
  assert.equal(response.status, 201);
  return {
    user: (await response.json()).user,
    cookie: response.headers.get("set-cookie").split(";")[0],
  };
}

test("validates signup data and rejects malformed JSON", async () => {
  assert.equal((await post("/api/signup", "{")).status, 400);
  assert.equal((await post("/api/signup", {
    username: "bad name",
    password: "short",
    gender: "other",
    birthdate: "2020-02-31",
  })).status, 400);
  assert.equal((await post("/api/signup", {
    username: "young-user",
    password: "correct-horse-battery",
    gender: "Female",
    birthdate: "2020-01-01",
  })).status, 400);
});

test("protects habit mutations and awards experience at most once per habit per day", async () => {
  const alice = await signup("alice");
  const bob = await signup("bob");
  assert.equal(alice.user.passwordHash, undefined);
  assert.match(alice.cookie, /^habit_session=/);

  assert.equal((await post("/api/habits", { title: "private" })).status, 401);
  assert.equal((await post("/api/habits/toggle", { habitId: "workout" })).status, 401);

  const custom = await post("/api/habits", { userId: bob.user.id, title: "<img src=x onerror=alert(1)>" }, alice.cookie);
  assert.equal(custom.status, 200);
  const customUser = (await custom.json()).user;
  assert.equal(customUser.username, "alice");
  assert.equal(customUser.habits.at(-1).title, "<img src=x onerror=alert(1)>");
  assert.equal(customUser.habits.length, 6);

  const toggle = async () => post("/api/habits/toggle", { userId: bob.user.id, habitId: "workout" }, alice.cookie);
  const first = await toggle();
  const firstBody = await first.json();
  assert.equal(firstBody.gained, 10);
  assert.equal(firstBody.user.username, "alice");
  assert.equal(firstBody.user.totalExp, 10);
  assert.equal(firstBody.user.habits[0].doneOn, new Date().toISOString().slice(0, 10));

  const undone = await (await toggle()).json();
  assert.equal(undone.gained, 0);
  assert.equal(undone.user.habits[0].doneOn, null);
  assert.equal(undone.user.totalExp, 10);

  const redone = await (await toggle()).json();
  assert.equal(redone.gained, 0);
  assert.equal(redone.user.habits[0].doneOn, new Date().toISOString().slice(0, 10));
  assert.equal(redone.user.totalExp, 10);

  const bobLogin = await post("/api/login", { username: "bob", password: "correct-horse-battery" });
  const bobBody = await bobLogin.json();
  assert.equal(bobBody.user.totalExp, 0);
  assert.equal(bobBody.user.habits.length, 5);
});

test("handles malformed stored password hashes without timingSafeEqual errors", async () => {
  const data = JSON.parse(fs.readFileSync(process.env.HABIT_DATA_FILE, "utf8"));
  const bob = data.users.find((user) => user.username === "bob");
  bob.passwordHash = "broken";
  fs.writeFileSync(process.env.HABIT_DATA_FILE, JSON.stringify(data));

  const response = await post("/api/login", { username: "bob", password: "correct-horse-battery" });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Invalid username or password/);
});
