# 应用图标说明

这里应该放置应用图标文件：

- `icon.png` - PNG格式图标（256x256或512x512）
- `icon.ico` - Windows图标
- `icon.icns` - macOS图标

## 生成图标

你可以使用在线工具或命令行工具将PNG图标转换为不同平台所需的格式：

### 使用 electron-icon-builder

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./icon.png --output=./assets
```

### 手动转换

1. **Windows (.ico)**
   - 使用 ImageMagick: `convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`
   - 或使用在线工具：https://convertio.co/png-ico/

2. **macOS (.icns)**
   - 使用 iconutil (macOS)
   - 或使用在线工具：https://cloudconvert.com/png-to-icns

## 图标要求

- 推荐尺寸：512x512px
- 格式：PNG（透明背景）
- 内容：清晰、简洁的应用标识
