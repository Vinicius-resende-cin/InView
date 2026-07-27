# Github Code Review + Semantic Conflicts

This chrome extension introduces information about semantic conflicts reported by code analysis tools to the Github pull request page.

_\*The analysis information is located on a separated database. This extension only modifies the UI to display the conflicts._

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Standalone web interface](#standalone-web-interface)
  - [Backend mode](#backend-mode)
  - [Local-folder mode](#local-folder-mode)
- [Related repositories](#related-repositories)

## Installation

```bash
# Clone the repository
git clone https://github.com/Vinicius-resende-cin/react-chrome-ext.git

# Navigate to the project directory
cd react-chrome-ext

# Install dependencies
npm install
```

## Usage

1. First, build the extension with the command:

```bash
npm run build
```

2. After that, follow the instructions on [this link](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) and select the `dist` folder to load the extension on your chrome compatible browser.

3. Now you can access a pull request page and the new tab will be available.

## Standalone web interface

The same interface can also run as a standalone local web app, **without installing a
browser extension and without depending on the GitHub page**. It reuses the exact same
UI (the `DependencyView` component) as the extension — nothing about the interface
changes; only how it is served.

The web app is built from `src/web/` with `webpack.web.config.js` and served with
`webpack-dev-server`. There are two modes.

### Backend mode

Fetches the analysis from the same DBServer backend the extension uses (via the
`SERVER_URL` variable in `.env`, defaulting to `http://localhost:4000`).

```bash
# on the Extension folder
npm install
npm run start:web        # dev server at http://localhost:3000
# or produce a static bundle in dist-web/:
npm run build:web
```

Identify the pull request through query params, e.g.:

```
http://localhost:3000/?owner=OWNER&repo=REPO&pull=123
```

If the params are missing, a small form is shown to enter the owner, repository and
pull request number (which then rewrites the URL into a shareable link).

### Local-folder mode

Runs **without any backend or database**. Instead, you point the app at a local folder
containing analysis-output JSON files; the dev server reads that folder and the landing
page lists the files so you can pick one to open.

```bash
# on the Extension folder
npm run start:web:local -- --env dir=path/to/your/json-folder
```

- `--env dir=…` is the folder with the analysis `.json` files. If omitted, it defaults
  to `./analysis-output`. The path may be relative or absolute.
- Open `http://localhost:3000`. When the main page (`/`) is accessed, the folder
  contents are listed; select a file to parse and render the interface. A **← Files**
  bar lets you return and pick another file, and the selection is reflected in the URL
  (`?file=…`) so it can be linked.

Notes:

- Each JSON file must be a single analysis output (the same object the backend's
  `/analysis` endpoint returns).
- Local-folder mode is served by the dev server (there is no static build for it, since
  the folder is read at request time), and settings changes are not persisted in this
  mode.

## Related repositories

- Github app (executes code analysis on pull requests): [basic-app](https://github.com/Vinicius-resende-cin/basic-app)
- Database server: [github-plugin-server](https://github.com/Vinicius-resende-cin/github-plugin-server)
