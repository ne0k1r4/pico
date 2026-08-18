FROM oven/bun:1.1.17-alpine AS deps
WORKDIR /app
COPY package.json tsconfig.json ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1.17-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY db ./db
USER bun
EXPOSE 8080
CMD ["bun", "src/server.ts"]
