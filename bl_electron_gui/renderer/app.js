// 应用程序状态
const appState = {
  isFlashing: false,
  selectedPorts: [],
  startTime: null,
  config: {
    port: '',
    baudrate: 250000,
    slaveId: 1,
    targetType: 'main',
    lowHexFile: '',
    highHexFile: '',
    cmHexFile: '',
    chunkSize: 64
  }
};

// DOM元素
const elements = {
  // 串口配置
  portSelect: document.getElementById('port'),
  refreshPortsBtn: document.getElementById('refreshPorts'),
  baudrateSelect: document.getElementById('baudrate'),
  slaveIdInput: document.getElementById('slaveId'),

  // 目标选择
  targetTypeRadios: document.querySelectorAll('input[name="targetType"]'),
  mainMcuSection: document.getElementById('mainMcuSection'),
  cmMcuSection: document.getElementById('cmMcuSection'),

  // 文件选择
  lowHexPath: document.getElementById('lowHexPath'),
  highHexPath: document.getElementById('highHexPath'),
  cmHexPath: document.getElementById('cmHexPath'),
  selectLowHexBtn: document.getElementById('selectLowHex'),
  selectHighHexBtn: document.getElementById('selectHighHex'),
  selectCmHexBtn: document.getElementById('selectCmHex'),

  // 固件AppInfo
  appInfoAddrInput: document.getElementById('appInfoAddr'),
  appInfoMagic: document.getElementById('appInfoMagic'),
  appInfoValid: document.getElementById('appInfoValid'),
  appInfoVersion: document.getElementById('appInfoVersion'),
  appInfoEntry: document.getElementById('appInfoEntry'),
  appInfoStart: document.getElementById('appInfoStart'),
  appInfoLength: document.getElementById('appInfoLength'),
  appInfoCrc32: document.getElementById('appInfoCrc32'),
  appInfoTimestamp: document.getElementById('appInfoTimestamp'),
  appInfoGit: document.getElementById('appInfoGit'),
  appInfoTag: document.getElementById('appInfoTag'),

  // 高级设置
  chunkSizeInput: document.getElementById('chunkSize'),

  // 操作按钮
  startFlashBtn: document.getElementById('startFlash'),
  stopFlashBtn: document.getElementById('stopFlash'),
  enterBootloaderBtn: document.getElementById('enterBootloader'),
  jumpToAppBtn: document.getElementById('jumpToApp'),
  readSystemInfoBtn: document.getElementById('readSystemInfo'),

  // 模态窗口
  systemInfoModal: document.getElementById('systemInfoModal'),
  closeModalBtn: document.getElementById('closeModal'),
  
  // Bootloader信息显示
  blMagic: document.getElementById('blMagic'),
  blVersion: document.getElementById('blVersion'),
  blState: document.getElementById('blState'),
  blCapability: document.getElementById('blCapability'),
  blErrorCode: document.getElementById('blErrorCode'),
  
  // Flash信息显示
  flashSize: document.getElementById('flashSize'),
  flashAppStart: document.getElementById('flashAppStart'),
  flashAppMax: document.getElementById('flashAppMax'),
  
  // APP信息显示
  infoValidFlag: document.getElementById('infoValidFlag'),
  infoVersion: document.getElementById('infoVersion'),
  infoEntryAddr: document.getElementById('infoEntryAddr'),
  infoStartAddr: document.getElementById('infoStartAddr'),
  infoLength: document.getElementById('infoLength'),
  infoCrc32: document.getElementById('infoCrc32'),
  infoTimestamp: document.getElementById('infoTimestamp'),
  infoGitCommit: document.getElementById('infoGitCommit'),
  infoGitTag: document.getElementById('infoGitTag'),

  // 进度和状态
  statusText: document.getElementById('statusText'),
  statusIcon: document.getElementById('statusIcon'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  progressDetails: document.getElementById('progressDetails'),
  progressTime: document.getElementById('progressTime'),

  // 日志
  logContent: document.getElementById('logContent'),
  clearLogBtn: document.getElementById('clearLog'),

  // 状态栏
  connectionStatus: document.getElementById('connectionStatus')
};

// 初始化
async function init() {
  await refreshSerialPorts();
  setupEventListeners();
  setupIPCListeners();
  log('应用程序已启动', 'info');
}

// 设置事件监听器
function setupEventListeners() {
  // 串口刷新
  elements.refreshPortsBtn.addEventListener('click', refreshSerialPorts);

  // 目标类型切换
  elements.targetTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      appState.config.targetType = radio.value;
      updateTargetSections();
    });
  });

  // 文件选择
  elements.selectLowHexBtn.addEventListener('click', () => selectFile('lowHex'));
  elements.selectHighHexBtn.addEventListener('click', () => selectFile('highHex'));
  elements.selectCmHexBtn.addEventListener('click', () => selectFile('cmHex'));
  elements.appInfoAddrInput.addEventListener('change', parseFirmwareAppInfo);

  // 操作按钮
  elements.startFlashBtn.addEventListener('click', startFlash);
  elements.stopFlashBtn.addEventListener('click', stopFlash);
  elements.enterBootloaderBtn.addEventListener('click', enterBootloader);
  elements.jumpToAppBtn.addEventListener('click', jumpToApp);
  elements.readSystemInfoBtn.addEventListener('click', readSystemInfo);

  // 模态窗口
  elements.closeModalBtn.addEventListener('click', closeModal);
  elements.systemInfoModal.addEventListener('click', (e) => {
    if (e.target === elements.systemInfoModal) {
      closeModal();
    }
  });

  // 日志清空
  elements.clearLogBtn.addEventListener('click', clearLog);
}

// 设置IPC监听器
function setupIPCListeners() {
  // 进度更新
  window.electronAPI.onFlashProgress((data) => {
    updateProgress(data.percentage, data.stage);
    elements.progressDetails.textContent = `${data.current} / ${data.total} 字节`;
    
    // 更新耗时
    if (appState.startTime) {
      const elapsedMs = Date.now() - appState.startTime;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(elapsedSec / 60);
      const seconds = elapsedSec % 60;
      elements.progressTime.textContent = `耗时: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  });

  // 日志更新
  window.electronAPI.onFlashLog((data) => {
    log(data.message, data.type);
  });

  // 状态更新
  window.electronAPI.onFlashStatus((data) => {
    updateStatus(data.status, data.message);
  });
}

// 刷新串口列表
async function refreshSerialPorts() {
  try {
    const result = await window.electronAPI.listSerialPorts();
    
    if (result.success) {
      elements.portSelect.innerHTML = '<option value="">请选择串口</option>';
      
      result.ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.manufacturer}`;
        elements.portSelect.appendChild(option);
      });

      appState.selectedPorts = result.ports;
      
      if (result.ports.length === 0) {
        log('未找到可用串口', 'warning');
      } else {
        log(`找到 ${result.ports.length} 个串口`, 'info');
      }
    } else {
      log(`刷新串口列表失败: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`刷新串口列表错误: ${error.message}`, 'error');
  }
}

// 更新目标选择区域显示
function updateTargetSections() {
  if (appState.config.targetType === 'main') {
    elements.mainMcuSection.style.display = 'block';
    elements.cmMcuSection.style.display = 'none';
  } else {
    elements.mainMcuSection.style.display = 'none';
    elements.cmMcuSection.style.display = 'block';
  }

  parseFirmwareAppInfo();
}

// 选择文件
async function selectFile(type) {
  try {
    const result = await window.electronAPI.selectFile({
      title: '选择HEX文件'
    });

    if (result.success && !result.canceled) {
      switch (type) {
        case 'lowHex':
          appState.config.lowHexFile = result.filePath;
          elements.lowHexPath.value = result.filePath;
          log(`已选择低字节HEX文件: ${result.filePath}`, 'info');
          parseFirmwareAppInfo();
          break;
        case 'highHex':
          appState.config.highHexFile = result.filePath;
          elements.highHexPath.value = result.filePath;
          log(`已选择高字节HEX文件: ${result.filePath}`, 'info');
          parseFirmwareAppInfo();
          break;
        case 'cmHex':
          appState.config.cmHexFile = result.filePath;
          elements.cmHexPath.value = result.filePath;
          log(`已选择CM核HEX文件: ${result.filePath}`, 'info');
          parseFirmwareAppInfo();
          break;
      }
    }
  } catch (error) {
    log(`选择文件错误: ${error.message}`, 'error');
  }
}

function formatHex(value, width) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
}

function clearFirmwareAppInfo() {
  elements.appInfoMagic.value = '';
  elements.appInfoValid.value = '';
  elements.appInfoVersion.value = '';
  elements.appInfoEntry.value = '';
  elements.appInfoStart.value = '';
  elements.appInfoLength.value = '';
  elements.appInfoCrc32.value = '';
  elements.appInfoTimestamp.value = '';
  elements.appInfoGit.value = '';
  elements.appInfoTag.value = '';
}

function renderFirmwareAppInfo(appInfo) {
  elements.appInfoMagic.value = formatHex(appInfo.magic, 8);
  elements.appInfoValid.value = appInfo.validFlag === 0xAA55
    ? '0xAA55 (有效)'
    : formatHex(appInfo.validFlag, 4);
  elements.appInfoVersion.value = `v${appInfo.majorVersion}.${appInfo.minorVersion}`;
  elements.appInfoEntry.value = formatHex(appInfo.entryAddr, 8);
  elements.appInfoStart.value = formatHex(appInfo.appStartAddr, 8);
  elements.appInfoLength.value = `${appInfo.appLength} (${formatHex(appInfo.appLength, 8)})`;
  elements.appInfoCrc32.value = formatHex(appInfo.crc32, 8);
  elements.appInfoTimestamp.value = formatHex(appInfo.timestamp, 8);
  elements.appInfoGit.value = formatHex(appInfo.gitCommitId, 8);
  elements.appInfoTag.value = appInfo.gitTag || '';
}

async function parseFirmwareAppInfo() {
  const addrText = elements.appInfoAddrInput.value.trim();
  if (!addrText) {
    clearFirmwareAppInfo();
    return;
  }

  if (appState.config.targetType === 'main') {
    if (!appState.config.lowHexFile || !appState.config.highHexFile) {
      clearFirmwareAppInfo();
      return;
    }
  } else if (appState.config.targetType === 'cm') {
    if (!appState.config.cmHexFile) {
      clearFirmwareAppInfo();
      return;
    }
  }

  try {
    const result = await window.electronAPI.parseFirmwareAppInfo({
      targetType: appState.config.targetType,
      lowHexFile: appState.config.lowHexFile,
      highHexFile: appState.config.highHexFile,
      cmHexFile: appState.config.cmHexFile,
      appInfoAddr: addrText
    });

    if (result.success) {
      renderFirmwareAppInfo(result.appInfo);
    } else {
      clearFirmwareAppInfo();
      log(`AppInfo解析失败: ${result.error}`, 'warning');
    }
  } catch (error) {
    clearFirmwareAppInfo();
    log(`AppInfo解析错误: ${error.message}`, 'error');
  }
}

// 开始烧录
async function startFlash() {
  // 验证配置
  const config = collectConfig();
  if (!validateConfig(config)) {
    return;
  }

  // 更新UI状态
  appState.isFlashing = true;
  appState.startTime = Date.now();
  updateUIForFlashing(true);
  clearLog();
  resetProgress();

  try {
    log('开始烧录流程...', 'info');
    const result = await window.electronAPI.startFlash(config);

    if (result.success) {
      log('烧录完成！', 'success');
    } else {
      log(`烧录失败: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`烧录错误: ${error.message}`, 'error');
  } finally {
    appState.isFlashing = false;
    updateUIForFlashing(false);
  }
}

// 停止烧录
async function stopFlash() {
  try {
    log('正在停止烧录...', 'warning');
    await window.electronAPI.stopFlash();
  } catch (error) {
    log(`停止烧录错误: ${error.message}`, 'error');
  }
}

// 进入Bootloader模式
async function enterBootloader() {
  const config = {
    port: elements.portSelect.value,
    baudrate: parseInt(elements.baudrateSelect.value),
    slaveId: parseInt(elements.slaveIdInput.value)
  };

  if (!config.port) {
    log('请选择串口', 'error');
    return;
  }

  try {
    log('正在进入Bootloader模式...', 'info');
    const result = await window.electronAPI.enterBootloader(config);
    
    if (result.success) {
      log('成功进入Bootloader模式', 'success');
      elements.connectionStatus.textContent = '已进入Bootloader';
    } else {
      log(`进入Bootloader模式失败: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`错误: ${error.message}`, 'error');
  }
}

// 跳转到应用程序
async function jumpToApp() {
  const config = {
    port: elements.portSelect.value,
    baudrate: parseInt(elements.baudrateSelect.value),
    slaveId: parseInt(elements.slaveIdInput.value)
  };

  if (!config.port) {
    log('请选择串口', 'error');
    return;
  }

  try {
    log('正在跳转到应用程序...', 'info');
    const result = await window.electronAPI.jumpToApp(config);
    
    if (result.success) {
      log('成功跳转到应用程序', 'success');
    } else {
      log(`跳转失败: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`错误: ${error.message}`, 'error');
  }
}

// 收集配置
function collectConfig() {
  return {
    port: elements.portSelect.value,
    baudrate: parseInt(elements.baudrateSelect.value),
    slaveId: parseInt(elements.slaveIdInput.value),
    targetType: appState.config.targetType,
    lowHexFile: appState.config.lowHexFile,
    highHexFile: appState.config.highHexFile,
    cmHexFile: appState.config.cmHexFile,
    chunkSize: parseInt(elements.chunkSizeInput.value)
  };
}

// 验证配置
function validateConfig(config) {
  if (!config.port) {
    log('请选择串口', 'error');
    return false;
  }

  if (config.targetType === 'main') {
    if (!config.lowHexFile || !config.highHexFile) {
      log('请选择低字节和高字节HEX文件', 'error');
      return false;
    }
  } else if (config.targetType === 'cm') {
    if (!config.cmHexFile) {
      log('请选择CM核HEX文件', 'error');
      return false;
    }
  }

  return true;
}

// 更新UI状态
function updateUIForFlashing(isFlashing) {
  if (isFlashing) {
    elements.startFlashBtn.style.display = 'none';
    elements.stopFlashBtn.style.display = 'block';
    
    // 禁用配置控件
    elements.portSelect.disabled = true;
    elements.baudrateSelect.disabled = true;
    elements.slaveIdInput.disabled = true;
    elements.targetTypeRadios.forEach(radio => radio.disabled = true);
    elements.selectLowHexBtn.disabled = true;
    elements.selectHighHexBtn.disabled = true;
    elements.selectCmHexBtn.disabled = true;
    elements.enterBootloaderBtn.disabled = true;
    elements.jumpToAppBtn.disabled = true;
  } else {
    elements.startFlashBtn.style.display = 'block';
    elements.stopFlashBtn.style.display = 'none';
    
    // 启用配置控件
    elements.portSelect.disabled = false;
    elements.baudrateSelect.disabled = false;
    elements.slaveIdInput.disabled = false;
    elements.targetTypeRadios.forEach(radio => radio.disabled = false);
    elements.selectLowHexBtn.disabled = false;
    elements.selectHighHexBtn.disabled = false;
    elements.selectCmHexBtn.disabled = false;
    elements.enterBootloaderBtn.disabled = false;
    elements.jumpToAppBtn.disabled = false;
  }
}

// 更新进度
function updateProgress(percentage, stage) {
  elements.progressFill.style.width = `${percentage}%`;
  elements.progressText.textContent = `${percentage}%`;
}

// 重置进度
function resetProgress() {
  updateProgress(0, '');
  elements.progressDetails.textContent = '';
  elements.progressTime.textContent = '';
  appState.startTime = null;
}

// 更新状态
function updateStatus(status, message) {
  elements.statusText.textContent = message || status;
  
  const statusIcons = {
    'parsing': '📖',
    'connecting': '🔌',
    'entering-bootloader': '🚀',
    'set-target': '🎯',
    'erasing': '🗑️',
    'writing': '✍️',
    'flushing': '💾',
    'completing': '✅',
    'jumping': '🏃',
    'success': '✅',
    'error': '❌',
    'idle': '⚪'
  };

  elements.statusIcon.textContent = statusIcons[status] || '⚪';
}

// 添加日志
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString('zh-CN', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span>${message}`;
  
  // 如果是进度日志（包含"已写入:"），则更新最后一条进度日志
  if (message.includes('已写入:')) {
    const lastEntry = elements.logContent.lastElementChild;
    if (lastEntry && lastEntry.textContent.includes('已写入:')) {
      // 更新最后一条日志而不是添加新的
      lastEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span>${message}`;
      return;
    }
  }
  
  elements.logContent.appendChild(entry);
  
  // 限制日志最大条数为500条，避免性能问题
  const maxLogEntries = 500;
  while (elements.logContent.children.length > maxLogEntries) {
    elements.logContent.removeChild(elements.logContent.firstChild);
  }
  
  elements.logContent.scrollTop = elements.logContent.scrollHeight;
}

// 清空日志
function clearLog() {
  elements.logContent.innerHTML = '';
}

// 读取系统信息
async function readSystemInfo() {
  const config = {
    port: elements.portSelect.value,
    baudrate: parseInt(elements.baudrateSelect.value),
    slaveId: parseInt(elements.slaveIdInput.value)
  };

  if (!config.port) {
    log('请选择串口', 'error');
    return;
  }

  try {
    log('正在读取系统信息...', 'info');
    const result = await window.electronAPI.readSystemInfo(config);
    
    if (result.success) {
      displaySystemInfo(result);
      log('成功读取系统信息', 'success');
    } else {
      log(`读取系统信息失败: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`错误: ${error.message}`, 'error');
  }
}

// 显示系统信息
function displaySystemInfo(result) {
  const { bootloaderInfo, flashInfo, appInfo, isBootloaderMode, isAppValid } = result;
  
  // Bootloader信息
  elements.blMagic.textContent = `0x${bootloaderInfo.magic.toString(16).toUpperCase().padStart(4, '0')}`;
  if (isBootloaderMode) {
    elements.blMagic.textContent += ' ✅ Bootloader模式';
    elements.blMagic.className = 'info-value valid';
  } else {
    elements.blMagic.textContent += ' ⚠️ 应用模式';
    elements.blMagic.className = 'info-value';
  }
  
  elements.blVersion.textContent = `v${bootloaderInfo.majorVersion}.${bootloaderInfo.minorVersion} (0x${bootloaderInfo.version.toString(16).toUpperCase().padStart(4, '0')})`;
  elements.blState.textContent = `0x${bootloaderInfo.state.toString(16).toUpperCase().padStart(4, '0')}`;
  elements.blCapability.textContent = `0x${bootloaderInfo.capability.toString(16).toUpperCase().padStart(4, '0')}`;
  if (bootloaderInfo.capability & 0x0001) {
    elements.blCapability.textContent += ' (支持本地MCU编程)';
  }
  elements.blErrorCode.textContent = `0x${bootloaderInfo.errorCode.toString(16).toUpperCase().padStart(4, '0')}`;
  if (bootloaderInfo.errorCode === 0) {
    elements.blErrorCode.textContent += ' (无错误)';
    elements.blErrorCode.className = 'info-value valid';
  } else {
    elements.blErrorCode.className = 'info-value invalid';
  }
  
  // Flash信息
  const flashSizeKB = (flashInfo.size / 1024).toFixed(0);
  elements.flashSize.textContent = `${flashInfo.size} 字节 (${flashSizeKB} KB)`;
  elements.flashAppStart.textContent = `0x${flashInfo.appStart.toString(16).toUpperCase().padStart(8, '0')}`;
  const appMaxKB = (flashInfo.appMaxSize / 1024).toFixed(0);
  elements.flashAppMax.textContent = `${flashInfo.appMaxSize} 字节 (${appMaxKB} KB)`;
  
  // APP信息
  elements.infoValidFlag.textContent = `0x${appInfo.validFlag.toString(16).toUpperCase().padStart(4, '0')}`;
  elements.infoValidFlag.className = 'info-value ' + (isAppValid ? 'valid' : 'invalid');
  if (isAppValid) {
    elements.infoValidFlag.textContent += ' ✅ 有效';
  } else {
    elements.infoValidFlag.textContent += ' ❌ 无效';
  }

  elements.infoVersion.textContent = `v${appInfo.majorVersion}.${appInfo.minorVersion}`;
  elements.infoEntryAddr.textContent = `0x${appInfo.entryAddr.toString(16).toUpperCase().padStart(8, '0')}`;
  elements.infoStartAddr.textContent = `0x${appInfo.appStartAddr.toString(16).toUpperCase().padStart(8, '0')}`;

  const lengthKB = (appInfo.appLength / 1024).toFixed(2);
  elements.infoLength.textContent = `${appInfo.appLength} 字节 (${lengthKB} KB)`;
  elements.infoCrc32.textContent = `0x${appInfo.crc32.toString(16).toUpperCase().padStart(8, '0')}`;

  if (appInfo.timestamp > 0) {
    const date = new Date(appInfo.timestamp * 1000);
    elements.infoTimestamp.textContent = date.toLocaleString('zh-CN');
  } else {
    elements.infoTimestamp.textContent = '未设置';
  }

  elements.infoGitCommit.textContent = appInfo.gitCommitId > 0 
    ? `0x${appInfo.gitCommitId.toString(16).toUpperCase().padStart(8, '0')}` 
    : '未设置';
  elements.infoGitTag.textContent = appInfo.gitTag || '未设置';

  // 显示模态窗口
  elements.systemInfoModal.classList.add('show');
}

// 关闭模态窗口
function closeModal() {
  elements.systemInfoModal.classList.remove('show');
}

// 启动应用
init();
