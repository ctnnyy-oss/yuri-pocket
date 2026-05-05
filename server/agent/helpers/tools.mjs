// Agent 工具结果元数据：ID、角色标签、Meta 工具识别、显示名

import { TOOL_DISPLAY_NAMES } from '../constants.mjs'

const META_TOOL_NAMES = new Set([
  'agent_brief',
  'capability_guide',
  'attachment_guide',
  'agent_continuity',
  'memory_bridge',
  'autonomy_budget',
  'risk_gate',
  'task_queue',
  'workflow_router',
  'persona_guard',
  'failure_recovery',
  'evidence_audit',
  'answer_composer',
  'deliverable_contract',
  'response_quality_gate',
  'agent_quality_check',
  'handoff_marker',
  'tool_governance',
])

export function isMetaToolName(name) {
  return META_TOOL_NAMES.has(name)
}

export function getAgentToolLabel(tool) {
  return TOOL_DISPLAY_NAMES[tool.name] || String(tool.title || tool.name).replace('Agent 工具：', '')
}

export function getToolRoleLabel(role) {
  return { user: '用户', assistant: '助手', system: '系统', tool: '工具' }[role] || role
}

export function createAgentId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function inferSafetyCategory(text) {
  if (/药|药物|用药|剂量|症状|疼|痛|发烧|感染|清洁|私处|包茎|抑郁|自残|诊断|治疗/.test(text)) {
    return { label: '医疗', policy: '只给一般信息和何时求助专业人士；不能给确定诊断或处方剂量。' }
  }
  if (/法律|合同|起诉|违法/.test(text)) {
    return { label: '法律', policy: '只给一般信息；正式建议交给执业律师。' }
  }
  if (/投资|股票|基金|加密货币|贷款|保险/.test(text)) {
    return { label: '金融', policy: '只给科普性背景；不做收益承诺或具体投资建议。' }
  }
  return { label: '一般高风险', policy: '保守回答，给一般信息和现实求助方向。' }
}
