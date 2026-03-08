import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopApi", {
  getDbPath: () => ipcRenderer.invoke("app:dbPath"),
  listTransactions: () => ipcRenderer.invoke("data:transactions"),
  listSummaries: () => ipcRenderer.invoke("data:summaries"),
  listRules: () => ipcRenderer.invoke("data:rules"),
  saveRule: (rule) => ipcRenderer.invoke("rule:save", rule),
  importPdf: () => ipcRenderer.invoke("import:pdf"),
  importSynthetic: () => ipcRenderer.invoke("import:synthetic")
});
