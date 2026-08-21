import { dependency, tracedNode } from "../../models/AnalysisOutput";

/**
 * Remove duplicate dependencies from the list.
 *
 * Two dependencies are considered duplicates when they share the same type and the
 * same endpoints - compared by the first and last stack-trace frames of both the
 * first and last interference nodes. The first occurrence of each is kept.
 */
const filterDuplicatedDependencies = (dependencies: dependency[]) => {
  const uniqueDependencies: dependency[] = [];
  dependencies.forEach((dep) => {
    if (
      !uniqueDependencies.some(
        (d) =>{
          const dinterf0 = d.body.interference?.[0]
          const dinterf1 = d.body.interference?.[d.body.interference.length - 1]

          const interf0 = dep.body.interference?.[0]
          const interf1 = dep.body.interference?.[dep.body.interference.length - 1]

          if (!dinterf0 || !dinterf1 || !interf0 || !interf1) return false

          const di0s0 = dinterf0.stackTrace?.at(0)
          const di0s1 = dinterf0.stackTrace?.at(dinterf0.stackTrace.length - 1)
          const di1s0 = dinterf1.stackTrace?.at(0)
          const di1s1 = dinterf1.stackTrace?.at(dinterf1.stackTrace.length - 1)

          const i0s0 = interf0.stackTrace?.at(0)
          const i0s1 = interf0.stackTrace?.at(interf0.stackTrace.length - 1)
          const i1s0 = interf1.stackTrace?.at(0)
          const i1s1 = interf1.stackTrace?.at(interf1.stackTrace.length - 1)


          return d.type === dep.type &&
          i0s0 === di0s0 &&
          i0s1 === di0s1 &&
          i1s0 === di1s0 &&
          i1s1 === di1s1
        }
      )
    ) {
      uniqueDependencies.push(dep);
    }
  });

  return uniqueDependencies;
};

/**
 * Walk a stack trace from `maxDepth` toward the top and return the deepest frame whose
 * class maps to a file actually present in the rendered diff. Frames whose file is not
 * shown in the diff are skipped. Falls back to the top frame (index 0) if none match.
 *
 * @throws if the diff container element is not present in the DOM.
 */
const getLastValidNode = (stackTrace: tracedNode[], maxDepth: number) => {
  // get all the diff file elements
  let diffFiles: NodeListOf<Element> | Element[] | undefined = document
    .getElementById("diff-container")
    ?.querySelectorAll(".d2h-file-wrapper");
  if (!diffFiles) throw new Error("Diff not found");
  diffFiles = Array.from(diffFiles);

  let cur = maxDepth;
  while (cur >= 0) {
    const file = stackTrace[cur].class.replaceAll(".", "/") + ".java";

    // get the diff element of the file
    const diffContent = diffFiles.filter((diffFile) => {
      const fileName = diffFile.querySelector(".d2h-file-name")?.textContent;
      return fileName?.endsWith(file);
    })[0];

    // check if is a valid node
    if (!diffContent) {
      cur--;
    } else {
      return stackTrace[cur];
    }
  }
  return stackTrace[0];
};

/**
 * Rewrite an interference node's `location` (file/line/class) from its stack trace, so
 * that dependencies with an "UNKNOWN" location point at a concrete source line.
 *
 * The first and last interference nodes are updated; for CONFLUENCE dependencies the two
 * sources are interference[0]/interference[1] and the confluence point is the last node.
 *
 * @param options.inplace - when true, mutate and return `dep`; otherwise operate on a clone.
 * @param options.mode - "default" uses each node's top stack frame; "deep" uses
 *   {@link getLastValidNode} to pick the deepest frame whose file is present in the diff.
 * @throws if any of the required stack traces are missing or empty.
 */
const updateLocationFromStackTrace = (dep: dependency, options?: { inplace?: boolean; mode?: "default" | "deep" }) => {
  console.log("Updating location from stack trace");
  const hasValidStackTrace = (st: Array<tracedNode> | undefined): st is Array<tracedNode> =>
    !!(st && st.length > 0);

  if (
    !hasValidStackTrace(dep.body.interference[0].stackTrace) ||
    (dep.type.startsWith("CONFLUENCE") && !hasValidStackTrace(dep.body.interference[1].stackTrace)) ||
    (!dep.type.startsWith("CONFLUENCE") && !hasValidStackTrace(dep.body.interference[dep.body.interference.length - 1].stackTrace))
  )
    throw new Error("File not found: Invalid stack trace");

  const inplace: boolean = options?.inplace || false;
  const mode: "default" | "deep" = options?.mode || "default";

  let stackTrace0: tracedNode;
  let stackTraceN: tracedNode;
  let stackTraceCF: tracedNode | null = null;

  if (mode === "deep") {
    const maxDepth0 = dep.type.startsWith("CONFLUENCE")
      ? dep.body.interference[0].stackTrace.length - 2
      : dep.body.interference[0].stackTrace.length - 1;
    const maxDepthN = dep.type.startsWith("CONFLUENCE")
      ? dep.body.interference[1].stackTrace!.length - 2
      : dep.body.interference[dep.body.interference.length - 1].stackTrace!.length - 1;

    stackTrace0 = getLastValidNode(dep.body.interference[0].stackTrace, maxDepth0);
    stackTraceN = getLastValidNode(
      dep.type.startsWith("CONFLUENCE")
        ? dep.body.interference[1].stackTrace!
        : dep.body.interference[dep.body.interference.length - 1].stackTrace!,
      maxDepthN
    );
  } else if (dep.type.startsWith("CONFLUENCE")) {
    stackTrace0 = dep.body.interference[0].stackTrace[0];
    stackTraceN = dep.body.interference[1].stackTrace![0];
    stackTraceCF = {
      class: dep.body.interference[dep.body.interference.length - 1].location.class,
      method: dep.body.interference[dep.body.interference.length - 1].location.method,
      line: dep.body.interference[dep.body.interference.length - 1].location.line
    };
  } else {
    stackTrace0 = dep.body.interference[0].stackTrace[0];
    stackTraceN = dep.body.interference[dep.body.interference.length - 1].stackTrace![0];
  }

  const file0 = stackTrace0.class.replaceAll(".", "/") + ".java";
  const fileN = stackTraceN.class.replaceAll(".", "/") + ".java";
  const fileCF = stackTraceCF ? stackTraceCF.class.replaceAll(".", "/") + ".java" : "";

  if (inplace) {
    let firstNode = dep.body.interference[0];
    let lastNode = dep.type.startsWith("CONFLUENCE")
      ? dep.body.interference[1]
      : dep.body.interference[dep.body.interference.length - 1];
    let cfNode = dep.type.startsWith("CONFLUENCE") ? dep.body.interference[dep.body.interference.length - 1] : null;

    firstNode.location.file = file0;
    firstNode.location.line = stackTrace0.line;
    firstNode.location.class = stackTrace0.class;
    lastNode.location.file = fileN;
    lastNode.location.line = stackTraceN.line;
    lastNode.location.class = stackTraceN.class;
    if (cfNode && stackTraceCF) {
      cfNode.location.file = fileCF;
      cfNode.location.line = stackTraceCF.line;
      cfNode.location.class = stackTraceCF.class;
    }

    return dep;
  } else {
    const newDep = structuredClone(dep);

    let firstNode = newDep.body.interference[0];
    let lastNode = newDep.type.startsWith("CONFLUENCE")
      ? newDep.body.interference[1]
      : newDep.body.interference[dep.body.interference.length - 1];
    let cfNode = newDep.type.startsWith("CONFLUENCE") ? newDep.body.interference[dep.body.interference.length - 1] : null;

    firstNode.location.file = file0;
    firstNode.location.line = stackTrace0.line;
    firstNode.location.class = stackTrace0.class;
    lastNode.location.file = fileN;
    lastNode.location.line = stackTraceN.line;
    lastNode.location.class = stackTraceN.class;
    if (cfNode && stackTraceCF) {
      cfNode.location.file = fileCF;
      cfNode.location.line = stackTraceCF.line;
      cfNode.location.class = stackTraceCF.class;
    }

    return newDep;
  }
};

export { filterDuplicatedDependencies, updateLocationFromStackTrace };
