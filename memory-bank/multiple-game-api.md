# 捕鱼游戏多人模式接口对接文档

## 一、概述

本文档描述捕鱼游戏多人模式服务端接口，包括HTTP接口和WebSocket通信协议。服务端支持最多4名玩家同时游戏，处理玩家位置分配、鱼群生成与行为、子弹碰撞等核心逻辑。

## 二、基础信息

### 接口基础地址
- REST API: `https://api.example.com`
- WebSocket: `wss://api.example.com`

### 通用请求头
REST API请求需要包含以下请求头：
```
Authorization: Bearer {token}
Content-Type: application/json
```

### 通用返回格式
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

## 三、房间管理 REST API

### 1. 获取玩家位置布局

**请求方式**：GET

**接口地址**：`/rooms/player-positions`

**返回示例**：
```json
{
  "positions": [
    {
      "id": 1,
      "orientation": "bottom",
      "side": "left",
      "defaultX": 0.25,
      "defaultY": 0.95
    },
    {
      "id": 2,
      "orientation": "bottom",
      "side": "right",
      "defaultX": 0.75,
      "defaultY": 0.95
    },
    {
      "id": 3,
      "orientation": "top",
      "side": "left",
      "defaultX": 0.25,
      "defaultY": 0.05
    },
    {
      "id": 4,
      "orientation": "top",
      "side": "right",
      "defaultX": 0.75,
      "defaultY": 0.05
    }
  ]
}
```

### 2. 创建房间

**请求方式**：POST

**接口地址**：`/rooms`

**请求参数**：
```json
{
  "type": "private" // 房间类型: "public"或"private"
}
```

**返回示例**：
```json
{
  "id": "60a5e8a9c5dc207c4c7b9f1e",
  "roomCode": "123456",
  "type": "private",
  "status": "waiting",
  "players": [
    {
      "userId": "60a5e8a9c5dc207c4c7b9f1d",
      "nickname": "玩家1",
      "avatarUrl": "https://example.com/avatar.png",
      "score": 0,
      "isReady": false,
      "isHost": true
    }
  ],
  "hostId": "60a5e8a9c5dc207c4c7b9f1d",
  "startTime": null,
  "endTime": null,
  "currentRound": 0,
  "createdAt": "2023-05-17T08:30:00.000Z"
}
```

### 3. 加入房间

**请求方式**：POST

**接口地址**：`/rooms/join`

**请求参数**：
```json
{
  "roomCode": "123456"
}
```

**返回示例**：
与创建房间返回格式相同

### 4. 获取公共房间列表

**请求方式**：GET

**接口地址**：`/rooms/public`

**返回示例**：
```json
[
  {
    "id": "60a5e8a9c5dc207c4c7b9f1e",
    "roomCode": "123456",
    "type": "public",
    "status": "waiting",
    "playerCount": 2,
    "hostName": "玩家1",
    "createdAt": "2023-05-17T08:30:00.000Z"
  }
]
```

### 5. 根据ID获取房间详情

**请求方式**：GET

**接口地址**：`/rooms/{id}`

**返回示例**：
与创建房间返回格式相同

### 6. 在线匹配

**请求方式**：POST

**接口地址**：`/rooms/match`

**返回示例**：
```json
{
  "id": "60a5e8a9c5dc207c4c7b9f1e",
  "roomCode": "123456",
  "playerCount": 2,
  "maxPlayerCount": 4
}
```

## 四、WebSocket通信协议

### 连接建立

客户端需要在连接时提供JWT令牌：
```javascript
const socket = io('wss://api.example.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 事件类型

#### 1. 房间事件

##### 加入房间
**客户端发送**:
```json
{
  "event": "room:join",
  "data": {
    "roomId": "60a5e8a9c5dc207c4c7b9f1e"
  }
}
```

**服务端响应**:
```json
{
  "success": true,
  "room": {
    // 房间详情（与REST API返回相同）
  }
}
```

##### 离开房间
**客户端发送**:
```json
{
  "event": "room:leave"
}
```

##### 准备状态
**客户端发送**:
```json
{
  "event": "room:ready",
  "data": {
    "isReady": true
  }
}
```

#### 2. 游戏事件

##### 游戏开始
**客户端发送**:
```json
{
  "event": "game:start"
}
```

**服务端广播**:
```json
{
  "event": "game:start"
}
```

##### 玩家初始化
**客户端发送**:
```json
{
  "event": "game:player_init",
  "data": {
    "position": {
      "x": 100,
      "y": 50
    },
    "weaponType": 1
  }
}
```

**服务端广播**:
```json
{
  "type": "player",
  "roomId": "60a5e8a9c5dc207c4c7b9f1e",
  "playerId": "60a5e8a9c5dc207c4c7b9f1d",
  "data": {
    "action": "init",
    "position": {
      "x": 100,
      "y": 50
    },
    "orientation": "bottom",
    "side": "left",
    "positionId": 1,
    "nickname": "玩家1",
    "avatarUrl": "https://example.com/avatar.png",
    "weaponType": 1,
    "score": 0
  }
}
```

##### 射击
**客户端发送**:
```json
{
  "event": "game:shoot",
  "data": {
    "action": "shoot",
    "bulletId": "bullet123",
    "angle": 45,
    "power": 1,
    "weaponType": 1,
    "position": {
      "x": 100,
      "y": 50
    },
    "clientTime": 1623123456789
  }
}
```

**服务端广播**:
```json
{
  "type": "action",
  "roomId": "60a5e8a9c5dc207c4c7b9f1e",
  "playerId": "60a5e8a9c5dc207c4c7b9f1d",
  "data": {
    "action": "shoot",
    "bulletId": "bullet123",
    "angle": 45,
    "power": 1,
    "weaponType": 1,
    "position": {
      "x": 100,
      "y": 50
    },
    "clientTime": 1623123456789
  },
  "timestamp": 1623123456790
}
```

##### 鱼群生成
**房主客户端发送**:
```json
{
  "event": "game:fish_spawn",
  "data": {
    "action": "spawn",
    "fishes": [
      {
        "id": "fish1",
        "type": 1,
        "path": [
          {"x": 0, "y": 100, "time": 0},
          {"x": 100, "y": 150, "time": 1000},
          {"x": 200, "y": 100, "time": 2000}
        ],
        "hp": 10,
        "speed": 1,
        "behavior": {
          "type": "normal",
          "params": {
            "speedMultiplier": 1.0
          }
        }
      }
    ]
  }
}
```

**服务端广播**:
```json
{
  "type": "fish",
  "roomId": "60a5e8a9c5dc207c4c7b9f1e",
  "data": {
    "action": "spawn",
    "fishes": [
      {
        "id": "fish1",
        "type": 1,
        "path": [
          {"x": 0, "y": 100, "time": 0},
          {"x": 100, "y": 150, "time": 1000},
          {"x": 200, "y": 100, "time": 2000}
        ],
        "hp": 10,
        "speed": 1,
        "behavior": {
          "type": "normal",
          "params": {
            "speedMultiplier": 1.0
          }
        }
      }
    ]
  },
  "timestamp": 1623123456790
}
```

##### 鱼群行为更新
**房主客户端发送**:
```json
{
  "event": "game:fish_behavior",
  "data": {
    "action": "updateBehavior",
    "fishes": [
      {
        "id": "fish1",
        "behavior": {
          "type": "escape",
          "params": {
            "direction": 45,
            "speedMultiplier": 1.5,
            "duration": 2000
          }
        },
        "newPath": [
          {"x": 100, "y": 150, "time": 0},
          {"x": 150, "y": 200, "time": 1000},
          {"x": 200, "y": 250, "time": 2000}
        ]
      }
    ]
  }
}
```

**服务端广播**:
```json
{
  "type": "fish",
  "roomId": "60a5e8a9c5dc207c4c7b9f1e",
  "data": {
    "action": "updateBehavior",
    "fishes": [
      {
        "id": "fish1",
        "behavior": {
          "type": "escape",
          "params": {
            "direction": 45,
            "speedMultiplier": 1.5,
            "duration": 2000
          }
        },
        "newPath": [
          {"x": 100, "y": 150, "time": 0},
          {"x": 150, "y": 200, "time": 1000},
          {"x": 200, "y": 250, "time": 2000}
        ]
      }
    ]
  },
  "timestamp": 1623123456790
}
```

##### 子弹碰撞
**房主客户端发送**:
```json
{
  "event": "game:bullet_collision",
  "data": {
    "event": "bulletCollision",
    "bullets": [
      {
        "bulletId1": "bullet1",
        "bulletId2": "bullet2",
        "playerId1": "player1",
        "playerId2": "player2",
        "position": {"x": 150, "y": 150},
        "effect": "cancel"
      }
    ]
  }
}
```

**服务端广播**:
```json
{
  "type": "game",
  "roomId": "60a5e8a9c5dc207c4c7b9f1e",
  "data": {
    "event": "bulletCollision",
    "bullets": [
      {
        "bulletId1": "bullet1",
        "bulletId2": "bullet2",
        "playerId1": "player1",
        "playerId2": "player2",
        "position": {"x": 150, "y": 150},
        "effect": "cancel"
      }
    ]
  },
  "timestamp": 1623123456790
}
```

##### 子弹击中鱼
**房主客户端发送**:
```json
{
  "event": "game:fish_collision",
  "data": {
    "event": "collision",
    "collisions": [
      {
        "bulletId": "bullet1",
        "playerId": "player1",
        "fishId": "fish1",
        "position": {"x": 120, "y": 160},
        "damage": 10,
        "killed": true,
        "score": 100
      }
    ]
  }
}
```

**服务端广播**:
```json
{
  "type": "game",
  "roomId": "60a5e8a9c5dc207c4c7b9f1e",
  "data": {
    "event": "collision",
    "collisions": [
      {
        "bulletId": "bullet1",
        "playerId": "player1",
        "fishId": "fish1",
        "position": {"x": 120, "y": 160},
        "damage": 10,
        "killed": true,
        "score": 100
      }
    ]
  },
  "timestamp": 1623123456790
}
```

##### 游戏倒计时
**服务端广播**:
```json
{
  "event": "game:countdown",
  "data": {
    "countdown": 3
  }
}
```

##### 游戏时间更新
**服务端广播**:
```json
{
  "event": "game:time",
  "data": {
    "timeLeft": 180
  }
}
```

##### 得分更新
**服务端广播**:
```json
{
  "event": "game:score_update",
  "data": {
    "userId": "player1",
    "score": 100,
    "players": [
      {
        "userId": "player1",
        "nickname": "玩家1",
        "score": 1500,
        "isReady": true,
        "isHost": true,
        "positionId": 1,
        "orientation": "bottom",
        "side": "left",
        "weaponType": 1,
        "combo": 3
      }
    ]
  }
}
```

##### 游戏结束
**服务端广播**:
```json
{
  "event": "game:end",
  "data": {
    "gameId": "game123",
    "duration": 180,
    "playerResults": [
      {
        "userId": "player1",
        "nickname": "玩家1",
        "score": 1500,
        "rank": 1,
        "events": []
      },
      {
        "userId": "player2",
        "nickname": "玩家2",
        "score": 1200,
        "rank": 2,
        "events": []
      }
    ],
    "winnerId": "player1"
  }
}
```

## 五、数据结构说明

### 1. 鱼群行为类型

```typescript
enum FishBehaviorType {
  NORMAL = 'normal',     // 正常移动
  SCHOOLING = 'schooling', // 群体行为
  ESCAPE = 'escape',     // 逃跑行为
  AGGRESSIVE = 'aggressive', // 攻击性行为
  ZIGZAG = 'zigzag',     // 曲线移动
}
```

### 2. 子弹碰撞行为

```typescript
enum BulletCollisionBehavior {
  CANCEL = 'cancel',     // 相互抵消
  CONTINUE = 'continue', // 继续前进
  REFLECT = 'reflect',   // 反弹
  EXPLODE = 'explode',   // 爆炸
}
```

### 3. 房间状态

```typescript
enum RoomStatus {
  WAITING = 'waiting',   // 等待中
  COUNTDOWN = 'countdown', // 倒计时
  PLAYING = 'playing',   // 游戏中
  FINISHED = 'finished', // 已结束
}
```

### 4. 玩家位置

```typescript
interface PlayerPosition {
  id: number;                // 位置ID(1-4)
  orientation: 'top' | 'bottom'; // 方向
  side: 'left' | 'right';    // 侧边
  defaultX: number;          // X坐标比例
  defaultY: number;          // Y坐标比例
}
```

## 六、错误处理

所有接口在发生错误时会返回以下格式：

```json
{
  "success": false,
  "message": "错误信息",
  "code": 10001
}
```

常见错误码：
- 10001: 通用错误
- 10002: 未授权
- 10003: 房间不存在
- 10004: 房间已满
- 10005: 用户已在其他房间
- 10006: 无效操作
