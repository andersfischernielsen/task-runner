FROM node:26-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY samples/schemas ../samples/schemas

COPY typescript/package.json typescript/package-lock.json ./
RUN npm ci --ignore-scripts

COPY typescript/. .

RUN npm run generate:messages

CMD ["node", "samples/FileConverter/main.ts"]
