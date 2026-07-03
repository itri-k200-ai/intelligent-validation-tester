FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . ./
# 預設接真後端;傳 --build-arg NEXT_PUBLIC_USE_MOCK=true 可 build 成
# mock/免登入的獨立 demo image。process.env 在 Next 的優先序最高,
# 會蓋過 .env.local 的值。
ARG NEXT_PUBLIC_USE_MOCK=false
ENV NEXT_PUBLIC_USE_MOCK=${NEXT_PUBLIC_USE_MOCK}
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
