# human-memory-90 硬任务（兼容旧文件名）

目标：Yuri Nest 的记忆系统必须持续向“人类记忆 90%+ 代理能力”推进。没有达到评测门槛，不允许把任务视为完成。

## 完成门槛

当前硬门槛：

- `npm run test:memory` 必须通过。
- 旧事召回用例通过率必须 >= 90%。
- 17 维 human-memory proxy gate 必须 >= 90%，当前验证结果为 17/17。
- 静默/极敏记忆不能在回忆模式泄露。
- 召回一次后，相关记忆必须被巩固：`accessCount` 增加、`memoryStrength` 增加、`nextReviewAt` 更新。
- 后台整理必须能生成 reflection 候选，把多条同类记忆抽象成可审核规则。
- 相反偏好必须优先进入 value conflict，避免旧规则和新规则一起污染回答。
- 人工修正记忆必须保留 revision history，保证“现在的妹妹”覆盖旧信息时有证据线。
- 时间线线索必须能召回对应阶段事件，例如“5月5号 / 五一最后一天”。
- 情绪显著性必须能把妹妹最焦虑、最在意、反复强调的记忆推到前面。
- 反思整理候选必须可解释：包含可沉淀原则、证据、时间线和仍需确认。
- 模糊旧事必须走本地向量近邻候选，但明确领域问题不能被向量噪声盖住。
- 记忆必须保存可持久语义签名，后续接外部 embedding / ANN 时不用重写整个记忆模型。
- AppState 必须保存 embedding 缓存，迁移、保存、备份时自动补齐，避免未来每轮聊天都重新计算。
- 外部 embedding 查询向量必须能参与回忆模式，且失败/超时时退回本地索引。
- 高权重泛化项目记忆不能压住具体旧事和情绪显著记忆。
- 聊天透镜反馈必须校准强度和显著性，不只是改展示策略。

## 当前已做

- 工作记忆：最近消息 + 会话摘要。
- 语义记忆：profile / preference / procedure / project。
- 情景记忆：event / reflection / conversation scope。
- 程序记忆：procedure + 高权重核心锚点。
- 线索召回：关键词 + 概念线索扩展 + 回忆模式。
- 轻量语义召回：关键词 + 概念组 + 中文片段向量相似度。
- 巩固：核心锚点、重复证据增强、记忆强度。
- 再巩固：调用后更新 `memoryStrength / reviewIntervalDays / nextReviewAt`。
- 冲突重巩固：相反偏好先报 value conflict，人工修正保留版本线。
- 复习痕迹：500 条 usage log + 守护台待巩固提醒。
- 反思整理：后台整理生成 reflection 候选。
- 时间线定位：日期、假期阶段、前后顺序和来源时间进入评分。
- 情绪显著性：`emotionalSalience` 进入记忆评分和 prompt 展示。
- 可解释反思：后台整理候选包含原则、证据、时间线和确认提示。
- 向量近邻检索：本地稀疏向量索引提供模糊旧事候选，明确领域问题会避开向量噪声。
- 可持久语义签名：每条记忆保存 `semanticSignature` / `semanticSignatureVersion`，向量索引用它分桶，但不会把分桶当成硬过滤。
- Embedding 缓存底座：新增 `memoryEmbeddings` 和 `memoryEmbeddingIndex.ts`，支持本地投影缓存、复用检测和向量召回；回忆模式已接入 embedding 候选；后端新增 `/api/model/embeddings`，以后可接 OpenAI-compatible embedding 模型。
- 外部 embedding 查询向量：显式旧事询问时会尝试用后端 embedding 入口生成同模型 query vector，成功则参与本轮回忆排序，失败或超时自动回落。
- 高噪声抗干扰：评测集加入高权重泛化路线图干扰项，防止“泛泛记忆系统升级”盖住妹妹真正焦虑的长期遗忘问题。
- 反馈校准：冷却、少用、问起再提、归档会调整 `memoryStrength` 和 `emotionalSalience`。
- 自动评测：`scripts/memoryEvalEntry.ts`，当前输出 `Memory eval score: 13/13 (100%)` 和 `Human-memory proxy gate: 17/17 (100%)`。

## 未完成

- 外部 embedding 模型 + 真正 ANN 向量检索。
- LLM 后台反思整理，而不是规则启发式 reflection。
- 更大规模真实聊天旧事评测集。
- 云端多设备增量同步与冲突合并。
- 图片、文档、语音内容自动入记忆。
- 情绪显著性仍是规则估算，需要后续用真实反馈校准。

## 继续规则

每次继续这个任务时，先跑：

```powershell
npm run test:memory
```

如果失败，先修评测失败。  
如果通过，继续补“未完成”列表中的下一项。
