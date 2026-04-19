FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
COPY scripts/start.sh ./start.sh
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh
EXPOSE 3020
CMD ["./start.sh"]
