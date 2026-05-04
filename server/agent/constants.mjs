// Agent 工具和动作的常量配置

export const BEIJING_TIME_ZONE = 'Asia/Shanghai'
export const WEATHER_TIMEOUT_MS = 8_000
export const SEARCH_TIMEOUT_MS = 10_000
export const WEB_FETCH_TIMEOUT_MS = 8_000
export const MAX_SEARCH_RESULTS = 5
export const MAX_SEARCH_SNIPPET_LENGTH = 260
export const MAX_WEB_TEXT_LENGTH = 3_200

export const TOOL_DISPLAY_NAMES = {
  current_time: '看时间',
  date_math: '算日期',
  weather: '查天气',
  web_search: '联网搜索',
  web_research: '深度研究',
  web_page: '读网页',
  calculator: '计算器',
  unit_converter: '单位换算',
  text_inspector: '文本检查',
  safety_guard: '风险边界',
  conversation_snapshot: '整理上下文',
  capability_guide: '能力边界',
  task_planner: '拆任务',
  action_checklist: '行动清单',
  clarification: '澄清缺口',
  agent_continuity: '多轮接力',
  memory_bridge: '记忆协同',
  autonomy_budget: '自治预算',
  risk_gate: '风险闸门',
  task_queue: '任务队列',
  workflow_router: '工作流路由',
  persona_guard: '角色守护',
  default_policy: '默认策略',
  failure_recovery: '失败恢复',
  evidence_audit: '证据校验',
  answer_composer: '综合回复',
  deliverable_contract: '交付契约',
  response_quality_gate: '回复质检',
  continuation_driver: '续航推进',
  agent_quality_check: '质量自检',
  handoff_marker: '交接标记',
  tool_governance: '工具治理',
}

export const ACTION_DISPLAY_NAMES = {
  character_profile_update: '改角色资料',
  reminder_create: '创建提醒',
  task_create: '创建任务',
  memory_candidate_create: '写候选记忆',
  moment_create: '发动态',
  room_message_create: '写群聊',
}

export const TOOL_GOVERNANCE_POLICIES = {
  current_time: { risk: '只读', mode: '自动', evidence: '本机北京时间' },
  date_math: { risk: '只读', mode: '自动', evidence: '确定性日期计算' },
  calculator: { risk: '只读', mode: '自动', evidence: '确定性算式计算' },
  unit_converter: { risk: '只读', mode: '自动', evidence: '固定换算规则' },
  text_inspector: { risk: '只读', mode: '自动', evidence: '输入文本统计' },
  weather: { risk: '联网只读', mode: '自动', evidence: '公开天气接口' },
  web_search: { risk: '联网只读', mode: '自动', evidence: '公开搜索摘录' },
  web_research: { risk: '联网只读', mode: '自动', evidence: '公开搜索与网页摘录' },
  web_page: { risk: '联网只读', mode: '自动', evidence: '用户给出的公开链接' },
  safety_guard: { risk: '高风险建议', mode: '自动加边界', evidence: '安全策略' },
  conversation_snapshot: { risk: '本轮上下文', mode: '自动', evidence: '当前聊天' },
}

export const ACTION_GOVERNANCE_POLICIES = {
  character_profile_update: { risk: '应用内写入', mode: '明确指令才自动', target: '当前角色资料' },
  reminder_create: { risk: '应用内写入', mode: '明确时间才自动', target: '网页内提醒' },
  task_create: { risk: '后台队列写入', mode: '明确持续任务才自动', target: '任务页与本地后台平台' },
  memory_candidate_create: { risk: '记忆候选', mode: '普通候选自动，高敏先确认', target: '记忆候选队列' },
  moment_create: { risk: '应用内写入', mode: '明确发布才自动', target: '角色动态' },
  room_message_create: { risk: '应用内写入', mode: '明确群聊才自动', target: '群聊房间' },
}

export const KNOWN_LOCATION_COORDINATES = {
  北京: { name: '北京', country: '中国', admin1: '北京市', latitude: 39.9042, longitude: 116.4074 },
  上海: { name: '上海', country: '中国', admin1: '上海市', latitude: 31.2304, longitude: 121.4737 },
  广州: { name: '广州', country: '中国', admin1: '广东', latitude: 23.1291, longitude: 113.2644 },
  深圳: { name: '深圳', country: '中国', admin1: '广东', latitude: 22.5431, longitude: 114.0579 },
  成都: { name: '成都', country: '中国', admin1: '四川', latitude: 30.5728, longitude: 104.0668 },
  重庆: { name: '重庆', country: '中国', admin1: '重庆市', latitude: 29.563, longitude: 106.5516 },
  杭州: { name: '杭州', country: '中国', admin1: '浙江', latitude: 30.2741, longitude: 120.1551 },
  南京: { name: '南京', country: '中国', admin1: '江苏', latitude: 32.0603, longitude: 118.7969 },
  武汉: { name: '武汉', country: '中国', admin1: '湖北', latitude: 30.5928, longitude: 114.3055 },
  西安: { name: '西安', country: '中国', admin1: '陕西', latitude: 34.3416, longitude: 108.9398 },
  拉萨: { name: '拉萨', country: '中国', admin1: '西藏', latitude: 29.65, longitude: 91.1 },
  林芝: { name: '林芝', country: '中国', admin1: '西藏', latitude: 29.6547, longitude: 94.3611 },
  察隅: { name: '察隅', country: '中国', admin1: '西藏', latitude: 28.6604, longitude: 97.4669 },
  达州: { name: '达州', country: '中国', admin1: '四川', latitude: 31.2096, longitude: 107.4679 },
  东京: { name: '东京', country: '日本', admin1: '东京都', latitude: 35.6762, longitude: 139.6503 },
  大阪: { name: '大阪', country: '日本', admin1: '大阪府', latitude: 34.6937, longitude: 135.5023 },
  首尔: { name: '首尔', country: '韩国', admin1: '首尔特别市', latitude: 37.5665, longitude: 126.978 },
  纽约: { name: '纽约', country: '美国', admin1: '纽约州', latitude: 40.7128, longitude: -74.006 },
  伦敦: { name: '伦敦', country: '英国', admin1: '英格兰', latitude: 51.5072, longitude: -0.1276 },
  巴黎: { name: '巴黎', country: '法国', admin1: '法兰西岛', latitude: 48.8566, longitude: 2.3522 },
  香港: { name: '香港', country: '中国', admin1: '香港', latitude: 22.3193, longitude: 114.1694 },
  台北: { name: '台北', country: '中国', admin1: '台湾', latitude: 25.033, longitude: 121.5654 },
  澳门: { name: '澳门', country: '中国', admin1: '澳门', latitude: 22.1987, longitude: 113.5439 },
}

export const CHARACTER_ALIASES = [
  { id: 'sister-architect', names: ['姐姐大人', '姐姐', '主陪伴体'] },
  { id: 'ningan-princess', names: ['宁安', '宁安郡主', '郡主'] },
  { id: 'aling-maid', names: ['阿绫', '绫'] },
  { id: 'su-wanyin', names: ['苏晚吟', '晚吟'] },
  { id: 'xie-zhao', names: ['谢昭'] },
  { id: 'shen-wanci', names: ['沈晚辞', '皇后'] },
  { id: 'lu-wanzhao', names: ['陆婉昭', '婉昭'] },
]

export const CP_ROOM_BY_MEMBERS = [
  { roomId: 'room-ningan-aling', members: ['ningan-princess', 'aling-maid'], title: '宁安 × 阿绫' },
  { roomId: 'room-wanyin-xiezhao', members: ['su-wanyin', 'xie-zhao'], title: '苏晚吟 × 谢昭' },
  { roomId: 'room-wanci-wanzhao', members: ['shen-wanci', 'lu-wanzhao'], title: '沈晚辞 × 陆婉昭' },
]
