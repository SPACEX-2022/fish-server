#!/bin/bash

# 停止旧的PM2进程
pm2 stop fish-game-server || true
pm2 delete fish-game-server || true

# 拉取最新代码
git pull

# 安装依赖
echo "正在安装依赖..."
pnpm install

# 构建项目
echo "正在构建项目..."
npm run build

# 加载环境变量
if [ -f ".env" ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# 设置默认证书路径
SSL_CERT_PATH=${SSL_CERT_PATH:-"./ssl/cert.pem"}
SSL_KEY_PATH=${SSL_KEY_PATH:-"./ssl/key.pem"}

# 如果没有SSL证书，提示生成测试证书
if [ "$HTTPS_ENABLED" = "true" ] && [[ ! -f "$SSL_CERT_PATH" || ! -f "$SSL_KEY_PATH" ]]; then
  echo "未找到SSL证书，证书路径:"
  echo "证书路径: $SSL_CERT_PATH"
  echo "密钥路径: $SSL_KEY_PATH"
  echo "您可以使用以下命令生成自签名证书用于测试:"
  echo "openssl req -x509 -newkey rsa:4096 -keyout $SSL_KEY_PATH -out $SSL_CERT_PATH -days 365 -nodes"
fi

# 启动PM2
echo "正在启动服务..."
pm2 start ecosystem.config.js

echo "部署完成! 服务已通过PM2启动"
echo "查看日志: pm2 logs fish-game-server"
echo "查看状态: pm2 status" 