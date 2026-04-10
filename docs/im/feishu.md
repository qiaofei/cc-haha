# 飞书接入

> 飞书 Adapter 的实际接入说明，基于当前仓库代码。

## 适用场景

飞书方案适合在中国区环境下通过企业自建应用私聊 Claude Code。当前实现只处理 `p2p` 私聊，不处理群聊。

实现入口：`adapters/feishu/index.ts`

## 启动前准备

### 1. 创建飞书应用

在飞书开放平台创建企业自建应用，拿到：

- `App ID`
- `App Secret`

### 2. 配权限

至少确认这些能力可用：

- `im:message`
- `im:message:send_as_bot`
- `im:resource`

### 3. 配事件订阅

当前实现使用飞书 WebSocket 长连接接事件，不需要公网回调地址。

需要注册的事件：

- `im.message.receive_v1`
- `card.action.trigger`

### 4. 发布应用

应用至少需要处于可用发布状态，否则 bot 无法正常收发消息。

## 在 Desktop Webapp 里配置

打开 `Settings -> IM 接入 -> 飞书`，填写：

- `App ID`
- `App Secret`
- `Encrypt Key`，按你的事件配置填写
- `Verification Token`，按你的事件配置填写
- `Allowed Users`，可选
- `Streaming Card`

配置结构示例：

```json
{
  "serverUrl": "ws://127.0.0.1:3456",
  "defaultProjectDir": "/Users/me/workspace/my-project",
  "feishu": {
    "appId": "cli_xxx",
    "appSecret": "xxx",
    "encryptKey": "",
    "verificationToken": "",
    "allowedUsers": ["ou_xxx"],
    "streamingCard": false
  }
}
```

环境变量也可覆盖配置文件：

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
export FEISHU_ENCRYPT_KEY=""
export FEISHU_VERIFICATION_TOKEN=""
export ADAPTER_SERVER_URL="ws://127.0.0.1:3456"
```

## 启动

```bash
cd adapters
bun install
bun run feishu
```

## 首次配对

飞书侧的配对和 Telegram 一样，都是走 Webapp 生成的全局配对码。

流程：

1. 在 Desktop Webapp 里生成 6 位配对码
2. 飞书私聊 bot
3. 直接发送配对码
4. `adapters/common/pairing.ts` 验证成功后，把当前 `open_id` 写进 `feishu.pairedUsers`

注意：

- 当前实现把飞书用户标识存成 `open_id`
- `allowedUsers` 也是按 `open_id` 比较
- 码一次性使用，60 分钟过期

## 日常使用流程

### 首次消息

`adapters/feishu/index.ts` 处理逻辑：

1. 通过长连接收到 `im.message.receive_v1`
2. 提取文本内容
3. 只接受 `p2p`
4. 校验授权
5. 没有 session 时：
   - 先尝试恢复 `adapter-sessions.json`
   - 否则按 `defaultProjectDir` 建 session
   - 如果没默认项目，则列最近项目让用户回复编号

### 项目选择

没有默认项目时，adapter 会调用 `GET /api/sessions/recent-projects`，然后在飞书里发编号列表。

用户回复编号后：

- adapter 调 `POST /api/sessions`
- 建立 `/ws/:sessionId` 连接
- 把映射写入 `~/.claude/adapter-sessions.json`

## 支持的命令

飞书当前支持文本命令和中文别名：

- `/help` 或 `帮助`
- `/status` 或 `状态`
- `/clear` 或 `清空`
- `/projects` 或 `项目列表`
- `/new` 或 `新会话`
- `/stop` 或 `停止`

## 权限审批

飞书使用交互卡片，而不是 Telegram 的 inline button。

当 Claude 请求权限时：

1. adapter 构造 interactive card
2. 用户点击允许/拒绝
3. 飞书回调 `card.action.trigger`
4. adapter 调用 `bridge.sendPermissionResponse(...)`

## 返回消息的表现

飞书侧也支持流式更新，但渲染方式和 Telegram 不同：

- 普通文本通过 `post` 消息发送
- 权限审批通过卡片发送
- 流式内容优先 patch 同一条消息
- 完成后按 30000 字左右分片

`streamingCard` 字段当前已经进入配置模型，但 `adapters/feishu/index.ts` 里实际消息渲染仍以文本 patch / card 为主，文档里不应把它写成一个已经成型的独立体验开关。

## 常见问题

### 收不到消息

优先检查：

- App ID / App Secret 是否正确
- 应用是否已发布
- 是否启用了 `im.message.receive_v1`
- 是否启用了 `card.action.trigger`
- 是否真的是和 bot 的私聊，而不是群聊

### 权限按钮点了没反应

通常是 `card.action.trigger` 没配置好，或者事件订阅鉴权配置和本地 `encryptKey` / `verificationToken` 不匹配。

### 一直提示未授权

优先检查：

- 配对码是否还在有效期
- 发送的是不是当前有效码
- `allowedUsers` 填的是不是 `open_id`
- `feishu.pairedUsers` 里是否已写入当前用户

### 会话没恢复

检查：

- `~/.claude/adapter-sessions.json` 是否成功写入
- Desktop server 里的 session 是否仍存在

## 源码入口

- `adapters/feishu/index.ts`
- `adapters/common/pairing.ts`
- `adapters/common/session-store.ts`
- `adapters/common/ws-bridge.ts`
- `adapters/common/http-client.ts`
