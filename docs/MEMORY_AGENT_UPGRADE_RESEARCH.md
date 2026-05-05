# 记忆系统与 Agent 能力升级研究摘记

日期：2026-05-05

## 研究结论

本轮查阅的前沿资料指向同一件事：长期陪伴应用不能把“记忆”和“Agent 工具”做成黑箱。好的系统要分层、可审查、可回滚，并且让用户看见系统为什么调用某个工具。

补充查阅人类记忆资料后，工程目标再收紧：Yuri Nest 的记忆系统至少要覆盖工作记忆、语义记忆、情景记忆、程序记忆、线索召回、巩固、再巩固更新、复习/调用痕迹 8 个代理指标。详见 `docs/HUMAN_MEMORY_TARGET.md`。

## 可借鉴原则

### 记忆系统

1. **短期与长期分开**  
   LangGraph 把 thread-scoped short-term memory 和跨会话 long-term memory 分开。Yuri Nest 已经有最近对话、会话摘要、长期记忆、scope 和 prompt block，本轮继续把“调用路径”做得更可见。

2. **语义、事件、流程三类分工**  
   LangGraph 文档把长期记忆分成 semantic、episodic、procedural；本项目对应已有 `stable / episode / working` 与 `profile / event / procedure / reflection`。后续不要把一次性事件写成稳定规则。

3. **层级记忆与上下文预算**  
   MemGPT 的关键启发是“有限上下文里管理多级记忆”：不是全塞，而是按快慢层和相关性调入。Yuri Nest 的 prompt builder 继续沿用边界、稳定事实、关系、项目、事件的预算顺序。

4. **观察、反思、计划闭环**  
   Generative Agents 的架构强调 observation、reflection、planning。Yuri Nest 当前先做轻量版：候选捕捉、人工审核、调用日志、守护台复查，未来再接 LLM 反思整理。

5. **人类可干预**  
   记忆系统要让用户看见候选、来源、版本和误用反馈。本轮新增“记忆流水线”，把捕捉、校准、调用、修剪四段直接放到记忆页。

### Agent 能力

1. **工具要有清楚契约**  
   OpenAI 工具文档和 MCP tools 都强调 tool name、description/schema 和 tool result 的结构化。Yuri Nest 现在的 `toolDetectors / toolExecutors / actionDetectors` 分层是正确方向，后续新增工具继续走白名单和 facade。

2. **工具调用要可见**  
   MCP 明确建议 UI 展示哪些工具暴露给模型、何时被调用，并对重要操作保留用户确认。本轮新增 Agent 决策摘要，让调试模式能看到意图、工作流、风险、记忆模式和下一步。

3. **护栏与追踪不是附加品**  
   OpenAI Agents SDK 把 guardrails、human review、tracing 放在 agent workflow 核心位置。Yuri Nest 已有 `risk_gate / tool_governance / response_quality_gate`，本轮把它们的决策结果进一步汇总到 `agent.decision`。

4. **协议化资源与提示词**  
   MCP resources/prompts 的启发是：资源、提示词、工具应该能被发现、列出、选择，而不是散在各处。Yuri Nest 的后续云端版本可以把记忆空间、角色档案、世界树和任务队列都抽象成可列出的资源。

## 本轮落地

- Agent 决策摘要：后端返回 `agent.decision`，前端调试面板展示意图、工作流、风险等级、记忆模式和下一步。
- 记忆流水线：记忆页新增捕捉、校准、调用、修剪四段总览，帮助人工干预记忆系统。
- 核心记忆锚点：稳定、置顶、高权重高可信和流程规则类记忆优先保留，降低“重要记忆被关键词漏召回”的概率。
- 精准记忆捕捉：自动捕捉时先抽取真正要记的 payload，不把整句口头语和吐槽原样塞进长期记忆。
- 回忆模式：用户显式问旧事时，扩大召回上限、放宽事件/反思/曾调用记忆，并在 prompt 中要求找不到就诚实说明。
- 长期调用证据：记忆调用日志保留上限从 50 扩到 500，prompt 中加入记录/更新/上次调用日期。
- 再巩固提醒：核心记忆很久没调用时，守护台提醒复查确认。
- 附件能力边界：新增 `attachment_guide`，当用户问文档、图片、截图、PDF、DOCX 时，明确当前能处理粘贴文本/公开链接/工作区扫描，不能假装已经接入上传 OCR 或多模态图片理解。

## 资料来源

- [LangGraph Memory Concepts](https://docs.langchain.com/oss/python/concepts/memory)
- [LangGraph Add Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)
- [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442)
- [OpenAI Tools Guide](https://developers.openai.com/api/docs/guides/tools)
- [OpenAI Agents SDK Guide](https://developers.openai.com/api/docs/guides/agents)
- [OpenAI Agents SDK Tracing](https://github.com/openai/openai-agents-python/blob/main/docs/tracing.md)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Resources Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [MCP Prompts Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)
- [NCBI Bookshelf: Physiology, Long Term Memory](https://www.ncbi.nlm.nih.gov/books/NBK549791/)
- [NCBI Bookshelf: Memory Reconsolidation or Updating Consolidation](https://www.ncbi.nlm.nih.gov/books/NBK3905/)
- [Frontiers: Using Self-Generated Cues to Facilitate Recall](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.01830/full)
- [Spacing and Testing Effects review](https://www.sciencedirect.com/science/chapter/bookseries/abs/pii/S0079742110530032)
