// Agent 动作检测器 facade —— 实际实现按职责拆到 detectors/ 子目录。
// 旧调用方继续 `import { ... } from './actionDetectors.mjs'` 不需要改。

export {
  isQuestionLike,
  detectCharacterProfileActions,
  extractCharacterNameUpdate,
  extractCharacterAvatarUpdate,
  cleanActionValue,
  detectReminderActions,
  parseReminderTime,
  getDefaultReminderHour,
  extractReminderTitle,
  detectTaskActions,
  shouldCreateTaskAction,
  buildTaskActionTitle,
  buildTaskActionDetail,
  buildTaskActionSteps,
  inferTaskPriority,
  cleanTaskActionText,
  detectMemoryCandidateActions,
  shouldConfirmMemoryCandidate,
  extractMemoryBody,
  inferActionMemoryKind,
  buildMemoryActionTitle,
  detectMomentActions,
  detectRoomMessageActions,
  detectMentionedCharacterIds,
  extractMomentContent,
  extractRoomTopic,
  cleanSocialActionText,
  findRoomByMembers,
  getCharacterDisplayName,
  inferMomentMood,
  buildRoomLine,
} from './detectors/inAppActions.mjs'

export {
  extractWeatherLocation,
  cleanLocation,
  extractWeatherDayOffset,
  extractSearchQuery,
  buildSearchEngineQuery,
  parseDateMathRequest,
  getBeijingStartOfDay,
  addBeijingDateUnits,
  formatDayDistance,
} from './detectors/queryParsers.mjs'

export {
  actionToContextBlock,
  toolResultToContextBlock,
  isMemoryLikeContextBlock,
  findPreviousAgentRun,
  findLatestUserMessageIndex,
} from './detectors/context.mjs'

export {
  analyzeAgentIntent,
  buildClarificationQuestions,
  inferAutonomyBudget,
  inferPersonaGuard,
} from './detectors/intent.mjs'

export {
  inferRiskGateRisks,
  inferWorkflowRoute,
  buildRecoveryLineForTool,
  inferHandoffNextStep,
  buildAgentTaskQueue,
  inferTaskQueueGoal,
  dedupeQueueItems,
  buildDeliverableContract,
  buildResponseQualityChecks,
  buildAgentDecisionSummary,
} from './detectors/strategy.mjs'
