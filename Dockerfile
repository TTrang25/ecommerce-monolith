FROM node:20-slim

# Prisma cần openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

# Tạo/cập nhật bảng rồi mới chạy server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]