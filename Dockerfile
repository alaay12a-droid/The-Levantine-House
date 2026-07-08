FROM node:24-slim

WORKDIR /app

RUN npm install -g pnpm@10

COPY . .

RUN pnpm install --no-frozen-lockfile

RUN BASE_PATH=/dashboard/ pnpm --filter @workspace/dashboard run build

RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
