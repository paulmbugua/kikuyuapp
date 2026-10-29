FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/web/package.json apps/web/package.json
RUN yarn install --immutable

COPY apps/backend apps/backend
RUN yarn workspace @kikuyu/backend build

ENV NODE_ENV=production
EXPOSE 5000
CMD ["yarn", "workspace", "@kikuyu/backend", "start"]

