const EventEmitter = require('events');
const ModbusClient = require('./modbus-client');
const HexParser = require('./hex-parser');

/**
 * Bootloader烧录器
 */
class Flasher extends EventEmitter {
  constructor(port, baudrate = 115200, slaveId = 1) {
    super();
    this.client = new ModbusClient(port, baudrate, slaveId, false);
    this.parser = new HexParser();
    this.isFlashing = false;
    this.shouldStop = false;
  }

  async flashParsedImage(image, targetCode, targetLabel, chunkSize = 64, majorVer = 1, minorVer = 0, buildVer = 0) {
    this.parser = image;

    this.log(`开始烧录${targetLabel}`);
    this.setStatus('parsing', '解析固件数据...');

    const summary = image.getSummary();
    this.log('固件数据已加载');
    this.log(`  目标: ${summary.target}`);
    this.log(`  数据块数: ${summary.blockCount}`);
    this.log(`  地址范围: 0x${summary.minAddr.toString(16)} - 0x${summary.maxAddr.toString(16)}`);
    this.log(`  总字节数: ${summary.totalBytes}`);
    if (summary.is16bitMode) {
      this.log(`  总字数: ${summary.totalWords}`);
    }
    this.log(`  CRC32: 0x${summary.crc32.toString(16).padStart(8, '0')}`);

    return this._flashCommon(targetCode, chunkSize, majorVer, minorVer, buildVer);
  }

  /**
   * 发送日志
   */
  log(message, type = 'info') {
    this.emit('log', { message, type, timestamp: new Date().toISOString() });
  }

  /**
   * 发送状态
   */
  setStatus(status, message) {
    this.emit('status', { status, message });
  }

  /**
   * 发送进度
   */
  updateProgress(current, total, stage) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.emit('progress', {
      current,
      total,
      percentage,
      stage
    });
  }

  /**
   * 烧录主MCU（16位内存）
   */
  async flashMainMcu(lowHexFile, highHexFile, chunkSize = 64, majorVer = 1, minorVer = 0, buildVer = 0) {
    this.log(`开始烧录主MCU (16位内存模式)`);
    this.log(`  低字节文件: ${lowHexFile}`);
    this.log(`  高字节文件: ${highHexFile}`);

    this.setStatus('parsing', '解析HEX文件...');

    // 解析HEX文件
    const parseResult = await this.parser.parseFiles(lowHexFile, highHexFile);
    if (!parseResult.success) {
      this.log(`HEX文件解析失败: ${parseResult.error}`, 'error');
      return { success: false, error: parseResult.error };
    }

    this.log('HEX文件解析成功');
    const summary = parseResult.summary;
    this.log(`  数据块数: ${summary.blockCount}`);
    this.log(`  字地址范围: 0x${summary.minAddr.toString(16)} - 0x${summary.maxAddr.toString(16)}`);
    this.log(`  总字节数: ${summary.totalBytes}`);
    this.log(`  总字数: ${summary.totalWords}`);
    this.log(`  CRC32: 0x${summary.crc32.toString(16).padStart(8, '0')}`);

    // 执行通用烧录流程
    return await this._flashCommon(0x00, chunkSize, majorVer, minorVer, buildVer);
  }

  /**
   * 烧录CM核（8位内存）
   */
  async flashCmMcu(hexFile, chunkSize = 64, majorVer = 1, minorVer = 0, buildVer = 0) {
    this.log(`开始烧录CM核 (8位内存模式)`);
    this.log(`  文件: ${hexFile}`);

    this.setStatus('parsing', '解析HEX文件...');

    // 解析HEX文件
    const parseResult = await this.parser.parseSingleFile(hexFile);
    if (!parseResult.success) {
      this.log(`HEX文件解析失败: ${parseResult.error}`, 'error');
      return { success: false, error: parseResult.error };
    }

    this.log('HEX文件解析成功');
    const summary = parseResult.summary;
    this.log(`  数据块数: ${summary.blockCount}`);
    this.log(`  字节地址范围: 0x${summary.minAddr.toString(16)} - 0x${summary.maxAddr.toString(16)}`);
    this.log(`  总字节数: ${summary.totalBytes}`);
    this.log(`  CRC32: 0x${summary.crc32.toString(16).padStart(8, '0')}`);

    // 执行通用烧录流程（CM核目标类型为0x01）
    return await this._flashCommon(0x01, chunkSize, majorVer, minorVer, buildVer);
  }

  /**
   * 通用烧录流程
   */
  async _flashCommon(targetType, chunkSize, majorVer, minorVer, buildVer) {
    this.isFlashing = true;
    this.shouldStop = false;

    try {
      // 1. 连接串口
      this.setStatus('connecting', '连接串口...');
      this.log('连接串口...');
      await this.client.connect();
      this.log('串口连接成功');

      if (this.shouldStop) {
        throw new Error('用户取消操作');
      }

      // 2. 进入Bootloader模式
      this.setStatus('entering-bootloader', '进入Bootloader模式...');
      this.log('进入Bootloader模式...');
      await this.client.enterBootloaderMode();
      this.log('成功进入Bootloader模式');

      if (this.shouldStop) {
        throw new Error('用户取消操作');
      }

      // 3. 设置会话目标（如果不是本地MCU）
      if (targetType !== 0x00) {
        this.setStatus('set-target', '设置会话目标...');
        this.log(`设置会话目标: ${targetType === 0x01 ? 'CM核' : '从MCU2'}...`);
        await this.client.setSessionTarget(targetType);
        this.log('成功设置会话目标');

        if (this.shouldStop) {
          throw new Error('用户取消操作');
        }
      }

      // 4. 擦除闪存
      this.setStatus('erasing', '擦除闪存...');
      this.log('擦除闪存...');
      const eraseResult = await this.client.eraseFlash();
      this.log(`成功擦除闪存: 起始地址=0x${eraseResult.startAddr.toString(16)}, 长度=${eraseResult.length}字节`);

      if (this.shouldStop) {
        throw new Error('用户取消操作');
      }

      // 5. 写入固件
      this.setStatus('writing', '写入固件...');
      await this._writeFlash(chunkSize);

      if (this.shouldStop) {
        throw new Error('用户取消操作');
      }

      // 6. 刷新FLASH缓存
      this.setStatus('flushing', '刷新FLASH缓存...');
      this.log('刷新FLASH缓存...');
      await this.client.flushFlashCache();
      this.log('成功刷新FLASH缓存');

      if (this.shouldStop) {
        throw new Error('用户取消操作');
      }

      // 7. 完成APP写入
      this.setStatus('completing', '完成APP写入...');
      this.log('完成APP写入...');
      const completeResult = await this.client.completeAppWrite();
      this.log(`完成APP写入: 状态=0x${completeResult.status.toString(16)}`);

      if (this.shouldStop) {
        throw new Error('用户取消操作');
      }

      // 8. 跳转到应用程序
      this.setStatus('jumping', '跳转到应用程序...');
      this.log('跳转到应用程序...');
      await this.client.jumpToApplication();
      this.log('成功跳转到应用程序');

      // 断开连接
      await this.client.disconnect();

      this.isFlashing = false;
      this.setStatus('success', '烧录完成');
      this.log('烧录完成!', 'success');

      return { success: true };
    } catch (error) {
      this.log(`烧录失败: ${error.message}`, 'error');
      this.setStatus('error', `烧录失败: ${error.message}`);
      
      try {
        await this.client.disconnect();
      } catch (e) {
        // 忽略断开连接错误
      }

      this.isFlashing = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * 写入闪存数据
   */
  async _writeFlash(chunkSize) {
    const dataBlocks = this.parser.getDataBlocks();
    if (dataBlocks.size === 0) {
      throw new Error('没有数据需要写入');
    }

    const sortedAddresses = Array.from(dataBlocks.keys()).sort((a, b) => a - b);
    const totalBytes = Array.from(dataBlocks.values())
      .reduce((sum, buf) => sum + buf.length, 0);

    this.log('开始写入固件...');
    this.log(`  总数据量: ${totalBytes} 字节`);
    this.log(`  数据块大小: ${chunkSize} 字节`);

    let writtenBytes = 0;
    const is16bitMode = this.parser.is16bitMode;

    for (const baseAddr of sortedAddresses) {
      if (this.shouldStop) {
        throw new Error('用户取消操作');
      }

      const data = dataBlocks.get(baseAddr);
      let offset = 0;

      while (offset < data.length) {
        if (this.shouldStop) {
          throw new Error('用户取消操作');
        }

        const chunk = data.slice(offset, offset + chunkSize);
        
        // 计算当前地址
        let currentAddr;
        if (is16bitMode) {
          // 16位模式：数据是16位字数组，地址是字地址
          const wordOffset = offset / 2;
          currentAddr = baseAddr + wordOffset;
        } else {
          // 8位模式：数据是字节数组，地址是字节地址
          currentAddr = baseAddr + offset;
        }

        // 写入数据
        await this.client.writeFlash(currentAddr, chunk);

        offset += chunk.length;
        writtenBytes += chunk.length;

        // 更新进度
        this.updateProgress(writtenBytes, totalBytes, 'writing');
        
        // 进度仅用于UI显示，不输出日志
      }
    }

    this.log(`成功写入 ${writtenBytes} 字节`);
  }

  /**
   * 停止烧录
   */
  async stop() {
    this.shouldStop = true;
    this.log('正在取消操作...', 'warning');
  }

  /**
   * 断开连接
   */
  async disconnect() {
    await this.client.disconnect();
  }

  /**
   * 进入Bootloader模式（单独操作）
   */
  async enterBootloaderMode() {
    try {
      await this.client.connect();
      const result = await this.client.enterBootloaderMode();
      await this.client.disconnect();
      return result;
    } catch (error) {
      try {
        await this.client.disconnect();
      } catch (e) {
        // 忽略
      }
      throw error;
    }
  }

  /**
   * 跳转到应用程序（单独操作）
   */
  async jumpToApplication() {
    try {
      await this.client.connect();
      const result = await this.client.jumpToApplication();
      await this.client.disconnect();
      return result;
    } catch (error) {
      try {
        await this.client.disconnect();
      } catch (e) {
        // 忽略
      }
      throw error;
    }
  }

  /**
   * 独立擦除指定范围
   */
  async eraseFlashRange(startAddr, length, targetType = 0x00) {
    try {
      await this.client.connect();
      await this.client.enterBootloaderMode();

      if (targetType !== 0x00) {
        await this.client.setSessionTarget(targetType);
      }

      const result = Number.isFinite(startAddr) && Number.isFinite(length)
        ? await this.client.eraseFlash(startAddr, length)
        : await this.client.eraseFlash();
      await this.client.disconnect();

      return result;
    } catch (error) {
      try {
        await this.client.disconnect();
      } catch (e) {
        // 忽略
      }
      throw error;
    }
  }

  /**
   * 读取寄存器（单独操作）
   */
  async readRegisters(startAddr, count) {
    try {
      await this.client.connect();
      const result = await this.client.readInputRegisters(startAddr, count);
      await this.client.disconnect();
      return result;
    } catch (error) {
      try {
        await this.client.disconnect();
      } catch (e) {
        // 忽略
      }
      throw error;
    }
  }

  /**
   * 读取APP信息（单独操作）
   */
  async readAppInfo() {
    try {
      await this.client.connect();
      
      // 读取APP信息寄存器 (0xF300-0xF31F, 共32个寄存器)
      const result = await this.client.readInputRegisters(0xF300, 32);
      
      if (!result.success) {
        throw new Error('读取寄存器失败');
      }

      const regs = result.registers;
      
      // 解析APP信息
      const appInfo = {
        validFlag: regs[0],
        entryAddr: (regs[1] << 16) | regs[2],
        majorVersion: regs[3],
        minorVersion: regs[4],
        appStartAddr: (regs[5] << 16) | regs[6],
        appLength: (regs[7] << 16) | regs[8],
        crc32: (regs[9] << 16) | regs[10],
        timestamp: (regs[11] << 16) | regs[12],
        gitCommitId: (regs[13] << 16) | regs[14],
        gitTagLength: regs[15],
        gitTag: ''
      };

      // 解析Git标签（从寄存器16开始，每个寄存器包含一个字符）
      if (appInfo.gitTagLength > 0 && appInfo.gitTagLength <= 32) {
        for (let i = 0; i < appInfo.gitTagLength && i < 16; i++) {
          const charCode = regs[16 + i] & 0xFF;
          if (charCode !== 0) {
            appInfo.gitTag += String.fromCharCode(charCode);
          }
        }
      }

      await this.client.disconnect();
      
      return {
        success: true,
        appInfo: appInfo,
        isValid: appInfo.validFlag === 0xAA55
      };
    } catch (error) {
      try {
        await this.client.disconnect();
      } catch (e) {
        // 忽略
      }
      throw error;
    }
  }

  /**
   * 读取完整系统信息（Bootloader + Flash + APP）
   */
  async readSystemInfo(targetType = 0x00) {
    try {
      await this.client.connect();

      if (targetType !== 0x00) {
        await this.client.enterBootloaderMode();
        await this.client.setSessionTarget(targetType);
      }
      
      // 读取Bootloader信息 (0xF000-0xF004, 5个寄存器)
      const blResult = await this.client.readInputRegisters(0xF000, 5);
      if (!blResult.success) {
        throw new Error('读取Bootloader信息失败');
      }

      // 读取Flash信息 (0xF100-0xF105, 6个寄存器)
      const flashResult = await this.client.readInputRegisters(0xF100, 6);
      if (!flashResult.success) {
        throw new Error('读取Flash信息失败');
      }

      // 读取APP信息 (0xF300-0xF31F, 32个寄存器)
      const appResult = await this.client.readInputRegisters(0xF300, 32);
      if (!appResult.success) {
        throw new Error('读取APP信息失败');
      }

      const blRegs = blResult.registers;
      const flashRegs = flashResult.registers;
      const appRegs = appResult.registers;

      // 解析Bootloader信息
      const bootloaderInfo = {
        magic: blRegs[0],
        version: blRegs[1],
        majorVersion: (blRegs[1] >> 8) & 0xFF,
        minorVersion: blRegs[1] & 0xFF,
        state: blRegs[2],
        capability: blRegs[3],
        errorCode: blRegs[4]
      };

      // 解析Flash信息
      const flashInfo = {
        size: (flashRegs[0] << 16) | flashRegs[1],
        appStart: (flashRegs[2] << 16) | flashRegs[3],
        appMaxSize: (flashRegs[4] << 16) | flashRegs[5]
      };

      // 解析APP信息
      const appInfo = {
        validFlag: appRegs[0],
        entryAddr: (appRegs[1] << 16) | appRegs[2],
        majorVersion: appRegs[3],
        minorVersion: appRegs[4],
        appStartAddr: (appRegs[5] << 16) | appRegs[6],
        appLength: (appRegs[7] << 16) | appRegs[8],
        crc32: (appRegs[9] << 16) | appRegs[10],
        timestamp: (appRegs[11] << 16) | appRegs[12],
        gitCommitId: (appRegs[13] << 16) | appRegs[14],
        gitTagLength: appRegs[15],
        gitTag: ''
      };

      // 解析Git标签
      if (appInfo.gitTagLength > 0 && appInfo.gitTagLength <= 32) {
        for (let i = 0; i < appInfo.gitTagLength && i < 16; i++) {
          const charCode = appRegs[16 + i] & 0xFF;
          if (charCode !== 0) {
            appInfo.gitTag += String.fromCharCode(charCode);
          }
        }
      }

      await this.client.disconnect();
      
      return {
        success: true,
        bootloaderInfo,
        flashInfo,
        appInfo,
        isBootloaderMode: bootloaderInfo.magic === 0xBEEF,
        isAppValid: appInfo.validFlag === 0xAA55
      };
    } catch (error) {
      try {
        await this.client.disconnect();
      } catch (e) {
        // 忽略
      }
      throw error;
    }
  }
}

module.exports = Flasher;
