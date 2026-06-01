FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

USER appuser

CMD ["node", "src/index.js"]
