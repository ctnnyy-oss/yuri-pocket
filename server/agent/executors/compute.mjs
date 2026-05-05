// 计算类工具：算术、单位换算、文本统计

import {
  createAgentId,
  extractMathExpression,
  normalizeMathExpression,
  evaluateMathExpression,
  formatCalculatorNumber,
  parseUnitConversion,
  extractInspectableText,
  inspectTextStats,
  truncateToolText,
} from '../utils.mjs'

export function createCalculatorToolResult(text) {
  const expression = extractMathExpression(text)

  if (!expression) {
    return {
      id: createAgentId('tool'),
      name: 'calculator',
      status: 'needs_input',
      title: 'Agent 工具：计算器需要表达式',
      content: [
        '工具 calculator 已识别到计算意图，但没有提取到可安全计算的算式。',
        '请用户给出明确数字和运算符；不要心算猜结果。',
      ].join('\n'),
      summary: '缺少可计算算式。',
      createdAt: new Date().toISOString(),
    }
  }

  try {
    const normalizedExpression = normalizeMathExpression(expression)
    const value = evaluateMathExpression(normalizedExpression)
    const formattedValue = formatCalculatorNumber(value)

    return {
      id: createAgentId('tool'),
      name: 'calculator',
      status: 'success',
      title: 'Agent 工具：计算器',
      content: [
        '工具 calculator 已执行。',
        `原始算式：${expression}`,
        `规范算式：${normalizedExpression}`,
        `结果：${formattedValue}`,
        '回答时以这个结果为准；不要重新心算出另一个数字。',
      ].join('\n'),
      summary: `${expression} = ${formattedValue}`,
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      id: createAgentId('tool'),
      name: 'calculator',
      status: 'error',
      title: 'Agent 工具：计算失败',
      content: [
        `工具 calculator 没有算出「${expression}」。`,
        `错误：${error instanceof Error ? error.message : '未知错误'}`,
        '请让用户换成更清楚的算式；不要给猜测数字。',
      ].join('\n'),
      summary: '计算失败。',
      createdAt: new Date().toISOString(),
    }
  }
}

export function createUnitConverterToolResult(text) {
  const conversion = parseUnitConversion(text)

  if (!conversion) {
    return {
      id: createAgentId('tool'),
      name: 'unit_converter',
      status: 'needs_input',
      title: 'Agent 工具：单位换算需要数字和单位',
      content: [
        '工具 unit_converter 已识别到换算意图，但没有提取到明确数字、原单位或目标单位。',
        '请用户给出类似“57.9kg是多少斤”“5km是多少米”的表达；不要猜测换算结果。',
      ].join('\n'),
      summary: '缺少可换算的数字或单位。',
      createdAt: new Date().toISOString(),
    }
  }

  return {
    id: createAgentId('tool'),
    name: 'unit_converter',
    status: 'success',
    title: 'Agent 工具：单位换算',
    content: [
      '工具 unit_converter 已执行。',
      `原始：${conversion.value} ${conversion.fromLabel}`,
      `目标：${conversion.toLabel}`,
      `结果：${conversion.result}`,
      conversion.note ? `备注：${conversion.note}` : '',
      '回答时以这个换算结果为准；如果是健康、训练或消费建议，只把换算当作辅助信息。',
    ]
      .filter(Boolean)
      .join('\n'),
    summary: `${conversion.value}${conversion.fromLabel} ≈ ${conversion.result}`,
    createdAt: new Date().toISOString(),
  }
}

export function createTextInspectorToolResult(text) {
  const sample = extractInspectableText(text)

  if (!sample) {
    return {
      id: createAgentId('tool'),
      name: 'text_inspector',
      status: 'needs_input',
      title: 'Agent 工具：文本检查需要正文',
      content: [
        '工具 text_inspector 已识别到字数/文本统计意图，但用户没有提供需要统计的正文。',
        '请用户粘贴正文或明确要统计哪一段；不要猜字数。',
      ].join('\n'),
      summary: '缺少待检查正文。',
      createdAt: new Date().toISOString(),
    }
  }

  const stats = inspectTextStats(sample)

  return {
    id: createAgentId('tool'),
    name: 'text_inspector',
    status: 'success',
    title: 'Agent 工具：文本检查',
    content: [
      '工具 text_inspector 已执行。',
      `总字符数：${stats.totalChars}`,
      `非空白字符数：${stats.nonWhitespaceChars}`,
      `中文字符数：${stats.chineseChars}`,
      `英文/数字词元数：${stats.wordTokens}`,
      `行数：${stats.lines}`,
      `段落数：${stats.paragraphs}`,
      `粗略阅读时间：${stats.readingMinutes} 分钟`,
      `开头摘录：${truncateToolText(sample, 260)}`,
      '回答时可以自然总结这些统计，不要把字数说成精确到平台审核口径；不同平台可能有不同计数规则。',
    ].join('\n'),
    summary: `${stats.nonWhitespaceChars} 个非空白字符，${stats.paragraphs} 段，约 ${stats.readingMinutes} 分钟读完。`,
    createdAt: new Date().toISOString(),
  }
}
