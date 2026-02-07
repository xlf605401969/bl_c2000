const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const Flasher = require('./src/flasher');
const HexParser = require('./src/hex-parser');

let mainWindow;
let flasher = null;

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
        { name: 'HEX文件', extensions: ['hex', 'HEX'] },
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
      targetType,
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

    let result;
    if (targetType === 'main' && lowHexFile && highHexFile) {
      // 主MCU更新（16位内存）
      result = await flasher.flashMainMcu(
        lowHexFile,
        highHexFile,
        chunkSize,
        majorVersion,
        minorVersion,
        buildVersion
      );
    } else if (targetType === 'cm' && cmHexFile) {
      // CM核更新（8位内存）
      result = await flasher.flashCmMcu(
        cmHexFile,
        chunkSize,
        majorVersion,
        minorVersion,
        buildVersion
      );
    } else {
      throw new Error('无效的配置参数');
    }

    return result;
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
    const {
      targetType,
      lowHexFile,
      highHexFile,
      cmHexFile,
      appInfoAddr
    } = config;

    const address = parseAddressString(appInfoAddr);
    if (address === null || Number.isNaN(address)) {
      return { success: false, error: 'AppInfo地址无效' };
    }

    const parser = new HexParser();
    let parseResult;

    if (targetType === 'main') {
      if (!lowHexFile || !highHexFile) {
        return { success: false, error: '缺少低字节或高字节HEX文件' };
      }
      parseResult = await parser.parseFiles(lowHexFile, highHexFile);
    } else if (targetType === 'cm') {
      if (!cmHexFile) {
        return { success: false, error: '缺少CM核HEX文件' };
      }
      parseResult = await parser.parseSingleFile(cmHexFile);
    } else {
      return { success: false, error: '未知目标类型' };
    }

    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    const appInfoResult = parser.parseAppInfo(address);
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
