FROM node:26-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY samples/schemas ../samples/schemas

COPY typescript/package.json typescript/package-lock.json ./
RUN npm ci

COPY typescript/. .

RUN npm run generate:messages

CMD ["node", "samples/FileVerifier/main.ts"]
