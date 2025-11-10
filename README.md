# SSM Plugin

A plugin for Github that shows Pull Request's code semantic dependencies through graphs.

# Topics

- [Usage](#usage)
- [Installation](#installation)
  - [Extension](#extension)
  - [Github App and Database Server](#github-app-and-database-server)
    - [Install with Docker](#install-with-docker)
    - [Install Manually](#install-manually)
      - [Setup Environment Variables](#setup-environment-variables)
      - [GithubApp](#githubapp)
      - [DBServer](#dbserver)

# Usage

1. [Install the extension in your browser.](#extension)
2. [Install the Github app in your Github repository.](#githubapp)
3. [Run both the DBServer and the GithubApp.](#githubapp-and-database-server)
4. Open a Pull Request in your Github repository.
5. Click on the 'dependencies' button in the Pull Request page.
6. Now you can see the dependencies of the Pull Request in a list.
7. Click on any dependency on the list to see an interactive graph representation.

# Installation

To install each component, first clone the repository:

```bash
git clone https://github.com/Vinicius-resende-cin/ssm-plugin.git
cd ssm-plugin
```

After that, you can install the extension, the Github app, and the database server.

## Extension

First, build the extension:

```bash
cd Extension
# on the Extension folder
npm run build
```

This will create a `dist` folder with the built extension.

Then, follow the official instructions in the [Chrome documentation](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) to load the extension in your browser, or follow the steps below:

1. Open Chrome and go to `chrome://extensions/`.
2. Enable "Developer mode" in the top right corner.
3. Click on "Load unpacked" and select the `Extension/dist` folder in the cloned repository.
4. The extension should now be installed and ready to use.

## Github App and Database Server

The Github app and the database server are two components that work together to provide the functionality of the SSM plugin. The Github app is responsible for receiving webhooks from Github and sending them to the database server, which stores the data and provides it to the extension.

### Install with Docker

To install the Github app and the database server in one line with Docker, you can use the following command:

```bash
docker compose up --build
```

### Install Manually

To install the Github app and the database server manually, you can follow these steps:

#### Setup Environment Variables

_Section in development_

#### GithubApp

Go to the `GithubApp` folder and run the following command to build and run the app:

```bash
cd GithubApp
# on the GithubApp folder
npm install
npm run build
npm start
```

#### DBServer

Go to the `DBServer` folder and run the following command to build and run the server:

```bash
cd DBServer
# on the DBServer folder
npm install
npm run build
npm start
```
