const fs = require('fs');

/**
 * CRC32计算
 */
class CRC32 {
  constructor() {
    this.table = this.makeTable();
  }

  makeTable() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  }

  calculate(buffer) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc = (crc >>> 8) ^ this.table[(crc ^ buffer[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}

/**
 * Intel HEX文件解析器
 * 支持8位和16位内存宽度模式
 */
class HexParser {
  constructor() {
    this.crc32 = new CRC32();
    this.reset();
  }

  reset() {
    this.dataBlocks = new Map(); // 地址 -> 数据块
    this.minAddr = 0;
    this.maxAddr = 0;
    this.is16bitMode = false;
  }

  /**
   * 解析两个HEX文件（低字节和高字节）- 16位内存模式
   */
  async parseFiles(lowHexFile, highHexFile) {
    this.reset();
    this.is16bitMode = true;

    try {
      const lowData = await this._parseIntelHex(lowHexFile);
      const highData = await this._parseIntelHex(highHexFile);

      // 验证地址是否匹配
      const lowAddrs = Array.from(lowData.keys()).sort((a, b) => a - b);
      const highAddrs = Array.from(highData.keys()).sort((a, b) => a - b);

      if (lowAddrs.length !== highAddrs.length) {
        throw new Error('高低字节HEX文件的数据长度不匹配');
      }

      for (let i = 0; i < lowAddrs.length; i++) {
        if (lowAddrs[i] !== highAddrs[i]) {
          throw new Error(`地址不匹配: 低字节=${lowAddrs[i].toString(16)}, 高字节=${highAddrs[i].toString(16)}`);
        }
      }

      this.minAddr = lowAddrs[0];
      this.maxAddr = lowAddrs[lowAddrs.length - 1];

      // 合并数据为16位字
      this._mergeC2000Data(lowData, highData);

      return {
        success: true,
        summary: this.getSummary()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 解析单个HEX文件 - 8位内存模式
   */
  async parseSingleFile(hexFile) {
    this.reset();
    this.is16bitMode = false;

    try {
      const data = await this._parseIntelHex(hexFile);
      const addrs = Array.from(data.keys()).sort((a, b) => a - b);

      if (addrs.length === 0) {
        throw new Error('HEX文件为空');
      }

      this.minAddr = addrs[0];
      this.maxAddr = addrs[addrs.length - 1];

      // 转换为数据块
      this._mergeSingleFileData(data);

      return {
        success: true,
        summary: this.getSummary()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 解析Intel HEX文件格式
   */
  async _parseIntelHex(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    const data = new Map();
    let extendedAddr = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith(':')) {
        continue;
      }

      const bytes = this._hexLineToBytes(trimmed.substring(1));
      if (bytes.length < 5) {
        continue;
      }

      const byteCount = bytes[0];
      const address = (bytes[1] << 8) | bytes[2];
      const recordType = bytes[3];
      const dataBytes = bytes.slice(4, 4 + byteCount);
      const checksum = bytes[4 + byteCount];

      // 验证校验和
      let sum = 0;
      for (let i = 0; i < 4 + byteCount; i++) {
        sum += bytes[i];
      }
      sum = (~sum + 1) & 0xFF;
      
      if (sum !== checksum) {
        throw new Error(`校验和错误: 计算=${sum.toString(16)}, 实际=${checksum.toString(16)}`);
      }

      // 处理不同的记录类型
      switch (recordType) {
        case 0x00: // 数据记录
          const fullAddr = extendedAddr + address;
          for (let i = 0; i < dataBytes.length; i++) {
            data.set(fullAddr + i, dataBytes[i]);
          }
          break;

        case 0x01: // 文件结束
          break;

        case 0x02: // 扩展段地址
          extendedAddr = ((dataBytes[0] << 8) | dataBytes[1]) << 4;
          break;

        case 0x04: // 扩展线性地址
          extendedAddr = ((dataBytes[0] << 8) | dataBytes[1]) << 16;
          break;

        default:
          // 忽略其他记录类型
          break;
      }
    }

    return data;
  }

  _hexLineToBytes(hexStr) {
    const bytes = [];
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes.push(parseInt(hexStr.substring(i, i + 2), 16));
    }
    return bytes;
  }

  /**
   * 合并16位数据（C2000模式）
   */
  _mergeC2000Data(lowData, highData) {
    this.dataBlocks.clear();

    const addresses = Array.from(lowData.keys()).sort((a, b) => a - b);
    if (addresses.length === 0) return;

    let currentBlockAddr = addresses[0];
    let currentData = [];
    let lastAddr = addresses[0] - 1;

    for (const addr of addresses) {
      // 如果地址不连续，保存当前块并开始新块
      if (addr > lastAddr + 1 && currentData.length > 0) {
        this.dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
        currentData = [];
        currentBlockAddr = addr;
        lastAddr = addr - 1; // 重置lastAddr，避免填充间隙
      }

      // 填充缺失的字节（0xFFFF）- 仅用于小间隙
      while (lastAddr + 1 < addr) {
        currentData.push(0xFF, 0xFF);
        lastAddr++;
      }

      // 合并低字节和高字节为16位字（小端序）
      const lowByte = lowData.get(addr);
      const highByte = highData.get(addr);
      currentData.push(lowByte, highByte);
      lastAddr = addr;
    }

    // 保存最后一个块
    if (currentData.length > 0) {
      this.dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
    }
  }

  /**
   * 转换单个文件数据为数据块
   */
  _mergeSingleFileData(data) {
    this.dataBlocks.clear();

    const addresses = Array.from(data.keys()).sort((a, b) => a - b);
    if (addresses.length === 0) return;

    let currentBlockAddr = addresses[0];
    let currentData = [];
    let lastAddr = addresses[0] - 1;

    for (const addr of addresses) {
      // 如果地址不连续，保存当前块并开始新块
      if (addr > lastAddr + 1 && currentData.length > 0) {
        this.dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
        currentData = [];
        currentBlockAddr = addr;
        lastAddr = addr - 1; // 重置lastAddr，避免填充间隙
      }

      // 填充缺失的字节（0xFF）- 仅用于小间隙
      while (lastAddr + 1 < addr) {
        currentData.push(0xFF);
        lastAddr++;
      }

      currentData.push(data.get(addr));
      lastAddr = addr;
    }

    // 保存最后一个块
    if (currentData.length > 0) {
      this.dataBlocks.set(currentBlockAddr, Buffer.from(currentData));
    }
  }

  /**
   * 获取数据块
   */
  getDataBlocks() {
    return this.dataBlocks;
  }

  /**
   * 计算CRC32
   */
  calculateCrc32() {
    const blocks = Array.from(this.dataBlocks.entries()).sort((a, b) => a[0] - b[0]);
    const allData = Buffer.concat(blocks.map(([_, data]) => data));
    return this.crc32.calculate(allData);
  }

  /**
   * 获取应用程序信息
   */
  getAppInfo() {
    const startAddr = this.minAddr;
    const totalBytes = Array.from(this.dataBlocks.values())
      .reduce((sum, buf) => sum + buf.length, 0);
    const crc32 = this.calculateCrc32();

    return {
      startAddr,
      length: totalBytes,
      crc32
    };
  }

  /**
   * 从指定地址读取连续字节
   */
  _readBytesAt(address, length) {
    const buffer = Buffer.alloc(length, 0xFF);
    const blocks = Array.from(this.dataBlocks.entries()).sort((a, b) => a[0] - b[0]);
    let missing = 0;

    for (let i = 0; i < length; i++) {
      let found = false;

      if (this.is16bitMode) {
        const wordAddr = address + Math.floor(i / 2);
        const byteInWord = i % 2;

        for (const [blockStart, blockData] of blocks) {
          const blockWordLength = Math.floor(blockData.length / 2);
          if (wordAddr >= blockStart && wordAddr < blockStart + blockWordLength) {
            const offset = (wordAddr - blockStart) * 2 + byteInWord;
            buffer[i] = blockData[offset];
            found = true;
            break;
          }
        }
      } else {
        const byteAddr = address + i;

        for (const [blockStart, blockData] of blocks) {
          const blockByteLength = blockData.length;
          if (byteAddr >= blockStart && byteAddr < blockStart + blockByteLength) {
            const offset = byteAddr - blockStart;
            buffer[i] = blockData[offset];
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

  /**
   * 解析AppInfo结构体
   */
  parseAppInfo(address) {
    const appInfoSize = 68; // 结构体总字节数
    const { buffer, missing } = this._readBytesAt(address, appInfoSize);

    if (missing > 0) {
      return {
        success: false,
        error: `AppInfo数据不完整: 缺失${missing}字节`
      };
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
    for (let i = 0; i < tagLength; i++) {
      const ch = buffer[36 + i];
      if (ch === 0) {
        break;
      }
      appInfo.gitTag += String.fromCharCode(ch);
    }

    return { success: true, appInfo };
  }

  /**
   * 获取摘要信息
   */
  getSummary() {
    const appInfo = this.getAppInfo();
    const blockCount = this.dataBlocks.size;
    
    const summary = {
      is16bitMode: this.is16bitMode,
      blockCount,
      minAddr: this.minAddr,
      maxAddr: this.maxAddr,
      totalBytes: appInfo.length,
      crc32: appInfo.crc32,
      startAddr: appInfo.startAddr
    };

    if (this.is16bitMode) {
      summary.totalWords = appInfo.length / 2;
    }

    return summary;
  }
}

module.exports = HexParser;
