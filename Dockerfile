FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p data

EXPOSE 3001

CMD ["npm", "start"]
