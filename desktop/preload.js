// Sichere Brücke zwischen Web-App (Renderer) und Electron-Hauptprozess.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  // WLAN-Server für Geräte-Sync starten/stoppen
  startServer: function () { return ipcRenderer.invoke("sync-start"); },
  stopServer: function () { return ipcRenderer.invoke("sync-stop"); },
  // aktuelle Daten an den Hauptprozess spiegeln (für GET /pull)
  setData: function (json) { ipcRenderer.send("sync-set-data", json); },
  // wenn ein Handy Daten sendet (POST /push)
  onPush: function (cb) { ipcRenderer.on("sync-push", function (_e, json) { cb(json); }); },
  // wenn ein Handy Daten abholt (GET /pull) – für Status-Rückmeldung
  onClient: function (cb) { ipcRenderer.on("sync-client", function () { cb(); }); },
  // externen Link (z. B. Update-Download) im Standardbrowser öffnen
  openExternal: function (url) { ipcRenderer.send("open-external", url); }
});
