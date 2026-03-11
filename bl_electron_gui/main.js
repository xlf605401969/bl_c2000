const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const Flasher = require('./src/flasher');
const { loadFirmwareDocument } = require('./src/firmware-document');
const { loadGuiConfig } = require('./src/gui-config');

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
  const guiConfig = loadGuiConfig();
  const target = guiConfig.targets.find((item) => item.id === targetType);
  return target ? target.firmwareTarget : null;
}

function resolveTargetCode(targetType) {
  const guiConfig = loadGuiConfig();
  const target = guiConfig.targets.find((item) => item.id === targetType);
  if (!target) {
    throw new Error(`未知目标类型: ${targetType}`);
  }
  return target.protocolTargetCode;
}

function getFlashTargetSequence(config) {
  const guiConfig = loadGuiConfig();
  const priority = new Map(guiConfig.targets.map((target) => [target.id, target.flashPriority]));

  const requestedTargets = config.firmwareFormat === 'hex2'
    ? (Array.isArray(config.flashTargets) ? config.flashTargets : [])
    : [config.targetType];

  const uniqueTargets = Array.from(new Set(requestedTargets.filter((target) => priority.has(target))));
  return uniqueTargets.sort((left, right) => priority.get(right) - priority.get(left));
}

function getFirmwareCacheKey(config) {
  return JSON.stringify({
    firmwareFormat: config.firmwareFormat || 'legacy',
    targetType: config.targetType || 'main',
    legacyFiles: config.legacyFiles || null,
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

  const guiConfig = loadGuiConfig();
  const document = await loadFirmwareDocument({
    ...config,
    targetDefinitions: guiConfig.targets
  });
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

ipcMain.handle('load-gui-config', async () => {
  try {
    return {
      success: true,
      config: loadGuiConfig()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

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
        { name: '固件文件', extensions: ['hex', 'HEX', 'hex2', 'HEX2', 'i01', 'I01'] },
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

ipcMain.handle('erase-flash', async (event, config) => {
  try {
    const { port, baudrate, slaveId, targetType = 'main', eraseMode = 'custom', startAddr, length } = config;
    const parsedStartAddr = parseAddressString(startAddr);
    const parsedLength = parseAddressString(length);

    if (eraseMode !== 'app' && (parsedStartAddr === null || Number.isNaN(parsedStartAddr) || parsedStartAddr < 0)) {
      return { success: false, error: '擦除起始地址无效' };
    }

    if (eraseMode !== 'app' && (parsedLength === null || Number.isNaN(parsedLength) || parsedLength <= 0)) {
      return { success: false, error: '擦除长度无效' };
    }

    const tempFlasher = new Flasher(port, baudrate, slaveId);
    const result = await tempFlasher.eraseFlashRange(
      eraseMode === 'app' ? undefined : parsedStartAddr,
      eraseMode === 'app' ? undefined : parsedLength,
      resolveTargetCode(targetType)
    );
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
    const { port, baudrate, slaveId, targetType = 'main' } = config;
    
    const tempFlasher = new Flasher(port, baudrate, slaveId);
    const result = await tempFlasher.readSystemInfo(resolveTargetCode(targetType));
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
    const guiConfig = loadGuiConfig();
    const appInfoTarget = guiConfig.targets.find((item) => item.id === guiConfig.appInfoTarget) || guiConfig.targets[0];
    const image = firmwareDocument.getTarget(appInfoTarget.firmwareTarget);
    if (!image) {
      return { success: false, error: `当前固件中未找到 ${appInfoTarget.displayName} 目标` };
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
