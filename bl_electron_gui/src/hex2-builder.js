const fs = require('fs');

function parseHexLine(line, filePath, lineNumber) {
  if (!line.startsWith(':')) {
    throw new Error(`${filePath} 第 ${lineNumber} 行不是有效的 Intel HEX 记录`);
  }

  const payload = line.substring(1).trim();
  if (!payload || payload.length % 2 !== 0 || /[^0-9a-fA-F]/.test(payload)) {
    throw new Error(`${filePath} 第 ${lineNumber} 行包含无效的十六进制内容`);
  }

  const bytes = [];
  for (let index = 0; index < payload.length; index += 2) {
    bytes.push(parseInt(payload.substring(index, index + 2), 16));
  }

  if (bytes.length < 5) {
    throw new Error(`${filePath} 第 ${lineNumber} 行记录长度过短`);
  }

  const byteCount = bytes[0];
  if (bytes.length !== byteCount + 5) {
    throw new Error(`${filePath} 第 ${lineNumber} 行字节数与记录长度不一致`);
  }

  let checksum = 0;
  for (let index = 0; index < bytes.length - 1; index++) {
    checksum += bytes[index];
  }
  checksum = (~checksum + 1) & 0xFF;

  if (checksum !== bytes[bytes.length - 1]) {
    throw new Error(`${filePath} 第 ${lineNumber} 行校验和错误`);
  }

  return {
    recordType: bytes[3],
    line
  };
}

function normalizeIntelHexFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const normalized = [];
  let eofSeen = false;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (!line.startsWith(':')) {
      return;
    }

    const parsed = parseHexLine(line, filePath, index + 1);
    normalized.push(parsed.line.toUpperCase());
    if (parsed.recordType === 0x01) {
      eofSeen = true;
    }
  });

  if (!normalized.length) {
    throw new Error(`${filePath} 中未找到有效的 Intel HEX 记录`);
  }

  if (!eofSeen) {
    throw new Error(`${filePath} 缺少 Intel HEX EOF 记录`);
  }

  return normalized;
}

function createSegmentHeader({ name, target, addrUnit, combine }) {
  return `@SEGMENT name=${name} target=${target} addr-unit=${addrUnit} combine=${combine} purpose=firmware`;
}

function appendSegment(lines, header, body) {
  lines.push(header);
  lines.push(...body);
  lines.push('');
}

function createHex2File({ outputPath, targetDefinitions, selectedTargets }) {
  if (!outputPath) {
    throw new Error('输出文件路径不能为空');
  }

  if (!Array.isArray(selectedTargets) || selectedTargets.length === 0) {
    throw new Error('至少需要选择一个目标来生成 HEX2');
  }

  const lines = ['@HEX2 version=1', ''];
  const createdSegments = [];

  selectedTargets.forEach((selectedTarget) => {
    const targetDefinition = targetDefinitions.find((item) => item.id === selectedTarget.id);
    if (!targetDefinition) {
      throw new Error(`未知目标: ${selectedTarget.id}`);
    }

    const files = selectedTarget.files || {};
    if (targetDefinition.bitWidth === 16) {
      if (!files.low || !files.high) {
        throw new Error(`${targetDefinition.displayName} 需要同时提供低字节和高字节 HEX 文件`);
      }

      const lowLines = normalizeIntelHexFile(files.low);
      const highLines = normalizeIntelHexFile(files.high);

      appendSegment(
        lines,
        createSegmentHeader({
          name: `${targetDefinition.id}-low`,
          target: targetDefinition.firmwareTarget,
          addrUnit: 'word16',
          combine: 'pair-low'
        }),
        lowLines
      );
      appendSegment(
        lines,
        createSegmentHeader({
          name: `${targetDefinition.id}-high`,
          target: targetDefinition.firmwareTarget,
          addrUnit: 'word16',
          combine: 'pair-high'
        }),
        highLines
      );

      createdSegments.push(`${targetDefinition.displayName}: low/high`);
      return;
    }

    if (!files.single) {
      throw new Error(`${targetDefinition.displayName} 需要提供 HEX 文件`);
    }

    const singleLines = normalizeIntelHexFile(files.single);
    appendSegment(
      lines,
      createSegmentHeader({
        name: targetDefinition.id,
        target: targetDefinition.firmwareTarget,
        addrUnit: 'byte8',
        combine: 'none'
      }),
      singleLines
    );
    createdSegments.push(`${targetDefinition.displayName}: single`);
  });

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');

  return {
    outputPath,
    segments: createdSegments,
    targetCount: selectedTargets.length
  };
}

module.exports = {
  createHex2File
};