const { contextBridge, ipcRenderer } = require('electron');
const invoke=(name)=>(...args)=>ipcRenderer.invoke(name,...args);
contextBridge.exposeInMainWorld('foundry',{
  diagnosticStatus:invoke('diagnostic:status'), launchFullFoundry:invoke('diagnostic:launchFull'),
  getSettings:invoke('settings:get'), setSettings:invoke('settings:set'),
  chooseHome:invoke('home:choose'), openHome:invoke('home:open'), homeInfo:invoke('home:info'), scanHome:invoke('home:scan'),
  createProject:invoke('project:create'), archiveProject:invoke('project:archive'), restoreProject:invoke('project:restore'), listProjects:invoke('project:list'),
  listFiles:invoke('file:list'), importFiles:invoke('file:pickImport'), readFile:invoke('file:read'),
  createSnapshot:invoke('snapshot:create'), listSnapshots:invoke('snapshot:list'), restoreSnapshot:invoke('snapshot:restore'),
  backupWhole:invoke('backup:whole'),
  copyText:invoke('clipboard:write'), pasteText:invoke('clipboard:read'), importAIResult:invoke('result:import')
});
