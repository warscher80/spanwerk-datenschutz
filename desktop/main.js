// Preisschmiede – Desktop (Electron-Hauptprozess)
// Lädt die lokale Web-App in ein natives Fenster. Alles läuft offline,
// Daten bleiben lokal (localStorage des App-Profils).
const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Preisschmiede",
    autoHideMenuBar: true,
    backgroundColor: "#0f141b",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  win.loadFile(path.join(__dirname, "app", "index.html"));

  // Externe Links (Update-Download) im Standardbrowser öffnen;
  // interne Fenster (Angebot/PDF-Druckvorschau) zulassen.
  win.webContents.setWindowOpenHandler(function (details) {
    if (/^https?:/i.test(details.url)) {
      shell.openExternal(details.url);
      return { action: "deny" };
    }
    return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: "#ffffff" } };
  });
}

app.whenReady().then(function () {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
