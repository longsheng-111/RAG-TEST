FROM node:20-alpine AS base

# ---- 依赖安装阶段 ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ---- 构建阶段 ----
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# rewrites 在 next build 期内联进 routes-manifest，运行期 env 不生效——必须用 build ARG 注入
ARG API_INTERNAL_URL=http://localhost:8000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build

# ---- 运行阶段 ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
