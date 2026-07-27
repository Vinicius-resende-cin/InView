# InView

A plugin for Github that shows Pull Request's code semantic dependencies through graphs.

This project is licensed under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

# Topics

- [Usage](#usage)
- [Installation](#installation)
  - [Setup Environment Variables](#setup-environment-variables)
  - [Github App and Database Server](#github-app-and-database-server)
    - [Install with Docker](#install-with-docker)
    - [Install Manually](#install-manually)
      - [GithubApp](#githubapp)
      - [DBServer](#dbserver)
  - [Extension](#extension)
  - [Standalone Web Interface](#standalone-web-interface)
    - [Backend Mode](#backend-mode)
    - [Local-folder Mode](#local-folder-mode)

# Usage

1. [Install the Github app in your Github repository.](#githubapp)
2. [Install the extension in your browser.](#extension)
3. [Run both the DBServer and the GithubApp.](#github-app-and-database-server)
4. Open a Pull Request in your Github repository.
5. Click on the 'dependencies' button in the Pull Request page.
6. Now you can see the dependencies of the Pull Request in a list.
7. Click on any dependency on the list to see an interactive graph representation.

# Installation

To install each component, first clone the repository:

```bash
git clone https://github.com/Vinicius-resende-cin/InView.git
cd InView
```

After that, you can install the extension, the Github app, and the database server.

## Setup Environment Variables

Before installing the components, you need to set up the environment variables for each one of them:

1. Create a `.env` file in both the `GithubApp` and `DBServer` folders.
2. Add the required environment variables to each `.env` file as specified in the .env.example files located in each folder.
    * For the `GithubApp` either set up a GitHub App in your GitHub account and obtain the necessary credentials (App ID, Private Key, Webhook Secret, etc.), or use a existing GitHub App's credentials.
3. Lastly, create a `.env` file in the Extension folder and add a `SERVER_URL` variable pointing to your DBServer instance (e.g., `http://localhost:4000`).

## Github App and Database Server

The Github app and the database server are two components that work together to provide the functionality of the SSM plugin. The Github app is responsible for receiving webhooks from Github and sending them to the database server, which stores the data and provides it to the extension.

### Install with Docker

To install the Github app and the database server in one line with Docker, you can use the following command (make sure to setup each component's environment variables in a `.env` file first - see the [Setup Environment Variables](#setup-environment-variables) section):

```bash
docker compose up --build
```

### Install Manually

To install the Github app and the database server manually, you can follow these steps:

#### GithubApp

Go to the `GithubApp` folder and run the following command to build and run the app:

```bash
# on the GithubApp folder
npm install
npm run build
npm start
```

#### DBServer

Go to the `DBServer` folder and run the following command to build and run the server:

```bash
# on the DBServer folder
npm install
npm run build
npm start
```

## Extension

Lastly, build the extension:

```bash
# on the Extension folder
npm install
npm run build
```

This will create a `dist` folder with the built extension.

Then, follow the official instructions in the [Chrome documentation](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) to load the extension in your browser, or follow the steps below:

1. Open Chrome and go to `chrome://extensions/`.
2. Enable "Developer mode" in the top right corner.
3. Click on "Load unpacked" and select the `Extension/dist` folder in the cloned repository.
4. The extension should now be installed and ready to use.

## Standalone Web Interface

As an alternative to the browser extension, the exact same interface can run as a
standalone local web app — no extension to install and no dependency on the GitHub page.
It reuses the same UI code as the extension, so the interface is identical; only the way
it is served changes. It runs from the `Extension` folder:

```bash
# on the Extension folder
npm install
```

### Backend Mode

Uses the DBServer backend (the same one the extension relies on), configured via the
`SERVER_URL` variable in `Extension/.env`:

```bash
# on the Extension folder
npm run start:web        # dev server at http://localhost:3000
```

Then open the app pointing to a Pull Request, e.g.
`http://localhost:3000/?owner=OWNER&repo=REPO&pull=123` (a form is shown if the query
params are omitted).

### Local-folder Mode

Runs **without the GithubApp, DBServer or MongoDB**. Instead of fetching a backend, you
point the app at a local folder containing analysis-output JSON files. When the main page
is opened, the folder is listed and you select a file to render:

```bash
# on the Extension folder
npm run start:web:local -- --env dir=path/to/your/json-folder
```

Then open `http://localhost:3000` and pick a file from the list. See the
[Extension README](Extension/README.md#standalone-web-interface) for full details.