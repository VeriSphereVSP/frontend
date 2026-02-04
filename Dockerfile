# Use Debian-based Node (avoids musl/Rollup install bugs)
FROM node:20-slim

WORKDIR /frontend

# Install deps first (leverages Docker cache)
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY frontend/ .

EXPOSE 5173

# Run Vite in dev mode, bind to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
