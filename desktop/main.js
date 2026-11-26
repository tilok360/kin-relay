// Kin Relay for Windows: the same Kin Relay as the zip, in its own window. Electron runs Kin Relay's server inside
// this app (no Node.js to install) and shows the lobby. Your API key is encrypted with Windows (DPAPI, via safeStorage).
"use strict";
const { app, BrowserWindow, Menu, shell, dialog, safeStorage, session } = require("electron");
const path = require("path");

// Games that come with Kin Relay live in the program folder; games you add, your key and your saves live in
// %APPDATA%\KinRelay (the program folder is replaced on every update).
process.env.KGR_USER_GAMES = "1";
process.env.KGR_BUILTIN_GAMES = path.join(__dirname, "games");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAppUserModelId("com.tilok360.kinrelay");

let win = null, kr = null, base = "";
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function useWindowsEncryption(S) {
  // Windows and macOS keep the key with the OS's own encryption. On Linux, only with a real keyring.
  if (process.platform === "linux" && process.env.KGR_TEST_VAULT) safeStorage.setUsePlainTextEncryption(true); // tests only
  if (!safeStorage.isEncryptionAvailable()) return;
  if (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text" && !process.env.KGR_TEST_VAULT) return;
  S.useVault({ kind: process.platform === "win32" ? "dpapi" : "os", encrypt: (s) => safeStorage.encryptString(s), decrypt: (b) => safeStorage.decryptString(b) });
}

async function boot() {
  const S = require("./lib/store");
  useWindowsEncryption(S);
  kr = require("./server.js");
  let info;
  try { info = await kr.start({ quiet: !process.env.KGR_VERBOSE }); }
  catch (e) { dialog.showErrorBox("Kin Relay couldn't start", "Ports 47900 to 47910 are all in use on this PC (" + e.message + "). Close other copies of Kin Relay and try again."); return app.quit(); }
  base = info.url; // http://localhost:<port>/
  const screens = base.replace("localhost", "127.0.0.1");

  // Nothing here needs the camera, microphone, location or notifications.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(["clipboard-sanitized-write", "fullscreen"].includes(perm)));

  win = new BrowserWindow({
    width: 1320, height: 900, minWidth: 720, minHeight: 520, show: false, backgroundColor: "#0f0a1c", title: "Kin Relay",
    icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  const ours = (u) => u.startsWith(base) || u.startsWith(screens);
  // Links to the web open in your browser; dropping a file never replaces the page (the page itself takes the drop).
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url) && !ours(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!ours(url)) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on("before-input-event", (e, input) => { // F5 reload, Ctrl+Shift+I stays off in the shipped app
    if (input.type === "keyDown" && (input.key === "F5" || (input.control && input.key.toLowerCase() === "r"))) win.webContents.reload();
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { win = null; });
  await win.loadURL(base);
}

app.whenReady().then(boot).catch((e) => { console.error(e); dialog.showErrorBox("Kin Relay couldn't start", String((e && e.stack) || e).slice(0, 800)); app.quit(); });
app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => { try { kr && kr.stop(); } catch {} });
