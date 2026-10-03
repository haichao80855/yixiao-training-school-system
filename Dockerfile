# ==============================================================================
# 拓视未来教育「一校教培系统」前端生产镜像构建 (Multi-Stage Dockerfile)
# ==============================================================================

# 阶段一：构建前端静态产物
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com

# 拷贝源代码并构建生产资产
COPY . .
RUN npm run build

# 阶段二：使用轻量 Nginx Alpine 进行生产静态资源托管与反向代理
FROM nginx:1.25-alpine

# 清理默认配置
RUN rm -rf /etc/nginx/conf.d/default.conf

# 拷贝前端构建产物至 Web 根目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 拷贝生产 Nginx 配置文件
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
