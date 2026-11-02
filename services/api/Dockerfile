FROM node:26-alpine

RUN npm install -g pnpm@12.16.1
WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile --filter @loqua/api...

ENV NODE_ENV=production
EXPOSE 8787

CMD ["pnpm", "--filter", "@loqua/api", "start"]
