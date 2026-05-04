// Agent 工具编排入口
// 子模块：constants / utils / toolDetectors / toolExecutors / actionDetectors / searchEngines

import { normalizeToolText } from './agent/utils.mjs'
import {
  shouldUseTimeTool,
  shouldUseDateMathTool,
  shouldUseWeatherTool,
  shouldUseSearchTool,
  shouldUseDeepResearchTool,
  shouldUseCalculatorTool,
  shouldUseUnitConverterTool,
  shouldUseTextInspectorTool,
  shouldUseSafetyGuardTool,
  shouldUseConversationTool,
  shouldUseCapabilityGuide,
  shouldUseExternalSearchGuide,
  shouldUseWebPageTool,
  shouldUseAgentContinuityTool,
  shouldUseAutonomyBudgetTool,
  shouldUseTaskPlannerTool,
  shouldUseActionChecklistTool,
  shouldUseClarificationTool,
  shouldUseMemoryBridgeTool,
  shouldUseRiskGateTool,
  shouldUseWorkflowRouterTool,
  shouldUsePersonaGuardTool,
  shouldUseDefaultPolicyTool,
  shouldUseContinuationDriverTool,
  shouldUseAnswerComposerTool,
  shouldUseFailureRecoveryTool,
  shouldUseTaskQueueTool,
  shouldUseEvidenceAuditTool,
  shouldUseDeliverableContractTool,
  shouldUseResponseQualityGateTool,
  shouldUseToolGovernanceTool,
  shouldUseAgentBrief,
  shouldUseAgentQualityCheckTool,
  shouldUseHandoffMarkerTool,
} from './agent/toolDetectors.mjs'
import {
  createCurrentTimeToolResult,
  createDateMathToolResult,
  createWeatherToolResult,
  createWebSearchToolResult,
  createWebResearchToolResult,
  createWebPageToolResults,
  createExternalSearchGuideToolResult,
  createCalculatorToolResult,
  createUnitConverterToolResult,
  createTextInspectorToolResult,
  createSafetyGuardToolResult,
  createConversationSnapshotToolResult,
  createCapabilityGuideToolResult,
  createAgentContinuityToolResult,
  createAutonomyBudgetToolResult,
  createTaskPlannerToolResult,
  createActionChecklistToolResult,
  createClarificationToolResult,
  createMemoryBridgeToolResult,
  createRiskGateToolResult,
  createWorkflowRouterToolResult,
  createPersonaGuardToolResult,
  createDefaultPolicyToolResult,
  createContinuationDriverToolResult,
  createFailureRecoveryToolResult,
  createTaskQueueToolResult,
  createEvidenceAuditToolResult,
  createDeliverableContractToolResult,
  createAnswerComposerToolResult,
  createResponseQualityGateToolResult,
  createAgentQualityCheckToolResult,
  createHandoffMarkerToolResult,
  createToolGovernanceToolResult,
  createAgentBriefToolResult,
} from './agent/toolExecutors.mjs'
import {
  detectCharacterProfileActions,
  detectReminderActions,
  detectTaskActions,
  detectMemoryCandidateActions,
  detectMomentActions,
  detectRoomMessageActions,
  toolResultToContextBlock,
  actionToContextBlock,
  findPreviousAgentRun,
} from './agent/actionDetectors.mjs'

function createEmptyAgentRun() {
  return {
    tools: [],
    actions: [],
  }
}

export async function prepareAgentBundle(bundle) {
  const contextBlocks = Array.isArray(bundle?.contextBlocks) ? bundle.contextBlocks : []
  const messages = Array.isArray(bundle?.messages) ? bundle.messages : []
  const latestUserMessage = [...messages].reverse().find((message) => message?.role === 'user')
  const latestUserText = normalizeToolText(latestUserMessage?.content)
  const previousAgentRun = findPreviousAgentRun(messages)
  const agent = createEmptyAgentRun()

  if (!latestUserText) {
    return { bundle: { ...bundle, contextBlocks }, agent }
  }

  // ---- 实时工具 ----
  if (shouldUseTimeTool(latestUserText)) {
    agent.tools.push(createCurrentTimeToolResult())
  }

  if (shouldUseDateMathTool(latestUserText)) {
    agent.tools.push(createDateMathToolResult(latestUserText))
  }

  if (shouldUseWeatherTool(latestUserText)) {
    agent.tools.push(await createWeatherToolResult(latestUserText))
  }

  // ---- 搜索工具 ----
  if (shouldUseDeepResearchTool(latestUserText)) {
    agent.tools.push(await createWebResearchToolResult(latestUserText))
  } else if (shouldUseSearchTool(latestUserText)) {
    agent.tools.push(await createWebSearchToolResult(latestUserText))
  } else if (shouldUseExternalSearchGuide(latestUserText)) {
    agent.tools.push(createExternalSearchGuideToolResult())
  }

  if (shouldUseWebPageTool(latestUserText)) {
    const urlToolResults = await createWebPageToolResults(latestUserText)
    agent.tools.push(...urlToolResults)
  }

  // ---- 计算工具 ----
  if (shouldUseCalculatorTool(latestUserText)) {
    agent.tools.push(createCalculatorToolResult(latestUserText))
  }

  if (shouldUseUnitConverterTool(latestUserText)) {
    agent.tools.push(createUnitConverterToolResult(latestUserText))
  }

  if (shouldUseTextInspectorTool(latestUserText)) {
    agent.tools.push(createTextInspectorToolResult(latestUserText))
  }

  // ---- 安全与上下文 ----
  if (shouldUseSafetyGuardTool(latestUserText)) {
    agent.tools.push(createSafetyGuardToolResult(latestUserText))
  }

  if (shouldUseConversationTool(latestUserText)) {
    agent.tools.push(createConversationSnapshotToolResult(messages))
  }

  if (shouldUseCapabilityGuide(latestUserText)) {
    agent.tools.push(createCapabilityGuideToolResult())
  }

  // ---- 多轮接力 ----
  if (shouldUseAgentContinuityTool(latestUserText, previousAgentRun)) {
    agent.tools.push(createAgentContinuityToolResult(latestUserText, previousAgentRun))
  }

  if (shouldUseAutonomyBudgetTool(latestUserText, previousAgentRun)) {
    agent.tools.push(createAutonomyBudgetToolResult(latestUserText, previousAgentRun))
  }

  if (shouldUseTaskPlannerTool(latestUserText)) {
    agent.tools.push(createTaskPlannerToolResult(latestUserText))
  }

  // ---- 动作检测 ----
  agent.actions.push(...detectCharacterProfileActions(latestUserText))
  agent.actions.push(...detectReminderActions(latestUserText))
  agent.actions.push(...detectTaskActions(latestUserText))
  agent.actions.push(...detectMemoryCandidateActions(latestUserText))
  agent.actions.push(...detectMomentActions(latestUserText))
  agent.actions.push(...detectRoomMessageActions(latestUserText))

  // ---- 协同与治理 ----
  if (shouldUseMemoryBridgeTool(latestUserText, contextBlocks, agent)) {
    agent.tools.push(createMemoryBridgeToolResult(latestUserText, contextBlocks, agent))
  }

  if (shouldUseRiskGateTool(latestUserText, agent)) {
    agent.tools.push(createRiskGateToolResult(latestUserText, agent))
  }

  if (shouldUseWorkflowRouterTool(latestUserText, agent)) {
    agent.tools.push(createWorkflowRouterToolResult(latestUserText, agent))
  }

  if (shouldUsePersonaGuardTool(latestUserText, agent)) {
    agent.tools.push(createPersonaGuardToolResult(latestUserText, agent))
  }

  if (shouldUseActionChecklistTool(latestUserText)) {
    agent.tools.push(createActionChecklistToolResult(latestUserText, agent))
  }

  if (shouldUseClarificationTool(latestUserText, agent)) {
    agent.tools.push(createClarificationToolResult(latestUserText, agent))
  }

  if (shouldUseDefaultPolicyTool(latestUserText)) {
    agent.tools.push(createDefaultPolicyToolResult(latestUserText))
  }

  if (shouldUseContinuationDriverTool(latestUserText)) {
    agent.tools.push(createContinuationDriverToolResult(latestUserText, agent))
  }

  if (shouldUseFailureRecoveryTool(agent)) {
    agent.tools.push(createFailureRecoveryToolResult(agent))
  }

  if (shouldUseTaskQueueTool(latestUserText, agent, previousAgentRun)) {
    agent.tools.push(createTaskQueueToolResult(latestUserText, agent, previousAgentRun))
  }

  if (shouldUseEvidenceAuditTool(latestUserText, agent)) {
    agent.tools.push(createEvidenceAuditToolResult(latestUserText, agent))
  }

  if (shouldUseDeliverableContractTool(latestUserText, agent)) {
    agent.tools.push(createDeliverableContractToolResult(latestUserText, agent))
  }

  // ---- 质量与收尾 ----
  if (shouldUseAnswerComposerTool(agent)) {
    agent.tools.push(createAnswerComposerToolResult(latestUserText, agent))
  }

  if (shouldUseResponseQualityGateTool(latestUserText, agent)) {
    agent.tools.push(createResponseQualityGateToolResult(latestUserText, agent))
  }

  if (shouldUseAgentQualityCheckTool(latestUserText, agent)) {
    agent.tools.push(createAgentQualityCheckToolResult(latestUserText, agent))
  }

  if (shouldUseHandoffMarkerTool(latestUserText, agent)) {
    agent.tools.push(createHandoffMarkerToolResult(latestUserText, agent))
  }

  if (shouldUseToolGovernanceTool(agent)) {
    agent.tools.push(createToolGovernanceToolResult(agent))
  }

  if (shouldUseAgentBrief(latestUserText, agent)) {
    agent.tools.unshift(createAgentBriefToolResult(latestUserText, agent))
  }

  // ---- 组装上下文 ----
  const toolBlocks = [
    ...agent.tools.map(toolResultToContextBlock),
    ...agent.actions.map(actionToContextBlock),
  ]

  return {
    bundle: { ...bundle, contextBlocks: [...toolBlocks, ...contextBlocks] },
    agent,
  }
}
