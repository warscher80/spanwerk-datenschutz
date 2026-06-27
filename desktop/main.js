// Preisschmiede – Desktop (Electron-Hauptprozess)
// Lädt die lokale Web-App in ein natives Fenster. Alles läuft offline.
// Für den Geräte-Sync startet er auf Wunsch einen lokalen WLAN-Server,
// über den das Handy alle Daten holen oder senden kann.
const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");
const path = require("path");
const http = require("http");
const os = require("os");

var win = null;
var server = null;
var cachedData = "{}";
var PORT = 8765;

function localIPs() {
  var nets = os.networkInterfaces(), out = [];
  Object.keys(nets).forEach(function (name) {
    (nets[name] || []).forEach(function (n) {
      if (n.family === "IPv4" && !n.internal) out.push(n.address);
    });
  });
  return out;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    title: "Preisschmiede", autoHideMenuBar: true, backgroundColor: "#0f141b",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, "app", "index.html"));
  win.webContents.setWindowOpenHandler(function (details) {
    if (/^https?:/i.test(details.url)) { shell.openExternal(details.url); return { action: "deny" }; }
    return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: "#ffffff" } };
  });
}

// Externen Link (Update-Download o. ä.) im Standardbrowser öffnen.
ipcMain.on("open-external", function (_e, url) {
  if (typeof url === "string" && /^https?:/i.test(url)) { try { shell.openExternal(url); } catch (e) {} }
});

// ---- Geräte-Sync (lokaler WLAN-Server) ----
ipcMain.on("sync-set-data", function (_e, json) { if (typeof json === "string") cachedData = json; });

ipcMain.handle("sync-start", function () {
  if (server) return { ips: localIPs(), port: PORT, running: true };
  server = http.createServer(function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    if (req.method === "GET" && (req.url === "/pull" || req.url === "/")) {
      if (win) win.webContents.send("sync-client");
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(cachedData); return;
    }
    if (req.method === "POST" && req.url === "/push") {
      var body = "";
      req.on("data", function (c) { body += c; if (body.length > 30e6) req.destroy(); });
      req.on("end", function () {
        if (win) win.webContents.send("sync-push", body);
        res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}');
      });
      return;
    }
    res.writeHead(404); res.end("not found");
  });
  server.on("error", function (e) { console.error("Sync-Server:", e.message); });
  try { server.listen(PORT, "0.0.0.0"); } catch (e) { console.error(e); }
  return { ips: localIPs(), port: PORT, running: true };
});

ipcMain.handle("sync-stop", function () {
  if (server) { try { server.close(); } catch (e) {} server = null; }
  return { running: false };
});

app.whenReady().then(function () {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", function () { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", function () {
  if (server) { try { server.close(); } catch (e) {} }
  if (process.platform !== "darwin") app.quit();
});
