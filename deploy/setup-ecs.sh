#!/usr/bin/env bash
# ==============================================================================
# 拓视未来教育「一校教培系统」阿里云 ECS 生产环境一键初始化与部署运维脚本
# 适用系统: Alibaba Cloud Linux 3 / CentOS 7+ / Ubuntu 20.04+ / Debian 11+
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================================================${NC}"
echo -e "${BLUE}🚀 拓视未来教育「一校教培系统」阿里云生产环境部署与初始化启动${NC}"
echo -e "${BLUE}================================================================================${NC}\n"

# 1. 检查 root 权限
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}提示: 当前非 root 用户，尝试使用 sudo 执行...${NC}"
  SUDO='sudo'
else
  SUDO=''
fi

# 2. 检查并安装 Docker 与 Docker Compose
echo -e "${GREEN}[Step 1/5] 检查 Docker 与 Compose 运行环境...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}未检测到 Docker，正在通过阿里云源自动安装 Docker CE...${NC}"
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      alinux|aliyun|centos|rhel)
        $SUDO yum install -y yum-utils
        $SUDO yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
        $SUDO yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        ;;
      ubuntu|debian)
        $SUDO apt-get update
        $SUDO apt-get install -y ca-certificates curl gnupg lsb-release
        curl -fsSL http://mirrors.aliyun.com/docker-ce/linux/$ID/gpg | $SUDO gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] http://mirrors.aliyun.com/docker-ce/linux/$ID $(lsb_release -cs) stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
        $SUDO apt-get update
        $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        ;;
      *)
        echo -e "${RED}未能自动识别的 Linux 发行版，请先手动安装 Docker!${NC}"
        exit 1
        ;;
    esac
  fi
  $SUDO systemctl enable docker
  $SUDO systemctl start docker
  echo -e "${GREEN}✓ Docker 安装并启动成功！${NC}"
else
  echo -e "${GREEN}✓ Docker 已存在: $(docker --version)${NC}"
fi

# 配置阿里云 Docker 镜像加速器（如果未配置）
if [ ! -f /etc/docker/daemon.json ]; then
  echo -e "${GREEN}正在配置阿里云镜像加速源...${NC}"
  $SUDO mkdir -p /etc/docker
  $SUDO tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.baidubce.com",
    "https://docker.m.daocloud.io"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl restart docker
fi

# 3. 检查生产环境配置文件
echo -e "\n${GREEN}[Step 2/5] 检查服务端生产环境变量...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$ROOT_DIR/server/.env.production" ]; then
  if [ -f "$ROOT_DIR/server/.env.production.example" ]; then
    echo -e "${YELLOW}未检测到 server/.env.production，正在从模板生成...${NC}"
    cp "$ROOT_DIR/server/.env.production.example" "$ROOT_DIR/server/.env.production"
    echo -e "${RED}⚠️  注意: 请编辑 $ROOT_DIR/server/.env.production 中的 DATABASE_URL 与 JWT_SECRET 为真实阿里云 RDS 凭据！${NC}"
  else
    echo -e "${RED}❌ 缺失 server/.env.production.example 模板文件！${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ 找到 server/.env.production 生产配置文件${NC}"
fi

# 4. 执行 Docker Compose 生产编排构建
echo -e "\n${GREEN}[Step 3/5] 构建并启动 Docker 生产容器组...${NC}"
cd "$ROOT_DIR"

if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo -e "${RED}❌ 未检测到 Docker Compose 命令，请检查安装！${NC}"
  exit 1
fi

$COMPOSE_CMD -f deploy/docker-compose.prod.yml down --remove-orphans || true
$COMPOSE_CMD -f deploy/docker-compose.prod.yml up -d --build

# 5. 健康检查
echo -e "\n${GREEN}[Step 4/5] 容器健康状态检查与等待就绪...${NC}"
sleep 5

for i in {1..12}; do
  if curl -sf http://127.0.0.1/api/stats/overview > /dev/null; then
    echo -e "${GREEN}✓ 后端与前端服务已成功通过健康检查！${NC}"
    break
  fi
  echo -e "${YELLOW}等待服务就绪 ($i/12)...${NC}"
  sleep 3
done

echo -e "\n${GREEN}[Step 5/5] 查看运行中的容器实例...${NC}"
$COMPOSE_CMD -f deploy/docker-compose.prod.yml ps

echo -e "\n${BLUE}================================================================================${NC}"
echo -e "${GREEN}🎉 拓视未来教育「一校教培系统」阿里云生产环境部署完成！${NC}"
echo -e "${BLUE}================================================================================${NC}"
echo -e "前端访问入口: http://<你的ECS公网IP>/"
echo -e "后端健康监控: http://<你的ECS公网IP>/api/stats/overview"
echo -e "运维日志查看: $COMPOSE_CMD -f deploy/docker-compose.prod.yml logs -f"
echo -e "${BLUE}================================================================================${NC}\n"
