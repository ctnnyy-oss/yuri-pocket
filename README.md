# 百合小手机

网页端 AI 聊天陪伴应用雏形。第一版已经包含手机感聊天界面、角色卡、长期记忆、世界树、本地存储、数据导入导出和本地模型代理。

## 启动

```powershell
npm install
npm run dev
```

打开终端显示的本地地址即可使用。

## 接入模型

复制 `.env.local.example` 为 `.env.local`，填入自己的模型服务：

```env
AI_API_KEY=你的密钥
AI_BASE_URL=http://127.0.0.1:18788/v1
AI_MODEL=deepseek/deepseek-v4-pro-free
AI_MAX_TOKENS=4096
AI_ESCAPE_UNICODE_CONTENT=true
```

没有填写密钥时，应用会使用本地演示回复，方便先验证界面、角色和记忆流程。

## 版本回溯与上线

姐姐已经给项目准备了 Git 版本回溯和 GitHub Pages 自动部署配置。说明见：

- `docs/VERSIONING_AND_DEPLOYMENT.md`

注意：GitHub Pages 公开网页不会上传 `.env.local`，所以不会泄露密钥；上线版主要用于三端 UI 和记忆流程预览，真正聊天仍建议跑本机版。
