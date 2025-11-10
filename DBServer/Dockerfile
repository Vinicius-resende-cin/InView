FROM node:23-slim

# Set the working directory in the container to /usr/src/app
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code to the working directory
COPY . .

EXPOSE 4000

# Runs the application
CMD [ "npm", "run", "bstart" ]
