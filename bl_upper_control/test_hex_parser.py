#!/usr/bin/env python3
"""测试新的hex解析功能"""

from hex_parser import HexParser

def test_hex_parser():
    """测试hex解析器"""
    parser = HexParser()
    
    # 测试解析示例hex文件
    test_file = "sample_firmware.hex"
    
    print("测试新的hex解析器...")
    
    if parser.parse_file(test_file):
        print("✓ HEX文件解析成功")
        
        # 打印摘要信息
        parser.print_summary()
        
        # 获取数据块
        data_blocks = parser.get_data_blocks()
        print(f"\n数据块数量: {len(data_blocks)}")
        
        # 显示前几个数据块的信息
        sorted_addrs = sorted(data_blocks.keys())
        for i, addr in enumerate(sorted_addrs[:3]):
            data = data_blocks[addr]
            print(f"数据块{i+1}: 字地址={addr:#x}, 大小={len(data)}字节")
            print(f"  前16字节: {data[:16].hex().upper()}")
            
        # 测试应用程序信息
        start_addr, length, crc32 = parser.get_app_info()
        print(f"\n应用程序信息:")
        print(f"  启动字地址: {start_addr:#x}")
        print(f"  总字节数: {length}")
        print(f"  CRC32: {crc32:#010x}")
        
    else:
        print("✗ HEX文件解析失败")

if __name__ == "__main__":
    test_hex_parser()