FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY app ./app
COPY web ./web
COPY wiki ./wiki

RUN npm run game:build

FROM node:22-bookworm-slim AS app

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/app ./app
COPY --from=build /app/web ./web
COPY --from=build /app/wiki ./wiki

EXPOSE 3021

CMD ["node", "app/server/start.js"]
