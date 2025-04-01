# # Use the official Node.js image as the base image
# FROM node:18-alpine

# # Set the working directory in the container
# WORKDIR /app

# # Copy package.json and package-lock.json (if exists) to install dependencies
# COPY package*.json ./

# # Install project dependencies
# RUN npm install

# # Copy the rest of the application code
# COPY . .

# # Build the React app
# RUN npm run build
# RUN npm install -g serve

# # Expose the port the app will run on
# EXPOSE 3000

# # Start the server using 'serve' to serve the production build
# CMD ["serve", "-s", "build", "-l", "3000"]
# Build the React app using the Node.js image
FROM node:18-alpine AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if exists) to install dependencies
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the React app
RUN npm run build

# Use Nginx image to serve the app
FROM nginx:alpine

# Copy the build folder from the previous image into the Nginx container
COPY --from=build /app/build /usr/share/nginx/html

# Expose the port Nginx will listen on
EXPOSE 80

# Start Nginx to serve the app
CMD ["nginx", "-g", "daemon off;"]
