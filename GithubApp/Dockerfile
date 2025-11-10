FROM ibmjava:11-jdk

# install dependencies and set configs
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg gradle maven git && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 23
RUN curl -fsSL https://deb.nodesource.com/setup_23.x | bash - && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

ENV GRADLE_HOME=/usr/share/gradle \
    MAVEN_HOME=/usr/share/maven
    
ENV GRADLE_PATH=${GRADLE_HOME}/bin \
    MAVEN_PATH=${MAVEN_HOME}/bin

RUN git config --global user.name "User" && \
    git config --global user.email "user@example.com"

# Set the working directory in the container to /usr/src/app
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code to the working directory
COPY . .

# Copy the ssm files to the working directory and set ENV paths
ENV MERGER_PATH=/usr/src/app/ssm/dependencies \
    STATIC_SEMANTIC_MERGE_PATH=/usr/src/app/ssm/dependencies/static-semantic-merge-1.0-SNAPSHOT.jar \
    SCRIPTS_PATH=/usr/src/app/ssm/scripts


# Runs the application
CMD [ "npm", "start" ]
