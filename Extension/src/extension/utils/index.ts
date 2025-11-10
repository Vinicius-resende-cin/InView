import { modLine } from "models/AnalysisOutput";
import { Node } from "@extension/components/Graph/Node";

const ensureJavaExtension = (fileName: string): string => {
  if (fileName.endsWith(".java")) {
    return fileName;
  }
  return fileName + ".java";
};

const getClassFromJavaFilename = (filename: string): string | undefined => {
  if (!filename.endsWith(".java")) return filename.split("/").pop();
  return filename
    .substring(0, filename.length - 5)
    .split("/")
    .pop();
};

const getMethodNameFromJavaMethod = (methodName: string): string | undefined => {
  const result = methodName.split(" ").pop()?.replace(">", "").trim();
  return result?.endsWith(")") ? result : `${result}()`;
};

const isLineFromLeft = (lines: Node[], modlines: modLine[]): boolean => {
  return lines.some((line) =>
    modlines.some(
      (modLine) =>
        getClassFromJavaFilename(modLine.file) === getClassFromJavaFilename(line.fileName) &&
        (modLine.leftAdded.includes(line.numberHighlight) || modLine.leftRemoved.includes(line.numberHighlight))
    )
  );
};

function areArraysEqual(arr1: any[], arr2: any[]) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

export { getClassFromJavaFilename, getMethodNameFromJavaMethod, isLineFromLeft, areArraysEqual, ensureJavaExtension };