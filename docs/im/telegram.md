# Telegram 接入

> Telegram Adapter 的实际接入说明，基于当前仓库代码，而不是旧 README。

## 适用场景

Telegram 方案适合个人私聊远程使用。当前实现只处理 `private chat`，不处理群聊。

实现入口：`adapters/telegram/index.ts`

## 启动前准备

### 1. 创建 Bot

在 Telegram 里找 `@BotFather`：

1. 发送 `/newbot`
2. 按提示创建 bot
3. 拿到 `Bot Token`

### 2. 在 Desktop Webapp 里填写配置

打开 `Settings -> IM 接入 -> Telegram`，填写：

- `Bot Token`
- `Allowed Users`，可选
- 全局 `Default Project`

也可以直接写 `~/.claude/adapters.json`，但当前推荐从 Webapp 配。

配置结构示例：

```json
{
  "serverUrl": "ws://127.0.0.1:3456",
  "defaultProjectDir": "/Users/me/workspace/my-project",
  "telegram": {
    "botToken": "123456:ABC-DEF...",
    "allowedUsers": [123456789]
  }
}
```

环境变量优先级更高：

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
export ADAPTER_SERVER_URL="ws://127.0.0.1:3456"
```

## 启动

```bash
cd adapters
bun install
bun run telegram
```

## 首次配对

Telegram 侧的授权入口不再只依赖 `allowedUsers`。

当前真实逻辑：

1. 在 Desktop Webapp 里生成配对码
2. 去 Telegram 私聊 bot
3. 把那 6 位码直接发给 bot
4. adapter 调用 `tryPair(...)`
5. 配对成功后，把当前 Telegram user 写进 `telegram.pairedUsers`

特点：

- 配对码 60 分钟过期
- 配对成功后立即失效
- 和飞书共用同一枚全局配对码
- 连续输错有速率限制

## 日常使用流程

### 首次消息

`adapters/telegram/index.ts` 的流程是：

1. 校验是否私聊
2. 去重
3. 校验是否已授权
4. 没有 session 时：
   - 优先恢复 `adapter-sessions.json` 里的旧 session
   - 否则用 `defaultProjectDir` 创建新 session
   - 如果没配默认项目，则拉最近项目列表让你选

### 项目选择

当没有默认项目时，bot 会调用 `GET /api/sessions/recent-projects`，返回最近项目列表，并要求你回复编号。

选中后：

- adapter 用 `POST /api/sessions` 创建 session
- 把 `chatId -> sessionId -> workDir` 写进 `~/.claude/adapter-sessions.json`
- 后续消息继续复用

## 支持的命令

### `/start`

显示帮助和可用命令。

### `/projects`

切换项目，重新显示最近项目列表。

### `/status`

查看当前会话的项目、模型、运行状态和任务摘要。

### `/clear`

清空当前会话上下文，保留当前项目绑定。

### `/new`

清空当前 chat 绑定的 session，并重新选择项目。

### `/help`

显示当前可用命令。

### `/stop`

向当前 session 发送 `stop_generation`。

## 权限审批

当 Claude 需要敏感权限时，Telegram adapter 会发带按钮的消息：

- `✅ 允许`
- `❌ 拒绝`

点击后，adapter 会把结果通过 `permission_response` 发回 Desktop server。

## 返回消息的表现

Telegram 侧有一层流式缓冲：

- thinking 时先发占位消息
- text delta 逐步累积
- 完成时按 4000 字分片发送

对应公共模块：

- `adapters/common/message-buffer.ts`
- `adapters/common/format.ts`
- `adapters/common/ws-bridge.ts`

## 常见问题

### bot 启动时报缺少 token

说明 `TELEGRAM_BOT_TOKEN` 和 `~/.claude/adapters.json` 里的 `telegram.botToken` 都没有生效。

### 能打开设置页但 bot 不工作

Webapp 只负责配置，不会自动拉起 `bun run telegram`。

### 发消息提示未授权

优先检查：

- 是否已经在 Webapp 里生成配对码
- 配对码是否过期
- 是否把码发到了正确的 bot 私聊
- `allowedUsers` / `pairedUsers` 是否真的包含当前账号

### 每次重启后会话丢失

检查 `~/.claude/adapter-sessions.json` 是否能正常写入，以及 Desktop server 的 session 是否仍存在。

## 源码入口

- `adapters/telegram/index.ts`
- `adapters/common/pairing.ts`
- `adapters/common/session-store.ts`
- `adapters/common/ws-bridge.ts`
- `adapters/common/http-client.ts`
