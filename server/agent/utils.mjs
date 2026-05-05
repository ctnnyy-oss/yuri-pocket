// Agent helpers facade —— 实际实现按职责拆到 helpers/ 子目录。
// 旧调用方继续 `import { ... } from './utils.mjs'` 不需要改。

export {
  formatBeijingDateTime,
  formatBeijingDateOnly,
  getBeijingDateParts,
  createDateFromBeijingParts,
  formatToolMessageTime,
  getWeatherDayLabel,
} from './helpers/time.mjs'

export {
  isMetaToolName,
  getAgentToolLabel,
  getToolRoleLabel,
  createAgentId,
  inferSafetyCategory,
} from './helpers/tools.mjs'

export {
  hasUrl,
  extractUrls,
  isSafeHttpUrl,
  normalizeSearchUrl,
  decodeYahooRedirectUrl,
  decodeBingRedirectUrl,
} from './helpers/url.mjs'

export {
  decodeHtmlEntity,
  parseHtmlPage,
  getHtmlAttribute,
  cleanSearchHtml,
} from './helpers/html.mjs'

export {
  normalizeToolText,
  truncateToolText,
  extractInspectableText,
  inspectTextStats,
} from './helpers/text.mjs'

export {
  extractMathExpression,
  normalizeMathExpression,
  evaluateMathExpression,
  formatCalculatorNumber,
  parseUnitConversion,
  extractTargetUnit,
  normalizeUnit,
  convertUnitValue,
  getUnitLabel,
} from './helpers/math.mjs'

export {
  fetchTextWithTimeout,
  fetchJsonWithTimeout,
  isLikelySearchResult,
  dedupeSearchResults,
} from './helpers/http.mjs'

export {
  formatWeatherNumber,
  geocodeLocation,
  fetchWeatherForecast,
  buildWeatherDaySummary,
  getWeatherCodeLabel,
} from './helpers/weather.mjs'
