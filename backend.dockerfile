
# Use the official Node.js image
FROM node:22.12.0-bookworm

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . .

# Expose the port
EXPOSE 3000
EXPOSE 3001

# Start the application
CMD ["npm", "run", "dev"]
