FROM node:20-alpine
WORKDIR /srv

# Install production deps
COPY server/package.json ./
RUN npm install --omit=dev

# Copy server source + migrations
COPY server/src        ./src
COPY server/migrations ./migrations

# Copy game frontend (served as static)
COPY index.html ./public/index.html

CMD ["node", "src/app.js"]
