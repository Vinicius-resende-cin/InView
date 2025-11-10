import { useEffect, useState, useRef } from "react";
import AnalysisService from "../../services/AnalysisService";
import { dependency, modLine } from "../../models/AnalysisOutput";
import { filterDuplicatedDependencies, updateLocationFromStackTrace } from "./dependencies";
import Conflict from "./Conflict";
import DiffView from "./Diff/DiffView";
import GraphView, { ConflictGridType } from "./Graph/GraphView";
import "../styles/dependency-plugin.css";
import SettingsButton from "./Settings/Settings-button";
import SettingsService from "../../services/SettingsService";
import { getClassFromJavaFilename, isLineFromLeft, ensureJavaExtension } from "@extension/utils";
import { Node } from "./Graph/Node";
import { getDiffLine } from "./Diff/diff-navigation";
import { FileObject, Grouping_nodes, getGraphType } from "./grouping";
import { extractNodesFromDependency } from "../utils/extractNode";

const analysisService = new AnalysisService();
const settingsService = new SettingsService();

async function getAnalysisOutput(owner: string, repository: string, pull_number: number) {
  return await analysisService.getAnalysisOutput(owner, repository, pull_number);
}

async function getSettings(owner: string, repository: string, pull_number: number) {
  return await settingsService.getSettings(owner, repository, pull_number);
}

type GraphData = {
  files: FileObject[];
  graphType: ConflictGridType;
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /*
   * conflict properties
   */
  const [activeConflict, setActiveConflict] = useState<number | null>(null); // index of the active conflict on dependencies list
  // const [leftNode, setLeftNode] = useState<Node | null>(null);
  // const [rightNode, setRightNode] = useState<Node | null>(null);

  /*
   * graph properties
   */
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  /*
   * methods
   */
  const updateGraph = (dep: dependency, L: Node, R: Node, CF?: Node) => {
    // get the LC and RC
    dep = updateLocationFromStackTrace(dep, { inplace: false, mode: "deep" });

    const { L: LC, R: RC } = extractNodesFromDependency(dep);

    // If the nodes are equal, update from the stack trace
    if (getClassFromJavaFilename(L.fileName) === getClassFromJavaFilename(LC.fileName) && L.numberHighlight === LC.numberHighlight) {
      L.fileName = ensureJavaExtension(dep.body.interference[0].stackTrace?.at(0)?.class.replaceAll(".", "/") ?? L.fileName);

      if (dep.body.interference[0].stackTrace?.at(0)?.line){
        L.numberHighlight = dep.body.interference[0].stackTrace?.at(0)?.line ?? L.numberHighlight;

        let L_Row;
        let newNumber = L.numberHighlight;
        for ( let i = -1; i <= 1; i++){
          L_Row = getDiffLine(L.fileName, newNumber + i);
    
          L.lines[i + 1] = L_Row.querySelector(".d2h-code-line-ctn")?.textContent || "";
        }

      } 
    }

    if (getClassFromJavaFilename(R.fileName) === getClassFromJavaFilename(RC.fileName) && R.numberHighlight === RC.numberHighlight) {
      R.fileName = ensureJavaExtension(dep.body.interference[dep.body.interference.length - 1].stackTrace?.at(0)?.class.replaceAll(".", "/") ?? R.fileName);

      if (dep.body.interference[dep.body.interference.length - 1].stackTrace?.at(0)?.line){
        R.numberHighlight = dep.body.interference[dep.body.interference.length - 1].stackTrace?.at(0)?.line ?? R.numberHighlight;

        let R_Row;
        let newNumber = R.numberHighlight;
        for ( let i = -1; i <= 1; i++){
          R_Row = getDiffLine(R.fileName, newNumber + i);

          R.lines[i + 1] = R_Row.querySelector(".d2h-code-line-ctn")?.textContent || "";
        }

      } 
    }

    //Sending the correct colors to the nodes
    //TODO: set colors
    // let lColor = "";
    // let rColor = "";

    // const leftLines = [L, LC];

    // if (isLineFromLeft(leftLines, modifiedLines)) {
    //   lColor = "#1E90FF"; //azul
    //   rColor = "#228B22"; //verde
    // } else {
    //   lColor = "#228B22"; //verde
    //   rColor = "#1E90FF"; //azul
    // }

    const normalizePath = (p?: string) =>
      p ? p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "") : p;

    const unifyFileNames = (...nodes: Array<Node | undefined>) => {
      const ns = nodes.filter(Boolean) as Node[];
      ns.forEach((n) => {
        n.fileName = normalizePath(n.fileName) ?? n.fileName;
      });

      for (let i = 0; i < ns.length; i++) {
        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue;
          const a = ns[i].fileName;
          const b = ns[j].fileName;
          if (!a || !b || a === b) continue;

          // se um contém o outro, atribui o menor (mais curto) ao maior
          if (a.includes(b) && b.length < a.length) {
            ns[i].fileName = b;
          } else if (b.includes(a) && a.length < b.length) {
            ns[j].fileName = a;
          }
        }
      }
    };

    unifyFileNames(L, R, LC, RC);
    // Dividing the nodes into files
    console.log("Updating graph with nodes:", { L, R, LC, RC });
    const newGraphData = Grouping_nodes(dep, L, R, LC, RC);

    // identifying the graph type
    const graphType = getGraphType(dep, L, R, LC, RC);
    console.log("GraphType Identificado: ", graphType);

    // set the new graph data
    if (!newGraphData || !graphType) setGraphData(null);
    else setGraphData({ files: newGraphData, graphType });
  };

  const changeActiveConflict = (dep: dependency) => {
    const { L, R, CF } = extractNodesFromDependency(dep);
    updateGraph(dep, L, R, CF);
  };

  // get the analysis output
  useEffect(() => {
    const fetchAnalysis = () => {
      getAnalysisOutput(owner, repository, pull_number).then((response) => {
        setloading(false);
        dependencyViewConfig = { owner, repository, pull_number };
        let dependencies = response.getDependencies();
        dependencies.forEach((dep) => {
          if (
            dep.body.interference[0].location.file === "UNKNOWN" ||
            dep.body.interference[dep.body.interference.length - 1].location.file === "UNKNOWN"
          )
            updateLocationFromStackTrace(dep, { inplace: true });
        });
        dependencies = filterDuplicatedDependencies(dependencies);

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
  }, [owner, repository, pull_number]);

  // update the active conflict
  useEffect(() => {
    if (activeConflict !== null) {
      const conflict = dependencies[activeConflict];
      changeActiveConflict(conflict);
    }
  }, [activeConflict]);

  return (
    <div id="dependency-plugin">
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div> {/* Exibindo o spinner enquanto carrega */}
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
            {dependencies.length ? (
              <div
                id="dependency-container"
                className="tw-min-w-fit tw-max-w-[20%] tw-h-fit tw-mr-5 tw-py-2 tw-px-3 tw-border tw-border-gray-700 tw-rounded">
                <h3 className="tw-mb-5 tw-text-red-600">
                  {dependencies.length} possible conflict
                  {dependencies.length > 1 ? "s" : ""} reported:
                </h3>
                <ul className="tw-list-none">
                  {dependencies.map((d, i) => {
                    return (
                      <li>
                        <Conflict key={i} index={i} dependency={d} setConflict={setActiveConflict} />
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

            {diff ? (
              <div id="content-container" className="tw-w-full">
                {graphData && <GraphView data={graphData.files} conflictGridType={graphData.graphType} />}
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
    </div>
  );
}
