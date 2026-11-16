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
function render() { const completed = user.habits.filter((habit) => habit.doneOn === today()).length; $("name").textContent = user.username; $("level").textContent = user.level; $("exp").textContent = user.exp; $("bar").style.setProperty("--value", `${user.exp}%`); $("count").textContent = `${completed} / ${user.habits.length} complete`; $("date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }); $("habits").innerHTML = user.habits.map((habit) => `<div class="habit ${habit.doneOn === today() ? "done" : ""}" data-id="${habit.id}"><span>${habit.icon}</span><span class="title">${habit.title}</span><small>${habit.doneOn ? "+10 EXP earned" : "+10 EXP"}</small><span class="check">✓</span></div>`).join(""); document.querySelectorAll(".habit").forEach((item) => { item.onclick = () => toggleHabit(item.dataset.id); }); }
async function toggleHabit(habitId) { try { const wasDone = user.habits.find((habit) => habit.id === habitId).doneOn; const result = await api("/api/habits/toggle", { method: "POST", body: JSON.stringify({ habitId }) }); user = result.user; render(); if (!wasDone) toast(user.exp === 0 ? `LEVEL UP! You reached level ${user.level}!` : "+10 EXP · Quest complete! ✦"); } catch (error) { toast(error.message); } }
function enterApp(account) { user = account; $("auth").classList.add("hidden"); $("dashboard").classList.remove("hidden"); render(); }
function applyAppearance() {
  const theme = localStorage.getItem("habit-theme") || "graphite";
  const accent = localStorage.getItem("habit-accent") || "#68a9ff";
  document.documentElement.dataset.theme = ["graphite", "midnight", "light"].includes(theme) ? theme : "graphite";
  document.documentElement.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#68a9ff");
  $("theme-select").value = document.documentElement.dataset.theme;
  $("custom-accent").value = accent;
  const preset = $("accent-select");
  preset.value = [...preset.options].some((option) => option.value.toLowerCase() === accent.toLowerCase()) ? accent : "";
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
  document.documentElement.style.setProperty("--accent", event.target.value);
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
