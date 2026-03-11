# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# Install dependencies
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
# Build the Vite React app
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend and serve
FROM node:20-alpine
WORKDIR /app/backend
# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci
# Copy backend source
COPY backend/ ./
# Copy built frontend from Stage 1 into the location expected by server.js
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the Node.js server
CMD ["node", "server.js"]
