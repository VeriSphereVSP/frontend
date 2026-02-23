# ── Stage 1: Build protocol ──────────────────────────────────────────────────
FROM node:20-slim AS protocol-builder

WORKDIR /protocol

# Copy core artifacts (ABI source of truth)
COPY core/out ../core/out

# Copy protocol
COPY protocol/package*.json ./
RUN npm install

COPY protocol/src ./src
COPY protocol/script ./script
COPY protocol/tsconfig.json ./

RUN npm run build

# ── Stage 2: Frontend dev server ─────────────────────────────────────────────
FROM node:20-slim

WORKDIR /frontend

# Copy built protocol dist (no symlinks, no workspace root needed)
COPY --from=protocol-builder /protocol /protocol

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
