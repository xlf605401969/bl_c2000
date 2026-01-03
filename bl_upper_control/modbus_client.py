import struct
import time
from typing import Tuple, Optional


class ModbusCRC:
    @staticmethod
    def calculate(data: bytes) -> int:
        crc = 0xFFFF
        for byte in data:
            crc ^= byte
            for _ in range(8):
                if crc & 0x0001:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc >>= 1
        return crc


class BootloaderClient:
    def __init__(self, serial_port: str, baudrate: int = 115200, slave_id: int = 1, verbose: bool = False):
        self.serial_port = serial_port
        self.baudrate = baudrate
        self.slave_id = slave_id
        self.serial = None
        self.timeout = 0.5
        self.verbose = verbose
        self._response_length_map = {
            0x65: 5,
            0x66: 13,
            0x67: 7,
            0x68: 5,
            0x69: 5,
            0x6A: 5,
            0x75: 5
        }

    def connect(self):
        try:
            import serial
            self.serial = serial.Serial(
                port=self.serial_port,
                baudrate=self.baudrate,
                bytesize=8,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=0.005
            )
            time.sleep(0.1)
            return True
        except Exception as e:
            print(f"连接串口失败: {e}")
            return False

    def disconnect(self):
        if self.serial and self.serial.is_open:
            self.serial.close()

    def _send_request(self, data: bytes, function_code: int) -> Optional[bytes]:
        if not self.serial or not self.serial.is_open:
            print("串口未连接")
            return None

        try:
            if self.verbose:
                print(f"  [TX] {data.hex().upper()}")

            self.serial.write(data)
            self.serial.flush()
            time.sleep(0.002)
            expected_length = self._response_length_map.get(function_code, 5)

            response = bytearray()
            start_time = time.time()
            
            while len(response) < expected_length:
                if self.serial.in_waiting > 0:
                    chunk = self.serial.read(min(self.serial.in_waiting, expected_length - len(response)))
                    response.extend(chunk)
                elif time.time() - start_time > self.timeout:
                    break
                else:
                    time.sleep(0.0001)
            
            if len(response) < 4:
                print("未收到响应")
                return None

            if self.verbose:
                print(f"  [RX] {response.hex().upper()}")

            return response
        except Exception as e:
            print(f"发送请求失败: {e}")
            return None

    def _build_request(self, function_code: int, data: bytes = b'') -> bytes:
        request = bytes([self.slave_id, function_code]) + data
        crc = ModbusCRC.calculate(request)
        request += struct.pack('<H', crc)
        return request

    def _check_response(self, response: bytes, expected_function_code: int) -> Tuple[bool, bytes]:
        if len(response) < 4:
            print(f"响应长度不足: {len(response)}")
            return False, b''

        received_slave_id = response[0]
        received_function_code = response[1]

        if received_slave_id != self.slave_id:
            print(f"从站地址不匹配: 期望{self.slave_id}, 收到{received_slave_id}")
            return False, b''

        if received_function_code != expected_function_code:
            if received_function_code == (expected_function_code | 0x80):
                print(f"功能码{expected_function_code:#x}执行失败")
                return False, b''
            else:
                print(f"功能码不匹配: 期望{expected_function_code:#x}, 收到{received_function_code:#x}")
                return False, b''

        received_crc = struct.unpack('<H', response[-2:])[0]
        calculated_crc = ModbusCRC.calculate(response[:-2])
        if received_crc != calculated_crc:
            print(f"CRC校验失败: 期望{calculated_crc:#x}, 收到{received_crc:#x}")
            return False, b''

        return True, response[2:-2]

    def enter_bootloader_mode(self) -> bool:
        request = self._build_request(0x65)
        response = self._send_request(request, 0x65)

        if response is None:
            return False

        success, data = self._check_response(response, 0x65)
        if not success:
            return False

        if len(data) < 1:
            print("响应数据长度不足")
            return False

        status = data[0]
        if status != 0x00:
            print(f"进入引导加载程序模式失败, 状态码: {status:#x}")
            return False

        print("成功进入引导加载程序模式")
        return True

    def erase_flash(self, start_addr: int = 0xFFFFFFFF, length: int = 0xFFFFFFFF) -> bool:
        request = self._build_request(0x66, struct.pack('>II', start_addr, length))
        response = self._send_request(request, 0x66)

        if response is None:
            return False

        success, data = self._check_response(response, 0x66)
        if not success:
            return False

        if len(data) < 9:
            print("响应数据长度不足")
            return False

        status = data[0]
        if status != 0x00:
            print(f"擦除闪存失败, 状态码: {status:#x}")
            return False

        actual_start_addr = struct.unpack('>I', data[1:5])[0]
        actual_length = struct.unpack('>I', data[5:9])[0]

        print(f"成功擦除闪存, 起始地址: {actual_start_addr:#x}, 长度: {actual_length}字节")
        return True

    def write_flash(self, addr: int, data: bytes) -> bool:
        data_len = len(data)
        request = self._build_request(0x67, struct.pack('>IH', addr, data_len) + data)
        response = self._send_request(request, 0x67)

        if response is None:
            return False

        success, resp_data = self._check_response(response, 0x67)
        if not success:
            return False

        if len(resp_data) < 3:
            print("响应数据长度不足")
            return False

        status = resp_data[0]
        if status != 0x00:
            print(f"写入闪存失败, 状态码: {status:#x}")
            return False

        return True

    def flush_flash_cache(self) -> bool:
        request = self._build_request(0x68)
        response = self._send_request(request, 0x68)

        if response is None:
            return False

        success, data = self._check_response(response, 0x68)
        if not success:
            return False

        if len(data) < 1:
            print("响应数据长度不足")
            return False

        status = data[0]
        if status != 0x00:
            print(f"刷新FLASH缓存失败, 状态码: {status:#x}")
            return False

        print("成功刷新FLASH缓存")
        return True

    def complete_app_write(self, major_version: int, minor_version: int,
                          build_version: int, app_length: int, crc32: int,
                          timestamp: int) -> bool:
        request = self._build_request(0x6A, struct.pack('>BBHIHHI',
                                                        major_version, minor_version,
                                                        build_version, app_length,
                                                        (crc32 >> 16) & 0xFFFF, crc32 & 0xFFFF,
                                                        timestamp))
        response = self._send_request(request, 0x6A)

        if response is None:
            return False

        success, data = self._check_response(response, 0x6A)
        if not success:
            return False

        if len(data) < 1:
            print("响应数据长度不足")
            return False

        status = data[0]
        if status != 0x00:
            print(f"完成APP写入失败, 状态码: {status:#x}")
            return False

        print("成功完成APP写入")
        return True

    def jump_to_application(self, addr: int = 0xFFFFFFFF) -> bool:
        request = self._build_request(0x69, struct.pack('>I', addr))
        response = self._send_request(request, 0x69)

        if response is None:
            return False

        success, data = self._check_response(response, 0x69)
        if not success:
            return False

        if len(data) < 1:
            print("响应数据长度不足")
            return False

        status = data[0]
        if status != 0x00:
            print(f"跳转到应用程序失败, 状态码: {status:#x}")
            return False

        print("成功跳转到应用程序")
        return True

    def reset_device(self) -> bool:
        request = self._build_request(0x75)
        response = self._send_request(request, 0x75)

        if response is None:
            return False

        success, data = self._check_response(response, 0x75)
        if not success:
            return False

        if len(data) < 1:
            print("响应数据长度不足")
            return False

        status = data[0]
        if status != 0x00:
            print(f"重置设备失败, 状态码: {status:#x}")
            return False

        print("成功重置设备")
        return True
