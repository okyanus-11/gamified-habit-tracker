let user = null;
let mode = "login";
let sessionToken = null;
const $ = (id) => document.getElementById(id);
const today = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  const response = await fetch(url, { ...options, headers });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw Error(data.error || "The request failed.");
  return data;
}
function toast(message) { const item = $("toast"); item.textContent = message; item.classList.add("show"); setTimeout(() => item.classList.remove("show"), 2400); }
function render() {
  const completed = user.habits.filter((habit) => habit.doneOn === today()).length;
  $("name").textContent = user.username;
  $("level").textContent = user.level;
  $("exp").textContent = user.exp;
  $("bar").style.setProperty("--value", `${user.exp}%`);
  $("count").textContent = `${completed} / ${user.habits.length} complete`;
  $("date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  // Build rows with text nodes: habit titles are user-controlled and must never
  // be interpreted as HTML.
  const list = $("habits");
  const fragment = document.createDocumentFragment();
  for (const habit of user.habits) {
    const done = habit.doneOn === today();
    const item = document.createElement("button");
    item.type = "button";
    item.className = `habit${done ? " done" : ""}`;
    item.dataset.id = habit.id;
    item.setAttribute("aria-pressed", String(done));

    const icon = document.createElement("span");
    icon.textContent = habit.icon || "⚡";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = habit.title;
    const reward = document.createElement("small");
    reward.textContent = done ? "Completed · 10 EXP" : "+10 EXP";
    const check = document.createElement("span");
    check.className = "check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";

    item.append(icon, title, reward, check);
    item.addEventListener("click", () => toggleHabit(habit.id));
    fragment.append(item);
  }
  list.replaceChildren(fragment);
}
async function toggleHabit(habitId) {
  try {
    const previousLevel = user.level;
    const result = await api("/api/habits/toggle", { method: "POST", body: JSON.stringify({ habitId }) });
    user = result.user;
    render();
    if (result.gained > 0 && user.level > previousLevel) {
      toast(`LEVEL UP! You reached level ${user.level}!`);
    } else if (result.gained > 0) {
      toast("+10 EXP · Quest complete! ✦");
    } else {
      toast("Completion undone · 10 EXP returned.");
    }
  } catch (error) { toast(error.message); }
}
function enterApp(account) { user = account; $("auth").classList.add("hidden"); $("dashboard").classList.remove("hidden"); render(); }
function accentForeground(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? "#10151d" : "#ffffff";
}
function applyAccent(accent) {
  const safeAccent = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#68a9ff";
  document.documentElement.style.setProperty("--accent", safeAccent);
  document.documentElement.style.setProperty("--accent-foreground", accentForeground(safeAccent));
  return safeAccent;
}
function applyAppearance() {
  const theme = localStorage.getItem("habit-theme") || "graphite";
  const accent = localStorage.getItem("habit-accent") || "#68a9ff";
  document.documentElement.dataset.theme = ["graphite", "midnight", "light"].includes(theme) ? theme : "graphite";
  const safeAccent = applyAccent(accent);
  $("theme-select").value = document.documentElement.dataset.theme;
  $("custom-accent").value = safeAccent;
  const preset = $("accent-select");
  preset.value = [...preset.options].some((option) => option.value.toLowerCase() === safeAccent.toLowerCase()) ? safeAccent : "";
}
applyAppearance();
$("theme-select").addEventListener("change", (event) => {
  localStorage.setItem("habit-theme", event.target.value);
  applyAppearance();
});
$("accent-select").addEventListener("change", (event) => {
  localStorage.setItem("habit-accent", event.target.value);
  applyAppearance();
});
$("custom-accent").addEventListener("input", (event) => {
  localStorage.setItem("habit-accent", event.target.value);
  applyAccent(event.target.value);
  $("accent-select").value = "";
});
document.querySelectorAll("nav button").forEach((button) => button.onclick = () => { document.querySelectorAll("nav button").forEach((item) => item.classList.remove("active")); button.classList.add("active"); mode = button.dataset.mode; $("signup-fields").classList.toggle("hidden", mode !== "signup"); $("auth-label").textContent = mode === "signup" ? "Create your account ↗" : "Enter the quest ↗"; });
$("auth-form").onsubmit = async (event) => {
  event.preventDefault();
  const submit = $("auth-label");
  submit.disabled = true;
  try {
    const body = { username: $("username").value, password: $("password").value };
    if (mode === "signup") { body.gender = $("gender").value; body.birthdate = $("birthdate").value; }
    const result = await api(`/api/${mode}`, { method: "POST", body: JSON.stringify(body) });
    sessionToken = result.token;
    enterApp(result.user);
  } catch (error) { toast(error.message); }
  finally { submit.disabled = false; }
};
$("custom").onsubmit = async (event) => { event.preventDefault(); try { user = (await api("/api/habits", { method: "POST", body: JSON.stringify({ title: $("custom-title").value }) })).user; $("custom-title").value = ""; render(); } catch (error) { toast(error.message); } };
$("logout").onclick = async () => {
  try { if (sessionToken) await api("/api/logout", { method: "POST" }); } catch (_) {}
  sessionToken = null; user = null;
  $("dashboard").classList.add("hidden"); $("auth").classList.remove("hidden");
};
// Ranking is intentionally local-only and removed from the app.
document.querySelector("#leaderboard")?.remove(); document.querySelector("#rank-view")?.remove(); document.querySelector("aside")?.remove();
