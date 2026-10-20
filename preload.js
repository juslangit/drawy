const { contextBridge, ipcRenderer } = require('electron');

// Every call resolves to its value or throws the main process's error message.
const call = (channel) => async (...args) => {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

contextBridge.exposeInMainWorld('drawy', {
  projects: {
    list: call('projects:list'),
    create: call('projects:create'),
    open: call('projects:open'),
    save: call('project:save'),
    folder: call('shell:projectFolder'),
  },
  screens: {
    saveSketch: call('sketch:save'),
    saveUi: call('ui:save'),
    remove: call('screen:delete'),
  },
  ai: { ask: call('ai:ask'), stop: call('ai:stop') },
  exportScreen: call('export:write'),
  openFolder: call('shell:openFolder'),
});
