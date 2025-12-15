FROM oven/bun:latest

WORKDIR /app

COPY samples/schemas ../samples/schemas

COPY typescript/package.json typescript/bun.lock ./
RUN bun install --frozen-lockfile

COPY typescript/. .

RUN bun run generate:messages

CMD ["bun", "run", "samples/FileConverter/main.ts"]

