// 应用程序状态
const appState = {
  isFlashing: false,
  selectedPorts: [],
  startTime: null,
  guiConfig: null,
  firmwareDocument: null,
  availableTargets: [],
  lastSystemInfo: null,
  eraseTargetType: 'main',
  isMemorySectionCollapsed: false,
  config: {
    firmwareFormat: 'hex2',
    port: '',
    baudrate: 250000,
    slaveId: 1,
    targetType: '',
    flashTargets: [],
    legacyFiles: {},
    hex2File: '',
    browseTarget: '',
    chunkSize: 64
  }
};

const MAX_MEMORY_BROWSE_LENGTH = 8 * 1024 * 1024;
const DEFAULT_MEMORY_BROWSE_LENGTH = 128;
const INITIAL_MEMORY_BROWSE_LENGTH = 1024;

function formatMemoryLength(value) {
  return `0x${value.toString(16).toUpperCase()}`;
}

function parseMemoryLength(value) {
  const text = String(value || '').trim();
  if (!text) {
    return Number.NaN;
  }

  if (text.startsWith('0x') || text.startsWith('0X')) {
    return parseInt(text, 16);
  }

  return parseInt(text, 10);
}

function isTargetCompleteForHex2Builder(target, files) {
  if (!target || !files) {
    return false;
  }

  if (target.bitWidth === 16) {
    return Boolean(files.low && files.high);
  }

  return Boolean(files.single);
}

// DOM元素
const elements = {
  // 串口配置
  portSelect: document.getElementById('port'),
  refreshPortsBtn: document.getElementById('refreshPorts'),
  baudrateSelect: document.getElementById('baudrate'),
  slaveIdInput: document.getElementById('slaveId'),

  // 固件来源
  firmwareFormatRadios: document.querySelectorAll('input[name="firmwareFormat"]'),

  // 目标选择
  targetTypeGroup: document.getElementById('targetTypeGroup'),
  targetTypeRadios: [],
  flashTargetCheckboxes: [],
  legacyTargetsSection: document.getElementById('legacyTargetsSection'),
  legacyTargetsContainer: document.getElementById('legacyTargetsContainer'),
  legacyTargetBlocks: [],
  legacyFileButtons: [],
  hex2Section: document.getElementById('hex2Section'),
  flashTargetSection: document.getElementById('flashTargetSection'),
  flashTargetGroup: document.getElementById('flashTargetGroup'),
  hex2TargetHint: document.getElementById('hex2TargetHint'),
  flashTargetHint: document.getElementById('flashTargetHint'),
  legacyTargetHint: document.getElementById('legacyTargetHint'),

  // 文件选择
  hex2Path: document.getElementById('hex2Path'),
  selectHex2Btn: document.getElementById('selectHex2'),

  // 固件AppInfo
  openAppInfoBtn: document.getElementById('openAppInfo'),
  openHex2BuilderBtn: document.getElementById('openHex2Builder'),
  openEraseModalBtn: document.getElementById('openEraseModal'),
  appInfoAddrInput: document.getElementById('appInfoAddr'),
  refreshAppInfoBtn: document.getElementById('refreshAppInfo'),
  appInfoStatus: document.getElementById('appInfoStatus'),
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
  closeSystemInfoModalBtn: document.getElementById('closeSystemInfoModal'),
  appInfoModal: document.getElementById('appInfoModal'),
  closeAppInfoModalBtn: document.getElementById('closeAppInfoModal'),
  hex2BuilderModal: document.getElementById('hex2BuilderModal'),
  closeHex2BuilderModalBtn: document.getElementById('closeHex2BuilderModal'),
  hex2BuilderTargetsContainer: document.getElementById('hex2BuilderTargetsContainer'),
  hex2BuilderOutputPath: document.getElementById('hex2BuilderOutputPath'),
  selectHex2BuilderOutputBtn: document.getElementById('selectHex2BuilderOutput'),
  createHex2BundleBtn: document.getElementById('createHex2Bundle'),
  hex2BuilderStatus: document.getElementById('hex2BuilderStatus'),
  eraseModal: document.getElementById('eraseModal'),
  closeEraseModalBtn: document.getElementById('closeEraseModal'),
  eraseTargetSwitch: document.getElementById('eraseTargetSwitch'),
  eraseTargetButtons: [],
  erasePresetRadios: document.querySelectorAll('input[name="erasePreset"]'),
  eraseBootloaderOption: document.getElementById('eraseBootloaderOption'),
  eraseTargetLabel: document.getElementById('eraseTargetLabel'),
  eraseRangeSource: document.getElementById('eraseRangeSource'),
  eraseStartAddr: document.getElementById('eraseStartAddr'),
  eraseEndAddr: document.getElementById('eraseEndAddr'),
  eraseLength: document.getElementById('eraseLength'),
  eraseStatus: document.getElementById('eraseStatus'),
  confirmEraseBtn: document.getElementById('confirmErase'),
  
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

  // 内存浏览器
  memorySection: document.getElementById('memorySection'),
  memorySectionBody: document.getElementById('memorySectionBody'),
  toggleMemorySectionBtn: document.getElementById('toggleMemorySection'),
  memoryTarget: document.getElementById('memoryTarget'),
  memoryStartAddr: document.getElementById('memoryStartAddr'),
  memoryLength: document.getElementById('memoryLength'),
  memorySummary: document.getElementById('memorySummary'),
  memoryTableBody: document.getElementById('memoryTableBody'),
  refreshMemoryBrowserBtn: document.getElementById('refreshMemoryBrowser'),

  // 状态栏
  connectionStatus: document.getElementById('connectionStatus')
};

// 初始化
async function init() {
  await loadGuiConfiguration();
  renderConfiguredTargetUI();
  setupEventListeners();
  await refreshSerialPorts();
  setupIPCListeners();
  updateTargetSections();
  updateMemorySectionVisibility();
  clearMemoryBrowser();
  log('应用程序已启动', 'info');
}

function getGuiTargets() {
  return appState.guiConfig && Array.isArray(appState.guiConfig.targets) ? appState.guiConfig.targets : [];
}

function getTargetConfig(targetId) {
  return getGuiTargets().find((target) => target.id === targetId) || null;
}

function getDefaultTargetId() {
  const fallback = getGuiTargets()[0];
  return (appState.guiConfig && appState.guiConfig.defaultTarget) || (fallback ? fallback.id : '');
}

function getAppInfoTargetConfig() {
  const fallback = getGuiTargets()[0] || null;
  if (!appState.guiConfig) {
    return fallback;
  }
  return getTargetConfig(appState.guiConfig.appInfoTarget) || fallback;
}

function getLegacyTargets() {
  return getGuiTargets().filter((target) => target.legacySupported);
}

function buildLegacyFileState() {
  const state = {};
  getGuiTargets().forEach((target) => {
    state[target.id] = target.bitWidth === 16
      ? { low: '', high: '' }
      : { single: '' };
  });
  return state;
}

async function loadGuiConfiguration() {
  const result = await window.electronAPI.loadGuiConfig();
  if (!result.success) {
    throw new Error(`加载 GUI 配置失败: ${result.error}`);
  }

  appState.guiConfig = result.config;
  appState.config.firmwareFormat = result.config.defaultFirmwareFormat || 'hex2';
  appState.config.targetType = getDefaultTargetId();
  appState.eraseTargetType = appState.config.targetType;
  appState.config.flashTargets = appState.config.targetType ? [appState.config.targetType] : [];
  appState.config.legacyFiles = buildLegacyFileState();

  elements.firmwareFormatRadios.forEach((radio) => {
    radio.checked = radio.value === appState.config.firmwareFormat;
  });
}

function renderConfiguredTargetUI() {
  renderTargetTypeOptions();
  renderLegacyTargetInputs();
  renderFlashTargetOptions();
  renderEraseTargetButtons();
  renderHex2BuilderInputs();
  refreshDynamicElementRefs();

  const appInfoTarget = getAppInfoTargetConfig();
  if (appInfoTarget) {
    elements.refreshAppInfoBtn.textContent = `解析${appInfoTarget.displayName} AppInfo`;
    elements.appInfoStatus.textContent = `仅解析 ${appInfoTarget.displayName} 对应固件区域`;
  }
}

function refreshDynamicElementRefs() {
  elements.targetTypeRadios = Array.from(document.querySelectorAll('input[name="targetType"]'));
  elements.flashTargetCheckboxes = Array.from(document.querySelectorAll('input[name="flashTarget"]'));
  elements.legacyTargetBlocks = Array.from(document.querySelectorAll('.legacy-target-block'));
  elements.legacyFileButtons = Array.from(document.querySelectorAll('.select-legacy-file'));
  elements.eraseTargetButtons = Array.from(document.querySelectorAll('.erase-target-btn'));
}

function renderHex2BuilderInputs() {
  elements.hex2BuilderTargetsContainer.innerHTML = getGuiTargets().map((target) => {
    const files = appState.config.legacyFiles[target.id] || {};
    const enabled = isTargetCompleteForHex2Builder(target, files);

    if (target.bitWidth === 16) {
      return `
        <section class="hex2-builder-target">
          <div class="hex2-builder-target-header">
            <label class="target-check-item">
              <input type="checkbox" id="hex2-builder-${target.id}-enabled" ${enabled ? 'checked' : ''}>
              包含 ${target.displayName}
            </label>
            <div class="hex2-builder-target-meta">target=${target.firmwareTarget} | ${target.bitWidth}位 | 需要 low/high</div>
          </div>
          <h3>${target.label}</h3>
          <div class="form-group">
            <label>低字节HEX:</label>
            <div class="file-input-group">
              <input type="text" id="hex2-builder-${target.id}-low-path" class="form-control" readonly placeholder="请选择文件..." value="${files.low || ''}">
              <button class="btn btn-primary select-hex2-builder-source" data-target-id="${target.id}" data-file-role="low">浏览</button>
            </div>
          </div>
          <div class="form-group">
            <label>高字节HEX:</label>
            <div class="file-input-group">
              <input type="text" id="hex2-builder-${target.id}-high-path" class="form-control" readonly placeholder="请选择文件..." value="${files.high || ''}">
              <button class="btn btn-primary select-hex2-builder-source" data-target-id="${target.id}" data-file-role="high">浏览</button>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="hex2-builder-target">
        <div class="hex2-builder-target-header">
          <label class="target-check-item">
            <input type="checkbox" id="hex2-builder-${target.id}-enabled" ${enabled ? 'checked' : ''}>
            包含 ${target.displayName}
          </label>
          <div class="hex2-builder-target-meta">target=${target.firmwareTarget} | ${target.bitWidth}位 | 单文件</div>
        </div>
        <h3>${target.label}</h3>
        <div class="form-group">
          <label>HEX文件:</label>
          <div class="file-input-group">
            <input type="text" id="hex2-builder-${target.id}-single-path" class="form-control" readonly placeholder="请选择文件..." value="${files.single || ''}">
            <button class="btn btn-primary select-hex2-builder-source" data-target-id="${target.id}" data-file-role="single">浏览</button>
          </div>
        </div>
      </section>
    `;
  }).join('');
}

function renderTargetTypeOptions() {
  elements.targetTypeGroup.innerHTML = getGuiTargets().map((target, index) => `
    <label>
      <input type="radio" name="targetType" value="${target.id}" ${index === 0 ? 'checked' : ''}>
      ${target.label} (${target.bitWidth}位固件)
    </label>
  `).join('');
}

function renderLegacyTargetInputs() {
  elements.legacyTargetsContainer.innerHTML = getLegacyTargets().map((target) => {
    if (target.bitWidth === 16) {
      return `
        <section class="legacy-target-block" data-legacy-target="${target.id}">
          <h3>${target.label}固件文件</h3>
          <div class="form-group">
            <label>低字节HEX:</label>
            <div class="file-input-group">
              <input type="text" id="legacy-${target.id}-low-path" class="form-control" readonly placeholder="请选择文件...">
              <button class="btn btn-primary select-legacy-file" data-target-id="${target.id}" data-file-role="low">浏览</button>
            </div>
          </div>
          <div class="form-group">
            <label>高字节HEX:</label>
            <div class="file-input-group">
              <input type="text" id="legacy-${target.id}-high-path" class="form-control" readonly placeholder="请选择文件...">
              <button class="btn btn-primary select-legacy-file" data-target-id="${target.id}" data-file-role="high">浏览</button>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="legacy-target-block" data-legacy-target="${target.id}">
        <h3>${target.label}固件文件</h3>
        <div class="form-group">
          <label>HEX文件:</label>
          <div class="file-input-group">
            <input type="text" id="legacy-${target.id}-single-path" class="form-control" readonly placeholder="请选择文件...">
            <button class="btn btn-primary select-legacy-file" data-target-id="${target.id}" data-file-role="single">浏览</button>
          </div>
        </div>
      </section>
    `;
  }).join('');
}

function renderFlashTargetOptions() {
  elements.flashTargetGroup.innerHTML = getGuiTargets().map((target) => `
    <label class="target-check-item">
      <input type="checkbox" name="flashTarget" value="${target.id}">
      ${target.label} (${target.displayName})
    </label>
  `).join('');
}

function renderEraseTargetButtons() {
  elements.eraseTargetSwitch.innerHTML = getGuiTargets().map((target) => `
    <button type="button" class="btn btn-secondary erase-target-btn" data-erase-target="${target.id}">${target.displayName}</button>
  `).join('');
}

function getLegacyPathInput(targetId, role) {
  return document.getElementById(`legacy-${targetId}-${role}-path`);
}

// 设置事件监听器
function setupEventListeners() {
  // 串口刷新
  elements.refreshPortsBtn.addEventListener('click', refreshSerialPorts);

  // 固件来源切换
  elements.firmwareFormatRadios.forEach(radio => {
    radio.addEventListener('change', async () => {
      appState.config.firmwareFormat = radio.value;
      const currentTarget = getTargetConfig(appState.config.targetType);
      if (appState.config.firmwareFormat === 'legacy' && currentTarget && !currentTarget.legacySupported) {
        const fallbackTarget = getLegacyTargets()[0];
        appState.config.targetType = fallbackTarget ? fallbackTarget.id : getDefaultTargetId();
      }
      syncTargetRadios();
      syncFlashTargetsForMode();
      updateTargetSections();
      await refreshLoadedFirmware();
      await refreshFirmwareAppInfoIfVisible();
    });
  });

  // 目标类型切换
  elements.targetTypeRadios.forEach(radio => {
    radio.addEventListener('change', async () => {
      appState.config.targetType = radio.value;
      if (appState.config.firmwareFormat === 'legacy') {
        appState.config.flashTargets = [radio.value];
      }

      const browseTarget = normalizeTargetTypeToBrowseTarget(radio.value);
      if (browseTarget && appState.availableTargets.some((item) => item.target === browseTarget)) {
        appState.config.browseTarget = browseTarget;
        elements.memoryTarget.value = browseTarget;
        const selectedTarget = getSelectedTargetSummary();
        if (selectedTarget) {
          elements.memoryStartAddr.value = formatHex(selectedTarget.minAddr, 8);
        }
      }

      updateTargetSections();
      if (appState.config.firmwareFormat === 'legacy') {
        await refreshLoadedFirmware();
      } else {
        await refreshMemoryBrowser();
      }
      await refreshFirmwareAppInfoIfVisible();
    });
  });

  elements.flashTargetCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      appState.config.flashTargets = getCheckedFlashTargets();
      updateFlashTargetSelectionUI();
    });
  });

  // 文件选择
  elements.legacyFileButtons.forEach((button) => {
    button.addEventListener('click', () => selectLegacyFile(button.dataset.targetId, button.dataset.fileRole));
  });
  elements.selectHex2Btn.addEventListener('click', () => selectFile('hex2'));
  elements.openAppInfoBtn.addEventListener('click', openAppInfoModal);
  elements.openHex2BuilderBtn.addEventListener('click', openHex2BuilderModal);
  elements.openEraseModalBtn.addEventListener('click', openEraseModal);
  elements.appInfoAddrInput.addEventListener('change', () => parseFirmwareAppInfo({ silent: false }));
  elements.refreshAppInfoBtn.addEventListener('click', () => parseFirmwareAppInfo({ silent: false }));
  elements.toggleMemorySectionBtn.addEventListener('click', toggleMemorySection);
  elements.refreshMemoryBrowserBtn.addEventListener('click', refreshMemoryBrowser);
  elements.memoryTarget.addEventListener('change', async () => {
    appState.config.browseTarget = elements.memoryTarget.value;
    const selectedTarget = getSelectedTargetSummary();
    if (selectedTarget) {
      elements.memoryStartAddr.value = formatHex(selectedTarget.minAddr, 8);
      elements.memoryLength.value = formatMemoryLength(getDefaultMemoryBrowseLength(selectedTarget));
    }
    syncBrowseTargetToTargetType();
    if (getGuiTargets().some((target) => target.firmwareTarget === appState.config.browseTarget)) {
      await refreshFirmwareAppInfoIfVisible();
    } else {
      clearFirmwareAppInfo();
    }
    await refreshMemoryBrowser();
  });
  elements.memoryStartAddr.addEventListener('change', refreshMemoryBrowser);
  elements.memoryLength.addEventListener('change', async () => {
    normalizeMemoryLengthInput();
    await refreshMemoryBrowser();
  });

  // 操作按钮
  elements.startFlashBtn.addEventListener('click', startFlash);
  elements.stopFlashBtn.addEventListener('click', stopFlash);
  elements.enterBootloaderBtn.addEventListener('click', enterBootloader);
  elements.jumpToAppBtn.addEventListener('click', jumpToApp);
  elements.readSystemInfoBtn.addEventListener('click', readSystemInfo);

  // 模态窗口
  elements.closeSystemInfoModalBtn.addEventListener('click', closeSystemInfoModal);
  elements.systemInfoModal.addEventListener('click', (e) => {
    if (e.target === elements.systemInfoModal) {
      closeSystemInfoModal();
    }
  });
  elements.closeAppInfoModalBtn.addEventListener('click', closeAppInfoModal);
  elements.appInfoModal.addEventListener('click', (e) => {
    if (e.target === elements.appInfoModal) {
      closeAppInfoModal();
    }
  });
  elements.closeHex2BuilderModalBtn.addEventListener('click', closeHex2BuilderModal);
  elements.hex2BuilderModal.addEventListener('click', (e) => {
    if (e.target === elements.hex2BuilderModal) {
      closeHex2BuilderModal();
    }
  });
  elements.hex2BuilderTargetsContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.select-hex2-builder-source');
    if (!button) {
      return;
    }
    void selectHex2BuilderSourceFile(button.dataset.targetId, button.dataset.fileRole);
  });
  elements.selectHex2BuilderOutputBtn.addEventListener('click', selectHex2BuilderOutputPath);
  elements.createHex2BundleBtn.addEventListener('click', createHex2Bundle);
  elements.closeEraseModalBtn.addEventListener('click', closeEraseModal);
  elements.eraseModal.addEventListener('click', (e) => {
    if (e.target === elements.eraseModal) {
      closeEraseModal();
    }
  });
  elements.eraseTargetButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      appState.eraseTargetType = button.dataset.eraseTarget || 'main';
      await updateEraseRangeByPreset();
    });
  });
  elements.erasePresetRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      void updateEraseRangeByPreset();
    });
  });
  elements.eraseStartAddr.addEventListener('input', updateCustomEraseLength);
  elements.eraseEndAddr.addEventListener('input', updateCustomEraseLength);
  elements.confirmEraseBtn.addEventListener('click', executeEraseFlash);

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
  const isLegacy = appState.config.firmwareFormat === 'legacy';

  elements.hex2Section.style.display = isLegacy ? 'none' : 'block';
  elements.flashTargetSection.style.display = isLegacy ? 'none' : 'block';
  elements.legacyTargetsSection.style.display = isLegacy ? 'block' : 'none';
  elements.legacyTargetBlocks.forEach((block) => {
    block.style.display = isLegacy && block.dataset.legacyTarget === appState.config.targetType ? 'block' : 'none';
  });
  elements.hex2TargetHint.style.display = isLegacy ? 'none' : 'block';
  const unsupportedLegacyTargets = getGuiTargets().filter((target) => !target.legacySupported).map((target) => target.displayName);
  elements.legacyTargetHint.style.display = isLegacy && unsupportedLegacyTargets.length > 0 ? 'block' : 'none';
  if (unsupportedLegacyTargets.length > 0) {
    elements.legacyTargetHint.textContent = `分离HEX模式下不可用目标: ${unsupportedLegacyTargets.join('、')}`;
  }

  updateTargetRadioAvailability();
  updateFlashTargetSelectionUI();
}

function normalizeTargetTypeToBrowseTarget(targetType) {
  const target = getTargetConfig(targetType);
  return target ? target.firmwareTarget : '';
}

function normalizeBrowseTargetToTargetType(target) {
  const matched = getGuiTargets().find((item) => item.firmwareTarget === target);
  return matched ? matched.id : '';
}

function syncBrowseTargetToTargetType() {
  if (!appState.config.browseTarget) {
    return;
  }

  const mapped = normalizeBrowseTargetToTargetType(appState.config.browseTarget);
  if (!mapped) {
    updateTargetSections();
    return;
  }

  appState.config.targetType = mapped;
  syncTargetRadios();
  updateTargetSections();
}

function getCheckedFlashTargets() {
  return Array.from(elements.flashTargetCheckboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function syncTargetRadios() {
  elements.targetTypeRadios.forEach((radio) => {
    radio.checked = radio.value === appState.config.targetType;
  });
}

function getAvailableTargetTypesForCurrentMode() {
  if (appState.config.firmwareFormat === 'legacy') {
    return getLegacyTargets().map((target) => target.id);
  }

  return appState.availableTargets
    .map((item) => normalizeBrowseTargetToTargetType(item.target))
    .filter((value, index, array) => value && array.indexOf(value) === index);
}

function syncFlashTargetsForMode() {
  if (appState.config.firmwareFormat === 'legacy') {
    appState.config.flashTargets = [appState.config.targetType];
    return;
  }

  const available = getAvailableTargetTypesForCurrentMode();
  const currentSelection = appState.config.flashTargets.filter((target) => available.includes(target));
  appState.config.flashTargets = currentSelection.length ? currentSelection : [...available];
}

function updateTargetRadioAvailability() {
  const available = getAvailableTargetTypesForCurrentMode();

  elements.targetTypeRadios.forEach((radio) => {
    const target = getTargetConfig(radio.value);
    const isUnavailableInHex2 = appState.config.firmwareFormat === 'hex2' && !available.includes(radio.value);
    const isDisabled = appState.config.firmwareFormat === 'legacy'
      ? !target || !target.legacySupported
      : isUnavailableInHex2;

    radio.disabled = isDisabled;

    if (!isDisabled && !available.includes(appState.config.targetType) && available.length > 0) {
      appState.config.targetType = available[0];
    }
  });

  syncTargetRadios();
}

function updateFlashTargetSelectionUI() {
  const available = getAvailableTargetTypesForCurrentMode();

  elements.flashTargetCheckboxes.forEach((checkbox) => {
    const label = checkbox.closest('.target-check-item');
    const enabled = appState.config.firmwareFormat === 'hex2' && available.includes(checkbox.value);
    checkbox.disabled = !enabled;
    checkbox.checked = enabled && appState.config.flashTargets.includes(checkbox.value);

    if (label) {
      label.classList.toggle('disabled', !enabled);
    }
  });

  if (appState.config.firmwareFormat === 'hex2') {
    const selectedCount = appState.config.flashTargets.filter((target) => available.includes(target)).length;
    const orderedLabels = getGuiTargets()
      .slice()
      .sort((left, right) => right.flashPriority - left.flashPriority)
      .map((target) => target.displayName)
      .join(' → ');
    elements.flashTargetHint.textContent = selectedCount > 1
      ? `已启用多目标烧录；执行顺序固定为 ${orderedLabels}。`
      : `可多选；执行时按 ${orderedLabels} 的顺序依次烧录。`;
  }
}

// 选择文件
async function selectFile(type) {
  try {
    const result = await window.electronAPI.selectFile({
      title: '选择固件文件'
    });

    if (result.success && !result.canceled) {
      if (type === 'hex2') {
        appState.config.hex2File = result.filePath;
        elements.hex2Path.value = result.filePath;
        log(`已选择HEX2文件: ${result.filePath}`, 'info');
      }

      await refreshLoadedFirmware();
      await refreshFirmwareAppInfoIfVisible();
    }
  } catch (error) {
    log(`选择文件错误: ${error.message}`, 'error');
  }
}

async function selectLegacyFile(targetId, fileRole) {
  try {
    const result = await window.electronAPI.selectFile({
      title: '选择固件文件'
    });

    if (result.success && !result.canceled) {
      if (!appState.config.legacyFiles[targetId]) {
        appState.config.legacyFiles[targetId] = {};
      }
      appState.config.legacyFiles[targetId][fileRole] = result.filePath;
      const input = getLegacyPathInput(targetId, fileRole);
      if (input) {
        input.value = result.filePath;
      }
      setHex2BuilderSourceInputValue(targetId, fileRole, result.filePath);

      const target = getTargetConfig(targetId);
      const roleText = fileRole === 'single' ? 'HEX文件' : `${fileRole === 'low' ? '低字节' : '高字节'}HEX文件`;
      log(`已选择${target ? target.label : targetId}${roleText}: ${result.filePath}`, 'info');
      await refreshLoadedFirmware();
      await refreshFirmwareAppInfoIfVisible();
    }
  } catch (error) {
    log(`选择文件错误: ${error.message}`, 'error');
  }
}

function getHex2BuilderPathInput(targetId, role) {
  return document.getElementById(`hex2-builder-${targetId}-${role}-path`);
}

function getHex2BuilderEnabledInput(targetId) {
  return document.getElementById(`hex2-builder-${targetId}-enabled`);
}

function setHex2BuilderSourceInputValue(targetId, fileRole, value) {
  const input = getHex2BuilderPathInput(targetId, fileRole);
  if (input) {
    input.value = value || '';
  }

  const target = getTargetConfig(targetId);
  const enabledInput = getHex2BuilderEnabledInput(targetId);
  if (enabledInput && isTargetCompleteForHex2Builder(target, appState.config.legacyFiles[targetId] || {})) {
    enabledInput.checked = true;
  }
}

function setHex2BuilderStatus(message) {
  elements.hex2BuilderStatus.textContent = message;
}

async function selectHex2BuilderSourceFile(targetId, fileRole) {
  try {
    const result = await window.electronAPI.selectFile({
      title: '选择固件文件'
    });

    if (!result.success || result.canceled) {
      return;
    }

    if (!appState.config.legacyFiles[targetId]) {
      appState.config.legacyFiles[targetId] = {};
    }
    appState.config.legacyFiles[targetId][fileRole] = result.filePath;

    const legacyInput = getLegacyPathInput(targetId, fileRole);
    if (legacyInput) {
      legacyInput.value = result.filePath;
    }
    setHex2BuilderSourceInputValue(targetId, fileRole, result.filePath);

    const target = getTargetConfig(targetId);
    const roleText = fileRole === 'single' ? 'HEX文件' : `${fileRole === 'low' ? '低字节' : '高字节'}HEX文件`;
    setHex2BuilderStatus(`已更新 ${target ? target.displayName : targetId} 的${roleText}`);
  } catch (error) {
    setHex2BuilderStatus(error.message);
    log(`选择 HEX2 创建源文件错误: ${error.message}`, 'error');
  }
}

async function selectHex2BuilderOutputPath() {
  try {
    const result = await window.electronAPI.selectSaveFile({
      title: '保存 HEX2 组合文件',
      defaultPath: elements.hex2BuilderOutputPath.value || undefined
    });

    if (!result.success || result.canceled) {
      return;
    }

    elements.hex2BuilderOutputPath.value = result.filePath;
    setHex2BuilderStatus('已选择输出文件，点击“生成 HEX2”开始创建。');
  } catch (error) {
    setHex2BuilderStatus(error.message);
    log(`选择 HEX2 输出路径错误: ${error.message}`, 'error');
  }
}

function collectHex2BuilderTargets() {
  const selectedTargets = [];

  getGuiTargets().forEach((target) => {
    const enabledInput = getHex2BuilderEnabledInput(target.id);
    if (!enabledInput || !enabledInput.checked) {
      return;
    }

    const files = appState.config.legacyFiles[target.id] || {};
    if (target.bitWidth === 16) {
      if (!files.low || !files.high) {
        throw new Error(`${target.displayName} 缺少 low/high 文件`);
      }

      selectedTargets.push({
        id: target.id,
        files: {
          low: files.low,
          high: files.high
        }
      });
      return;
    }

    if (!files.single) {
      throw new Error(`${target.displayName} 缺少 HEX 文件`);
    }

    selectedTargets.push({
      id: target.id,
      files: {
        single: files.single
      }
    });
  });

  if (!selectedTargets.length) {
    throw new Error('请至少勾选一个目标并提供完整源文件');
  }

  return selectedTargets;
}

async function openHex2BuilderModal() {
  if (appState.isFlashing) {
    log('烧录过程中不能创建 HEX2 文件', 'warning');
    return;
  }

  renderHex2BuilderInputs();
  setHex2BuilderStatus('生成后会自动切换到新建的 HEX2 文件。');
  elements.hex2BuilderModal.classList.add('show');
}

function closeHex2BuilderModal() {
  elements.hex2BuilderModal.classList.remove('show');
}

async function createHex2Bundle() {
  try {
    const outputPath = elements.hex2BuilderOutputPath.value.trim();
    if (!outputPath) {
      throw new Error('请先选择输出文件路径');
    }

    const targets = collectHex2BuilderTargets();
    elements.createHex2BundleBtn.disabled = true;
    setHex2BuilderStatus('正在生成 HEX2 文件...');

    const result = await window.electronAPI.createHex2File({
      outputPath,
      targets
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    appState.config.hex2File = outputPath;
    appState.config.firmwareFormat = 'hex2';
    elements.hex2Path.value = outputPath;
    elements.firmwareFormatRadios.forEach((radio) => {
      radio.checked = radio.value === 'hex2';
    });

    setHex2BuilderStatus(`HEX2 创建成功，包含 ${result.segments.join('；')}`);
    log(`HEX2 创建成功: ${outputPath}`, 'success');
    closeHex2BuilderModal();
    await refreshLoadedFirmware();
    await refreshFirmwareAppInfoIfVisible();
  } catch (error) {
    setHex2BuilderStatus(error.message);
    log(`HEX2 创建失败: ${error.message}`, 'error');
  } finally {
    elements.createHex2BundleBtn.disabled = false;
  }
}

function clearMemoryBrowser(message = '请选择固件文件以查看解析后的内存内容') {
  elements.memorySummary.textContent = '未加载固件';
  elements.memoryTableBody.innerHTML = `<tr><td colspan="18" class="memory-empty">${message}</td></tr>`;
}

function normalizeMemoryLengthInput() {
  const rawValue = elements.memoryLength.value.trim();
  const parsed = parseMemoryLength(rawValue);

  if (Number.isNaN(parsed) || parsed <= 0) {
    elements.memoryLength.value = formatMemoryLength(DEFAULT_MEMORY_BROWSE_LENGTH);
    return DEFAULT_MEMORY_BROWSE_LENGTH;
  }

  const normalized = Math.min(parsed, MAX_MEMORY_BROWSE_LENGTH);
  elements.memoryLength.value = formatMemoryLength(normalized);
  return normalized;
}

function getDefaultMemoryBrowseLength(targetSummary) {
  if (!targetSummary || !Number.isFinite(targetSummary.totalBytes) || targetSummary.totalBytes <= 0) {
    return DEFAULT_MEMORY_BROWSE_LENGTH;
  }

  return Math.min(targetSummary.totalBytes, INITIAL_MEMORY_BROWSE_LENGTH, MAX_MEMORY_BROWSE_LENGTH);
}

function updateMemorySectionVisibility() {
  elements.memorySection.classList.toggle('collapsed', appState.isMemorySectionCollapsed);
  elements.toggleMemorySectionBtn.setAttribute('aria-expanded', String(!appState.isMemorySectionCollapsed));
}

function toggleMemorySection() {
  appState.isMemorySectionCollapsed = !appState.isMemorySectionCollapsed;
  updateMemorySectionVisibility();
}

function getSelectedTargetSummary() {
  return appState.availableTargets.find((item) => item.target === appState.config.browseTarget) || null;
}

function renderByteCells(bytes) {
  return bytes.map((value, index) => {
    const classes = ['memory-byte-cell'];

    if (value === 0xFF) {
      classes.push('byte-ff');
    } else if (value === 0x00) {
      classes.push('byte-zero');
    }

    if (value >= 32 && value <= 126) {
      classes.push('byte-printable');
    }

    if (index === 7) {
      classes.push('byte-group-split');
    }

    return `<td class="${classes.join(' ')}">${value.toString(16).toUpperCase().padStart(2, '0')}</td>`;
  }).join('');
}

function renderMemoryBrowser(memoryResult, targetSummary) {
  const segmentText = targetSummary.segmentNames && targetSummary.segmentNames.length
    ? ` | 段 ${targetSummary.segmentNames.join(', ')}`
    : '';
  const missingText = memoryResult.missing > 0
    ? ` | 视图内缺失填充 ${memoryResult.missing} 字节`
    : '';

  elements.memorySummary.textContent = `${targetSummary.target} | ${targetSummary.addrUnit} | 块数 ${targetSummary.blockCount} | 起始 ${formatHex(targetSummary.minAddr, 8)} | 长度 ${targetSummary.totalBytes} 字节${segmentText}${missingText}`;
  elements.memoryTableBody.innerHTML = '';

  if (!memoryResult.rows.length) {
    clearMemoryBrowser('当前范围内无可显示数据');
    return;
  }

  for (const row of memoryResult.rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatHex(row.address, 8)}</td>
      ${renderByteCells(row.bytes)}
      <td class="memory-ascii-cell">${row.ascii}</td>
    `;
    elements.memoryTableBody.appendChild(tr);
  }
}

async function refreshLoadedFirmware() {
  try {
    if (!hasFirmwareSelection()) {
      appState.firmwareDocument = null;
      appState.availableTargets = [];
      appState.config.flashTargets = appState.config.firmwareFormat === 'legacy' ? [appState.config.targetType] : [];
      elements.memoryTarget.innerHTML = '<option value="">暂无已加载目标</option>';
      clearMemoryBrowser();
      clearFirmwareAppInfo();
      updateTargetSections();
      return;
    }

    const result = await window.electronAPI.loadFirmwareDocument(collectConfig());
    if (!result.success) {
      appState.firmwareDocument = null;
      appState.availableTargets = [];
      appState.config.flashTargets = appState.config.firmwareFormat === 'legacy' ? [appState.config.targetType] : [];
      elements.memoryTarget.innerHTML = '<option value="">暂无已加载目标</option>';
      clearMemoryBrowser(result.error);
      updateTargetSections();
      log(`固件解析失败: ${result.error}`, 'warning');
      return;
    }

    appState.firmwareDocument = result;
    appState.availableTargets = result.targets || [];
    syncFlashTargetsForMode();
    populateMemoryTargets();
    updateTargetSections();
    await refreshMemoryBrowser();
  } catch (error) {
    appState.firmwareDocument = null;
    appState.availableTargets = [];
    appState.config.flashTargets = appState.config.firmwareFormat === 'legacy' ? [appState.config.targetType] : [];
    clearMemoryBrowser(error.message);
    updateTargetSections();
    log(`固件加载错误: ${error.message}`, 'error');
  }
}

function populateMemoryTargets() {
  elements.memoryTarget.innerHTML = '';

  if (!appState.availableTargets.length) {
    elements.memoryTarget.innerHTML = '<option value="">暂无已加载目标</option>';
    appState.config.browseTarget = '';
    return;
  }

  const preferredTarget = normalizeTargetTypeToBrowseTarget(appState.config.targetType);
  const availableTargetNames = appState.availableTargets.map((item) => item.target);

  if (!appState.config.browseTarget || !availableTargetNames.includes(appState.config.browseTarget)) {
    appState.config.browseTarget = availableTargetNames.includes(preferredTarget)
      ? preferredTarget
      : appState.availableTargets[0].target;
  }

  const selectedTarget = appState.availableTargets.find((target) => target.target === appState.config.browseTarget);
  if (selectedTarget) {
    elements.memoryStartAddr.value = formatHex(selectedTarget.minAddr, 8);
    elements.memoryLength.value = formatMemoryLength(getDefaultMemoryBrowseLength(selectedTarget));
  }

  appState.availableTargets.forEach((target) => {
    const option = document.createElement('option');
    option.value = target.target;
    option.textContent = `${target.target} (${target.addrUnit})`;
    option.selected = target.target === appState.config.browseTarget;
    elements.memoryTarget.appendChild(option);
  });

  syncBrowseTargetToTargetType();
}

async function refreshMemoryBrowser() {
  if (!appState.firmwareDocument || !appState.config.browseTarget) {
    clearMemoryBrowser();
    return;
  }

  try {
    const browseLength = normalizeMemoryLengthInput();
    const result = await window.electronAPI.browseFirmwareMemory({
      ...collectConfig(),
      browseTarget: appState.config.browseTarget,
      startAddress: elements.memoryStartAddr.value.trim(),
      length: browseLength
    });

    if (!result.success) {
      clearMemoryBrowser(result.error);
      return;
    }

    if (!elements.memoryStartAddr.value.trim()) {
      elements.memoryStartAddr.value = formatHex(result.memory.startAddress, 8);
    }

    renderMemoryBrowser(result.memory, result.target);
  } catch (error) {
    clearMemoryBrowser(error.message);
  }
}

function hasFirmwareSelection() {
  if (appState.config.firmwareFormat === 'hex2') {
    return Boolean(appState.config.hex2File);
  }

  const target = getTargetConfig(appState.config.targetType);
  const files = appState.config.legacyFiles[appState.config.targetType] || {};
  if (!target) {
    return false;
  }

  if (target.bitWidth === 16) {
    return Boolean(files.low && files.high);
  }

  if (target.bitWidth === 8) {
    return Boolean(files.single);
  }

  return false;
}

function formatHex(value, width) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
}

function getQuickActionConfig() {
  return {
    port: elements.portSelect.value,
    baudrate: parseInt(elements.baudrateSelect.value),
    slaveId: parseInt(elements.slaveIdInput.value),
    targetType: appState.config.targetType
  };
}

function getEraseTargetType() {
  return appState.eraseTargetType || appState.config.targetType || 'main';
}

function getTargetDisplayName(targetType) {
  const target = getTargetConfig(targetType);
  return target ? target.displayName : targetType;
}

function getSelectedErasePreset() {
  const selected = Array.from(elements.erasePresetRadios).find((radio) => radio.checked);
  return selected ? selected.value : 'bootloader';
}

function setEraseStatus(message) {
  elements.eraseStatus.textContent = message;
}

function applyEraseRange(range, sourceText, editable = false) {
  elements.eraseStartAddr.value = formatHex(range.start, 8);
  elements.eraseEndAddr.value = formatHex(range.endExclusive, 8);
  elements.eraseLength.value = formatHex(range.endExclusive - range.start, 8);
  elements.eraseStartAddr.readOnly = !editable;
  elements.eraseEndAddr.readOnly = !editable;
  elements.eraseLength.readOnly = true;
  elements.eraseRangeSource.textContent = sourceText;
}

function getBootloaderEraseRange() {
  const target = getTargetConfig(getEraseTargetType());
  const bootloaderErase = target && target.bootloaderErase;
  if (!bootloaderErase || !bootloaderErase.defaultStart || !bootloaderErase.defaultEndExclusive) {
    return {
      start: 0x00080000,
      endExclusive: 0x00088000,
      editable: true
    };
  }

  return {
    start: parseMemoryLength(bootloaderErase.defaultStart),
    endExclusive: parseMemoryLength(bootloaderErase.defaultEndExclusive),
    editable: bootloaderErase.editable !== false
  };
}

function setErasePreset(value) {
  elements.erasePresetRadios.forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

function updateEraseTargetButtonsUI() {
  const targetType = getEraseTargetType();
  elements.eraseTargetButtons.forEach((button) => {
    const isActive = button.dataset.eraseTarget === targetType;
    button.classList.toggle('active', isActive);
    button.classList.toggle('btn-primary', isActive);
    button.classList.toggle('btn-secondary', !isActive);
  });

  const target = getTargetConfig(targetType);
  const showBootloader = Boolean(target && target.bootloaderErase && target.bootloaderErase.enabled);
  elements.eraseBootloaderOption.style.display = showBootloader ? 'flex' : 'none';
  if (!showBootloader && getSelectedErasePreset() === 'bootloader') {
    setErasePreset('app');
  }
}

function updateCustomEraseLength() {
  if (getSelectedErasePreset() !== 'custom') {
    return;
  }

  const start = parseMemoryLength(elements.eraseStartAddr.value);
  const endExclusive = parseMemoryLength(elements.eraseEndAddr.value);

  if (Number.isNaN(start) || Number.isNaN(endExclusive) || endExclusive <= start) {
    elements.eraseLength.value = '-';
    setEraseStatus('请输入有效的自定义范围，结束地址必须大于起始地址。');
    return;
  }

  elements.eraseLength.value = formatHex(endExclusive - start, 8);
  elements.eraseRangeSource.textContent = '自定义输入范围';
  setEraseStatus(`将按自定义起止范围擦除 ${getTargetDisplayName(getEraseTargetType())}。`);
}

async function fetchSystemInfo(options = {}) {
  const { showModal = true, silent = false } = options;
  const config = getQuickActionConfig();

  if (!config.port) {
    if (!silent) {
      log('请选择串口', 'error');
    }
    return null;
  }

  try {
    if (!silent) {
      log('正在读取系统信息...', 'info');
    }

    const result = await window.electronAPI.readSystemInfo(config);
    if (!result.success) {
      if (!silent) {
        log(`读取系统信息失败: ${result.error}`, 'error');
      }
      return null;
    }

    appState.lastSystemInfo = {
      targetType: config.targetType,
      result
    };

    if (showModal) {
      displaySystemInfo(result);
    }

    if (!silent) {
      log('成功读取系统信息', 'success');
    }

    return result;
  } catch (error) {
    if (!silent) {
      log(`错误: ${error.message}`, 'error');
    }
    return null;
  }
}

async function updateEraseRangeByPreset() {
  const targetType = getEraseTargetType();
  updateEraseTargetButtonsUI();
  elements.eraseTargetLabel.textContent = getTargetDisplayName(targetType);

  if (getSelectedErasePreset() === 'bootloader') {
    const range = getBootloaderEraseRange();
    applyEraseRange(range, `${getTargetDisplayName(targetType)} Bootloader 默认范围`, range.editable !== false);
    setEraseStatus(`将擦除 ${getTargetDisplayName(targetType)} Bootloader 范围${range.editable !== false ? '，可按需手动修改起始和结束地址。' : '。'}`);
    return;
  }

  if (getSelectedErasePreset() === 'app') {
    elements.eraseStartAddr.value = '-';
    elements.eraseEndAddr.value = '-';
    elements.eraseLength.value = '由设备返回';
    elements.eraseStartAddr.readOnly = true;
    elements.eraseEndAddr.readOnly = true;
    elements.eraseLength.readOnly = true;
    elements.eraseRangeSource.textContent = '默认 APP 全擦除命令';
    setEraseStatus(`将对 ${getTargetDisplayName(targetType)} 发送默认 APP 全擦除命令。`);
    return;
  }

  if (!elements.eraseStartAddr.value || !elements.eraseEndAddr.value || elements.eraseLength.value === '-') {
    applyEraseRange(getBootloaderEraseRange(), '自定义输入范围', true);
  } else {
    elements.eraseStartAddr.readOnly = false;
    elements.eraseEndAddr.readOnly = false;
    elements.eraseRangeSource.textContent = '自定义输入范围';
  }
  updateCustomEraseLength();
}

async function openEraseModal() {
  if (appState.isFlashing) {
    log('烧录过程中不能执行独立擦除', 'warning');
    return;
  }

  appState.eraseTargetType = appState.config.targetType;
  elements.eraseModal.classList.add('show');
  await updateEraseRangeByPreset();
}

function closeEraseModal() {
  elements.eraseModal.classList.remove('show');
}

async function executeEraseFlash() {
  if (appState.isFlashing) {
    log('烧录过程中不能执行独立擦除', 'warning');
    return;
  }

  const config = getQuickActionConfig();
  if (!config.port) {
    setEraseStatus('请先选择串口。');
    log('请选择串口', 'error');
    return;
  }

  config.targetType = getEraseTargetType();

  let start = parseMemoryLength(elements.eraseStartAddr.value);
  let endExclusive = parseMemoryLength(elements.eraseEndAddr.value);
  const preset = getSelectedErasePreset();

  if (preset !== 'app' && (Number.isNaN(start) || Number.isNaN(endExclusive) || endExclusive <= start)) {
    setEraseStatus('擦除范围无效，请检查起始和结束地址。');
    log('擦除范围无效，请检查起始和结束地址', 'error');
    return;
  }

  const length = preset === 'app' ? null : (endExclusive - start);
  const description = preset === 'app'
    ? `${getTargetDisplayName(config.targetType)} APP 默认全擦除`
    : `${getTargetDisplayName(config.targetType)}: ${formatHex(start, 8)} - ${formatHex(endExclusive, 8)} (长度 ${formatHex(length, 8)})`;
  if (!window.confirm(`确认擦除 ${description} 吗？`)) {
    return;
  }

  elements.confirmEraseBtn.disabled = true;

  try {
    log(`开始擦除 ${description}`, 'warning');
    setEraseStatus('正在执行擦除，请勿断电或断开连接。');

    const result = await window.electronAPI.eraseFlash({
      ...config,
      eraseMode: preset,
      startAddr: preset === 'app' ? undefined : start,
      length: preset === 'app' ? undefined : length
    });

    if (!result.success) {
      setEraseStatus(result.error);
      log(`擦除失败: ${result.error}`, 'error');
      return;
    }

    elements.eraseStartAddr.value = formatHex(result.startAddr, 8);
    elements.eraseLength.value = formatHex(result.length, 8);
    elements.eraseEndAddr.value = formatHex(result.startAddr + result.length, 8);
    setEraseStatus('擦除完成。');
    log(`擦除完成: 起始 ${formatHex(result.startAddr, 8)}, 长度 ${formatHex(result.length, 8)}`, 'success');
  } catch (error) {
    setEraseStatus(error.message);
    log(`擦除错误: ${error.message}`, 'error');
  } finally {
    elements.confirmEraseBtn.disabled = false;
  }
}

function clearFirmwareAppInfo() {
  const appInfoTarget = getAppInfoTargetConfig();
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
  elements.appInfoStatus.textContent = appInfoTarget
    ? `仅解析 ${appInfoTarget.displayName} 对应固件区域`
    : '仅解析已配置 AppInfo 目标对应固件区域';
}

function renderFirmwareAppInfo(appInfo) {
  const appInfoTarget = getAppInfoTargetConfig();
  elements.appInfoStatus.textContent = appInfoTarget
    ? `已解析 ${appInfoTarget.displayName} 对应固件区域`
    : '已解析配置的 AppInfo 目标区域';
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

async function parseFirmwareAppInfo(options = {}) {
  const { silent = true } = options;
  const addrText = elements.appInfoAddrInput.value.trim();
  if (!addrText) {
    clearFirmwareAppInfo();
    elements.appInfoStatus.textContent = '请输入 AppInfo 地址';
    return;
  }

  if (!hasFirmwareSelection()) {
    clearFirmwareAppInfo();
    const appInfoTarget = getAppInfoTargetConfig();
    elements.appInfoStatus.textContent = appInfoTarget
      ? `请先加载包含 ${appInfoTarget.displayName} 的固件`
      : '请先加载包含 AppInfo 目标的固件';
    return;
  }

  try {
    const appInfoTarget = getAppInfoTargetConfig();
    const result = await window.electronAPI.parseFirmwareAppInfo({
      firmwareFormat: appState.config.firmwareFormat,
      targetType: appInfoTarget ? appInfoTarget.id : appState.config.targetType,
      legacyFiles: appState.config.legacyFiles,
      hex2File: appState.config.hex2File,
      appInfoAddr: addrText
    });

    if (result.success) {
      renderFirmwareAppInfo(result.appInfo);
    } else {
      clearFirmwareAppInfo();
      elements.appInfoStatus.textContent = result.error;
      if (!silent) {
        log(`AppInfo解析失败: ${result.error}`, 'warning');
      }
    }
  } catch (error) {
    clearFirmwareAppInfo();
    elements.appInfoStatus.textContent = error.message;
    if (!silent) {
      log(`AppInfo解析错误: ${error.message}`, 'error');
    }
  }
}

async function refreshFirmwareAppInfoIfVisible() {
  if (!elements.appInfoModal.classList.contains('show')) {
    return;
  }

  await parseFirmwareAppInfo({ silent: true });
}

async function openAppInfoModal() {
  elements.appInfoModal.classList.add('show');
  clearFirmwareAppInfo();
  await parseFirmwareAppInfo({ silent: false });
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
    firmwareFormat: appState.config.firmwareFormat,
    port: elements.portSelect.value,
    baudrate: parseInt(elements.baudrateSelect.value),
    slaveId: parseInt(elements.slaveIdInput.value),
    targetType: appState.config.targetType,
    flashTargets: [...appState.config.flashTargets],
    legacyFiles: appState.config.legacyFiles,
    hex2File: appState.config.hex2File,
    chunkSize: parseInt(elements.chunkSizeInput.value)
  };
}

// 验证配置
function validateConfig(config) {
  if (!config.port) {
    log('请选择串口', 'error');
    return false;
  }

  if (config.firmwareFormat === 'hex2') {
    if (!config.hex2File) {
      log('请选择HEX2文件', 'error');
      return false;
    }

    const selectedTargets = Array.isArray(config.flashTargets) ? config.flashTargets : [];
    if (selectedTargets.length === 0) {
      log('请至少选择一个烧录目标', 'error');
      return false;
    }

    const available = getAvailableTargetTypesForCurrentMode();
    const invalidTarget = selectedTargets.find((target) => !available.includes(target));
    if (invalidTarget) {
      log(`烧录目标 ${invalidTarget} 当前固件中不存在`, 'error');
      return false;
    }
  } else {
    const target = getTargetConfig(config.targetType);
    const files = config.legacyFiles && config.legacyFiles[config.targetType] ? config.legacyFiles[config.targetType] : {};
    if (!target) {
      log('当前目标未在 GUI 配置中定义', 'error');
      return false;
    }

    if (target.bitWidth === 16 && (!files.low || !files.high)) {
      log(`请选择 ${target.label} 的低字节和高字节HEX文件`, 'error');
      return false;
    }

    if (target.bitWidth === 8 && !files.single) {
      log(`请选择 ${target.label} 的HEX文件`, 'error');
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
    elements.flashTargetCheckboxes.forEach(checkbox => checkbox.disabled = true);
    elements.firmwareFormatRadios.forEach(radio => radio.disabled = true);
    elements.legacyFileButtons.forEach((button) => button.disabled = true);
    elements.selectHex2Btn.disabled = true;
    elements.openHex2BuilderBtn.disabled = true;
    elements.enterBootloaderBtn.disabled = true;
    elements.jumpToAppBtn.disabled = true;
    elements.refreshMemoryBrowserBtn.disabled = true;
  } else {
    elements.startFlashBtn.style.display = 'block';
    elements.stopFlashBtn.style.display = 'none';
    
    // 启用配置控件
    elements.portSelect.disabled = false;
    elements.baudrateSelect.disabled = false;
    elements.slaveIdInput.disabled = false;
    elements.firmwareFormatRadios.forEach(radio => radio.disabled = false);
    elements.legacyFileButtons.forEach((button) => button.disabled = false);
    elements.selectHex2Btn.disabled = false;
    elements.openHex2BuilderBtn.disabled = false;
    elements.enterBootloaderBtn.disabled = false;
    elements.jumpToAppBtn.disabled = false;
    elements.refreshMemoryBrowserBtn.disabled = false;
    updateTargetSections();
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
  await fetchSystemInfo({ showModal: true, silent: false });
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

function closeSystemInfoModal() {
  elements.systemInfoModal.classList.remove('show');
}

function closeAppInfoModal() {
  elements.appInfoModal.classList.remove('show');
}

// 启动应用
init();
