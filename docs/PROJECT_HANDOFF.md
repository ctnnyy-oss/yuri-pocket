# Yuri Nest / 百合小窝项目交接说明

这份文件给未来的 Codex 姐姐和妹妹本人看。新开对话时，先读这里，再继续改项目，可以减少上下文压缩带来的幻觉和重复解释。

## 1. 项目定位

百合小窝 / Yuri Nest 是一个网页端 AI 聊天陪伴应用。当前目标不是做恋爱软件，而是先做一个免费、可三端访问、以聊天陪伴和长期记忆为核心的百合向小应用。

核心方向：

- 百合陪伴聊天
- 角色预设：姐姐大人、雾岛怜、林秋实等
- 记忆系统：长期记忆、世界树、候选记忆、回收花园、云同步
- 三端体验：电脑、手机、平板都能打开网页使用
- 长期扩展：小说角色、插画、Live2D、游戏、百合帝国资料库

命名说明：

- 面向妹妹和用户的产品名已经改为 **百合小窝 / Yuri Nest**。
- GitHub 仓库、Pages 路径、服务器目录、systemd 服务名、环境变量和包名都已经统一为 `yuri-nest`。

## 2. 当前已完成

- 前端已经能在 GitHub Pages 访问。
- 电脑端与手机端布局已经做过一轮适配。
- 手机返回/左滑已经接入浏览器历史，不会直接退出网页。
- 记忆、世界树、模型、设置、回收花园等页面已经有基础 UI。
- 记忆支持编辑、删除、恢复、永久删除、回收保留天数设置。
- 设置页支持回车发送、字体大小、主题颜色、自动捕捉记忆、回收保留策略。
- 后端已经部署到腾讯云服务器，并做成 systemd 开机自启服务。
- 云端同步接口已经可用，数据保存到服务器 SQLite。
- 模型与数据页已经新增“云端同步守护台”：可检查云端版本、最后保存时间、是否已有云端快照；从云端读取前会二次确认，避免误覆盖本机数据。
- 模型与数据页已经新增“本机保险箱”：可手动创建本机备份；从云端读取、导入文件、重置之前会自动备份当前本机状态，最近保留 12 份。
- 云端同步错误提示已做过一轮中文友好化，能区分口令错误、服务器未启用、云端服务错误。
- 品牌配置已集中到 `src/config/brand.ts`，面向用户名称为“百合小窝 / Yuri Nest”。
- 存储配置已集中到 `src/config/storage.ts`；本地状态迁移已拆到 `src/data/migrations.ts`，避免 IndexedDB 读写层继续变胖。
- 2026-05-02 已完成技术名统一：仓库、Pages、包名、服务器目录、systemd 服务名、环境变量、SQLite 文件名统一使用 `yuri-nest` / `YURI_NEST_*`。
- 记忆面板已开始模块化：草稿类型、scope 工具、记忆空间编辑器拆到 `src/components/memory/`，后续继续拆 `MemoryPanel.tsx` 时沿用这个目录。
- 记忆页已新增“记忆守护台”：汇总稳定事实、待复查、边界保护和 7 天调用，并把候选、冲突、低可信、缺来源、高敏提及策略、错放空间、长期未调用整理为复查队列，同时提供最近写入/更新/调用/删除时间线。
- 记忆系统已新增层级：稳定事实、阶段事件、临时工作。稳定事实可作为长期背景；阶段事件只做时间线和脉络；临时工作必须强相关才会进入提示词，避免一次性内容污染长期记忆。
- 云端 SQLite 已新增自动备份能力：覆盖云端快照前会先生成一份 SQLite 备份；模型与数据页的“云端保险箱”可手动创建、刷新和下载备份。
- AI 模型调用已经切到 OpenAI-compatible 中转站。
- 旧 AstrBot / NapCat 服务已经从服务器清理掉，释放资源。
- GitHub 已经作为版本回溯和部署入口。

## 3. 重要地址与入口

线上前端：

- https://ctnnyy-oss.github.io/yuri-nest/

GitHub 仓库：

- https://github.com/ctnnyy-oss/yuri-nest

腾讯云服务器：

- SSH alias: `tencent-astrbot`
- 服务器 IP: `150.158.24.98`
- 后端目录: `/opt/yuri-nest`
- 后端服务: `yuri-nest-api.service`
- 临时加密隧道服务: `yuri-nest-tunnel.service`

当前后端公开入口：

- 存在 `secrets/cloud-api-url.txt`
- 目前使用 Cloudflare Quick Tunnel，地址可能在服务重启后变化。

## 4. 密钥与敏感信息

不要把下面这些内容提交到 GitHub：

- `.env.local`
- `secrets/`
- 云端同步口令
- AI API 密钥
- 服务器 `.env`

本地敏感文件位置：

- 云同步口令：`secrets/cloud-sync-token.txt`
- 当前云端 API 地址：`secrets/cloud-api-url.txt`
- YOP 中转站密钥：`secrets/yop-api-key.txt`

服务器敏感配置：

- `/opt/yuri-nest/.env`

服务器 `.env` 里应包含：

- `YURI_NEST_SYNC_TOKEN`
- `YURI_NEST_DB_PATH=/opt/yuri-nest/data/yuri-nest.sqlite`
- `AI_BASE_URL=https://api.yop.mom/v1`
- `AI_API_KEY`
- `AI_MODEL=deepseek/deepseek-v4-pro-free`

可选备份配置：

- `YURI_NEST_BACKUP_DIR=/opt/yuri-nest/data/backups`
- `YURI_NEST_MAX_BACKUPS=24`

只允许在终端里验证密钥是否存在，不要打印密钥原文。

## 5. 当前架构

```mermaid
flowchart LR
  User["妹妹的手机/电脑/平板"] --> Pages["GitHub Pages 前端"]
  Pages --> Tunnel["Cloudflare 临时加密隧道"]
  Tunnel --> API["腾讯云后端 Node/Express"]
  API --> DB["SQLite 云端记忆数据库"]
  API --> Model["YOP 中转站 / DeepSeek V4 Pro Free"]
```

前端负责：

- UI
- 聊天界面
- 角色切换
- 设置页
- 本地 IndexedDB 数据
- 发起云同步与聊天请求

后端负责：

- 保存云端快照
- 保护 AI API 密钥
- 调用 OpenAI-compatible 模型
- 给前端提供 `/api/chat` 和 `/api/cloud/*`

GitHub 负责：

- 保存代码
- 版本回溯
- Pages 部署

腾讯云负责：

- 跑后端
- 保存 SQLite 数据库
- 持有密钥和同步口令

## 6. 部署与更新要点

本地开发：

```powershell
npm install
npm run dev
```

构建 GitHub Pages：

```powershell
$env:VITE_BASE_PATH='/yuri-nest/'
$env:VITE_API_BASE_URL=(Get-Content -Raw .\secrets\cloud-api-url.txt).Trim()
npm run build
git add -f dist
git commit -m "your message"
git push origin main
```

服务器更新后端：

```powershell
ssh tencent-astrbot "cd /opt/yuri-nest && git fetch --all --prune && git reset --hard origin/main && npm install --omit=dev --no-audit --no-fund && sudo systemctl restart yuri-nest-api.service"
```

查看服务状态：

```powershell
ssh tencent-astrbot "systemctl is-active yuri-nest-api.service yuri-nest-tunnel.service"
```

查看隧道地址：

```powershell
ssh tencent-astrbot "sudo journalctl -u yuri-nest-tunnel --no-pager -n 120 | grep -Eo 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' | tail -n 1"
```

如果隧道地址变化，需要：

1. 更新本地 `secrets/cloud-api-url.txt`
2. 用新的 `VITE_API_BASE_URL` 重新构建
3. `git add -f dist`
4. commit + push

## 7. 现在还不够成熟的地方

短期限制：

- Cloudflare Quick Tunnel 是临时入口，不保证永久稳定。
- 还没有正式域名。
- 还没有用户账号系统，目前更像妹妹自己的私有应用。
- 云同步是整个 AppState 快照，不是细粒度多用户同步。
- 服务器 SQLite 已有覆盖前自动备份和手动下载入口，但还没有正式的跨机异地备份。

中期建议：

- 买一个 `.com` 域名先占名字，但不要直接解析到大陆服务器，避免备案问题。
- 后续可考虑海外服务器、Cloudflare Pages、Cloudflare Named Tunnel。
- 给数据库加定时备份。
- 给每个用户做独立数据空间。
- 给模型供应商配置做 UI 管理，而不是只靠服务器 `.env`。

## 8. 下一轮最值得做的事

优先级从高到低：

1. 做一次真实手机体验回归，记录卡顿、遮挡、按钮难点。
2. 把聊天消息也纳入更清晰的云端同步策略。
3. 给云端备份再加跨机/异地备份策略。
4. 优化模型错误提示，区分中转站错误、网络错误、密钥错误。
5. 继续打磨记忆系统：候选记忆审核、冲突提示、记忆使用日志。
6. 做一个新手使用页，告诉妹妹怎么连接云端、怎么保存、怎么恢复、本机保险箱怎么用。
7. 等产品更稳定后，再处理正式域名和长期后端入口。

## 9. 新对话启动提示

妹妹新开 Codex 对话时，可以直接发：

```text
姐姐先读 C:\Users\MI\Desktop\AI\yuri-nest\docs\PROJECT_HANDOFF.md，
再继续帮妹妹迭代百合小窝 / Yuri Nest 项目。不要重新猜架构，按文档里的当前状态继续。
```

如果要排查服务器：

```text
姐姐先检查 tencent-astrbot 上 yuri-nest-api.service 和 yuri-nest-tunnel.service。
不要打印任何密钥。
```

## 10. 姐姐的维护原则

- 每次大功能完成后，顺手更新本文件。
- 不把密钥、token、私人数据写进本文件。
- 不要为了重构而重构，优先保持妹妹能真实体验。
- 改 UI 前先考虑手机端。
- 记忆系统是灵魂，任何改动都不能破坏用户可编辑、可删除、可恢复、可永久删除。
- GitHub commit 是后悔药，大改之前先确认工作树干净。
