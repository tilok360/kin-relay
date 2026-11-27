// Builds the Kin Relay Windows installer from this folder (works on Linux with wine for the exe icon, or on Windows).
//   node build.js stage   copy Kin Relay into .stage/ (what goes inside the installer)
//   node build.js dist    stage, then build installer-out/Kin-Relay-Setup-<version>.exe
// Nothing in dev/, samples/ or your data folder is copied, and no key ever is.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const STAGE = path.join(__dirname, ".stage");
const OUT = path.join(__dirname, "installer-out");
const VERSION = /const VERSION = "([\d.]+)"/.exec(fs.readFileSync(path.join(ROOT, "server.js"), "utf8"))[1];
const SKIP = /(^|\/)(\.adding-|\.old-|kinrelay-added\.json$|node_modules|\.git|.*\.result\.json$)/;

function copy(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) { fs.mkdirSync(to, { recursive: true }); for (const n of fs.readdirSync(from)) { if (SKIP.test(n)) continue; copy(path.join(from, n), path.join(to, n)); } }
  else fs.copyFileSync(from, to);
}
function stage() {
  fs.rmSync(STAGE, { recursive: true, force: true }); fs.mkdirSync(STAGE, { recursive: true });
  for (const n of ["server.js", "relay.js", "lib", "public", "README.txt", "ADAPTER-GUIDE.md", "LICENSE"]) if (fs.existsSync(path.join(ROOT, n))) copy(path.join(ROOT, n), path.join(STAGE, n));
  // the four games that come with Kin Relay (not ones you added while testing)
  for (const g of require(path.join(ROOT, "lib", "bundled.js"))) copy(path.join(ROOT, "games", g), path.join(STAGE, "games", g));
  copy(path.join(__dirname, "main.js"), path.join(STAGE, "main.js"));
  copy(path.join(__dirname, "assets", "icon.png"), path.join(STAGE, "icon.png"));
  fs.writeFileSync(path.join(STAGE, "package.json"), JSON.stringify({ name: "kin-relay", productName: "Kin Relay", version: VERSION, description: "Play your Kindroid games on your PC and host tables for friends.", author: "tilok360", license: "MIT", main: "main.js" }, null, 2));
  // never ship a key
  const bad = [];
  (function scan(d) { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) scan(f); else if (/kn_[A-Za-z0-9]{12,}/.test(fs.readFileSync(f, "latin1")) || /^(key\.json|\.kin_token)$/.test(n)) bad.push(f); } })(STAGE);
  if (bad.length) { console.error("Refusing to build: something that looks like a key is in", bad); process.exit(1); }
  console.log("staged Kin Relay", VERSION, "in", STAGE);
}
function dist() {
  stage();
  const cfg = {
    appId: "com.tilok360.kinrelay", productName: "Kin Relay", copyright: "Made by tilok360",
    directories: { app: STAGE, output: OUT, buildResources: path.join(__dirname, "assets") },
    electronVersion: require("./node_modules/electron/package.json").version,
    asar: false, // games run as their own Node processes and need real files
    files: ["**/*"], electronLanguages: ["en-US"], compression: "maximum",
    win: { target: [{ target: "nsis", arch: ["x64"] }], icon: path.join(__dirname, "assets", "icon.ico"), executableName: "Kin Relay" },
    nsis: {
      oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: false,
      createDesktopShortcut: "always", createStartMenuShortcut: true, shortcutName: "Kin Relay", runAfterFinish: true,
      deleteAppDataOnUninstall: false, include: path.join(__dirname, "assets", "installer.nsh"),
      installerIcon: path.join(__dirname, "assets", "icon.ico"), installerSidebar: path.join(__dirname, "assets", "sidebar.bmp"), uninstallerSidebar: path.join(__dirname, "assets", "sidebar.bmp"), uninstallerIcon: path.join(__dirname, "assets", "icon.ico"), installerSidebar: path.join(__dirname, "assets", "sidebar.bmp"), uninstallerSidebar: path.join(__dirname, "assets", "sidebar.bmp"),
      uninstallDisplayName: "Kin Relay", artifactName: "Kin-Relay-Setup-${version}.${ext}",
    },
  };
  const cfgFile = path.join(__dirname, ".builder.json"); fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  execFileSync(process.execPath, [require.resolve("electron-builder/cli.js"), "--win", "nsis", "--x64", "--config", cfgFile, "--publish", "never"], { stdio: "inherit", cwd: __dirname });
}
function mac() {
  // macOS build, unsigned (no Apple developer account): a .dmg and a .zip for Intel (x64) and Apple Silicon (arm64).
  stage();
  const cfg = {
    appId: "com.tilok360.kinrelay", productName: "Kin Relay", copyright: "Made by tilok360",
    directories: { app: STAGE, output: path.join(__dirname, "mac-out"), buildResources: path.join(__dirname, "assets") },
    electronVersion: require("./node_modules/electron/package.json").version,
    asar: false, files: ["**/*"], electronLanguages: ["en-US"], compression: "maximum",
    mac: { target: [{ target: "dmg", arch: ["x64", "arm64"] }, { target: "zip", arch: ["x64", "arm64"] }], icon: path.join(__dirname, "assets", "icon.icns"), category: "public.app-category.games", identity: null, hardenedRuntime: false, gatekeeperAssess: false, artifactName: "Kin-Relay-${version}-mac-${arch}.${ext}" },
    dmg: { sign: false, title: "Kin Relay ${version}" },
  };
  const cfgFile = path.join(__dirname, ".builder-mac.json"); fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  execFileSync(process.execPath, [require.resolve("electron-builder/cli.js"), "--mac", "--x64", "--arm64", "--config", cfgFile, "--publish", "never"], { stdio: "inherit", cwd: __dirname });
}
({ stage, dist, mac })[process.argv[2] || "dist"]();
