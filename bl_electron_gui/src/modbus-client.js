const { SerialPort } = require('serialport');

/**
 * Modbus CRC16计算
 */
class ModbusCRC {
  static calculate(data) {
    let crc = 0xFFFF;
    
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        if (crc & 0x0001) {
          crc = (crc >>> 1) ^ 0xA001;
        } else {
          crc >>>= 1;
        }
      }
    }
    
    return crc;
  }
}

/**
 * Bootloader Modbus客户端
 */
class ModbusClient {
  constructor(port, baudrate = 115200, slaveId = 1, verbose = false) {
    this.portPath = port;
    this.baudrate = baudrate;
    this.slaveId = slaveId;
    this.verbose = verbose;
    this.serial = null;
    this.timeout = 500; // 毫秒
    
    // 响应长度映射
    this.responseLengthMap = {
      0x65: 5,  // 进入Bootloader
      0x66: 13, // 擦除闪存
      0x67: 7,  // 写入闪存
      0x68: 5,  // 刷新缓存
      0x69: 5,  // 跳转到应用
      0x6A: 5,  // 完成APP写入
      0x70: 5,  // 设置会话目标
      0x75: 5   // 重置设备
    };
  }

  /**
   * 连接串口
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.serial = new SerialPort({
          path: this.portPath,
          baudRate: this.baudrate,
          dataBits: 8,
          parity: 'none',
          stopBits: 1,
          autoOpen: false
        });

        this.serial.open((err) => {
          if (err) {
            reject(new Error(`连接串口失败: ${err.message}`));
          } else {
            setTimeout(() => resolve({ success: true }), 100);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开串口
   */
  async disconnect() {
    return new Promise((resolve) => {
      if (this.serial && this.serial.isOpen) {
        this.serial.close(() => {
          resolve({ success: true });
        });
      } else {
        resolve({ success: true });
      }
    });
  }

  /**
   * 发送请求并等待响应
   */
  async _sendRequest(data, functionCode) {
    return new Promise((resolve, reject) => {
      if (!this.serial || !this.serial.isOpen) {
        reject(new Error('串口未连接'));
        return;
      }

      let expectedLength = this.responseLengthMap[functionCode] || 5;
      let response = Buffer.alloc(0);
      let timeoutTimer;

      const onData = (chunk) => {
        response = Buffer.concat([response, chunk]);
        
        // 对于0x04功能码，响应长度是动态的，需要从字节计数字段获取
        if (functionCode === 0x04 && response.length >= 3) {
          const byteCount = response[2];
          expectedLength = 3 + byteCount + 2; // 地址(1) + 功能码(1) + 字节计数(1) + 数据(N) + CRC(2)
        }
        
        if (response.length >= expectedLength) {
          clearTimeout(timeoutTimer);
          cleanup();
          resolve(response);
        }
      };

      const onTimeout = () => {
        cleanup();
        if (response.length > 0) {
          resolve(response);
        } else {
          reject(new Error('响应超时'));
        }
      };

      const cleanup = () => {
        this.serial.removeListener('data', onData);
      };

      this.serial.on('data', onData);
      timeoutTimer = setTimeout(onTimeout, this.timeout);

      if (this.verbose) {
        console.log(`[TX] ${data.toString('hex').toUpperCase()}`);
      }

      this.serial.write(data, (err) => {
        if (err) {
          clearTimeout(timeoutTimer);
          cleanup();
          reject(new Error(`发送数据失败: ${err.message}`));
        }
      });

      this.serial.drain();
    });
  }

  /**
   * 构建请求
   */
  _buildRequest(functionCode, data = Buffer.alloc(0)) {
    const request = Buffer.concat([
      Buffer.from([this.slaveId, functionCode]),
      data
    ]);
    
    const crc = ModbusCRC.calculate(request);
    const crcBuffer = Buffer.alloc(2);
    crcBuffer.writeUInt16LE(crc, 0);
    
    return Buffer.concat([request, crcBuffer]);
  }

  /**
   * 检查响应
   */
  _checkResponse(response, expectedFunctionCode) {
    if (response.length < 4) {
      throw new Error(`响应长度不足: ${response.length}`);
    }

    if (this.verbose) {
      console.log(`[RX] ${response.toString('hex').toUpperCase()}`);
    }

    const slaveId = response[0];
    const functionCode = response[1];

    if (slaveId !== this.slaveId) {
      throw new Error(`从站地址不匹配: 期望${this.slaveId}, 收到${slaveId}`);
    }

    if (functionCode !== expectedFunctionCode) {
      if (functionCode === (expectedFunctionCode | 0x80)) {
        const exceptionCode = response[2];
        throw new Error(`功能码0x${expectedFunctionCode.toString(16)}执行失败，异常码: 0x${exceptionCode.toString(16)}`);
      }
      throw new Error(`功能码不匹配: 期望0x${expectedFunctionCode.toString(16)}, 收到0x${functionCode.toString(16)}`);
    }

    // 验证CRC
    const receivedCrc = response.readUInt16LE(response.length - 2);
    const calculatedCrc = ModbusCRC.calculate(response.slice(0, -2));
    
    if (receivedCrc !== calculatedCrc) {
      throw new Error(`CRC校验失败: 期望0x${calculatedCrc.toString(16)}, 收到0x${receivedCrc.toString(16)}`);
    }

    return response.slice(2, -2); // 返回数据部分（去除地址、功能码和CRC）
  }

  /**
   * 进入Bootloader模式 (0x65)
   */
  async enterBootloaderMode() {
    const request = this._buildRequest(0x65);
    const response = await this._sendRequest(request, 0x65);
    const data = this._checkResponse(response, 0x65);

    if (data.length < 1) {
      throw new Error('响应数据长度不足');
    }

    const status = data[0];
    if (status !== 0x00) {
      throw new Error(`进入Bootloader模式失败，状态码: 0x${status.toString(16)}`);
    }

    return { success: true, message: '成功进入Bootloader模式' };
  }

  /**
   * 设置会话目标 (0x70)
   * targetType: 0x00=本地MCU, 0x01=从MCU1, 0x02=从MCU2
   */
  async setSessionTarget(targetType) {
    const requestData = Buffer.from([targetType]);
    const request = this._buildRequest(0x70, requestData);
    const response = await this._sendRequest(request, 0x70);
    const data = this._checkResponse(response, 0x70);

    if (data.length < 1) {
      throw new Error('响应数据长度不足');
    }

    const status = data[0];
    if (status !== 0x00) {
      throw new Error(`设置会话目标失败，状态码: 0x${status.toString(16)}`);
    }

    return { success: true, message: `成功设置会话目标: ${targetType}` };
  }

  /**
   * 擦除闪存 (0x66)
   * 默认擦除整个APP区域
   */
  async eraseFlash(startAddr = 0xFFFFFFFF, length = 0xFFFFFFFF) {
    const requestData = Buffer.alloc(8);
    requestData.writeUInt32BE(startAddr, 0);
    requestData.writeUInt32BE(length, 4);
    
    const request = this._buildRequest(0x66, requestData);
    const response = await this._sendRequest(request, 0x66);
    const data = this._checkResponse(response, 0x66);

    if (data.length < 9) {
      throw new Error('响应数据长度不足');
    }

    const status = data[0];
    if (status !== 0x00) {
      throw new Error(`擦除闪存失败，状态码: 0x${status.toString(16)}`);
    }

    const actualStartAddr = data.readUInt32BE(1);
    const actualLength = data.readUInt32BE(5);

    return {
      success: true,
      message: '成功擦除闪存',
      startAddr: actualStartAddr,
      length: actualLength
    };
  }

  /**
   * 写入闪存 (0x67)
   */
  async writeFlash(addr, data) {
    const dataLen = data.length;
    const requestData = Buffer.alloc(6 + dataLen);
    requestData.writeUInt32BE(addr, 0);
    requestData.writeUInt16BE(dataLen, 4);
    data.copy(requestData, 6);
    
    const request = this._buildRequest(0x67, requestData);
    const response = await this._sendRequest(request, 0x67);
    const respData = this._checkResponse(response, 0x67);

    if (respData.length < 3) {
      throw new Error('响应数据长度不足');
    }

    const status = respData[0];
    if (status !== 0x00) {
      throw new Error(`写入闪存失败，状态码: 0x${status.toString(16)}`);
    }

    const writtenBytes = respData.readUInt16BE(1);
    return { success: true, writtenBytes };
  }

  /**
   * 刷新FLASH缓存 (0x68)
   */
  async flushFlashCache() {
    const request = this._buildRequest(0x68);
    const response = await this._sendRequest(request, 0x68);
    const data = this._checkResponse(response, 0x68);

    if (data.length < 1) {
      throw new Error('响应数据长度不足');
    }

    const status = data[0];
    if (status !== 0x00) {
      throw new Error(`刷新FLASH缓存失败，状态码: 0x${status.toString(16)}`);
    }

    return { success: true, message: '成功刷新FLASH缓存' };
  }

  /**
   * 完成APP写入 (0x6A)
   */
  async completeAppWrite() {
    const request = this._buildRequest(0x6A);
    const response = await this._sendRequest(request, 0x6A);
    const data = this._checkResponse(response, 0x6A);

    if (data.length < 1) {
      throw new Error('响应数据长度不足');
    }

    const status = data[0];
    if (status !== 0x00 && status !== 0x06) {
      throw new Error(`完成APP写入失败，状态码: 0x${status.toString(16)}`);
    }

    return { success: true, message: '成功完成APP写入', status };
  }

  /**
   * 跳转到应用程序 (0x69)
   */
  async jumpToApplication(addr = 0xFFFFFFFF) {
    const requestData = Buffer.alloc(4);
    requestData.writeUInt32BE(addr, 0);
    
    const request = this._buildRequest(0x69, requestData);
    const response = await this._sendRequest(request, 0x69);
    const data = this._checkResponse(response, 0x69);

    if (data.length < 1) {
      throw new Error('响应数据长度不足');
    }

    const status = data[0];
    if (status !== 0x00) {
      throw new Error(`跳转到应用程序失败，状态码: 0x${status.toString(16)}`);
    }

    return { success: true, message: '成功跳转到应用程序' };
  }

  /**
   * 读取输入寄存器 (0x04)
   */
  async readInputRegisters(startAddr, count) {
    const requestData = Buffer.alloc(4);
    requestData.writeUInt16BE(startAddr, 0);
    requestData.writeUInt16BE(count, 2);
    
    const request = this._buildRequest(0x04, requestData);
    const response = await this._sendRequest(request, 0x04);
    const data = this._checkResponse(response, 0x04);

    if (data.length < 1) {
      throw new Error('响应数据长度不足');
    }

    const byteCount = data[0];
    if (data.length < 1 + byteCount) {
      throw new Error('响应数据长度不足');
    }

    const registers = [];
    for (let i = 0; i < byteCount; i += 2) {
      registers.push(data.readUInt16BE(1 + i));
    }

    return { success: true, registers };
  }
}

module.exports = ModbusClient;
