FROM node:20-alpine

WORKDIR /workspace

COPY package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install

COPY . .

WORKDIR /workspace/apps/backend
EXPOSE 3000

# The Compose node_modules volume can outlive a schema change. Regenerate the
# client at container start so its runtime types always match prisma/schema.prisma.
CMD ["sh", "-c", "npx prisma generate && npm run start:dev"]
