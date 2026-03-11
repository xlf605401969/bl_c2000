const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const Flasher = require('./src/flasher');
const { loadFirmwareDocument } = require('./src/firmware-document');

let mainWindow;
let flasher = null;
const firmwareDocumentCache = new Map();

function parseAddressString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (text.startsWith('0x') || text.startsWith('0X')) {
    return parseInt(text, 16);
  }

  return parseInt(text, 10);
}

function resolveTargetKey(targetType) {
  if (targetType === 'main') {
    return 'cpu1';
  }
  if (targetType === 'cm') {
    return 'cm';
  }
  if (targetType === 'cpu2') {
    return 'cpu2';
  }
  return null;
}

function resolveTargetCode(targetType) {
  if (targetType === 'main') {
    return 0x00;
  }
  if (targetType === 'cm') {
    return 0x01;
  }
  if (targetType === 'cpu2') {
    return 0x02;
  }
  throw new Error(`未知目标类型: ${targetType}`);
}

function getFlashTargetSequence(config) {
  const priority = {
    main: 1,
    cm: 2,
    cpu2: 3
  };

  const requestedTargets = config.firmwareFormat === 'hex2'
    ? (Array.isArray(config.flashTargets) ? config.flashTargets : [])
    : [config.targetType];

  const uniqueTargets = Array.from(new Set(requestedTargets.filter((target) => priority[target])));
  return uniqueTargets.sort((left, right) => priority[right] - priority[left]);
}

function getFirmwareCacheKey(config) {
  return JSON.stringify({
    firmwareFormat: config.firmwareFormat || 'legacy',
    targetType: config.targetType || 'main',
    lowHexFile: config.lowHexFile || '',
    highHexFile: config.highHexFile || '',
    cmHexFile: config.cmHexFile || '',
    hex2File: config.hex2File || ''
  });
}

async function getFirmwareDocument(config) {
  const cacheKey = getFirmwareCacheKey(config);
  if (firmwareDocumentCache.has(cacheKey)) {
    return firmwareDocumentCache.get(cacheKey);
  }

  const document = await loadFirmwareDocument(config);
  firmwareDocumentCache.set(cacheKey, document);
  return document;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('renderer/index.html');

  // 开发环境下打开开发工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC处理器

// 列出可用串口
ipcMain.handle('list-serial-ports', async () => {
  try {
    const ports = await SerialPort.list();
    return {
      success: true,
      ports: ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || '未知',
        serialNumber: port.serialNumber || '未知',
        vendorId: port.vendorId,
        productId: port.productId
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 选择文件
ipcMain.handle('select-file', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '固件文件', extensions: ['hex', 'HEX', 'hex2', 'HEX2'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      ...options
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return {
      success: true,
      filePath: result.filePaths[0]
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 开始烧录
ipcMain.handle('start-flash', async (event, config) => {
  try {
    const {
      port,
      baudrate,
      slaveId,
      lowHexFile,
      highHexFile,
      cmHexFile,
      hex2File,
      firmwareFormat,
      targetType,
      flashTargets,
      majorVersion,
      minorVersion,
      buildVersion,
      chunkSize
    } = config;

    flasher = new Flasher(port, baudrate, slaveId);

    // 发送进度更新
    flasher.on('progress', (data) => {
      mainWindow.webContents.send('flash-progress', data);
    });

    // 发送日志
    flasher.on('log', (data) => {
      mainWindow.webContents.send('flash-log', data);
    });

    // 发送状态更新
    flasher.on('status', (data) => {
      mainWindow.webContents.send('flash-status', data);
    });

    const firmwareDocument = await getFirmwareDocument({
      firmwareFormat,
      targetType,
      flashTargets,
      lowHexFile,
      highHexFile,
      cmHexFile,
      hex2File
    });

    const flashSequence = getFlashTargetSequence({ firmwareFormat, targetType, flashTargets });
    if (flashSequence.length === 0) {
      throw new Error('没有可执行的烧录目标');
    }

    flasher.log(`烧录目标顺序: ${flashSequence.join(' -> ')}`);

    for (const currentTargetType of flashSequence) {
      const targetKey = resolveTargetKey(currentTargetType);
      const image = firmwareDocument.getTarget(targetKey);
      if (!image) {
        throw new Error(`当前固件中未找到目标 ${targetKey}`);
      }

      flasher.log(`准备烧录目标 ${targetKey}`);
      const result = await flasher.flashParsedImage(
        image,
        resolveTargetCode(currentTargetType),
        targetKey,
        chunkSize,
        majorVersion,
        minorVersion,
        buildVersion
      );

      if (!result.success) {
        return result;
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 停止烧录
ipcMain.handle('stop-flash', async () => {
  try {
    if (flasher) {
      await flasher.stop();
      flasher = null;
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 读取寄存器信息
ipcMain.handle('read-registers', async (event, config) => {
  try {
    const { port, baudrate, slaveId, startAddr, count } = config;
    
    const tempFlasher = new Flasher(port, baudrate, slaveId);
    const result = await tempFlasher.readRegisters(startAddr, count);
    await tempFlasher.disconnect();
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 进入Bootloader模式
ipcMain.handle('enter-bootloader', async (event, config) => {
  try {
    const { port, baudrate, slaveId } = config;
    
    const tempFlasher = new Flasher(port, baudrate, slaveId);
    const result = await tempFlasher.enterBootloaderMode();
    await tempFlasher.disconnect();
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 跳转到应用程序
ipcMain.handle('jump-to-app', async (event, config) => {
  try {
    const { port, baudrate, slaveId } = config;
    
    const tempFlasher = new Flasher(port, baudrate, slaveId);
    const result = await tempFlasher.jumpToApplication();
    await tempFlasher.disconnect();
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 读取APP信息
ipcMain.handle('read-app-info', async (event, config) => {
  try {
    const { port, baudrate, slaveId } = config;
    
    const tempFlasher = new Flasher(port, baudrate, slaveId);
    const result = await tempFlasher.readAppInfo();
    await tempFlasher.disconnect();
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 读取完整系统信息
ipcMain.handle('read-system-info', async (event, config) => {
  try {
    const { port, baudrate, slaveId } = config;
    
    const tempFlasher = new Flasher(port, baudrate, slaveId);
    const result = await tempFlasher.readSystemInfo();
    await tempFlasher.disconnect();
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// 从固件文件解析AppInfo
ipcMain.handle('parse-app-info', async (event, config) => {
  try {
    const { appInfoAddr } = config;
    const address = parseAddressString(appInfoAddr);
    if (address === null || Number.isNaN(address)) {
      return { success: false, error: 'AppInfo地址无效' };
    }

    const firmwareDocument = await getFirmwareDocument(config);
    const image = firmwareDocument.getTarget('cpu1');
    if (!image) {
      return { success: false, error: '当前固件中未找到 CPU1 目标' };
    }

    const appInfoResult = image.parseAppInfo(address);
    if (!appInfoResult.success) {
      return { success: false, error: appInfoResult.error };
    }

    return {
      success: true,
      appInfo: appInfoResult.appInfo,
      address
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('load-firmware-document', async (event, config) => {
  try {
    const firmwareDocument = await getFirmwareDocument(config);
    return {
      success: true,
      format: firmwareDocument.format,
      targets: firmwareDocument.listTargets()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('browse-firmware-memory', async (event, config) => {
  try {
    const firmwareDocument = await getFirmwareDocument(config);
    const image = firmwareDocument.getTarget(config.browseTarget);
    if (!image) {
      return { success: false, error: `未找到目标 ${config.browseTarget}` };
    }

    const startAddress = parseAddressString(config.startAddress);
    const length = parseInt(config.length, 10);
    const address = startAddress === null || Number.isNaN(startAddress) ? image.minAddr : startAddress;
    const browseLength = Number.isNaN(length) || length <= 0 ? 128 : length;

    return {
      success: true,
      target: image.getSummary(),
      memory: image.getMemoryRows(address, browseLength)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
