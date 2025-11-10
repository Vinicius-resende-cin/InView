import { dependency } from "@src/models/AnalysisOutput";
import { getDiffLine } from "../components/Diff/diff-navigation";
import { Node } from "../components/Graph/Node";
import { updateLocationFromStackTrace } from "../components/dependencies";

export function extractNodesFromDependency(dep: dependency): {
  L: Node;
  R: Node;
  CF?: Node;
} {
  let fileFrom, lineFrom, fileTo, lineTo, cfLine, cfFileName = "";

  if (dep.type.startsWith("CONFLUENCE")) {
    const sourceOne = dep.body.interference.find(el => el.type === "source1");
    const sourceTwo = dep.body.interference.find(el => el.type === "source2");
    const confluence = dep.body.interference.find(el => el.type === "confluence");

    if (!sourceOne || !sourceTwo || !confluence) {
      throw new Error("Missing interference elements: source1, source2, or confluence.");
    }

    fileFrom = sourceOne.location.file.replaceAll("\\", "/");
    lineFrom = sourceOne;
    fileTo = sourceTwo.location.file.replaceAll("\\", "/");
    lineTo = sourceTwo;
    cfLine = confluence;
    cfFileName = confluence.location.file.replaceAll("\\", "/");
  } else {
    fileFrom = dep.body.interference[0].location.file.replaceAll("\\", "/"); // first filename
    lineFrom = dep.body.interference[0]; // first line
    fileTo = dep.body.interference[dep.body.interference.length - 1].location.file.replaceAll("\\", "/"); // last filename
    lineTo = dep.body.interference[dep.body.interference.length - 1]; //last line
  }

  // if the filename is unknown, try to get the first valid one from the stack trace
  if (fileFrom === "UNKNOWN" || fileTo === "UNKNOWN") {
    updateLocationFromStackTrace(dep, { inplace: true });
    fileFrom = dep.body.interference[0].location.file.replaceAll("\\", "/");
    fileTo = dep.type.startsWith("CONFLUENCE")
      ? dep.body.interference[1].location.file.replaceAll("\\", "/")
      : dep.body.interference[dep.body.interference.length - 1].location.file.replaceAll("\\", "/");
  }

  const L_Lines: string[] = [];
  const R_Lines: string[] = [];
  let leftRow, rightRow;

  for (let i = -1; i <= 1; i++) {
    leftRow = getDiffLine(fileFrom, lineFrom.location.line + i);
    rightRow = getDiffLine(fileTo, lineTo.location.line + i);

    const leftText = leftRow.querySelector(".d2h-code-line-ctn")?.textContent;
    const rightText = rightRow.querySelector(".d2h-code-line-ctn")?.textContent;

    L_Lines.push(leftText || "");
    R_Lines.push(rightText || "");
  }

  const L = new Node(fileFrom, L_Lines, lineFrom.location.line, "", false, true, false);
  const R = new Node(fileTo, R_Lines, lineTo.location.line, "", false, true, false);

  const result = { L, R } as { L: Node; R: Node; CF?: Node };

  return result;
}
