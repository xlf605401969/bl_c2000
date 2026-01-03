import argparse
import sys
from flasher import BootloaderFlasher


def main():
    parser = argparse.ArgumentParser(
        description='Bootloader上位机程序 - 用于烧录HEX固件到C2000芯片',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 8位内存模式
  %(prog)s -p COM3 -f firmware.hex
  %(prog)s --port COM4 --file-low app.hex --baudrate 115200
  %(prog)s -p COM5 -f fw.hex --major 1 --minor 2 --build 100
  
  # 16位内存模式（C2000芯片）
  %(prog)s -p COM3 -f firmware_low.hex --file-high firmware_high.hex
  %(prog)s --port COM4 --file-low app_low.hex --file-high app_high.hex --baudrate 115200
  %(prog)s -p COM5 -f fw_low.hex --file-high fw_high.hex --major 1 --minor 2 --build 100
        """
    )

    parser.add_argument('-p', '--port', required=True,
                        help='串口设备名称 (例如: COM3, /dev/ttyUSB0)')

    parser.add_argument('-f', '--file-low', required=True,
                        help='HEX固件文件路径')

    parser.add_argument('--file-high', required=False,
                        help='高字节HEX固件文件路径（可选，指定时按16bit内存处理，不指定按8bit处理）')

    parser.add_argument('-b', '--baudrate', type=int, default=250000,
                        help='串口波特率 (默认: 250000)')

    parser.add_argument('-s', '--slave-id', type=int, default=1,
                        help='Modbus从站ID (默认: 1)')

    parser.add_argument('--major', type=int, default=1,
                        help='主版本号 (默认: 1)')

    parser.add_argument('--minor', type=int, default=0,
                        help='次版本号 (默认: 0)')

    parser.add_argument('--build', type=int, default=0,
                        help='构建版本号 (默认: 0)')

    parser.add_argument('--chunk-size', type=int, default=64,
                        help='每次写入的数据块大小 (默认: 64)')

    parser.add_argument('-v', '--verbose', action='store_true',
                        help='显示详细的Modbus通讯信息')

    args = parser.parse_args()

    print("=" * 60)
    print("Bootloader上位机程序")
    print("=" * 60)
    print(f"串口: {args.port}")
    print(f"波特率: {args.baudrate}")
    print(f"从站ID: {args.slave_id}")
    print(f"HEX文件: {args.file_low}")
    if args.file_high:
        print(f"高字节HEX文件: {args.file_high}")
        print(f"内存模式: 16位")
    else:
        print(f"内存模式: 8位")
    print(f"版本: {args.major}.{args.minor}.{args.build}")
    print(f"数据块大小: {args.chunk_size}")
    print(f"详细模式: {'是' if args.verbose else '否'}")
    print("=" * 60)

    flasher = BootloaderFlasher(
        serial_port=args.port,
        baudrate=args.baudrate,
        slave_id=args.slave_id,
        verbose=args.verbose
    )

    if args.file_high:
        success = flasher.flash_hex_files(
            low_hex_file=args.file_low,
            high_hex_file=args.file_high,
            chunk_size=args.chunk_size,
            major_version=args.major,
            minor_version=args.minor,
            build_version=args.build
        )
    else:
        success = flasher.flash_hex_file(
            hex_file=args.file_low,
            chunk_size=args.chunk_size,
            major_version=args.major,
            minor_version=args.minor,
            build_version=args.build
        )

    if success:
        print("\n烧录成功!")
        sys.exit(0)
    else:
        print("\n烧录失败!")
        sys.exit(1)


if __name__ == '__main__':
    main()
