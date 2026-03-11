const fs = require('fs');
const path = require('path');

const DEFAULT_GUI_CONFIG = {
  defaultFirmwareFormat: 'hex2',
  defaultTarget: 'main',
  appInfoTarget: 'main',
  targets: [
    {
      id: 'main',
      firmwareTarget: 'cpu1',
      label: '主MCU',
      displayName: 'CPU1',
      bitWidth: 16,
      protocolTargetCode: 0,
      flashPriority: 1,
      legacySupported: true,
      bootloaderErase: {
        enabled: true,
        defaultStart: '0x00080000',
        defaultEndExclusive: '0x00088000',
        editable: true
      }
    },
    {
      id: 'cm',
      firmwareTarget: 'cm',
      label: 'CM核',
      displayName: 'CM',
      bitWidth: 8,
      protocolTargetCode: 1,
      flashPriority: 2,
      legacySupported: true
    },
    {
      id: 'cpu2',
      firmwareTarget: 'cpu2',
      label: 'CPU2',
      displayName: 'CPU2',
      bitWidth: 16,
      protocolTargetCode: 2,
      flashPriority: 3,
      legacySupported: true
    }
  ]
};

function parseConfigAddress(value) {
  const text = String(value || '').trim();
  if (!text) {
    return Number.NaN;
  }

  if (text.startsWith('0x') || text.startsWith('0X')) {
    return parseInt(text, 16);
  }

  return parseInt(text, 10);
}

function normalizeTarget(target, index) {
  if (!target || typeof target !== 'object') {
    throw new Error(`目标配置无效: ${index}`);
  }

  const id = String(target.id || '').trim();
  const firmwareTarget = String(target.firmwareTarget || '').trim();
  const label = String(target.label || '').trim();
  const displayName = String(target.displayName || label || id).trim();
  const bitWidth = Number(target.bitWidth);
  const protocolTargetCode = Number(target.protocolTargetCode);
  const flashPriority = Number.isFinite(Number(target.flashPriority)) ? Number(target.flashPriority) : index + 1;

  if (!id || !firmwareTarget || !label) {
    throw new Error(`目标配置缺少必要字段: ${JSON.stringify(target)}`);
  }

  if (bitWidth !== 8 && bitWidth !== 16) {
    throw new Error(`目标 ${id} 的 bitWidth 必须为 8 或 16`);
  }

  if (!Number.isInteger(protocolTargetCode) || protocolTargetCode < 0 || protocolTargetCode > 255) {
    throw new Error(`目标 ${id} 的 protocolTargetCode 无效`);
  }

  const bootloaderErase = target.bootloaderErase && typeof target.bootloaderErase === 'object'
    ? {
        enabled: Boolean(target.bootloaderErase.enabled),
        defaultStart: String(target.bootloaderErase.defaultStart || ''),
        defaultEndExclusive: String(target.bootloaderErase.defaultEndExclusive || ''),
        editable: target.bootloaderErase.editable !== false
      }
    : null;

  if (bootloaderErase && bootloaderErase.enabled) {
    const start = parseConfigAddress(bootloaderErase.defaultStart);
    const endExclusive = parseConfigAddress(bootloaderErase.defaultEndExclusive);
    if (!Number.isFinite(start) || !Number.isFinite(endExclusive) || endExclusive <= start) {
      throw new Error(`目标 ${id} 的 bootloaderErase 默认地址范围无效`);
    }
  }

  return {
    id,
    firmwareTarget,
    label,
    displayName,
    bitWidth,
    protocolTargetCode,
    flashPriority,
    legacySupported: target.legacySupported !== false,
    bootloaderErase
  };
}

function normalizeGuiConfig(config) {
  const merged = {
    ...DEFAULT_GUI_CONFIG,
    ...config
  };

  const targets = Array.isArray(merged.targets) ? merged.targets.map(normalizeTarget) : [];
  if (targets.length === 0) {
    throw new Error('GUI 配置中至少需要一个目标');
  }

  const idSet = new Set();
  const firmwareTargetSet = new Set();
  for (const target of targets) {
    if (idSet.has(target.id)) {
      throw new Error(`目标 id 重复: ${target.id}`);
    }
    if (firmwareTargetSet.has(target.firmwareTarget)) {
      throw new Error(`firmwareTarget 重复: ${target.firmwareTarget}`);
    }
    idSet.add(target.id);
    firmwareTargetSet.add(target.firmwareTarget);
  }

  const defaultTarget = idSet.has(merged.defaultTarget) ? merged.defaultTarget : targets[0].id;
  const appInfoTarget = idSet.has(merged.appInfoTarget) ? merged.appInfoTarget : defaultTarget;

  return {
    defaultFirmwareFormat: merged.defaultFirmwareFormat === 'legacy' ? 'legacy' : 'hex2',
    defaultTarget,
    appInfoTarget,
    targets
  };
}

function getGuiConfigPath() {
  return path.join(__dirname, '..', 'gui-config.json');
}

function loadGuiConfig() {
  const filePath = getGuiConfigPath();
  if (!fs.existsSync(filePath)) {
    return normalizeGuiConfig(DEFAULT_GUI_CONFIG);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return normalizeGuiConfig(parsed);
}

module.exports = {
  DEFAULT_GUI_CONFIG,
  loadGuiConfig,
  normalizeGuiConfig
};