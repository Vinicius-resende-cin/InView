import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import DependencyView from "@extension/components/DependencyView";
import LocalMode from "./localMode";

// Set at build time by webpack.web.config.js. "true" enables local-folder mode
// (no backend; reads analysis JSON from a folder served by the dev server).
const LOCAL_MODE = process.env.LOCAL_MODE === "true";

// Styles that the Chrome extension injects at runtime via the background
// service worker. In the standalone web app we import them directly so the
// bundle is self-contained. (dependency-plugin.css is imported by
// DependencyView itself, so it is not repeated here.)
import "@extension/styles/tailwind.css";
import "@extension/styles/diff2html.css";
import "@extension/styles/react-sigma-min.css";
import "./web.css";

interface PRIdentity {
  owner: string;
  repository: string;
  pull_number: number;
}

/**
 * Reads the PR identity from the URL query string.
 * Accepts ?owner=X&repo=Y&pull=123 (pull_number and pr are also accepted).
 * @returns the identity if all three params are present and valid, null otherwise
 */
function readIdentityFromQuery(): PRIdentity | null {
  const params = new URLSearchParams(window.location.search);
  const owner = params.get("owner");
  const repository = params.get("repo") ?? params.get("repository");
  const pullRaw = params.get("pull") ?? params.get("pull_number") ?? params.get("pr");

  if (!owner || !repository || !pullRaw) return null;
  const pull_number = Number(pullRaw);
  if (!Number.isInteger(pull_number) || pull_number <= 0) return null;

  return { owner, repository, pull_number };
}

/**
 * Fallback form shown when the query params are missing or invalid.
 * On submit it updates the URL query string so the view can be linked/shared.
 */
function IdentityForm({ onSubmit }: { onSubmit: (identity: PRIdentity) => void }) {
  const [owner, setOwner] = useState("");
  const [repository, setRepository] = useState("");
  const [pull, setPull] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pull_number = Number(pull);
    if (!owner || !repository || !Number.isInteger(pull_number) || pull_number <= 0) return;

    // Reflect the selection in the URL so it becomes a shareable link.
    const params = new URLSearchParams({ owner, repo: repository, pull: String(pull_number) });
    window.history.replaceState(null, "", `?${params.toString()}`);

    onSubmit({ owner, repository, pull_number });
  };

  return (
    <form className="inview-identity-form" onSubmit={handleSubmit}>
      <h1>InView</h1>
      <p>Enter the pull request to analyze.</p>
      <label>
        Owner
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="octocat" autoFocus />
      </label>
      <label>
        Repository
        <input value={repository} onChange={(e) => setRepository(e.target.value)} placeholder="hello-world" />
      </label>
      <label>
        Pull request number
        <input value={pull} onChange={(e) => setPull(e.target.value)} placeholder="123" inputMode="numeric" />
      </label>
      <button type="submit">Analyze</button>
    </form>
  );
}

function Root() {
  const [identity, setIdentity] = useState<PRIdentity | null>(readIdentityFromQuery);

  // Local-folder mode: no backend, pick a file from the served folder instead.
  if (LOCAL_MODE) return <LocalMode />;

  if (!identity) return <IdentityForm onSubmit={setIdentity} />;

  return (
    <DependencyView
      owner={identity.owner}
      repository={identity.repository}
      pull_number={identity.pull_number}
    />
  );
}

const rootElement = document.querySelector("#dependencies-content-root");
if (rootElement === null) throw new Error("Root not found");

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
