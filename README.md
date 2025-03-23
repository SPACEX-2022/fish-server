<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# 捕鱼游戏服务器

基于NestJS开发的多人捕鱼游戏服务器，游戏主要玩法模仿游戏厅街机-捕鱼达人，服务端主要负责微信登录以及多人模式的功能。

## 技术栈

- **框架**: [NestJS](https://nestjs.com/)
- **数据库**: MongoDB (使用Mongoose ODM)
- **缓存**: Redis
- **认证**: JWT + Passport
- **实时通信**: 原生WebSocket
- **API文档**: Swagger

## 主要功能

- **用户授权**: 微信小游戏登录授权
- **多人游戏房间**: 创建/加入/退出游戏房间
- **实时通信**: 使用WebSocket进行游戏状态同步
- **排行榜系统**: 基于Redis实现的高效排行榜
- **心跳检测**: 基于WebSocket的用户在线状态追踪
- **数据持久化**: 用户数据、游戏记录保存至MongoDB

## 项目设置

```bash
$ pnpm install
```

## 编译和运行项目

```bash
# 开发模式
$ pnpm run start

# 监视模式
$ pnpm run start:dev

# 生产模式
$ pnpm run start:prod
```

## WebSocket连接说明

服务器使用原生WebSocket协议进行实时通信，主要端点：

### 心跳检测

- **URL**: `ws://服务器地址:端口/api/heartbeat`
- **认证**: 通过URL参数传递JWT令牌 `?token=your_jwt_token`
- **事件**:
  - `connection`: 连接建立时服务器发送的事件
  - `heartbeat`: 客户端定期发送以维持连接
  - `status`: 客户端请求获取状态信息

示例代码:
```javascript
// 连接WebSocket
const token = 'your_jwt_token';
const ws = new WebSocket(`ws://localhost:3000/api/heartbeat?token=${token}`);

// 连接建立
ws.onopen = () => {
  console.log('连接已建立');
  
  // 定时发送心跳
  setInterval(() => {
    ws.send(JSON.stringify({ event: 'heartbeat', data: {} }));
  }, 30000);
};

// 接收消息
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('收到消息:', message);
};
```

### 游戏房间

- **URL**: `ws://服务器地址:端口/api/game-room`
- **认证**: 同样通过JWT令牌进行认证
- **主要事件**: 请参考API文档

## 运行测试

```bash
# 单元测试
$ pnpm run test

# e2e测试
$ pnpm run test:e2e

# 测试覆盖率
$ pnpm run test:cov
```

## 配置说明

项目使用环境变量进行配置，主要配置项：

```dotenv
# 应用配置
PORT=3000
API_PREFIX=/api
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/fish-game

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# 微信配置
WX_APP_ID=your_wx_app_id
WX_APP_SECRET=your_wx_app_secret
```

## 使用PM2部署服务并配置SSL

### 准备工作

1. 确保安装了PM2：
```bash
npm install -g pm2
# 或
pnpm add -g pm2
```

2. 安装依赖：
```bash
pnpm install
```

### SSL证书配置

1. 创建存放SSL证书的目录：
```bash
mkdir -p ssl
```

2. 配置SSL证书：
   - 如果您有正式的SSL证书，请将证书文件和密钥文件分别命名为`cert.pem`和`key.pem`，并放置在`ssl`目录下
   - 如果仅用于测试，可以生成自签名证书：
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
   ```

3. 配置.env文件启用SSL：
```
HTTPS_ENABLED=true
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem
```

### 部署服务

#### Linux/macOS

使用提供的部署脚本：
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

#### Windows

使用提供的批处理脚本：
```
scripts\deploy.bat
```

### PM2常用命令

- 查看应用状态：
```bash
pm2 status
```

- 查看日志：
```bash
pm2 logs fish-game-server
```

- 重启应用：
```bash
pm2 restart fish-game-server
```

- 停止应用：
```bash
pm2 stop fish-game-server
```

- 设置开机自启：
```bash
pm2 startup
pm2 save
```

## 协议

本项目基于 [MIT 许可证](LICENSE)

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
