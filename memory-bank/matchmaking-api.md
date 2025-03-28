# 捕鱼游戏在线匹配功能接口文档

## 一、HTTP接口

### 1. 发起在线匹配

**请求方式**：POST

**接口地址**：`/rooms/match`

**请求头**：
```
Authorization: Bearer {token}
```

**请求参数**：无

**响应示例**：
```json
{
  "success": true,
  "message": "匹配请求已接收，等待匹配中...",
  "status": "matching"
}
```

**状态说明**：
- `matching`：匹配中
- `matched`：匹配成功
- `canceled`：已取消匹配

## 二、WebSocket事件

### 1. 连接建立

客户端需要在连接时提供JWT令牌：
```javascript
const socket = io('wss://api.example.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 2. 匹配相关事件

#### 监听匹配成功
```javascript
socket.on('match:success', (data) => {
  // data格式如下
  // {
  //   roomId: "房间ID",
  //   roomCode: "房间代码",
  //   readyTimeout: 10, // 10秒准备倒计时
  //   players: [
  //     {
  //       userId: "用户ID",
  //       nickname: "昵称",
  //       avatarUrl: "头像URL"
  //     }
  //   ]
  // }
});
```

#### 准备倒计时通知
```javascript
socket.on('ready:countdown', (data) => {
  // data格式如下
  // {
  //   countdown: 10 // 当前准备倒计时秒数
  // }
});
```

#### 发送玩家准备就绪
```javascript
socket.emit('player:ready', {}, (response) => {
  // response格式如下
  // {
  //   success: true
  // }
});
```

#### 匹配取消通知
```javascript
socket.on('match:canceled', (data) => {
  // data格式如下
  // {
  //   reason: "ready_timeout", // 取消原因
  //   message: "部分玩家未准备，匹配已取消",
  //   notReadyPlayers: ["用户ID1", "用户ID2"] // 未准备的玩家ID列表
  // }
});
```

#### 取消匹配
```javascript
socket.emit('match:cancel', {}, (response) => {
  // response格式如下
  // {
  //   success: true,
  //   message: "已取消匹配"
  // }
});
```

### 3. 房间相关事件

#### 加入房间
```javascript
socket.emit('room:join', { roomId: "房间ID" }, (response) => {
  // response包含房间完整信息
});
```

#### 监听房间更新
```javascript
socket.on('room:updated', (roomData) => {
  // roomData包含完整房间信息
});
```

### 4. 游戏相关事件

#### 倒计时
```javascript
socket.on('game:countdown', (data) => {
  // data格式如下
  // {
  //   countdown: 5 // 当前倒计时秒数
  // }
});
```

#### 游戏开始
```javascript
socket.on('game:start', () => {
  // 游戏开始
});
```

## 三、完整流程

1. **发起匹配**：
   - 客户端调用 `POST /rooms/match` 接口
   - 服务端返回匹配状态为 `matching`

2. **匹配等待**：
   - 客户端显示"匹配中"界面
   - 可以监听 `match:success` 事件等待匹配成功
   - 用户可以随时通过发送 `match:cancel` 事件取消匹配

3. **匹配成功**：
   - 服务端通过 WebSocket 发送 `match:success` 事件
   - 客户端收到事件后显示匹配成功界面，展示其他匹配到的玩家信息
   - 客户端在收到事件的同时自动发送 `room:join` 事件加入房间

4. **玩家准备确认**：
   - 客户端显示"准备确认"界面，提示用户点击"准备"按钮
   - 服务端发送 `ready:countdown` 事件，倒计时10秒
   - 用户需要在10秒内点击准备按钮，客户端发送 `player:ready` 事件
   - 如果10秒内未准备，服务端将发送 `match:canceled` 事件通知所有玩家

5. **游戏开始倒计时**：
   - 当所有玩家都准备好后，会收到 `game:countdown` 事件
   - 客户端显示游戏即将开始的倒计时界面

6. **游戏开始**：
   - 倒计时结束后，服务端发送 `game:start` 事件
   - 客户端收到事件后进入游戏界面并开始游戏

## 四、注意事项

1. 匹配成功后，玩家必须在10秒内手动点击"准备"按钮
2. 如果有玩家未准备，其他已准备的玩家会自动重新进入匹配队列
3. 未准备的玩家将被踢出匹配队列
4. 玩家在匹配中断开连接会自动从匹配队列中移除
5. 客户端应在收到 `match:success` 事件后立即调用 `room:join` 加入房间
6. 如果在匹配过程中用户取消匹配，客户端应发送 `match:cancel` 事件

## 五、错误处理

常见错误码和错误信息：

1. `用户已在其他房间中`：当用户尝试匹配时已在其他房间中
2. `用户不存在`：用户信息无法找到
3. `未授权`：未提供有效的JWT令牌

当收到错误时，客户端应向用户展示适当的错误提示，并提供重试选项。

## 六、改进说明

本次匹配系统改进重点：

1. **队列式匹配**：不再立即返回房间号，而是将玩家加入匹配队列
2. **自动匹配**：后台自动为达到人数要求的玩家创建房间
3. **实时通知**：使用WebSocket通知玩家匹配结果
4. **手动准备确认**：增加玩家准备确认环节，确保所有玩家都已就绪
5. **超时处理**：对未准备的玩家进行踢出处理，已准备的玩家自动重新匹配

这种实现相比之前的方案有以下优势：
- 提供更好的用户体验
- 流程更符合现代游戏的匹配系统设计
- 手动确认减少了"僵尸玩家"的情况
- 支持取消匹配功能