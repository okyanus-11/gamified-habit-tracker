const { app, BrowserWindow } = require("electron");
const { fork } = require("child_process");

let server;
function createWindow() {
  server = fork(require.resolve("./server.js"), [], { silent: true });
  const window = new BrowserWindow({ width: 1180, height: 820, backgroundColor: "#090a12", autoHideMenuBar: true });
  setTimeout(() => window.loadURL("http://localhost:3000"), 700);
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (server) server.kill(); if (process.platform !== "darwin") app.quit(); });
