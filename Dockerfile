FROM node:24-bookworm-slim

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy source code
COPY src ./src

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "start"]
