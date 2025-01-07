# Use the Node.js image to build the app with strict version to avoid future conflicts
FROM node:18.18.0 AS builder

# Create non-root user for this Flask API endpoint image
# adduser is alpine base image tool, specific for docker as opposed to useradd -m which creates /home/ etc for normal debian distro users
RUN useradd -m frontenduser

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
COPY ./src/wsserver.js /app/websocket/wsserver.js
RUN npm init -y && npm install ws

# Switch to the non-root flaskuser
RUN chown -R frontenduser:frontenduser /usr/share/nginx /app
USER frontenduser

# Expose the port for the app (80) and the websocket server (8000)
EXPOSE 80 8000

# Start Nginx and the WebSocket Server when the container starts
CMD ["sh", "-c", "nginx -g 'daemon off;' & node /app/websocket/wsserver.js"]

# TEST WITH THESE COMMANDS
# docker exec -it <container_id> sh
# node /usr/share/nginx/html/wsserver.js



# Set the working directory in the container
WORKDIR /usr/share/nginx/html