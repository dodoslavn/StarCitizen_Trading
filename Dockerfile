FROM node:20-alpine
ARG FOLDER="/app"
WORKDIR ${FOLDER}

# Copy package files first for better Docker layer caching
COPY StarCitizen_Trading/package*.json ${FOLDER}/

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY StarCitizen_Trading/ ${FOLDER}/

# Expose port (optional, for documentation)
EXPOSE 3000

ENTRYPOINT ["node", "server.js"]
