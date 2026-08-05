import { useEffect, useState, useRef, useCallback } from "react";
import AnalysisService from "../../services/AnalysisService";
import { dependency, modLine } from "../../models/AnalysisOutput";
import { filterDuplicatedDependencies, updateLocationFromStackTrace } from "./dependencies";
import Conflict from "./Conflict";
import DiffView from "./Diff/DiffView";
import GraphView, { ConflictGridType } from "./Graph/GraphView";
import "../styles/dependency-plugin.css";
import SettingsButton from "./Settings/Settings-button";
import SettingsService from "../../services/SettingsService";
import { FileObject, Grouping_nodes, getGraphType, reorderFilesForLayout } from "./grouping";
import { buildNodesFromClassification } from "../utils/extractNode";
import { classifyDependency, normalizeFileKey } from "../utils/classification";
import type { ClassificationResult, FrameInfo } from "../models/Classification";
import FileTree from "./Diff/FileTree";

const analysisService = new AnalysisService();
const settingsService = new SettingsService();

async function getAnalysisOutput(owner: string, repository: string, pull_number: number) {
  return await analysisService.getAnalysisOutput(owner, repository, pull_number);
}

async function getSettings(owner: string, repository: string, pull_number: number) {
  return await settingsService.getSettings(owner, repository, pull_number);
}

// Convert modifiedLines array to map format for classification.
// Stores both the original file path and its normalized key for lookup flexibility.
function buildModifiedLinesMap(modifiedLines: modLine[]): Record<string, any> {
  const modifiedLinesMap: Record<string, any> = {};
  modifiedLines.forEach((ml) => {
    const entry = {
      leftAdded: ml.leftAdded || [],
      leftRemoved: ml.leftRemoved || [],
      rightAdded: ml.rightAdded || [],
      rightRemoved: ml.rightRemoved || [],
    };

    modifiedLinesMap[ml.file] = entry;

    const normalizedKey = normalizeFileKey(ml.file);
    if (normalizedKey && normalizedKey !== ml.file) {
      modifiedLinesMap[normalizedKey] = entry;
    }
  });
  return modifiedLinesMap;
}

// Identifies conflicts that classification considers the same: same conflict shape (label)
// at the same concrete locations. Two dependencies can differ in their raw stack traces
// (and so survive filterDuplicatedDependencies) yet still classify down to an identical
// conflict - those should be treated as duplicates too.
function classificationDedupeKey(classification: ClassificationResult): string {
  const frameKey = (frames?: FrameInfo[]) => (frames ?? []).map((f) => `${f.fileKey}:${f.line}`).join(">");

  if (classification.conflictType === "CF") {
    return [
      "CF",
      classification.label,
      frameKey(classification.source1Frames),
      frameKey(classification.source2Frames),
      classification.confluenceFrame ? `${classification.confluenceFrame.fileKey}:${classification.confluenceFrame.line}` : "",
    ].join("|");
  }

  return [
    classification.conflictType,
    classification.label,
    frameKey(classification.leftFrames),
    frameKey(classification.rightFrames),
  ].join("|");
}

type GraphData = {
  files: FileObject[];
  graphType: ConflictGridType;
  dependencyType?: string;
  classification?: ClassificationResult;
}

interface DependencyViewProps {
  owner: string;
  repository: string;
  pull_number: number;
}

let dependencyViewConfig: { owner: string; repository: string; pull_number: number } | null = null;

export function getDependencyViewConfig() {
  if (!dependencyViewConfig) {
    throw new Error("DependencyViewConfig is not set. Ensure DependencyView is rendered.");
  }
  return dependencyViewConfig;
}

export default function DependencyView({ owner, repository, pull_number }: DependencyViewProps) {
  /*
   * analysis properties
   */
  const [dependencies, setDependencies] = useState<dependency[]>([]);
  const [modifiedLines, setModifiedLines] = useState<modLine[]>([]);

  /*
   * diff properties
   */
  const [diff, setDiff] = useState<string>("");
  const [filesFromBase, setFilesFromBase] = useState<string[]>([]);

  /*
   * settings properties
   */
  const [mainClass, setMainClass] = useState("");
  const [baseClass, setBaseClass] = useState("");
  const [mainMethod, setMainMethod] = useState("");

  /*
   * loading properties
   */
  const [loading, setloading] = useState<boolean>(true);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [stickyOffset, setStickyOffset] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pluginRef = useRef<HTMLDivElement>(null);

  /*
   * conflict properties
   */
  const [activeConflict, setActiveConflict] = useState<number | null>(null); // index of the active conflict on dependencies list

  /*
   * graph properties
   */
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [allGraphsData, setAllGraphsData] = useState<Map<number, GraphData>>(new Map()); // Store graph data for all conflicts
  const [loadingConflicts, setLoadingConflicts] = useState<Set<number>>(new Set()); // Track which conflicts are currently loading
  const [graphMinimized, setGraphMinimized] = useState(false);

  /*
   * methods
   */

  const handleConflictSelect = useCallback((index: number) => {
    setActiveConflict(index);
    setGraphMinimized(false);
  }, []);

  // Helper function to load a single graph
  const loadGraphForConflict = useCallback((index: number, callback?: (data: GraphData | null) => void) => {
    if (index >= dependencies.length) {
      callback?.(null);
      return;
    }

    const dep = dependencies[index];
    try {
      const modifiedLinesMap = buildModifiedLinesMap(modifiedLines);

      // Classify the dependency first, then build the graph's nodes directly from the
      // classification result - the graph can never show endpoints classification didn't
      // actually reason about.
      const classification = classifyDependency(dep, modifiedLinesMap);

      const nodes = buildNodesFromClassification(classification);
      if (!nodes) {
        callback?.(null);
        return;
      }
      const { L, R, LC, RC } = nodes;

      const newGraphData = Grouping_nodes(dep, L, R, LC, RC);
      const graphType = getGraphType(dep, L, R, LC, RC, classification);

      if (newGraphData && graphType) {
        const c = classification;
        let classReason = 'n/a';
        if (c && !c.label.startsWith('Error:')) {
          if (c.conflictType === 'CF') {
            classReason = `source1=[${(c.source1Files ?? []).join('→')}] source2=[${(c.source2Files ?? []).join('→')}] confluence=${c.confluenceFile ?? '?'}`;
          } else {
            classReason = `left=[${(c.leftFiles ?? []).join('→')}] right=[${(c.rightFiles ?? []).join('→')}]`;
          }
        } else if (c?.label.startsWith('Error:')) {
          classReason = c.label;
        }
        console.log(
          `[Graph] conflict #${index}\n` +
          `  type        : ${dep.type}\n` +
          `  class       : ${c?.label ?? 'none'}\n` +
          `  reason      : ${classReason}\n` +
          `  layout      : ${graphType.layout.rows}r × ${graphType.layout.columns}c\n` +
          `  positions   : ${JSON.stringify(graphType.positions)}`
        );
        const graphDataObj = {
          files: reorderFilesForLayout(newGraphData, graphType.positions),
          graphType,
          dependencyType: dep.type,
          classification,
        };
        setAllGraphsData(prev => new Map(prev).set(index, graphDataObj));
        callback?.(graphDataObj);
        return;
      }
    } catch (error) {
      console.warn(`Failed to load graph for conflict ${index}:`, error);
    }
    callback?.(null);
  }, [dependencies]);

  // Pre-load all graphs in the background after dependencies are loaded
  useEffect(() => {
    if (dependencies.length === 0) return;

    const newGraphsData = new Map<number, GraphData>();
    let loadedCount = 0;

    const loadGraph = (index: number) => {
      loadGraphForConflict(index, (data) => {
        if (data) {
          newGraphsData.set(index, data);
        }
        loadedCount++;
        if (loadedCount === dependencies.length) {
          setAllGraphsData(newGraphsData);
        }
      });
    };

    // Load all graphs in the background
    dependencies.forEach((_, index) => {
      // Use requestIdleCallback for background loading, fallback to setTimeout
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => loadGraph(index), { timeout: 500 });
      } else {
        setTimeout(() => loadGraph(index), 10 + index * 50); // Stagger loading
      }
    });
  }, [dependencies, loadGraphForConflict]);

  // get the analysis output
  useEffect(() => {
    const fetchAnalysis = () => {
      getAnalysisOutput(owner, repository, pull_number).then((response) => {
        setloading(false);
        dependencyViewConfig = { owner, repository, pull_number };
        let dependencies = response.getDependencies();
        dependencies = filterDuplicatedDependencies(dependencies);

        // Drop conflicts classification can't make sense of (error label) - there's no
        // usable graph for them, so they shouldn't clutter the conflict list either.
        // Also drop conflicts that classify down to the same shape at the same locations
        // as one already kept, even if their raw stack traces differ.
        const modifiedLinesMap = buildModifiedLinesMap(response.data.modifiedLines ?? []);
        const seenClassificationKeys = new Set<string>();
        dependencies = dependencies.filter((dep) => {
          const classification = classifyDependency(dep, modifiedLinesMap);
          if (classification.label.startsWith("Error:")) return false;

          const key = classificationDedupeKey(classification);
          if (seenClassificationKeys.has(key)) return false;
          seenClassificationKeys.add(key);
          return true;
        });

        setDependencies(
          dependencies.sort((a, b) => {
            const aStartLine = a.body.interference[0].location.line;
            const bStartLine = b.body.interference[0].location.line;
            const aEndLine = a.body.interference[a.body.interference.length - 1].location.line;
            const bEndLine = b.body.interference[b.body.interference.length - 1].location.line;

            if (aStartLine < bStartLine) return -1;
            if (aStartLine > bStartLine) return 1;
            if (aEndLine < bEndLine) return -1;
            if (aEndLine > bEndLine) return 1;
            return 0;
          })
        );

        const appendMissingFilesToDiff = (diff: string, missingFiles: { file: string; content: string }[]) => {
          for (const { file, content } of missingFiles) {
            const fileHeader = `diff --git a/${file} b/${file}\nindex 0000000..0000000 100644\n--- a/${file}\n+++ b/${file}\n`;
            const contentSize = content.split("\n").length - 1;
            const fileContent = `@@ -1,${contentSize} +1,${contentSize} @@\n${content
              .split("\n")
              .map((line) => " " + line)
              .join("\n")}\n`;
            diff += fileHeader + fileContent;
          }
          return diff;
        };
        let newDiff = response.getDiff();
        const missingFiles: { file: string; content: string }[] = response.data.missingFiles ?? [];
        newDiff = appendMissingFilesToDiff(newDiff, missingFiles);

        setDiff(newDiff);
        setFilesFromBase(missingFiles.map((file) => file.file));
        setModifiedLines(response.data.modifiedLines ?? []);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      });
    };

    fetchAnalysis();
    if (loading) {
      intervalRef.current = setInterval(fetchAnalysis, 3000);
    }
    // get the settings
    getSettings(owner, repository, pull_number).then((response) => {
      setMainClass(response.mainClass);
      setMainMethod(response.mainMethod);
      setBaseClass(response.baseClass ?? "");
    });
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [owner, repository, pull_number, loading]);

  // Auto-select the first conflict once its graph data is ready
  useEffect(() => {
    if (activeConflict === null && allGraphsData.has(0)) {
      setActiveConflict(0);
    }
  }, [allGraphsData]);

  // update the active conflict
  useEffect(() => {
    if (activeConflict !== null) {
      // Check if graph is already loaded
      if (allGraphsData.has(activeConflict)) {
        setGraphData(allGraphsData.get(activeConflict) || null);
      } else if (!loadingConflicts.has(activeConflict)) {
        // If not loaded and not already loading, load it immediately
        setLoadingConflicts(prev => new Set(prev).add(activeConflict));
        loadGraphForConflict(activeConflict, (data) => {
          setLoadingConflicts(prev => {
            const newSet = new Set(prev);
            newSet.delete(activeConflict);
            return newSet;
          });
          if (data) {
            setGraphData(data);
          }
        });
      }
    }
  }, [activeConflict, allGraphsData, loadingConflicts, loadGraphForConflict]);

  useEffect(() => {
    const computeGitHubHeaderOffset = (): number => {
      const plugin = pluginRef.current;
      let max = 0;
      document.querySelectorAll<HTMLElement>('header, [class*="AppHeader"], [class*="sticky"]').forEach(el => {
        if (plugin?.contains(el)) return;
        const s = getComputedStyle(el);
        if (s.position !== "fixed" && s.position !== "sticky") return;
        if (s.display === "none") return;
        const rect = el.getBoundingClientRect();
        // element is at the top of the viewport and within the first 300px
        if (rect.height > 0 && rect.top >= -2 && rect.bottom > 0 && rect.bottom < 300) {
          max = Math.max(max, rect.bottom);
        }
      });
      return max;
    };

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setShowBackToTop(scrollTop > 250);
      setStickyOffset(computeGitHubHeaderOffset());
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div id="dependency-plugin" ref={pluginRef}>
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading analysis...</p>
        </div>
      ) : (
        <>
          {diff ? (
            <SettingsButton
              baseClass={baseClass}
              setBaseClass={setBaseClass}
              mainClass={mainClass}
              setMainClass={setMainClass}
              mainMethod={mainMethod}
              setMainMethod={setMainMethod}
            />
          ) : null}
          <div id="dependency-plugin-content" className="tw-flex tw-flex-row tw-justify-between">
            <div className="tw-flex tw-flex-col tw-gap-3 tw-mr-5 tw-sticky tw-self-start tw-min-w-[200px] tw-max-w-[240px]" style={{ top: stickyOffset + 30 }}>
              {dependencies.length ? (
                <div
                  id="dependency-container"
                  className="tw-h-fit tw-py-2 tw-px-3 tw-border tw-border-gray-700 tw-rounded">
                  <h3 className="tw-mb-5 tw-text-red-600">
                    {dependencies.length} dependenc
                    {dependencies.length > 1 ? "ies" : "y"} reported:
                  </h3>
                  <ul className="tw-list-none dependency-list">
                    {dependencies.map((d, i) => {
                      return (
                        <li>
                          <Conflict key={i} index={i} dependency={d} setConflict={handleConflictSelect} isActive={activeConflict === i} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : diff ? (
                <div id="no-dependencies">
                  <p>No conflicts were found during the analysis</p>
                </div>
              ) : null}
              {diff && <FileTree diff={diff} />}
            </div>

            {diff ? (
              <div id="content-container" className="tw-w-full">
                {graphData && (
                  <div className={`graph-sticky-wrap${graphMinimized ? " graph-sticky-wrap--minimized" : ""}`} style={{ top: stickyOffset }}>
                    <div className="graph-toggle-bar">
                      <button
                        type="button"
                        className="graph-toggle-btn"
                        onClick={() => setGraphMinimized(m => !m)}
                        aria-label={graphMinimized ? "Expand graph" : "Minimize graph"}
                      >
                        {graphMinimized ? "▾ Show graph" : "▴ Hide graph"}
                      </button>
                    </div>
                    {!graphMinimized && (
                      <GraphView data={graphData.files} conflictGridType={graphData.graphType} dependencyType={graphData.dependencyType} />
                    )}
                  </div>
                )}
                <DiffView diff={diff} modifiedLines={modifiedLines} filesFromBase={filesFromBase} />
              </div>
            ) : (
              <div id="no-analysis" className="tw-mb-3">
                <p>The analysis results were not found...</p>
                <p>Please try again soon. If the problem persists, please contact support.</p>
              </div>
            )}
          </div>
        </>
      )}
      {showBackToTop ? (
        <button type="button" className="back-to-top-button" onClick={scrollToTop} aria-label="Back to top">
          Back to top
        </button>
      ) : null}
    </div>
  );
}
