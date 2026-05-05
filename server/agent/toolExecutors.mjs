// Agent 工具执行器 facade —— 实际实现按职责拆到 executors/ 子目录。
// 旧调用方继续 `import { ... } from './toolExecutors.mjs'` 不需要改。

export {
  createCurrentTimeToolResult,
  createDateMathToolResult,
  createWeatherToolResult,
} from './executors/realtime.mjs'

export {
  createWebSearchToolResult,
  createWebResearchToolResult,
  createWebPageToolResults,
  createWebPageToolResult,
  fetchResearchPageExcerpts,
  fetchPublicPageExcerpt,
} from './executors/web.mjs'

export {
  createCalculatorToolResult,
  createUnitConverterToolResult,
  createTextInspectorToolResult,
} from './executors/compute.mjs'

export {
  createSafetyGuardToolResult,
  createConversationSnapshotToolResult,
  createCapabilityGuideToolResult,
  createAttachmentGuideToolResult,
  createExternalSearchGuideToolResult,
} from './executors/workspace.mjs'

export {
  createTaskPlannerToolResult,
  createActionChecklistToolResult,
  createClarificationToolResult,
  createAgentContinuityToolResult,
  createMemoryBridgeToolResult,
  createTaskQueueToolResult,
  createDeliverableContractToolResult,
} from './executors/planning.mjs'

export {
  createAutonomyBudgetToolResult,
  createRiskGateToolResult,
  createWorkflowRouterToolResult,
  createPersonaGuardToolResult,
  createDefaultPolicyToolResult,
  createContinuationDriverToolResult,
  createFailureRecoveryToolResult,
  createEvidenceAuditToolResult,
  createToolGovernanceToolResult,
  describeGovernedTool,
  describeGovernedAction,
} from './executors/governance.mjs'

export {
  createAnswerComposerToolResult,
  createResponseQualityGateToolResult,
  createAgentQualityCheckToolResult,
  createHandoffMarkerToolResult,
  createAgentBriefToolResult,
} from './executors/quality.mjs'
