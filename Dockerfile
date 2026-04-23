FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npm run db:generate

EXPOSE 3000
CMD ["npm", "start"]
