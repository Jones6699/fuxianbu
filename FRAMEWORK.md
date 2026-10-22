# 项目框架速查 — Threadbook（伏线簿）

## 技术栈
React 18 / TypeScript / Vite / Zustand / Capacitor 6 → Android APK

## 目录速查

```
src/
├── app/              # 入口 & 路由 & 全局样式
│   ├── App.tsx       # 单路由 /* → HomePage
│   ├── router.tsx    # 路由配置
│   ├── main.tsx      # ReactDOM 入口
│   └── styles.css    # 全局 CSS（140 行）
│
├── pages/
│   └── HomePage.tsx  # ☠️ 主页面，~1400 行，包含了：消息列表、输入框、
│                     #    设置、知识库、历史侧栏、工具面板、局部重写等所有 UI
│   (ChatPage/KnowledgePage/PromptsPage/SettingsPage 均为死代码，未被路由引用)
│
├── components/       # 全部为空文件（13 个），拆分 HomePage 后可填充
│
├── hooks/
│   └── useChat.ts    # sendMessage / retryMessage / stopGeneration / isLoading
│
├── services/
│   ├── api/
│   │   ├── providers/openai.ts   # OpenAI + DeepSeek + SiliconFlow API（prefix/FIM 也在这里）
│   │   ├── stream.ts             # SSE 流式处理器
│   │   └── controller.ts         # AbortController 池
│   ├── checker/      # 文风检测、禁用词、重复检测等
│   └── storage/      # IndexedDB / localStorage 持久化层
│
├── store/            # Zustand 状态管理
│   ├── chatStore.ts  # 对话核心：消息管理、流式生成、知识注入、版本管理
│   ├── settingsStore.ts  # 模型配置、API Key、UI 设置
│   ├── knowledgeStore.ts # 知识库
│   ├── promptStore.ts    # 提示词模板
│   ├── projectStore.ts   # 项目管理
│   └── checkerStore.ts   # 检测规则
│
├── types/            # TypeScript 类型定义
│   ├── api.ts        # LLM API 接口、模型、Provider 枚举
│   ├── chat.ts       # ChatMessage 类型（含 prefixText/suffixText）
│   └── ...
│
├── utils/
│   ├── template.ts   # {{input}} 模板填充
│   └── text.ts       # deepClone, prettyObject 等
│
capasitor.config.ts   # Capacitor 配置（键盘、splash 等）
index.html            # viewport + root mount
```

## 核心数据流

```
HomePage.handleSend()
  → capture prefixText/suffixText（局部重写）
  → useChat.sendMessage(input, prefix, suffix)
    → setIsLoading(true)
    → chatStore.onUserInput(input, {prefixText, suffixText})
      → fillTemplate("{{input}}", input)  // 模板填充
      → createMessage(user, bot)           // 构建消息
      → getClientApi().chat({prefixText, suffixText, ...})
        → prefixText → 加 assistant prefix 消息，切 Beta URL
        → suffixText → 用 FIM /completions 端点
        → streamFetch() → SSE 流式输出
        → onUpdate → 批处理（80ms）/ skipPersist
        → onFinish → 持久化 IndexedDB
      → setIsLoading(false)
```

## API 模式

| 模式 | base_url | 方法 |
|------|----------|------|
| 普通对话 | api.deepseek.com | Chat Completions |
| 前缀续写 | api.deepseek.com/beta | Chat Completions + assistant prefix |
| FIM 补全 | api.deepseek.com/beta | Completions（prompt + suffix） |
| SiliconFlow 普通对话 | api.siliconflow.cn/v1 | Chat Completions |
| SiliconFlow 前缀续写 | api.siliconflow.cn/v1 | Chat Completions + assistant prefix |
| SiliconFlow FIM 补全 | api.siliconflow.cn/v1 | FIM Completions（prompt + suffix） |

## 关键常量

| 项 | 值 |
|----|-----|
| 默认模型 | deepseek-v4-flash |
| 模板 | `"{{input}}"` |
| SSE 超时 | 60s |
| 流式批处理间隔 | 80ms |
| 消息历史条数 | 4 轮 |

## 待清理

- `components/` 下 13 个空文件
- `pages/` 下 4 个孤儿页面
- 8 个未使用的 npm 包
- `services/api/providers/google.ts` / `anthropic.ts`（stub）
- `utils/chinese.ts` / `utils/model.ts`（无人引用）
