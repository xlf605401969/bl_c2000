const fs = require('fs');

class CRC32 {
  constructor() {
    this.table = this._makeTable();
  }

  _makeTable() {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
      let value = index;
      for (let bit = 0; bit < 8; bit++) {
        value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value;
    }
    return table;
  }

  calculate(buffer) {
    let crc = 0xFFFFFFFF;
    for (let index = 0; index < buffer.length; index++) {
      crc = (crc >>> 8) ^ this.table[(crc ^ buffer[index]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}

const crc32 = new CRC32();

function hexLineToBytes(hexStr) {
  const bytes = [];
  for (let index = 0; index < hexStr.length; index += 2) {
    bytes.push(parseInt(hexStr.substring(index, index + 2), 16));
  }
  return bytes;
}

function parseIntelHexContent(content) {
  const lines = content.split(/\r?\n/);
  const data = new Map();
  let extendedAddr = 0;
  let eofSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (!trimmed.startsWith(':')) {
      throw new Error(`无效的 Intel HEX 记录: ${trimmed}`);
    }

    const bytes = hexLineToBytes(trimmed.substring(1));
    if (bytes.length < 5) {
      throw new Error(`Intel HEX 记录过短: ${trimmed}`);
    }

    const byteCount = bytes[0];
    const address = (bytes[1] << 8) | bytes[2];
    const recordType = bytes[3];
    const dataBytes = bytes.slice(4, 4 + byteCount);
    const checksum = bytes[4 + byteCount];

    let sum = 0;
    for (let index = 0; index < 4 + byteCount; index++) {
      sum += bytes[index];
    }
    sum = (~sum + 1) & 0xFF;
    if (sum !== checksum) {
      throw new Error(`校验和错误: 计算=${sum.toString(16)}, 实际=${checksum.toString(16)}`);
    }

    switch (recordType) {
      case 0x00: {
        const fullAddr = extendedAddr + address;
        for (let offset = 0; offset < dataBytes.length; offset++) {
          data.set(fullAddr + offset, dataBytes[offset]);
        }
        break;
      }
      case 0x01:
        eofSeen = true;
        break;
      case 0x02:
        extendedAddr = ((dataBytes[0] << 8) | dataBytes[1]) << 4;
        break;
      case 0x04:
        extendedAddr = ((dataBytes[0] << 8) | dataBytes[1]) << 16;
        break;
      default:
        throw new Error(`不支持的 Intel HEX 记录类型: 0x${recordType.toString(16).padStart(2, '0')}`);
    }
  }

  if (!eofSeen) {
    throw new Error('分段缺少 Intel HEX EOF 记录');
  }

  return data;
}

function getSortedAddresses(dataMap) {
  return Array.from(dataMap.keys()).sort((left, right) => left - right);
}

function mergeWordData(lowData, highData) {
  const lowAddrs = getSortedAddresses(lowData);
  const highAddrs = getSortedAddresses(highData);

  if (lowAddrs.length !== highAddrs.length) {
    throw new Error('高低位分段长度不匹配');
  }

  for (let index = 0; index < lowAddrs.length; index++) {
    if (lowAddrs[index] !== highAddrs[index]) {
      throw new Error(`高低位地址不匹配: low=0x${lowAddrs[index].toString(16)}, high=0x${highAddrs[index].toString(16)}`);
    }
  }

  const dataBlocks = new Map();
  if (lowAddrs.length === 0) {
    return { dataBlocks, minAddr: 0, maxAddr: 0 };
  }

  let currentBlockAddr = lowAddrs[0];
  let currentData = [];
  let lastAddr = lowAddrs[0] - 1;

  for (const addr of lowAddrs) {
    if (addr > lastAddr + 1 && currentData.length > 0) {
      dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
      currentData = [];
      currentBlockAddr = addr;
      lastAddr = addr - 1;
    }

    while (lastAddr + 1 < addr) {
      currentData.push(0xFF, 0xFF);
      lastAddr++;
    }

    currentData.push(lowData.get(addr), highData.get(addr));
    lastAddr = addr;
  }

  if (currentData.length > 0) {
    dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
  }

  return {
    dataBlocks,
    minAddr: lowAddrs[0],
    maxAddr: lowAddrs[lowAddrs.length - 1]
  };
}

function mergeByteData(dataMap) {
  const addresses = getSortedAddresses(dataMap);
  const dataBlocks = new Map();

  if (addresses.length === 0) {
    return { dataBlocks, minAddr: 0, maxAddr: 0 };
  }

  let currentBlockAddr = addresses[0];
  let currentData = [];
  let lastAddr = addresses[0] - 1;

  for (const addr of addresses) {
    if (addr > lastAddr + 1 && currentData.length > 0) {
      dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
      currentData = [];
      currentBlockAddr = addr;
      lastAddr = addr - 1;
    }

    while (lastAddr + 1 < addr) {
      currentData.push(0xFF);
      lastAddr++;
    }

    currentData.push(dataMap.get(addr));
    lastAddr = addr;
  }

  if (currentData.length > 0) {
    dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
  }

  return {
    dataBlocks,
    minAddr: addresses[0],
    maxAddr: addresses[addresses.length - 1]
  };
}

function mergeDataMaps(maps) {
  const merged = new Map();

  for (const dataMap of maps) {
    for (const [address, value] of dataMap.entries()) {
      if (merged.has(address) && merged.get(address) !== value) {
        throw new Error(`地址 0x${address.toString(16)} 出现冲突数据`);
      }
      merged.set(address, value);
    }
  }

  return merged;
}

function parseSegmentHeader(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('@SEGMENT')) {
    throw new Error(`无效的分段头: ${line}`);
  }

  const body = trimmed.substring('@SEGMENT'.length).trim();
  const matches = body.match(/([^\s=]+)=([^\s]+)/g) || [];
  const fields = {};

  for (const item of matches) {
    const separatorIndex = item.indexOf('=');
    const key = item.substring(0, separatorIndex);
    const value = item.substring(separatorIndex + 1);
    fields[key] = value;
  }

  for (const requiredField of ['name', 'target', 'addr-unit', 'combine']) {
    if (!fields[requiredField]) {
      throw new Error(`分段头缺少字段: ${requiredField}`);
    }
  }

  if (!['word16', 'byte8'].includes(fields['addr-unit'])) {
    throw new Error(`不支持的 addr-unit: ${fields['addr-unit']}`);
  }

  if (!['none', 'pair-low', 'pair-high'].includes(fields.combine)) {
    throw new Error(`不支持的 combine: ${fields.combine}`);
  }

  return {
    name: fields.name,
    target: fields.target,
    addrUnit: fields['addr-unit'],
    combine: fields.combine,
    purpose: fields.purpose || ''
  };
}

class ParsedTargetImage {
  constructor({ target, addrUnit, dataBlocks, minAddr, maxAddr, segmentNames, purpose }) {
    this.target = target;
    this.addrUnit = addrUnit;
    this.is16bitMode = addrUnit === 'word16';
    this.dataBlocks = dataBlocks;
    this.minAddr = minAddr;
    this.maxAddr = maxAddr;
    this.segmentNames = segmentNames || [];
    this.purpose = purpose || '';
  }

  getDataBlocks() {
    return this.dataBlocks;
  }

  calculateCrc32() {
    const blocks = Array.from(this.dataBlocks.entries()).sort((left, right) => left[0] - right[0]);
    const allData = Buffer.concat(blocks.map(([, data]) => data));
    return crc32.calculate(allData);
  }

  getAppInfo() {
    const totalBytes = Array.from(this.dataBlocks.values()).reduce((sum, buffer) => sum + buffer.length, 0);
    return {
      startAddr: this.minAddr,
      length: totalBytes,
      crc32: this.calculateCrc32()
    };
  }

  getSummary() {
    const appInfo = this.getAppInfo();
    return {
      target: this.target,
      addrUnit: this.addrUnit,
      is16bitMode: this.is16bitMode,
      blockCount: this.dataBlocks.size,
      minAddr: this.minAddr,
      maxAddr: this.maxAddr,
      totalBytes: appInfo.length,
      totalWords: this.is16bitMode ? Math.floor(appInfo.length / 2) : undefined,
      crc32: appInfo.crc32,
      startAddr: appInfo.startAddr,
      segmentNames: this.segmentNames,
      purpose: this.purpose
    };
  }

  _readBytesAt(address, length) {
    const buffer = Buffer.alloc(length, 0xFF);
    const blocks = Array.from(this.dataBlocks.entries()).sort((left, right) => left[0] - right[0]);
    let missing = 0;

    for (let index = 0; index < length; index++) {
      let found = false;

      if (this.is16bitMode) {
        const wordAddr = address + Math.floor(index / 2);
        const byteInWord = index % 2;

        for (const [blockStart, blockData] of blocks) {
          const blockWordLength = Math.floor(blockData.length / 2);
          if (wordAddr >= blockStart && wordAddr < blockStart + blockWordLength) {
            const offset = (wordAddr - blockStart) * 2 + byteInWord;
            buffer[index] = blockData[offset];
            found = true;
            break;
          }
        }
      } else {
        const byteAddr = address + index;

        for (const [blockStart, blockData] of blocks) {
          if (byteAddr >= blockStart && byteAddr < blockStart + blockData.length) {
            const offset = byteAddr - blockStart;
            buffer[index] = blockData[offset];
            found = true;
            break;
          }
        }
      }

      if (!found) {
        missing++;
      }
    }

    return { buffer, missing };
  }

  parseAppInfo(address) {
    const appInfoSize = 68;
    const { buffer, missing } = this._readBytesAt(address, appInfoSize);

    if (missing > 0) {
      return { success: false, error: `AppInfo数据不完整: 缺失${missing}字节` };
    }

    const appInfo = {
      magic: buffer.readUInt32LE(0),
      entryAddr: buffer.readUInt32LE(4),
      majorVersion: buffer.readUInt16LE(8),
      minorVersion: buffer.readUInt16LE(10),
      appStartAddr: buffer.readUInt32LE(12),
      appLength: buffer.readUInt32LE(16),
      crc32: buffer.readUInt32LE(20),
      timestamp: buffer.readUInt32LE(24),
      gitCommitId: buffer.readUInt32LE(28),
      validFlag: buffer.readUInt16LE(32),
      gitTagLength: buffer.readUInt16LE(34),
      gitTag: ''
    };

    const tagLength = Math.min(appInfo.gitTagLength, 32);
    for (let index = 0; index < tagLength; index++) {
      const charCode = buffer[36 + index];
      if (charCode === 0) {
        break;
      }
      appInfo.gitTag += String.fromCharCode(charCode);
    }

    return { success: true, appInfo };
  }

  getMemoryRows(address, length, bytesPerRow = 16) {
    const { buffer, missing } = this._readBytesAt(address, length);
    const rows = [];

    for (let offset = 0; offset < buffer.length; offset += bytesPerRow) {
      const rowBytes = Array.from(buffer.slice(offset, offset + bytesPerRow));
      const ascii = rowBytes
        .map((value) => (value >= 32 && value <= 126 ? String.fromCharCode(value) : '.'))
        .join('');

      rows.push({
        address: address + (this.is16bitMode ? Math.floor(offset / 2) : offset),
        bytes: rowBytes,
        ascii
      });
    }

    return {
      target: this.target,
      addrUnit: this.addrUnit,
      startAddress: address,
      requestedLength: length,
      missing,
      rows
    };
  }
}

class FirmwareDocument {
  constructor({ format, source, targets }) {
    this.format = format;
    this.source = source;
    this.targets = targets;
  }

  getTarget(target) {
    return this.targets.get(target) || null;
  }

  listTargets() {
    return Array.from(this.targets.values()).map((image) => image.getSummary());
  }
}

async function createLegacyDocument(config) {
  const { targetType, lowHexFile, highHexFile, cmHexFile, legacyFiles, targetDefinitions = [] } = config;
  const targets = new Map();
  const selectedTarget = targetDefinitions.find((item) => item.id === targetType);

  if (selectedTarget) {
    const targetFiles = legacyFiles && legacyFiles[targetType] ? legacyFiles[targetType] : {};

    if (selectedTarget.bitWidth === 16) {
      const lowFile = targetFiles.low || lowHexFile;
      const highFile = targetFiles.high || highHexFile;
      if (!lowFile || !highFile) {
        throw new Error(`${selectedTarget.displayName} 缺少低字节或高字节HEX文件`);
      }

      const lowData = parseIntelHexContent(fs.readFileSync(lowFile, 'utf-8'));
      const highData = parseIntelHexContent(fs.readFileSync(highFile, 'utf-8'));
      const merged = mergeWordData(lowData, highData);
      targets.set(selectedTarget.firmwareTarget, new ParsedTargetImage({
        target: selectedTarget.firmwareTarget,
        addrUnit: 'word16',
        dataBlocks: merged.dataBlocks,
        minAddr: merged.minAddr,
        maxAddr: merged.maxAddr,
        segmentNames: [`legacy-${targetType}-low`, `legacy-${targetType}-high`],
        purpose: 'firmware'
      }));

      return new FirmwareDocument({ format: 'legacy', source: 'legacy', targets });
    }

    if (selectedTarget.bitWidth === 8) {
      const file = targetFiles.single || cmHexFile;
      if (!file) {
        throw new Error(`${selectedTarget.displayName} 缺少HEX文件`);
      }

      const data = parseIntelHexContent(fs.readFileSync(file, 'utf-8'));
      const merged = mergeByteData(data);
      targets.set(selectedTarget.firmwareTarget, new ParsedTargetImage({
        target: selectedTarget.firmwareTarget,
        addrUnit: 'byte8',
        dataBlocks: merged.dataBlocks,
        minAddr: merged.minAddr,
        maxAddr: merged.maxAddr,
        segmentNames: [`legacy-${targetType}`],
        purpose: 'firmware'
      }));

      return new FirmwareDocument({ format: 'legacy', source: 'legacy', targets });
    }

    throw new Error(`不支持的目标位宽: ${selectedTarget.bitWidth}`);
  }

  if (targetType === 'main') {
    if (!lowHexFile || !highHexFile) {
      throw new Error('缺少低字节或高字节HEX文件');
    }

    const lowData = parseIntelHexContent(fs.readFileSync(lowHexFile, 'utf-8'));
    const highData = parseIntelHexContent(fs.readFileSync(highHexFile, 'utf-8'));
    const merged = mergeWordData(lowData, highData);
    targets.set('cpu1', new ParsedTargetImage({
      target: 'cpu1',
      addrUnit: 'word16',
      dataBlocks: merged.dataBlocks,
      minAddr: merged.minAddr,
      maxAddr: merged.maxAddr,
      segmentNames: ['legacy-low', 'legacy-high'],
      purpose: 'firmware'
    }));
  } else if (targetType === 'cm') {
    if (!cmHexFile) {
      throw new Error('缺少CM核HEX文件');
    }

    const data = parseIntelHexContent(fs.readFileSync(cmHexFile, 'utf-8'));
    const merged = mergeByteData(data);
    targets.set('cm', new ParsedTargetImage({
      target: 'cm',
      addrUnit: 'byte8',
      dataBlocks: merged.dataBlocks,
      minAddr: merged.minAddr,
      maxAddr: merged.maxAddr,
      segmentNames: ['legacy-cm'],
      purpose: 'firmware'
    }));
  } else {
    throw new Error('传统HEX模式仅支持主MCU或CM目标');
  }

  return new FirmwareDocument({ format: 'legacy', source: 'legacy', targets });
}

function validateHex2TargetsAgainstConfig(targets, targetDefinitions = []) {
  if (!Array.isArray(targetDefinitions) || targetDefinitions.length === 0) {
    return;
  }

  for (const targetDefinition of targetDefinitions) {
    const image = targets.get(targetDefinition.firmwareTarget);
    if (!image) {
      continue;
    }

    const expectedAddrUnit = targetDefinition.bitWidth === 16 ? 'word16' : 'byte8';
    if (image.addrUnit !== expectedAddrUnit) {
      throw new Error(
        `目标 ${targetDefinition.displayName} 位宽配置为 ${targetDefinition.bitWidth}bit，但 HEX2 中 target=${targetDefinition.firmwareTarget} 实际为 ${image.addrUnit}`
      );
    }
  }
}

async function createHex2Document(hex2File, targetDefinitions = []) {
  const content = fs.readFileSync(hex2File, 'utf-8');
  const lines = content.split(/\r?\n/);
  const segments = [];
  let lineIndex = 0;
  let versionSeen = false;

  while (lineIndex < lines.length) {
    const trimmed = lines[lineIndex].trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      lineIndex++;
      continue;
    }

    if (!versionSeen) {
      if (trimmed !== '@HEX2 version=1') {
        throw new Error('HEX2 文件头无效，必须为 @HEX2 version=1');
      }
      versionSeen = true;
      lineIndex++;
      continue;
    }

    if (!trimmed.startsWith('@SEGMENT')) {
      throw new Error(`无效控制行: ${trimmed}`);
    }

    const header = parseSegmentHeader(trimmed);
    const hexLines = [];
    let eofSeen = false;
    lineIndex++;

    while (lineIndex < lines.length) {
      const current = lines[lineIndex].trim();
      if (!current || current.startsWith(';') || current.startsWith('#')) {
        lineIndex++;
        continue;
      }

      if (current.startsWith('@')) {
        break;
      }

      if (!current.startsWith(':')) {
        throw new Error(`分段 ${header.name} 中存在无效内容: ${current}`);
      }

      hexLines.push(current);
      if (current === ':00000001FF') {
        eofSeen = true;
        lineIndex++;
        break;
      }
      lineIndex++;
    }

    if (!eofSeen) {
      throw new Error(`分段 ${header.name} 缺少 EOF 记录`);
    }

    segments.push({
      ...header,
      data: parseIntelHexContent(hexLines.join('\n'))
    });
  }

  const nameSet = new Set();
  for (const segment of segments) {
    if (nameSet.has(segment.name)) {
      throw new Error(`分段名称重复: ${segment.name}`);
    }
    nameSet.add(segment.name);
  }

  const groupedTargets = new Map();
  for (const segment of segments) {
    if (!groupedTargets.has(segment.target)) {
      groupedTargets.set(segment.target, []);
    }
    groupedTargets.get(segment.target).push(segment);
  }

  const targets = new Map();

  for (const [targetName, targetSegments] of groupedTargets.entries()) {
    const pairLowSegments = targetSegments.filter((segment) => segment.combine === 'pair-low');
    const pairHighSegments = targetSegments.filter((segment) => segment.combine === 'pair-high');
    const singleSegments = targetSegments.filter((segment) => segment.combine === 'none');

    if (pairLowSegments.length > 0 || pairHighSegments.length > 0) {
      if (singleSegments.length > 0) {
        throw new Error(`目标 ${targetName} 同时包含 pair 和 none 分段，当前不支持`);
      }
      if (pairLowSegments.length !== 1 || pairHighSegments.length !== 1) {
        throw new Error(`目标 ${targetName} 必须恰好包含一对 pair-low / pair-high 分段`);
      }
      if (pairLowSegments[0].addrUnit !== 'word16' || pairHighSegments[0].addrUnit !== 'word16') {
        throw new Error(`目标 ${targetName} 的配对分段必须使用 word16 地址单位`);
      }

      const merged = mergeWordData(pairLowSegments[0].data, pairHighSegments[0].data);
      targets.set(targetName, new ParsedTargetImage({
        target: targetName,
        addrUnit: 'word16',
        dataBlocks: merged.dataBlocks,
        minAddr: merged.minAddr,
        maxAddr: merged.maxAddr,
        segmentNames: [pairLowSegments[0].name, pairHighSegments[0].name],
        purpose: pairLowSegments[0].purpose || pairHighSegments[0].purpose || ''
      }));
      continue;
    }

    if (singleSegments.length === 0) {
      throw new Error(`目标 ${targetName} 没有可用分段`);
    }

    const addrUnit = singleSegments[0].addrUnit;
    if (singleSegments.some((segment) => segment.addrUnit !== addrUnit)) {
      throw new Error(`目标 ${targetName} 的单段地址单位不一致`);
    }

    if (addrUnit !== 'byte8') {
      throw new Error(`当前仅支持 byte8 类型的单段目标，目标 ${targetName} 不满足要求`);
    }

    const mergedMap = mergeDataMaps(singleSegments.map((segment) => segment.data));
    const merged = mergeByteData(mergedMap);
    targets.set(targetName, new ParsedTargetImage({
      target: targetName,
      addrUnit,
      dataBlocks: merged.dataBlocks,
      minAddr: merged.minAddr,
      maxAddr: merged.maxAddr,
      segmentNames: singleSegments.map((segment) => segment.name),
      purpose: singleSegments[0].purpose || ''
    }));
  }

  validateHex2TargetsAgainstConfig(targets, targetDefinitions);
  return new FirmwareDocument({ format: 'hex2', source: hex2File, targets });
}

async function loadFirmwareDocument(config) {
  if (config.firmwareFormat === 'hex2') {
    if (!config.hex2File) {
      throw new Error('未选择 HEX2 文件');
    }
    return createHex2Document(config.hex2File, config.targetDefinitions || []);
  }
  return createLegacyDocument(config);
}

module.exports = {
  FirmwareDocument,
  ParsedTargetImage,
  loadFirmwareDocument
};