// Preisschmiede – Desktop (Electron-Hauptprozess)
// Lädt die lokale Web-App in ein natives Fenster. Alles läuft offline.
// Für den Geräte-Sync startet er auf Wunsch einen lokalen WLAN-Server,
// über den das Handy alle Daten holen oder senden kann.
const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");
const path = require("path");
const http = require("http");
const os = require("os");
const crypto = require("crypto");

var win = null;
var server = null;
var cachedData = "{}";
var PORT = 8765;
var syncToken = null; // 6-stelliger Kopplungs-PIN, nur gültig solange der Server läuft

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
  if (server) return { ips: localIPs(), port: PORT, token: syncToken, running: true };
  // Kopplungs-PIN: ohne gültigen PIN wird kein Zugriff gewährt – schützt
  // im gemeinsamen WLAN vor versehentlichem/fremdem Überschreiben der Daten.
  syncToken = String(crypto.randomInt(100000, 1000000));
  server = http.createServer(function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    var u, pfad, token;
    try { u = new URL(req.url, "http://localhost"); pfad = u.pathname; token = u.searchParams.get("t"); }
    catch (e) { res.writeHead(400); res.end("bad request"); return; }
    // PIN-Prüfung für alle Datenzugriffe
    if (token !== syncToken) { res.writeHead(403, { "Content-Type": "application/json" }); res.end('{"error":"PIN falsch"}'); return; }
    if (req.method === "GET" && (pfad === "/pull" || pfad === "/")) {
      if (win) win.webContents.send("sync-client");
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(cachedData); return;
    }
    if (req.method === "POST" && pfad === "/push") {
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
  return { ips: localIPs(), port: PORT, token: syncToken, running: true };
});

ipcMain.handle("sync-stop", function () {
  if (server) { try { server.close(); } catch (e) {} server = null; }
  syncToken = null;
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
