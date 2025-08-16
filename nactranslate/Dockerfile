# Use the Node.js image to build the app with strict version to avoid future conflicts

# FOR DEV amd64 SYSTEM
# FROM node:18.18.0 AS builder

# FOR RASPBERRY PI 3B
FROM node:18 AS builder

# Create non-root user for this Flask API endpoint image
# adduser is alpine base image tool, specific for docker as opposed to useradd -m which creates /home/ etc for normal debian distro users
# RUN useradd -m frontenduser

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Build the app
RUN npm run build

# Use the Nginx image to serve the app
# Nginx setup requires root user privileges so it defaults to root and the frontend user no longer exists under the new base image
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Install Node.js WebSocket server bits
RUN apk add --no-cache nodejs npm

# Make sure frontenduser has permissions, set up the websocket with that user instead of root
COPY ./src/wsserver.js /app/websocket/wsserver.mjs
COPY ./src/backend/websocket-package.json /app/websocket/package.json
WORKDIR /app/websocket
# Install WebSocket dependency for the server-side WebSocket as opposed to client which is installed in the app's package.json. This is being installed from a separate package.json stored in /src/backend
RUN npm install

# Create the non-root user
# RUN adduser -D frontenduser

# Switch to the non-root flaskuser
# RUN mkdir -p /var/cache/nginx/client_temp && chown -R frontenduser:frontenduser /usr/share/nginx /app
# RUN chown -R frontenduser:frontenduser /usr/share/nginx /app
# RUN chown -R frontenduser:frontenduser /
# USER frontenduser
WORKDIR /app

# Expose the port for the app (80) and the websocket server (8000)
EXPOSE 80 8000

# Start Nginx and the WebSocket Server when the container starts
# CMD ["sh", "-c", "nginx -g 'daemon off;' & node /app/websocket/wsserver.mjs"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "speech_to_text:app"]
# TEST WITH THESE COMMANDS
# docker exec -it <container_id> sh
# node /usr/share/nginx/html/wsserver.js