let user = null;
let mode = "login";
const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
async function api(url, options = {}) { const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options }); const data = response.status === 204 ? null : await response.json(); if (!response.ok) throw Error(data.error); return data; }
function toast(message) { const item = $("toast"); item.textContent = message; item.classList.add("show"); setTimeout(() => item.classList.remove("show"), 2400); }
function render() {
  const completed = user.habits.filter((habit) => habit.doneOn === today()).length;
  $("name").textContent = user.username;
  $("level").textContent = user.level;
  $("exp").textContent = user.exp;
  $("bar").style.setProperty("--value", `${user.exp}%`);
  $("count").textContent = `${completed} / ${user.habits.length} complete`;
  $("date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const habits = $("habits");
  habits.replaceChildren(...user.habits.map((habit) => {
    const isDone = habit.doneOn === today();
    const item = document.createElement("div");
    item.className = `habit${isDone ? " done" : ""}`;
    item.dataset.id = habit.id;
    item.onclick = () => toggleHabit(habit.id);

    const icon = document.createElement("span");
    icon.textContent = habit.icon;
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = habit.title;
    const reward = document.createElement("small");
    reward.textContent = isDone ? "+10 EXP earned" : "+10 EXP";
    const check = document.createElement("span");
    check.className = "check";
    check.textContent = "✓";
    item.append(icon, title, reward, check);
    return item;
  }));
}
async function toggleHabit(habitId) {
  try {
    const previousLevel = user.level;
    const result = await api("/api/habits/toggle", { method: "POST", body: JSON.stringify({ habitId }) });
    user = result.user;
    render();
    if (result.gained > 0) {
      toast(user.level > previousLevel ? `LEVEL UP! You reached level ${user.level}!` : "+10 EXP · Quest complete! ✦");
    }
  } catch (error) {
    toast(error.message);
  }
}
function enterApp(account) { user = account; $("auth").classList.add("hidden"); $("dashboard").classList.remove("hidden"); render(); }
document.querySelectorAll("nav button").forEach((button) => button.onclick = () => { document.querySelectorAll("nav button").forEach((item) => item.classList.remove("active")); button.classList.add("active"); mode = button.dataset.mode; const signingUp = mode === "signup"; $("signup-fields").classList.toggle("hidden", !signingUp); $("password").minLength = signingUp ? 8 : 1; $("gender").required = signingUp; $("birthdate").required = signingUp; $("auth-label").textContent = signingUp ? "Create your account ↗" : "Enter the quest ↗"; });
$("auth-form").onsubmit = async (event) => { event.preventDefault(); try { const body = { username: $("username").value, password: $("password").value }; if (mode === "signup") { body.gender = $("gender").value; body.birthdate = $("birthdate").value; } enterApp((await api(`/api/${mode}`, { method: "POST", body: JSON.stringify(body) })).user); } catch (error) { toast(error.message); } };
$("custom").onsubmit = async (event) => { event.preventDefault(); try { user = (await api("/api/habits", { method: "POST", body: JSON.stringify({ title: $("custom-title").value }) })).user; $("custom-title").value = ""; render(); } catch (error) { toast(error.message); } };
$("logout").onclick = async () => { try { await api("/api/logout", { method: "POST" }); user = null; $("dashboard").classList.add("hidden"); $("auth").classList.remove("hidden"); } catch (error) { toast(error.message); } };
// Ranking is intentionally local-only and removed from the app.
document.querySelector("#leaderboard")?.remove(); document.querySelector("#rank-view")?.remove(); document.querySelector("aside")?.remove();
