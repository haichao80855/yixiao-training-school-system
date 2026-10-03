# ==============================================================================
# 拓视未来教育「一校教培系统」NestJS 后端微服务生产镜像构建 (Multi-Stage Dockerfile)
# ==============================================================================

# 阶段一：编译 TypeScript 与 Prisma 客户端
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com

# 拷贝后端工程源码
COPY . .

# 生成 Prisma 客户端并编译 NestJS
RUN npx prisma generate
RUN npm run build

# 阶段二：生产运行环境 (只保留生产依赖，极简镜像体积)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com

# 拷贝 Prisma Schema 与必要引擎
COPY prisma ./prisma
RUN npx prisma generate

# 拷贝编译产物与数据脚本
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts

EXPOSE 3001

CMD ["node", "dist/main.js"]
