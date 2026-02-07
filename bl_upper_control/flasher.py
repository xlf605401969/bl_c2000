import time
import struct
from typing import Optional
from tqdm import tqdm
from modbus_client import BootloaderClient
from hex_parser import HexParser


class BootloaderFlasher:
    def __init__(self, serial_port: str, baudrate: int = 115200, slave_id: int = 1, verbose: bool = False):
        self.client = BootloaderClient(serial_port, baudrate, slave_id, verbose)
        self.parser = HexParser()

    def flash_hex_files(self, low_hex_file: str, high_hex_file: str, chunk_size: int = 256,
                        major_version: int = 1, minor_version: int = 0,
                        build_version: int = 0) -> bool:
        print(f"开始烧录HEX文件 (16位内存模式):")
        print(f"  低字节文件: {low_hex_file}")
        print(f"  高字节文件: {high_hex_file}")

        if not self.parser.parse_files(low_hex_file, high_hex_file):
            print("HEX文件解析失败")
            return False

        return self._flash_common(chunk_size, major_version, minor_version, build_version)

    def flash_hex_file(self, hex_file: str, chunk_size: int = 256,
                       major_version: int = 1, minor_version: int = 0,
                       build_version: int = 0) -> bool:
        print(f"开始烧录HEX文件 (8位内存模式):")
        print(f"  文件: {hex_file}")

        if not self.parser.parse_single_file(hex_file):
            print("HEX文件解析失败")
            return False

        return self._flash_common(chunk_size, major_version, minor_version, build_version)

    def _flash_common(self, chunk_size: int, major_version: int, minor_version: int,
                       build_version: int) -> bool:
        self.parser.print_summary()

        start_addr, app_length, crc32 = self.parser.get_app_info()
        print(f"\n应用程序信息:")
        print(f"  起始地址: {start_addr:#x}")
        print(f"  长度: {app_length} 字节")
        print(f"  CRC32: {crc32:#010x}")

        if not self._connect_and_enter_bootloader():
            return False

        if not self._erase_flash():
            self.client.disconnect()
            return False

        if not self._write_firmware(chunk_size):
            self.client.disconnect()
            return False

        if not self._flush_cache():
            self.client.disconnect()
            return False

        if not self._complete_app_write():
            self.client.disconnect()
            return False

        if not self._jump_to_application():
            self.client.disconnect()
            return False

        self.client.disconnect()
        print("\n烧录完成!")
        return True

    def _connect_and_enter_bootloader(self) -> bool:
        print("\n连接串口...")
        if not self.client.connect():
            print("串口连接失败")
            return False

        print("进入引导加载程序模式...")
        if not self.client.enter_bootloader_mode():
            print("进入引导加载程序模式失败")
            self.client.disconnect()
            return False

        return True

    def _erase_flash(self) -> bool:
        print("\n擦除闪存...")
        if not self.client.erase_flash():
            print("擦除闪存失败")
            return False
        return True

    def _write_firmware(self, chunk_size: int) -> bool:
        print("\n写入固件...")

        data_blocks = self.parser.get_data_blocks()
        if not data_blocks:
            print("没有数据需要写入")
            return False

        # 计算总字节数和总chunk数
        total_bytes = sum(len(data) for data in data_blocks.values())
        total_chunks = sum((len(data) + chunk_size - 1) // chunk_size for data in data_blocks.values())

        # 创建进度条
        progress_bar = tqdm(
            total=total_bytes,
            unit='B',
            unit_scale=True,
            unit_divisor=1024,
            desc="写入进度",
            bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]'
        )

        sorted_addresses = sorted(data_blocks.keys())
        written_bytes = 0
        written_chunks = 0
        is_16bit_mode = self.parser.is_16bit_mode

        try:
            for base_addr in sorted_addresses:
                data = data_blocks[base_addr]
                offset = 0

                while offset < len(data):
                    chunk = data[offset:offset + chunk_size]
                    
                    # 根据内存模式计算地址
                    if is_16bit_mode:
                        # 16位模式：数据是16位字数组，地址是字地址
                        # 需要将字节偏移转换为字偏移（每个字2字节）
                        word_offset = offset // 2
                        current_addr = base_addr + word_offset
                    else:
                        # 8位模式：数据是字节数组，地址是字节地址
                        current_addr = base_addr + offset

                    if not self.client.write_flash(current_addr, chunk):
                        progress_bar.close()
                        print(f"\n写入地址 {current_addr:#x} 失败")
                        return False

                    offset += len(chunk)
                    written_bytes += len(chunk)
                    written_chunks += 1
                    
                    # 更新进度条
                    progress_bar.update(len(chunk))
                    progress_bar.set_postfix({
                        '地址': f'{current_addr:#x}',
                        '块': f'{written_chunks}/{total_chunks}'
                    })

            progress_bar.close()
            print(f"\n成功写入 {written_bytes} 字节, 共 {written_chunks} 个数据块")
            return True
            
        except Exception as e:
            progress_bar.close()
            print(f"\n写入过程中发生错误: {str(e)}")
            return False

    def _flush_cache(self) -> bool:
        print("\n刷新FLASH缓存...")
        if not self.client.flush_flash_cache():
            print("刷新FLASH缓存失败")
            return False
        return True

    def _complete_app_write(self) -> bool:
        print("\n完成APP写入...")

        if not self.client.complete_app_write():
            print("完成APP写入失败")
            return False
        return True

    def _jump_to_application(self) -> bool:
        print("\n跳转到应用程序...")
        if not self.client.jump_to_application():
            print("跳转到应用程序失败")
            return False
        return True
