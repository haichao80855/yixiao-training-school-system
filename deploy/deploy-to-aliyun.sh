#!/usr/bin/env bash
# ==============================================================================
# 拓视未来教育「一校教培系统」阿里云服务器一键部署同步脚本
# 目标主机: aliyun (39.107.33.4) via SSH Config
# ==============================================================================

set -e

REMOTE_HOST="${1:-aliyun}"
REMOTE_DIR="/opt/yixiao"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================================================${NC}"
echo -e "${BLUE}🚀 拓视未来教育「一校教培系统」开始部署至远程主机 [${REMOTE_HOST}]${NC}"
echo -e "${BLUE}================================================================================${NC}\n"

# 1. 检查 SSH 连通性
echo -e "${GREEN}[Step 1/6] 检查 SSH 连通性...${NC}"
if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$REMOTE_HOST" "echo 'SSH_OK'" > /dev/null 2>&1; then
  echo -e "${RED}❌ 无法通过 SSH 连接到主机 ${REMOTE_HOST}，请确认 ~/.ssh/config 与密钥配置！${NC}"
  exit 1
fi
echo -e "${GREEN}✓ SSH 连通成功！${NC}"

# 2. 本地前端与后端构建产物检查
echo -e "\n${GREEN}[Step 2/6] 检查本地生产构建产物...${NC}"
if [ ! -f "dist/index.html" ]; then
  echo -e "${YELLOW}前端 dist 产物缺失，正在执行 npm run build...${NC}"
  npm run build
fi

if [ ! -f "server/dist/main.js" ]; then
  echo -e "${YELLOW}后端 server/dist 产物缺失，正在执行 server build...${NC}"
  npm --prefix server run build
fi
echo -e "${GREEN}✓ 本地构建产物已就绪！${NC}"

# 3. 远端全量自动备份
echo -e "\n${GREEN}[Step 3/6] 执行远端数据安全快照备份...${NC}"
ssh "$REMOTE_HOST" "bash -s" << 'EOF'
  BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_PATH="/opt/yixiao/backups/backup_${BACKUP_TIMESTAMP}"
  mkdir -p "$BACKUP_PATH"
  if [ -d "/opt/yixiao/frontend" ]; then
    cp -r /opt/yixiao/frontend "$BACKUP_PATH/frontend" 2>/dev/null || true
  fi
  if [ -f "/opt/yixiao/server/prisma/dev.db" ]; then
    mkdir -p "$BACKUP_PATH/prisma"
    cp /opt/yixiao/server/prisma/dev.db "$BACKUP_PATH/prisma/dev.db" 2>/dev/null || true
  fi
  if [ -d "/opt/yixiao/server/dist" ]; then
    cp -r /opt/yixiao/server/dist "$BACKUP_PATH/dist" 2>/dev/null || true
  fi
  echo "✓ 备份已保存至: $BACKUP_PATH"
EOF

# 4. 同步前端与后端生产产物
echo -e "\n${GREEN}[Step 4/6] 同步前端与后端产物至远端目录 ${REMOTE_DIR}...${NC}"

# 禁用 macOS AppleDouble (._*) 元数据生成
export COPYFILE_DISABLE=1

echo "-> 同步前端静态资源至 ${REMOTE_DIR}/frontend/ ..."
rsync -avz --delete \
  --exclude="._*" \
  --exclude=".DS_Store" \
  dist/ "${REMOTE_HOST}:${REMOTE_DIR}/frontend/"

echo "-> 同步后端编译代码至 ${REMOTE_DIR}/server/dist/ ..."
rsync -avz --delete \
  --exclude="._*" \
  --exclude=".DS_Store" \
  server/dist/ "${REMOTE_HOST}:${REMOTE_DIR}/server/dist/"

echo "-> 同步 Prisma Schema 与数据字典/组织架构数据库 ..."
rsync -avz \
  --exclude="._*" \
  --exclude=".DS_Store" \
  server/prisma/schema.prisma "${REMOTE_HOST}:${REMOTE_DIR}/server/prisma/schema.prisma"

rsync -avz \
  --exclude="._*" \
  --exclude=".DS_Store" \
  server/prisma/dev.db "${REMOTE_HOST}:${REMOTE_DIR}/server/prisma/dev.db"

rsync -avz \
  --exclude="._*" \
  --exclude=".DS_Store" \
  server/package.json "${REMOTE_HOST}:${REMOTE_DIR}/server/package.json"

rsync -avz \
  --exclude="._*" \
  --exclude=".DS_Store" \
  server/package-lock.json "${REMOTE_HOST}:${REMOTE_DIR}/server/package-lock.json"

echo -e "${GREEN}✓ 资源文件同步完成！${NC}"

# 5. 远端服务配置与平滑重启
echo -e "\n${GREEN}[Step 5/6] 远端 Prisma 引擎构建、清理元数据并重启服务...${NC}"
ssh "$REMOTE_HOST" "bash -s" << 'EOF'
  set -e
  # 1. 清理 Mac 元数据文件
  find /opt/yixiao -name "._*" -delete 2>/dev/null || true

  # 2. 生成 Prisma Client
  cd /opt/yixiao/server
  npx prisma generate

  # 3. 兼容双启动路径 (dist/main.js & dist/src/main.js)
  mkdir -p /opt/yixiao/server/dist/src
  cp /opt/yixiao/server/dist/main.js /opt/yixiao/server/dist/src/main.js

  # 4. 更新 systemd 服务配置指向规范入口
  if grep -q "dist/src/main.js" /etc/systemd/system/yixiao-server.service; then
    sed -i 's|/opt/yixiao/server/dist/src/main.js|/opt/yixiao/server/dist/main.js|g' /etc/systemd/system/yixiao-server.service
    systemctl daemon-reload
  fi

  # 5. 重启后端服务
  systemctl restart yixiao-server
  sleep 3

  # 6. 重载 Nginx
  nginx -t
  systemctl reload nginx

  echo "✓ 远端服务重启完成！"
EOF

# 6. 生产健康巡检与冒烟校验
echo -e "\n${GREEN}[Step 6/6] 生产服务存活与冒烟校验...${NC}"
ssh "$REMOTE_HOST" "bash -s" << 'EOF'
  echo -n "后端服务状态: "
  systemctl is-active yixiao-server
  echo -n "Nginx 状态: "
  systemctl is-active nginx

  echo -n "API 监控健康状态: "
  curl -s -f http://127.0.0.1:3001/api/stats/overview || echo "FAILED"
  echo ""
EOF

echo -e "\n${BLUE}================================================================================${NC}"
echo -e "${GREEN}🎉 拓视未来教育「一校教培系统」已成功部署至阿里云生产环境！${NC}"
echo -e "${BLUE}================================================================================${NC}"
echo -e "前端公网访问入口: http://39.107.33.4/"
echo -e "后端监控接口:     http://39.107.33.4/api/stats/overview"
echo -e "${BLUE}================================================================================${NC}\n"
