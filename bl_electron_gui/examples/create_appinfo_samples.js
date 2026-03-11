const fs = require('fs');
const path = require('path');

function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const value of buffer) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ value) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createRecord(byteCount, address, recordType, data) {
  const content = Buffer.from([
    byteCount,
    (address >> 8) & 0xFF,
    address & 0xFF,
    recordType,
    ...data
  ]);

  const checksum = (~content.reduce((sum, value) => sum + value, 0) + 1) & 0xFF;
  return `:${content.toString('hex').toUpperCase()}${checksum.toString(16).toUpperCase().padStart(2, '0')}`;
}

function createHexLines(addressToByteMap) {
  const addresses = Array.from(addressToByteMap.keys()).sort((left, right) => left - right);
  const lines = [];
  let index = 0;
  let lastUpper = null;

  while (index < addresses.length) {
    const start = addresses[index];
    const upper = start >>> 16;
    if (upper !== lastUpper) {
      lines.push(createRecord(2, 0x0000, 0x04, [(upper >> 8) & 0xFF, upper & 0xFF]));
      lastUpper = upper;
    }

    const chunk = [addressToByteMap.get(start)];
    let nextIndex = index + 1;
    while (
      nextIndex < addresses.length &&
      addresses[nextIndex] === addresses[nextIndex - 1] + 1 &&
      (addresses[nextIndex] & 0xFFFF0000) === (start & 0xFFFF0000) &&
      chunk.length < 16
    ) {
      chunk.push(addressToByteMap.get(addresses[nextIndex]));
      nextIndex++;
    }

    lines.push(createRecord(chunk.length, start & 0xFFFF, 0x00, chunk));
    index = nextIndex;
  }

  lines.push(':00000001FF');
  return lines;
}

function splitWordBytes(wordAddress, bytes, lowMap, highMap) {
  for (let index = 0; index < bytes.length; index += 2) {
    const low = bytes[index] ?? 0xFF;
    const high = bytes[index + 1] ?? 0xFF;
    const currentAddress = wordAddress + Math.floor(index / 2);
    lowMap.set(currentAddress, low);
    highMap.set(currentAddress, high);
  }
}

function addByteBytes(byteAddress, bytes, targetMap) {
  for (let index = 0; index < bytes.length; index++) {
    targetMap.set(byteAddress + index, bytes[index]);
  }
}

function createPayload(length) {
  const payload = Buffer.alloc(length);
  for (let index = 0; index < payload.length; index++) {
    payload[index] = (0x31 + index * 7) & 0xFF;
  }
  return payload;
}

function createPatternBuffer(length, seed, step) {
  const buffer = Buffer.alloc(length);
  for (let index = 0; index < buffer.length; index++) {
    buffer[index] = (seed + index * step) & 0xFF;
  }
  return buffer;
}

function createAppInfo(payload) {
  const appInfo = Buffer.alloc(68, 0x00);
  const gitTag = Buffer.from('sample-appinfo-demo', 'ascii');

  appInfo.writeUInt32LE(0xB16B00B5, 0);
  appInfo.writeUInt32LE(0x0008A040, 4);
  appInfo.writeUInt16LE(1, 8);
  appInfo.writeUInt16LE(7, 10);
  appInfo.writeUInt32LE(0x00088040, 12);
  appInfo.writeUInt32LE(payload.length, 16);
  appInfo.writeUInt32LE(crc32(payload), 20);
  appInfo.writeUInt32LE(1710000000, 24);
  appInfo.writeUInt32LE(0x4D3C2B1A, 28);
  appInfo.writeUInt16LE(0xAA55, 32);
  appInfo.writeUInt16LE(gitTag.length, 34);
  gitTag.copy(appInfo, 36);

  return appInfo;
}

function writeFile(filePath, lines) {
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf-8');
}

function createSegmentLines(header, lines) {
  return [header, ...lines, ''];
}

function main() {
  const examplesDir = __dirname;
  const lowHexPath = path.join(examplesDir, 'sample_cpu1_appinfo_low.hex');
  const highHexPath = path.join(examplesDir, 'sample_cpu1_appinfo_high.hex');
  const hex2Path = path.join(examplesDir, 'sample_cpu1_appinfo.hex2');
  const fullBundlePath = path.join(examplesDir, 'sample_multi_target_demo.hex2');

  const lowMap = new Map();
  const highMap = new Map();
  const payload = createPayload(256);
  const appInfo = createAppInfo(payload);

  const cmMap = new Map();
  const cpu2LowMap = new Map();
  const cpu2HighMap = new Map();
  const configMap = new Map();

  splitWordBytes(0x00088000, appInfo, lowMap, highMap);
  splitWordBytes(0x00088040, payload, lowMap, highMap);

  addByteBytes(0x00204000, createPatternBuffer(96, 0xA5, 0x11), cmMap);
  splitWordBytes(0x00302000, createPatternBuffer(192, 0x21, 0x09), cpu2LowMap, cpu2HighMap);
  addByteBytes(0x00400000, Buffer.from([0x55, 0xAA, 0x10, 0x20, 0x30, 0x40, 0x5A, 0xA5]), configMap);

  const lowLines = createHexLines(lowMap);
  const highLines = createHexLines(highMap);
  const cmLines = createHexLines(cmMap);
  const cpu2LowLines = createHexLines(cpu2LowMap);
  const cpu2HighLines = createHexLines(cpu2HighMap);
  const configLines = createHexLines(configMap);

  writeFile(lowHexPath, lowLines);
  writeFile(highHexPath, highLines);

  const hex2Content = [
    '@HEX2 version=1',
    '',
    '@SEGMENT name=cpu1-low-appinfo target=cpu1 addr-unit=word16 combine=pair-low purpose=firmware',
    ...lowLines,
    '',
    '@SEGMENT name=cpu1-high-appinfo target=cpu1 addr-unit=word16 combine=pair-high purpose=firmware',
    ...highLines,
    ''
  ].join('\n');

  fs.writeFileSync(hex2Path, hex2Content, 'utf-8');

  const fullBundleContent = [
    '@HEX2 version=1',
    '',
    ...createSegmentLines('@SEGMENT name=cpu1-low-appinfo target=cpu1 addr-unit=word16 combine=pair-low purpose=firmware', lowLines),
    ...createSegmentLines('@SEGMENT name=cpu1-high-appinfo target=cpu1 addr-unit=word16 combine=pair-high purpose=firmware', highLines),
    ...createSegmentLines('@SEGMENT name=cm-demo target=cm addr-unit=byte8 combine=none purpose=firmware', cmLines),
    ...createSegmentLines('@SEGMENT name=cpu2-low-demo target=cpu2 addr-unit=word16 combine=pair-low purpose=firmware', cpu2LowLines),
    ...createSegmentLines('@SEGMENT name=cpu2-high-demo target=cpu2 addr-unit=word16 combine=pair-high purpose=firmware', cpu2HighLines),
    ...createSegmentLines('@SEGMENT name=config-demo target=config addr-unit=byte8 combine=none purpose=config', configLines)
  ].join('\n');

  fs.writeFileSync(fullBundlePath, fullBundleContent, 'utf-8');

  console.log('Generated sample files:');
  console.log(`- ${path.basename(lowHexPath)}`);
  console.log(`- ${path.basename(highHexPath)}`);
  console.log(`- ${path.basename(hex2Path)}`);
  console.log(`- ${path.basename(fullBundlePath)}`);
}

main();