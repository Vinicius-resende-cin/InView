import React, { useCallback, useEffect, useState } from "react";
import DependencyView from "@extension/components/DependencyView";

// Local-folder mode.
//
// Instead of fetching a Mongo-backed backend, the dev server exposes a small
// middleware (see webpack.web.config.js) that reads a local folder passed by
// the user. This component lists the folder's JSON files and, once one is
// selected, renders the *unchanged* DependencyView.
//
// DependencyView identifies an analysis by owner/repository/pull_number and
// fetches it through AnalysisService. In local mode we reuse that exact path by
// passing the selected file name as `owner`; the middleware reads the `owner`
// query param as the file name and returns its contents.

interface FileListResponse {
  dir: string;
  files: string[];
}

function useSelectedFile(): [string | null, (name: string | null) => void] {
  const [file, setFile] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("file")
  );

  const select = useCallback((name: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (name) params.set("file", name);
    else params.delete("file");
    window.history.replaceState(null, "", params.toString() ? `?${params.toString()}` : window.location.pathname);
    setFile(name);
  }, []);

  return [file, select];
}

function FilePicker({ onSelect }: { onSelect: (name: string) => void }) {
  const [data, setData] = useState<FileListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/local-api/files")
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then((json: FileListResponse) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Verify the folder contents when the main page is accessed.
  useEffect(loadFiles, [loadFiles]);

  return (
    <div className="inview-local-picker">
      <h1>InView — Local mode</h1>
      {data?.dir && (
        <p className="inview-local-dir">
          Reading from <code>{data.dir}</code>
        </p>
      )}

      {loading ? (
        <p>Reading folder…</p>
      ) : error ? (
        <div className="inview-local-error">
          <p>Could not read the analysis folder: {error}</p>
          <button type="button" onClick={loadFiles}>
            Retry
          </button>
        </div>
      ) : data && data.files.length > 0 ? (
        <>
          <p>Select an analysis file to open:</p>
          <ul className="inview-local-files">
            {data.files.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => onSelect(name)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="inview-local-refresh" onClick={loadFiles}>
            Refresh
          </button>
        </>
      ) : (
        <div className="inview-local-error">
          <p>No JSON files were found in the folder.</p>
          <button type="button" onClick={loadFiles}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default function LocalMode() {
  const [file, setFile] = useSelectedFile();

  if (!file) return <FilePicker onSelect={setFile} />;

  return (
    <>
      <div className="inview-local-bar">
        <button type="button" onClick={() => setFile(null)}>
          ← Files
        </button>
        <span className="inview-local-bar__name">{file}</span>
      </div>
      {/* owner carries the selected file name; the middleware maps it back to
          the file. repository/pull_number are passthrough placeholders. */}
      <DependencyView key={file} owner={file} repository="local" pull_number={0} />
    </>
  );
}
