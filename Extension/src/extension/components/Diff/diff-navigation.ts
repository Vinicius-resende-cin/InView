import { interferenceNode, modLine } from "../../../models/AnalysisOutput";

const fadeOutBorder = (diffLine: HTMLElement) => {
  diffLine.classList.add("pl-fadeout-border");
};

const highlight = (diffLine: HTMLElement) => {
  // remove previous highlight if exists
  diffLine.classList.remove("pl-line-highlight");
  diffLine.classList.remove("pl-fadeout-border");

  // add the highlight class
  diffLine.classList.add("pl-line-highlight");

  // add the fade out effect
  diffLine.addEventListener(
    "mouseover",
    () => {
      fadeOutBorder(diffLine);
    },
    { once: true }
  );

  // remove the highlight class after the fade out effect
  diffLine.addEventListener("animationend", (event) => {
    if (event.animationName === "fadeOutBorder") {
      diffLine.classList.remove("pl-line-highlight");
      diffLine.classList.remove("pl-fadeout-border");
    }
  });
};

const removeHighlight = (diffLine: HTMLElement) => {
  diffLine.classList.remove("pl-line-highlight");
};

const scrollAndHighlight = (diffLine: HTMLElement) => {
  highlight(diffLine);
  diffLine.scrollIntoView({ block: "center" });
};

const setColorFromBranch = (diffLine: HTMLElement, branch: "L" | "R", colorType: "ins" | "del") => {
  // set the color for all childs
  diffLine.querySelectorAll("td").forEach((td) => {
    td.classList.add(`d2h-${colorType}${branch === "L" ? "-left" : ""}`);
  });
};

const removeLineColor = (diffLine: HTMLElement, modifiedLines?: modLine[]) => {
  if (modifiedLines) {
    const file = diffLine.id.split(":")[0];
    const line = parseInt(diffLine.id.split(":")[1]);

    const fileModifiedLines = modifiedLines.find((ml) => ml.file.endsWith(file) || file.endsWith(ml.file));
    if (!fileModifiedLines) return;

    if (
      fileModifiedLines.leftAdded.includes(line) ||
      fileModifiedLines.rightAdded.includes(line) ||
      fileModifiedLines.leftRemoved.includes(line) ||
      fileModifiedLines.rightRemoved.includes(line)
    ) {
      console.info(`Line ${line} of file ${file} was modified, the color will be maintained`);
      return;
    }
  }

  diffLine.querySelectorAll("td").forEach((td) => {
    td.classList.remove("d2h-ins-left");
    td.classList.remove("d2h-ins");
    td.classList.remove("d2h-del-left");
    td.classList.remove("d2h-del");
  });
};

const checkLineModificationType = (file: string, line: number) => {
  // get the diffLine element
  let diffLine = getDiffLine(file, line);

  // get child element (that contains the line style)
  diffLine = diffLine.querySelector("td") as HTMLElement;

  // check if the line was added, removed or modified
  if (diffLine.classList.contains("d2h-ins") || diffLine.classList.contains("d2h-ins-left")) return "ins";
  else if (diffLine.classList.contains("d2h-del") || diffLine.classList.contains("d2h-del-left")) return "del";
  else if (diffLine.classList.contains("d2h-change")) return "change";
  else return null;
};

type sourceBranch = {
  branch: "L" | "R";
  lineType: "del" | "ins";
};

const findSourceBranch: (node: interferenceNode, modifiedLines: modLine[]) => sourceBranch | null = (
  node: interferenceNode,
  modifiedLines: modLine[]
) => {
  // get the filename of the first node in the stack trace
  const firstNodeFromFile = node.stackTrace?.[0].class.split(".").pop() + ".java";
  if (!firstNodeFromFile) return null;

  // get the line number of the first node in the stack trace
  const firstNodeFromLine = node.stackTrace?.[0].line;
  if (!firstNodeFromLine) return null;

  // check if the node has already a set branch
  let branch: "L" | "R" | null = null;
  if (node.branch) {
    branch = node.branch;
  } else {
    // check if the line is in the modified lines
    const fileModifiedLines = modifiedLines.find(
      (ml) => ml.file.endsWith(firstNodeFromFile) || firstNodeFromFile.endsWith(ml.file)
    );
    if (!fileModifiedLines) return null;

    if (
      fileModifiedLines.leftAdded.includes(firstNodeFromLine) ||
      fileModifiedLines.leftRemoved.includes(firstNodeFromLine)
    )
      branch = "L";
    else if (
      fileModifiedLines.rightAdded.includes(firstNodeFromLine) ||
      fileModifiedLines.rightRemoved.includes(firstNodeFromLine)
    )
      branch = "R";
    else return null;
  }

  // check if the line was added or removed
  const lineType: "ins" | "del" | "change" | null = checkLineModificationType(firstNodeFromFile, firstNodeFromLine);
  if (!lineType) return null;

  return { branch, lineType: lineType === "change" ? "ins" : lineType };
};

const setAsConflictLine = (diffLine: HTMLElement, srcBranch: sourceBranch | null) => {
  // set the colors of the lines
  if (srcBranch) setColorFromBranch(diffLine, srcBranch.branch, srcBranch.lineType);
  else highlight(diffLine);

  // set the conflict line class
  diffLine.classList.add("pl-conflict-line");

  // change the left line number
  const leftLineNumber = diffLine.querySelector(".line-num1") as HTMLElement;
  leftLineNumber.setAttribute("prev-text", leftLineNumber.textContent || "");
  leftLineNumber.textContent = " →";
};

const unsetAsConflictLine = (diffLine: HTMLElement, modifiedLines: modLine[]) => {
  // remove styles
  removeLineColor(diffLine, modifiedLines);
  removeHighlight(diffLine);
  diffLine.classList.remove("pl-conflict-line");

  // remove event listeners
  diffLine.onclick = null;

  // change back the left line number
  const leftLineNumber = diffLine.querySelector(".line-num1") as HTMLElement;
  leftLineNumber.textContent = leftLineNumber.getAttribute("prev-text") || "";
  leftLineNumber.removeAttribute("prev-text");
};

const getDiffLine = (file: string, line: number) => {
  // try to get the line element by id
  let lineElement = document.getElementById(`${file}:${line}`);
  if (lineElement) return lineElement;

  // if not found, search for the line in the diff
  const diffContainer = document.getElementById("diff-container");
  const diffFiles = diffContainer?.querySelectorAll(".d2h-file-wrapper");
  if (!diffContainer || !diffFiles) throw new Error("Diff not found");

  // get the diff element of the file
  const diffContent = Array.from(diffFiles).filter((diffFile) => {
    const fileName = diffFile.querySelector(".d2h-file-name")?.textContent?.replace(/\.java$/, "");
    return fileName?.endsWith(file.replace(/\.java$/, ""));
  })[0];
  if (!diffContent) throw new Error(`Diff not found for file ${file}`);

  // get the line element
  const allLines = diffContent.querySelectorAll(`tr`);
  lineElement = Array.from(allLines).filter((l) => {
    const lineNumber = l.querySelector(".line-num2")?.textContent;
    return lineNumber === line.toString();
  })[0];
  if (!lineElement) throw new Error(`Line ${line} not found in file ${file}`);

  // set the id and return
  lineElement.id = `${file}:${line}`;
  return lineElement;
};

const gotoDiffConflict = (
  file1: string,
  file2: string,
  l1: interferenceNode,
  l2: interferenceNode,
  modifiedLines: modLine[]
) => {
  // get the first and last lines of the conflict
  const lineFrom = getDiffLine(file1, l1.location.line);
  const lineTo = getDiffLine(file2, l2.location.line);

  // get the source branch for each line
  const sourceBranchFrom = findSourceBranch(l1, modifiedLines);
  const sourceBranchTo = findSourceBranch(l2, modifiedLines);

  // set the conflict line style
  setAsConflictLine(lineFrom, sourceBranchFrom);
  setAsConflictLine(lineTo, sourceBranchTo);

  // set navigation between both lines
  lineFrom.onclick = () => {
    removeHighlight(lineFrom);
    scrollAndHighlight(lineTo);
  };
  lineTo.onclick = () => {
    removeHighlight(lineTo);
    scrollAndHighlight(lineFrom);
  };

  scrollAndHighlight(lineFrom);

  return [lineFrom, lineTo];
};

export {
  gotoDiffConflict,
  highlight,
  removeHighlight,
  setAsConflictLine,
  unsetAsConflictLine,
  removeLineColor,
  scrollAndHighlight,
  getDiffLine
};
