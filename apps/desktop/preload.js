const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bankAnalyzer", {
  loadData: () => ipcRenderer.invoke("data:load"),
  saveData: (data) => ipcRenderer.invoke("data:save", data),
  updateData: (data) => ipcRenderer.invoke("data:update", data),
  importFiles: (accountId) => ipcRenderer.invoke("import:files", accountId)
});
