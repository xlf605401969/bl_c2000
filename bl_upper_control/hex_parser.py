import struct
import zlib
from typing import Dict, List, Tuple
import intelhex


class HexParser:
    def __init__(self):
        self.low_hex_data = None
        self.high_hex_data = None
        self.start_address = 0
        self.min_addr = 0
        self.max_addr = 0
        self.data_blocks: Dict[int, bytes] = {}
        self.is_16bit_mode = False

    def parse_files(self, low_hex_file: str, high_hex_file: str) -> bool:
        """解析两个HEX文件（低字节和高字节），合并为16位字数据"""
        try:
            self.is_16bit_mode = True
            
            # 加载低字节HEX文件
            self.low_hex_data = intelhex.IntelHex(low_hex_file)
            
            # 加载高字节HEX文件
            self.high_hex_data = intelhex.IntelHex(high_hex_file)
            
            # 获取地址范围
            low_addresses = set(self.low_hex_data.addresses())
            high_addresses = set(self.high_hex_data.addresses())
            
            if not low_addresses or not high_addresses:
                print("HEX文件为空或没有数据")
                return False
            
            # 验证高低字节文件地址是否完全相同
            if low_addresses != high_addresses:
                print("错误：高低字节HEX文件的地址不匹配！")
                print(f"  低字节文件地址数: {len(low_addresses)}")
                print(f"  高字节文件地址数: {len(high_addresses)}")
                
                # 显示差异
                only_in_low = low_addresses - high_addresses
                only_in_high = high_addresses - low_addresses
                
                if only_in_low:
                    print(f"  仅在低字节文件中的地址（前10个）: {sorted(only_in_low)[:10]}")
                if only_in_high:
                    print(f"  仅在高字节文件中的地址（前10个）: {sorted(only_in_high)[:10]}")
                
                return False
                
            self.min_addr = min(low_addresses)
            self.max_addr = max(low_addresses)
            
            # 合并两个HEX文件的数据为16位字数据
            self._merge_c2000_data()
            
            return True
            
        except Exception as e:
            print(f"解析HEX文件时出错: {e}")
            return False

    def parse_single_file(self, hex_file: str) -> bool:
        """解析单个HEX文件（8位内存宽度）"""
        try:
            self.is_16bit_mode = False
            
            # 加载HEX文件
            hex_data = intelhex.IntelHex(hex_file)
            
            # 获取地址范围
            addresses = hex_data.addresses()
            
            if not addresses:
                print("HEX文件为空或没有数据")
                return False
                
            self.min_addr = min(addresses)
            self.max_addr = max(addresses)
            
            # 将HEX数据转换为数据块
            self._merge_single_file_data(hex_data)
            
            return True
            
        except Exception as e:
            print(f"解析HEX文件时出错: {e}")
            return False

    def _merge_single_file_data(self, hex_data):
        """将单个HEX文件数据转换为数据块（8位内存宽度）"""
        self.data_blocks = {}
        
        # 获取所有地址
        all_addresses = sorted(hex_data.addresses())
        
        if not all_addresses:
            return
            
        base_addr = all_addresses[0]
        current_addr = base_addr
        current_data = bytearray()
        block_start_addr = base_addr
        
        for addr in all_addresses:
            # 如果地址不连续，创建新的数据块
            if addr > current_addr + 1 and current_data:
                self.data_blocks[block_start_addr] = bytes(current_data)
                current_data = bytearray()
                current_addr = addr
                block_start_addr = addr
                
            # 填充缺失的字节为0xFF
            while current_addr < addr:
                current_data.append(0xFF)
                current_addr += 1
                
            # 获取字节数据
            byte = hex_data[addr]
            current_data.append(byte)
            current_addr += 1
        
        # 保存最后一个数据块
        if current_data:
            self.data_blocks[block_start_addr] = bytes(current_data)

    def _merge_c2000_data(self):
        """合并低字节和高字节HEX文件为16位字数据"""
        self.data_blocks = {}
        
        # 获取所有地址（已验证高低字节文件地址相同）
        all_addresses = sorted(self.low_hex_data.addresses())
        
        if not all_addresses:
            return
            
        base_addr = all_addresses[0]
        current_addr = base_addr
        current_data = bytearray()
        block_start_addr = base_addr
        
        for addr in all_addresses:
            # 如果地址不连续，创建新的数据块
            if addr > current_addr + 1 and current_data:
                word_addr = block_start_addr
                self.data_blocks[word_addr] = bytes(current_data)
                current_data = bytearray()
                current_addr = addr
                block_start_addr = addr
                
            # 填充缺失的字节为0xFFFF（16位未初始化值）
            while current_addr < addr:
                current_data.extend([0xFF, 0xFF])
                current_addr += 1
                
            # 获取低字节和高字节，合并为16位字
            low_byte = self.low_hex_data[addr]
            high_byte = self.high_hex_data[addr]
            
            # C2000是小端序：低字节在前，高字节在后
            word = (high_byte << 8) | low_byte
            current_data.extend(struct.pack('<H', word))
            current_addr += 1
        
        # 保存最后一个数据块
        if current_data:
            word_addr = block_start_addr
            self.data_blocks[word_addr] = bytes(current_data)

    def get_data_blocks(self) -> Dict[int, bytes]:
        """获取处理后的数据块，地址为字地址，数据为16位字数组"""
        return self.data_blocks

    def get_start_address(self) -> int:
        """获取启动地址（字地址）"""
        if not self.data_blocks:
            return 0
        return self.min_addr

    def calculate_crc32(self) -> int:
        """计算CRC32校验和（基于16位字数据）"""
        if not self.data_blocks:
            return 0
            
        # 合并所有数据
        merged_data = bytearray()
        sorted_addresses = sorted(self.data_blocks.keys())
        
        for addr in sorted_addresses:
            merged_data.extend(self.data_blocks[addr])
            
        return zlib.crc32(bytes(merged_data)) & 0xFFFFFFFF

    def get_app_info(self) -> Tuple[int, int, int]:
        """获取应用程序信息"""
        if not self.data_blocks:
            return 0, 0, 0
            
        start_addr = self.get_start_address()
        
        # 计算总字节数（每个字2字节）
        total_bytes = sum(len(data) for data in self.data_blocks.values())
        
        crc32 = self.calculate_crc32()
        
        return start_addr, total_bytes, crc32

    def print_summary(self):
        """打印HEX文件摘要信息"""
        if not self.data_blocks:
            print("没有可用的数据")
            return
            
        if self.is_16bit_mode:
            print(f"\nHEX文件解析摘要 (16位内存宽度):")
        else:
            print(f"\nHEX文件解析摘要 (8位内存宽度):")
        
        sorted_addrs = sorted(self.data_blocks.keys())
        
        # 计算地址范围
        min_addr = sorted_addrs[0]
        max_addr = sorted_addrs[-1]
        
        if self.is_16bit_mode:
            # 16位模式：每个地址对应2字节
            max_byte_addr = max_addr + len(self.data_blocks[max_addr]) // 2
            total_bytes = sum(len(data) for data in self.data_blocks.values())
            total_words = total_bytes // 2
            
            print(f"  数据块数: {len(self.data_blocks)}")
            print(f"  字地址范围: {min_addr:#x} - {max_addr:#x}")
            print(f"  字节地址范围: {min_addr:#x} - {max_byte_addr:#x}")
            print(f"  总字节数: {total_bytes}")
            print(f"  总字数: {total_words}")
        else:
            # 8位模式：每个地址对应1字节
            max_byte_addr = max_addr + len(self.data_blocks[max_addr])
            total_bytes = sum(len(data) for data in self.data_blocks.values())
            
            print(f"  数据块数: {len(self.data_blocks)}")
            print(f"  字节地址范围: {min_addr:#x} - {max_byte_addr:#x}")
            print(f"  总字节数: {total_bytes}")
        
        start_addr, length, crc32 = self.get_app_info()
        print(f"  启动地址: {start_addr:#x}")
        print(f"  CRC32: {crc32:#010x}")
        
        # 显示每个数据块的信息
        print(f"\n  数据块详情:")
        for i, addr in enumerate(sorted_addrs[:5]):
            data = self.data_blocks[addr]
            if self.is_16bit_mode:
                num_words = len(data) // 2
                print(f"    块{i+1}: 字地址={addr:#x}, 大小={len(data)}字节 ({num_words}字)")
            else:
                print(f"    块{i+1}: 地址={addr:#x}, 大小={len(data)}字节")
        
        if len(sorted_addrs) > 5:
            print(f"    ... 还有 {len(sorted_addrs) - 5} 个数据块")
