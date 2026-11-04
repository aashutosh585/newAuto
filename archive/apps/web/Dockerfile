FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY niches/ ./niches/
COPY apps/web/ ./apps/web/

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @social-engine/db build
RUN pnpm --filter @social-engine/core build
RUN pnpm --filter @social-engine/web build

EXPOSE 3000

CMD ["node", "apps/web/dist/index.js"]

