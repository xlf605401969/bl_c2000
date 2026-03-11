# Bootloader 上位机 (Electron GUI)

基于 Electron 的 C2000 MCU Bootloader 上位机程序，提供图形化界面用于固件烧录。

![界面预览](screenshot.png)

## 功能特性

- 🎨 **现代化GUI界面** - 基于Electron构建的跨平台桌面应用
- 📡 **串口通信** - 支持Modbus RTU协议
- 🎯 **双MCU支持** - 支持主MCU（C2000，16位内存）和CM核（8位内存）
- 📊 **实时进度** - 实时显示烧录进度和状态
- 📝 **日志输出** - 详细的操作日志记录
- ⚡ **快捷操作** - 一键进入Bootloader模式、跳转到应用程序、查看系统信息
- 🎯 **会话管理** - 支持切换烧录目标（本地MCU/从MCU）
- 📋 **完整系统信息** - 读取并显示Bootloader、Flash、应用程序的完整信息

## 系统需求

- Windows 10/11、macOS 10.13+、Linux
- Node.js 16.x 或更高版本
- 可用的串口设备

## 安装

1. 克隆或下载项目到本地
2. 安装依赖：

```bash
cd bl_electron_gui
npm install
```

## 开发运行

```bash
npm start
```

或使用开发模式（自动打开开发工具）：

```bash
npm run dev
```

## 打包发布

打包为可执行文件：

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# 所有平台
npm run build
```

打包后的文件位于 `dist` 目录。

## 使用说明

### 主MCU固件烧录（16位内存）

1. **串口配置**
   - 选择串口设备
   - 设置波特率（默认250000）
   - 设置从站ID（默认1）

2. **选择目标**
   - 选择"主MCU (C2000, 16位内存)"

3. **选择固件文件**
   - 选择低字节HEX文件
   - 选择高字节HEX文件

4. **配置版本信息**（可选）
   - 主版本号
   - 次版本号
   - 构建号

5. **开始烧录**
   - 点击"开始烧录"按钮
   - 等待烧录完成

### CM核固件烧录（8位内存）

1. **串口配置**（同上）

2. **选择目标**
   - 选择"CM核 (8位内存)"

3. **选择固件文件**
   - 选择HEX文件

4. **配置版本信息**（同上）

5. **开始烧录**（同上）

### 快捷操作

- **进入Bootloader** - 快速让设备进入Bootloader模式
- **擦除芯片...** - 在弹窗中按 CPU1、CM、CPU2 分区切换擦除目标；CPU1 额外提供 Bootloader 擦除，APP 使用默认全擦除命令
- **跳转到应用** - 让设备跳转到应用程序运行
- **查看系统信息** - 读取并显示完整的系统信息：
  - **Bootloader信息**：魔数、版本、状态、能力、错误码
  - **Flash信息**：总容量、APP起始地址、APP最大容量
  - **应用程序信息**：版本号、CRC32、Git标签等

独立擦除说明：

- 弹窗顶部可直接切换 `CPU1 / CM / CPU2` 擦除目标，不依赖主界面的当前目标选择。
- Bootloader 擦除按钮只在 `CPU1` 目标下提供，默认范围为 `0x80000 - 0x88000`，GUI 中按“结束地址不含”解释，默认擦除长度为 `0x8000` 字节，且可手动修改起始和结束地址。
- “擦除 APP” 不再读取芯片信息，而是直接对当前目标发送 bootloader 的默认 APP 全擦除命令。
- “擦除指定地址范围” 允许手动输入起始和结束地址，结束地址为不包含上界。

## GUI配置

GUI 会从根目录的 [bl_electron_gui/gui-config.json](bl_electron_gui/gui-config.json) 读取目标定义，并据此动态生成页面与操作逻辑。

这份配置会决定：

- 一共有多少个目标
- 每个目标在 GUI 中的名称
- 每个目标接收 8 位还是 16 位固件
- 每个目标对应的 HEX2 `target`
- 每个目标对应的 bootloader 协议目标号
- 哪些目标支持分离 HEX 模式
- 每个目标的擦除行为和 Bootloader 默认地址范围

配置示例：

```json
{
   "defaultFirmwareFormat": "hex2",
   "defaultTarget": "main",
   "appInfoTarget": "main",
   "targets": [
      {
         "id": "main",
         "firmwareTarget": "cpu1",
         "label": "主MCU",
         "displayName": "CPU1",
         "bitWidth": 16,
         "protocolTargetCode": 0,
         "flashPriority": 1,
         "legacySupported": true
      },
      {
         "id": "cm",
         "firmwareTarget": "cm",
         "label": "CM核",
         "displayName": "CM",
         "bitWidth": 8,
         "protocolTargetCode": 1,
         "flashPriority": 2,
         "legacySupported": true
      }
   ]
}
```

说明：

- `bitWidth: 16` 的目标在分离 HEX 模式下需要 `low/high` 两个文件。
- `bitWidth: 8` 的目标在分离 HEX 模式下只需要一个 HEX 文件。
- HEX2 模式下也会校验 `bitWidth` 与分段实际地址单位是否一致：`16bit` 目标必须对应 `word16`，`8bit` 目标必须对应 `byte8`，不一致时会在加载固件时直接报错。
- 目标选择、烧录目标、擦除弹窗和相关校验逻辑，都会随这份配置自动变化。

## 烧录流程

程序会自动执行以下步骤：

1. 📖 解析HEX文件
2. 🔌 连接串口
3. 🚀 进入Bootloader模式
4. 🎯 设置会话目标（非CPU1目标时）
5. 🗑️ 擦除闪存
6. ✍️ 写入固件数据
7. 💾 刷新FLASH缓存
8. ✅ 完成APP写入
9. 🏃 跳转到应用程序

## 协议说明

本程序实现了基于Modbus RTU的Bootloader协议，支持以下功能码：

| 功能码 | 名称 | 描述 |
|-------|------|------|
| 0x04 | 读输入寄存器 | 读取引导加载程序信息寄存器 |
| 0x65 | 进入引导加载程序模式 | 切换到引导加载程序模式 |
| 0x66 | 擦除闪存 | 按地址范围擦除闪存内存 |
| 0x67 | 写入闪存 | 将数据写入闪存内存 |
| 0x68 | 刷新FLASH缓存 | 将FLASH缓冲区全部写入FLASH |
| 0x69 | 跳转到应用程序 | 跳转到应用程序代码 |
| 0x6A | 完成APP写入 | 完成APP写入操作并更新app_info信息 |
| 0x70 | 设置会话目标 | 设置当前会话操作目标 |

详细协议规范请参考：`../bl_main/PROTOCOL.md`

多镜像组合文件格式说明请参考：`./HEX2_FORMAT.md`

### 标准目标与协议目标号映射

GUI 中用于烧录的标准目标，与 Bootloader 协议 `0x70` 设置会话目标命令中的目标号映射如下：

| GUI目标 | HEX2标准target | 协议目标号 | 含义 |
|-------|----------------|-----------|------|
| 主MCU / CPU1 | `cpu1` | `0x00` | 本地MCU |
| CM核 | `cm` | `0x01` | 从MCU1 |
| CPU2 | `cpu2` | `0x02` | 从MCU2 |

说明：

- GUI 内部会把 `main` 映射为标准目标 `cpu1`，再进一步映射为协议目标号 `0x00`。
- `cm` 和 `cpu2` 分别映射为协议目标号 `0x01`、`0x02`。
- 该映射用于烧录时发送 `0x70` 设置会话目标命令。

### HEX2 target 与 GUI 的关系

在 HEX2 文件中，GUI 是根据每个分段头里的 `target=` 字段来决定目标归属的，而不是根据 `name=` 字段：

- `target=cpu1` 会在 GUI 中作为 CPU1 / 主MCU 目标出现
- `target=cm` 会在 GUI 中作为 CM 目标出现
- `target=cpu2` 会在 GUI 中作为 CPU2 目标出现
- 其他自定义 target，例如 `target=config`，会出现在内存浏览器中，但不会自动映射成标准烧录目标

也就是说：HEX2 的 `target` 决定“解析后有哪些目标”；只有 `cpu1`、`cm`、`cpu2` 这三个标准 target 会继续映射到 Bootloader 协议的目标号。

## 项目结构

```
bl_electron_gui/
├── main.js                 # Electron主进程
├── preload.js              # 预加载脚本
├── package.json            # 项目配置
├── src/                    # 源代码
│   ├── hex-parser.js       # HEX文件解析器
│   ├── modbus-client.js    # Modbus通信客户端
│   └── flasher.js          # 烧录流程控制
├── renderer/               # 渲染进程（前端）
│   ├── index.html          # 主界面
│   ├── styles.css          # 样式表
│   └── app.js              # 前端逻辑
└── assets/                 # 资源文件
    └── icon.png            # 应用图标
```

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **Node.js** - 后端运行环境
- **SerialPort** - 串口通信库
- **HTML/CSS/JavaScript** - 前端界面

## 常见问题

### 1. 找不到串口设备

- 确认设备已连接并安装驱动
- 在设备管理器中检查COM口
- 尝试点击刷新按钮

### 2. 烧录失败

- 检查串口配置是否正确
- 确认固件文件路径正确
- 查看日志了解详细错误信息
- 确认设备已进入Bootloader模式

### 3. 应用无法启动

- 确认已安装Node.js
- 重新运行 `npm install`
- 检查是否有依赖安装失败

## 参考

- Python命令行版本：`../bl_upper_control/`
- 协议文档：`../bl_main/PROTOCOL.md`
- Bootloader源码：`../bl_main/` 和 `../bl_cm_proxy/`

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-02-07)

- ✨ 初始版本发布
- 🎨 实现现代化GUI界面
- 📡 支持Modbus RTU通信
- 🔧 支持主MCU和CM核烧录
- 📊 实时进度显示
- 📝 详细日志记录
