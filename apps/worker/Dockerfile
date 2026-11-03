FROM node:22-bookworm-slim

# Install system dependencies required for Playwright Chromium headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libasound2 \
    fonts-liberation \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY niches/ ./niches/
COPY apps/worker/ ./apps/worker/

# Install dependencies and build
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @social-engine/db build
RUN pnpm --filter @social-engine/core build
RUN pnpm --filter @social-engine/niche-jobs build
RUN pnpm --filter @social-engine/niche-scholarships build
RUN pnpm --filter @social-engine/worker build

# Install Playwright Chromium browser
RUN npx playwright install chromium

CMD ["node", "apps/worker/dist/index.js"]
