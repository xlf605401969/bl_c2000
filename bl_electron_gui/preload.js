const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 串口操作
  listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
  
  // 文件选择
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  
  // 烧录操作
  startFlash: (config) => ipcRenderer.invoke('start-flash', config),
  stopFlash: () => ipcRenderer.invoke('stop-flash'),
  
  // 寄存器操作
  readRegisters: (config) => ipcRenderer.invoke('read-registers', config),
  
  // 设备操作
  enterBootloader: (config) => ipcRenderer.invoke('enter-bootloader', config),
  jumpToApp: (config) => ipcRenderer.invoke('jump-to-app', config),
  eraseFlash: (config) => ipcRenderer.invoke('erase-flash', config),
  readAppInfo: (config) => ipcRenderer.invoke('read-app-info', config),
  readSystemInfo: (config) => ipcRenderer.invoke('read-system-info', config),
  parseFirmwareAppInfo: (config) => ipcRenderer.invoke('parse-app-info', config),
  loadFirmwareDocument: (config) => ipcRenderer.invoke('load-firmware-document', config),
  browseFirmwareMemory: (config) => ipcRenderer.invoke('browse-firmware-memory', config),
  
  // 事件监听
  onFlashProgress: (callback) => {
    ipcRenderer.on('flash-progress', (event, data) => callback(data));
  },
  onFlashLog: (callback) => {
    ipcRenderer.on('flash-log', (event, data) => callback(data));
  },
  onFlashStatus: (callback) => {
    ipcRenderer.on('flash-status', (event, data) => callback(data));
  },
  
  // 移除监听器
  removeFlashProgressListener: () => {
    ipcRenderer.removeAllListeners('flash-progress');
  },
  removeFlashLogListener: () => {
    ipcRenderer.removeAllListeners('flash-log');
  },
  removeFlashStatusListener: () => {
    ipcRenderer.removeAllListeners('flash-status');
  }
});
