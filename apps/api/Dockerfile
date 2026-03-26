FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci

COPY . .

RUN npm run build -w @outreach/contracts && npm run build -w @outreach/api

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci --omit=dev --workspace @outreach/api --workspace @outreach/contracts

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/contracts/dist packages/contracts/dist

ENV PORT=8787

EXPOSE 8787

CMD ["node", "apps/api/dist/apps/api/src/index.js"]
