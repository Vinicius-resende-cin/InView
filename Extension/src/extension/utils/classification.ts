/**
 * Core utility functions for conflict classification pipeline.
 * Ported from Python conflict_processor.py and related modules.
 */

import type {
  ClassificationResult,
  FrameInfo,
  ModifiedLinesMap,
  OAType,
  DFType,
  CFType,
  ConflictType,
} from "../models/Classification";

/**
 * Normalize a file reference (path, filename, or class name) into a canonical key.
 * Used for comparing files across different representations.
 *
 * Rules (in order):
 * 1. If falsy → return undefined
 * 2. If has known extension or contains path separators → extract filename without extension
 * 3. If contains '.' but no separators → extract last component (qualified class name)
 * 4. Otherwise → extract filename without extension
 *
 * Examples:
 * - "com/example/Foo.java" → "Foo"
 * - "com.example.Foo" → "Foo"
 * - "Foo.java" → "Foo"
 * - "Bar" → "Bar"
 */
export function normalizeFileKey(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const knownExtensions = [
    ".java",
    ".py",
    ".kt",
    ".scala",
    ".js",
    ".ts",
    ".c",
    ".cpp",
    ".h",
    ".cs",
  ];

  // Check if has known extension or contains path separators
  const hasExtension = knownExtensions.some((ext) => value.includes(ext));
  const hasPathSeparator = value.includes("/") || value.includes("\\");

  if (hasExtension || hasPathSeparator) {
    // Extract filename and remove extension
    const filename = value.split(/[\/\\]/).pop() || value;
    return filename.replace(/\.[^.]+$/, "");
  }

  // Check if it's a qualified class name (contains '.' but no path separators)
  if (value.includes(".") && !hasPathSeparator) {
    // Extract last component after final '.'
    return value.split(".").pop();
  }

  // Fallback: remove extension if present, return as-is
  return value.replace(/\.[^.]+$/, "");
}

/**
 * Normalize a file path by standardizing separators and removing redundant prefixes.
 *
 * Rules:
 * - Replace backslashes with forward slashes
 * - Remove leading './'
 * - Remove leading '/'
 */
export function normalizeFilePath(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  return path
    .replace(/\\/g, "/") // Replace backslashes
    .replace(/^\.\/+/, "") // Remove leading ./
    .replace(/^\/+/, ""); // Remove leading /
}

/**
 * Extract an ordered list of frames from an interference node's stack trace.
 *
 * Each frame contains:
 * - fileKey: normalized file identifier
 * - line: line number (non-negative)
 * - frame: original frame object
 *
 * Skips:
 * - Frames with missing or invalid line numbers
 * - Frames with no resolvable file key
 * - Consecutive duplicate (fileKey, line) pairs
 *
 * After processing stack trace, also tries to add the node's location.file
 * as a final frame if it differs from the last appended frame.
 */
export function getFramesWithLines(
  interferenceNode: any,
  options?: { normalized?: boolean }
): FrameInfo[] {
  const frames: FrameInfo[] = [];
  const seenPairs = new Set<string>(); // Track (fileKey, line) pairs to avoid duplicates

  const stackTrace: {class: string; method: string; line: number;}[] = interferenceNode.stackTrace || [];
  const location = interferenceNode.location

  // verify if location is present on stack trace and add if not
  let isPresent = false;
  for (let n of stackTrace) {
    if (normalizeFileKey(n.class) === normalizeFileKey(location.class) &&
        n.line === location.line) {
          isPresent = true;
          break;
        }
  }

  if (!isPresent) {
    stackTrace.push({class: location.class, method: location.method, line: location.line});
  }

  // Process stack trace frames
  for (const frame of stackTrace) {
    // Extract line number
    const line = frame.line ?? frame.location?.line;
    if (line === undefined || line === null || line < 0 || isNaN(line)) {
      continue;
    }

    // Extract file key from various possible locations
    let fileKey: string | undefined;
    if (frame.file) {
      fileKey = normalizeFileKey(frame.file);
    } else if (frame.location?.file) {
      fileKey = normalizeFileKey(frame.location.file);
    } else if (frame.class) {
      fileKey = normalizeFileKey(frame.class);
    } else if (frame.location?.class) {
      fileKey = normalizeFileKey(frame.location.class);
    }

    if (!fileKey) {
      continue;
    }

    // Skip consecutive duplicate (fileKey, line) pairs
    const pair = `${fileKey}:${line}`;
    if (seenPairs.has(pair)) {
      continue;
    }

    seenPairs.add(pair);
    frames.push({
      fileKey,
      line,
      frame,
    });
  }

  // Try to add node's location as final frame if different from last
  const locationFile = interferenceNode.location?.file;
  const locationLine = interferenceNode.location?.line;

  if (
    locationFile &&
    locationLine !== undefined &&
    locationLine !== null &&
    locationLine >= 0 &&
    !isNaN(locationLine)
  ) {
    const locFileKey = normalizeFileKey(locationFile);
    if (locFileKey) {
      const lastFrame = frames[frames.length - 1];
      if (!lastFrame || lastFrame.fileKey !== locFileKey || lastFrame.line !== locationLine) {
        frames.push({
          fileKey: locFileKey,
          line: locationLine,
          frame: interferenceNode.location,
        });
      }
    }
  }

  return frames;
}

/**
 * Convert a list of frames to an ordered list of unique consecutive file keys.
 *
 * Collapses consecutive duplicate file keys.
 *
 * Example:
 * [("A", 10), ("A", 20), ("B", 5), ("B", 15)] → ["A", "B"]
 */
export function framesToFiles(frames: FrameInfo[]): string[] {
  const files: string[] = [];

  for (const frame of frames) {
    // Add if list is empty or different from last
    if (files.length === 0 || files[files.length - 1] !== frame.fileKey) {
      files.push(frame.fileKey);
    }
  }

  return files;
}

/**
 * Same collapsing rule as framesToFiles, but keeps the representative FrameInfo
 * (with its line number and raw frame) for each unique consecutive file instead
 * of just the file key. This is what lets graph rendering build nodes directly
 * from classification's file sequence instead of re-deriving locations elsewhere.
 */
export function framesToRepresentativeFrames(frames: FrameInfo[]): FrameInfo[] {
  const result: FrameInfo[] = [];

  for (const frame of frames) {
    if (result.length === 0 || result[result.length - 1].fileKey !== frame.fileKey) {
      result.push(frame);
    }
  }

  return result;
}

/**
 * Reduce a representative-frame sequence for classification purposes.
 * Mirrors filesForClassification, but on FrameInfo so line numbers survive.
 */
export function framesForClassification(framesFull: FrameInfo[]): FrameInfo[] {
  if (framesFull.length <= 2) {
    return framesFull;
  }

  const reduced = [framesFull[0], framesFull[framesFull.length - 1]];

  if (reduced[0].fileKey === reduced[1].fileKey) {
    return [reduced[0]];
  }

  return reduced;
}

/**
 * Reduce a file list for classification purposes.
 *
 * Rules:
 * - If ≤ 2 files: return as-is
 * - If > 2 files: return [first, last]
 * - If first == last (after reduction): return [first]
 */
export function filesForClassification(filesFull: string[]): string[] {
  if (filesFull.length <= 2) {
    return filesFull;
  }

  // Keep only first and last
  const reduced = [filesFull[0], filesFull[filesFull.length - 1]];

  // If they're the same, keep only one
  if (reduced[0] === reduced[1]) {
    return [reduced[0]];
  }

  return reduced;
}

/**
 * Check if a line number appears in any modified lines entry.
 * Used to determine if a frame belongs to the modified code.
 */
export function isLineModified(
  line: number,
  filePath: string,
  modifiedLines: ModifiedLinesMap | undefined
): boolean {
  if (!modifiedLines) {
    return true; // If no modified lines info, assume all are modified
  }

  const entry = modifiedLines[filePath];
  if (!entry) {
    return false;
  }

  const allModifiedLines = [
    ...entry.leftAdded,
    ...entry.leftRemoved,
    ...entry.rightAdded,
    ...entry.rightRemoved,
  ];

  return allModifiedLines.includes(line);
}

/**
 * Determine which branch owns a given file/line combination.
 * Returns 'L' for left, 'R' for right, or undefined if ambiguous.
 */
export function determineOwner(
  line: number,
  filePath: string,
  modifiedLines: ModifiedLinesMap | undefined
): "L" | "R" | undefined {
  if (!modifiedLines) {
    return undefined;
  }

  const entry = modifiedLines[filePath];
  if (!entry) {
    return undefined;
  }

  const inLeft = [
    ...entry.leftAdded,
    ...entry.leftRemoved,
  ].includes(line);
  const inRight = [
    ...entry.rightAdded,
    ...entry.rightRemoved,
  ].includes(line);

  if (inLeft && !inRight) {
    return "L";
  }
  if (inRight && !inLeft) {
    return "R";
  }

  return undefined;
}

/**
 * Determine which branch (L/R) owns an interference node, resolving its own location and
 * its stack-trace frames against the modified-lines map. Returns undefined when no
 * modified-lines info is available or no frame lands on an owned line.
 */
function determineStackOwner(frames: FrameInfo[], interf: any, modifiedLines: ModifiedLinesMap | undefined) {
  if (!modifiedLines || frames.length === 0) {
    return undefined;
  }

  let owner: "L" | "R" | undefined;

  const thisLine = interf.location?.line;
  const thisFileKey =
    normalizeFileKey(interf.location?.file) ??
    normalizeFileKey(interf.location?.class);

  if (thisFileKey && thisLine !== undefined) {
    owner = determineOwner(thisLine, thisFileKey, modifiedLines);
  }

  // Stack trace-based ownership (fallback)
  for (const frame of frames) {
    const frameOwner = determineOwner(frame.line, frame.fileKey, modifiedLines);
    if (frameOwner) {
      owner = frameOwner;
      break;
    }
  }

  return owner;
}

/**
 * Find the closest modified line to a given reference line.
 * Returns the distance to the closest modified line.
 * Used for breaking ties in Rule 2 (duplicate last frame removal).
 */
export function closestModifiedDistance(
  lines: number[],
  modifiedLines: ModifiedLinesMap | undefined
): number {
  if (!modifiedLines) {
    return Infinity;
  }

  const allModified = new Set<number>();
  Object.values(modifiedLines).forEach((entry) => {
    [...entry.leftAdded, ...entry.leftRemoved, ...entry.rightAdded, ...entry.rightRemoved].forEach(
      (line) => allModified.add(line)
    );
  });

  if (allModified.size === 0) {
    return Infinity;
  }

  // Find minimum distance from any line to nearest modified line
  let minDistance = Infinity;
  for (const line of lines) {
    for (const modLine of allModified) {
      const dist = Math.abs(line - modLine);
      minDistance = Math.min(minDistance, dist);
    }
  }

  return minDistance;
}

/**
 * Rule 1: Find the start index in a frame list.
 *
 * Trim the stack to start from the first frame that was modified by the branch
 * that owns this interference node. This removes "shared boilerplate" frames.
 *
 * Steps:
 * 1. Determine owner via location-based check (file/line in modifiedLines)
 * 2. If indeterminate, check stack trace frames
 * 3. Default to 'L' if still unclear
 * 4. Find first frame in owner's modified lines, return that index
 */
export function findStartIndex(
  frames: FrameInfo[],
  modifiedLines: ModifiedLinesMap | undefined,
  owner: "L" | "R"
): number {
  if (!modifiedLines || frames.length === 0) {
    return 0;
  }

  // Find first frame in owner's modified lines
  for (let i = 0; i < frames.length; i++) {
    const frameOwner = determineOwner(frames[i].line, frames[i].fileKey, modifiedLines);
    if (frameOwner === owner) {
      return i;
    }
  }

  return 0;
}

/**
 * Rule 2: Filter duplicate last frames.
 *
 * When both left and right frame lists end with the same (fileKey, line) pair,
 * remove it from the side that does not own it to avoid ambiguity.
 *
 * Returns: [leftFrames, rightFrames, error]
 */
export function filterDuplicateLastFrames(
  leftFrames: FrameInfo[],
  rightFrames: FrameInfo[],
  lowner: "L" | "R",
  rowner: "L" | "R",
  modifiedLines: ModifiedLinesMap | undefined
): [FrameInfo[], FrameInfo[], string | undefined] {
  // If either list is empty or last frames differ, return as-is
  if (leftFrames.length === 0 || rightFrames.length === 0) {
    return [leftFrames, rightFrames, undefined];
  }

  const lastLeft = leftFrames[leftFrames.length - 1];
  const lastRight = rightFrames[rightFrames.length - 1];

  if (lastLeft.fileKey !== lastRight.fileKey || lastLeft.line !== lastRight.line) {
    return [leftFrames, rightFrames, undefined];
  }

  // Frames have same last (fileKey, line) - determine owner
  const owner = determineOwner(lastLeft.line, lastLeft.fileKey, modifiedLines);

  if (owner === lowner) {
    // Left owns it, remove from right
    return [leftFrames, rightFrames.slice(0, -1), undefined];
  } else if (owner === rowner) {
    // Right owns it, remove from left
    return [leftFrames.slice(0, -1), rightFrames, undefined];
  }

  // Owner is ambiguous - use modified-line distance heuristic
  if (!modifiedLines) {
    // No modified lines info - error
    return [
      leftFrames,
      rightFrames,
      "unmodified_stack_trace",
    ];
  }

  const leftDistance = closestModifiedDistance(
    leftFrames.map((f) => f.line),
    modifiedLines
  );
  const rightDistance = closestModifiedDistance(
    rightFrames.map((f) => f.line),
    modifiedLines
  );

  // Check if any frames are modified
  if (leftDistance === Infinity && rightDistance === Infinity) {
    return [
      leftFrames,
      rightFrames,
      "unmodified_stack_trace",
    ];
  }

  // Remove from the side with greater distance
  if (leftDistance > rightDistance) {
    return [leftFrames.slice(0, -1), rightFrames, undefined];
  } else if (rightDistance > leftDistance) {
    return [leftFrames, rightFrames.slice(0, -1), undefined];
  }

  // Distances are equal - use length as tie-breaker
  if (leftFrames.length > rightFrames.length) {
    return [leftFrames.slice(0, -1), rightFrames, undefined];
  } else if (rightFrames.length > leftFrames.length) {
    return [leftFrames, rightFrames.slice(0, -1), undefined];
  }

  // Ambiguous - both sides identical
  return [
    leftFrames,
    rightFrames,
    "ambiguous_duplicate_last_frame",
  ];
}

/**
 * Result of processing an interference pair (OA/DF): the extracted file sequences
 * (full and reduced-for-classification), their representative frames, and any error.
 */
export interface ProcessedInterferencePair {
  leftFilesFull: string[];
  rightFilesFull: string[];
  leftFilesForClass: string[];
  rightFilesForClass: string[];
  /** Representative frame (file + line) for each entry in leftFilesFull, in order. */
  leftFrames: FrameInfo[];
  /** Representative frame (file + line) for each entry in rightFilesFull, in order. */
  rightFrames: FrameInfo[];
  error?: string;
}

/**
 * Main pipeline for OA/DF conflicts.
 *
 * Given two interference nodes, produce the file sequences used for classification.
 *
 * Steps (in execution order):
 * 1. Extract frames from both nodes
 * 2. Check for unmodified stack trace error
 * 3. Apply Rule 1 to trim frames (ownership + start-index)
 * 4. Apply Rule 2 to remove duplicate last frames
 * 5. Check for symmetric (identical) stacks error
 * 6. Build full and classification file lists
 */
export function processInterferencePair(
  leftInterf: any,
  rightInterf: any,
  modifiedLines: ModifiedLinesMap | undefined
): ProcessedInterferencePair {
  // Step 1: Extract frames
  let leftFrames = getFramesWithLines(leftInterf);
  let rightFrames = getFramesWithLines(rightInterf);

  // Step 2: Unmodified stack trace check
  if (modifiedLines && Object.keys(modifiedLines).length > 0) {
    const leftHasModified = leftFrames.some((f) =>
      isLineModified(f.line, f.fileKey, modifiedLines)
    );
    const rightHasModified = rightFrames.some((f) =>
      isLineModified(f.line, f.fileKey, modifiedLines)
    );

    if (!leftHasModified || !rightHasModified) {
      return {
        leftFilesFull: [],
        rightFilesFull: [],
        leftFilesForClass: [],
        rightFilesForClass: [],
        leftFrames: [],
        rightFrames: [],
        error: "unmodified_stack_trace",
      };
    }
  }

  // Step 3: Apply Rule 1 (start index trimming)
  const lowner = determineStackOwner(leftFrames, leftInterf, modifiedLines);
  if (!lowner) {
    return {
      leftFilesFull: [],
      rightFilesFull: [],
      leftFilesForClass: [],
      rightFilesForClass: [],
      leftFrames: [],
      rightFrames: [],
      error: "invalid_ownership",
    };
  }

  const rowner = lowner === "L" ? "R" : "L";
                    
  const lstart = findStartIndex(leftFrames, modifiedLines, lowner);
  const rstart = findStartIndex(rightFrames, modifiedLines, rowner);
  leftFrames = leftFrames.slice(lstart);
  rightFrames = rightFrames.slice(rstart);

  // Step 4: Apply Rule 2 (duplicate last frame removal)
  const [leftFiltered, rightFiltered, rule2Error] = filterDuplicateLastFrames(
    leftFrames,
    rightFrames,
    lowner,
    rowner,
    modifiedLines
  );

  if (rule2Error) {
    return {
      leftFilesFull: [],
      rightFilesFull: [],
      leftFilesForClass: [],
      rightFilesForClass: [],
      leftFrames: [],
      rightFrames: [],
      error: rule2Error,
    };
  }

  // Step 5: Symmetric check
  const leftPairs = leftFiltered.map((f) => `${f.fileKey}:${f.line}`);
  const rightPairs = rightFiltered.map((f) => `${f.fileKey}:${f.line}`);
  if (
    leftPairs.length === rightPairs.length &&
    leftPairs.every((p, i) => p === rightPairs[i])
  ) {
    return {
      leftFilesFull: [],
      rightFilesFull: [],
      leftFilesForClass: [],
      rightFilesForClass: [],
      leftFrames: [],
      rightFrames: [],
      error: "symmetric_modified_lines",
    };
  }

  // Step 6: Build file lists
  const leftFilesFull = framesToFiles(leftFiltered);
  const rightFilesFull = framesToFiles(rightFiltered);
  const leftFilesForClass = filesForClassification(leftFilesFull);
  const rightFilesForClass = filesForClassification(rightFilesFull);
  const leftRepFrames = framesToRepresentativeFrames(leftFiltered);
  const rightRepFrames = framesToRepresentativeFrames(rightFiltered);

  return {
    leftFilesFull,
    rightFilesFull,
    leftFilesForClass,
    rightFilesForClass,
    leftFrames: leftRepFrames,
    rightFrames: rightRepFrames,
  };
}

/**
 * OA-specific entry point for conflict processing.
 *
 * For OA conflicts, the two nodes are simply:
 * - left: interference[0]
 * - right: interference[-1]
 */
export function processOAConflict(
  dependency: any,
  modifiedLines: ModifiedLinesMap | undefined
): ProcessedInterferencePair {
  const interference = dependency.body?.interference || [];
  if (interference.length < 2) {
    return {
      leftFilesFull: [],
      rightFilesFull: [],
      leftFilesForClass: [],
      rightFilesForClass: [],
      leftFrames: [],
      rightFrames: [],
      error: "insufficient_interference_nodes",
    };
  }

  const leftInterf = interference[0];
  const rightInterf = interference[interference.length - 1];

  return processInterferencePair(leftInterf, rightInterf, modifiedLines);
}

/**
 * Select the Source/Sink interference nodes for a DF conflict.
 *
 * This is the single source of truth for "which nodes represent a DF conflict's
 * endpoints" - used both by classification (processDFConflict) and by the graph
 * rendering pipeline (buildNodesFromClassification), so the two can never disagree
 * about which nodes they're looking at.
 *
 * - left (Source): first node with "source" in type, fallback to first node
 * - right (Sink): last node with "sink" in type, fallback to last node
 */
export function selectDFNodes(dependency: any): { sourceNode: any; sinkNode: any } | undefined {
  const interference = dependency.body?.interference || [];
  if (interference.length < 2) {
    return undefined;
  }

  // Find Source node (first with "source" in type)
  let sourceNode = interference.find((node: any) =>
    (node.type || "").toLowerCase().includes("source")
  );
  if (!sourceNode) {
    sourceNode = interference[0];
  }

  // Find Sink node (last with "sink" in type, scanning in reverse)
  let sinkNode: any = null;
  for (let i = interference.length - 1; i >= 0; i--) {
    if ((interference[i].type || "").toLowerCase().includes("sink")) {
      sinkNode = interference[i];
      break;
    }
  }
  if (!sinkNode) {
    sinkNode = interference[interference.length - 1];
  }

  return { sourceNode, sinkNode };
}

/**
 * DF-specific entry point for conflict processing.
 *
 * For DF conflicts, we select:
 * - left (Source): first node with "Source" in type, fallback to first node
 * - right (Sink): last node with "Sink" in type, fallback to last node
 */
export function processDFConflict(
  dependency: any,
  modifiedLines: ModifiedLinesMap | undefined
): ProcessedInterferencePair {
  const selected = selectDFNodes(dependency);
  if (!selected) {
    return {
      leftFilesFull: [],
      rightFilesFull: [],
      leftFilesForClass: [],
      rightFilesForClass: [],
      leftFrames: [],
      rightFrames: [],
      error: "insufficient_interference_nodes",
    };
  }

  return processInterferencePair(selected.sourceNode, selected.sinkNode, modifiedLines);
}

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classify a 1×1 case: both left and right have single file.
 *
 * If left[0] == right[0]: OA_A1 (same file)
 * Else: OA_A2 (different files)
 */
function _classify_1_1(left: string[], right: string[]): OAType {
  if (left[0] === right[0]) {
    return "OA_A1";
  }
  return "OA_A2";
}

/**
 * Classify a 1×2 case: left has 1 file, right has 2 files.
 *
 * Rules:
 * - If left[0] == right[0] AND left[0] != right[1]: OA_B2
 * - If left[0] == right[1]: OA_C2
 * - Else: OA_A3
 */
function _classify_1_2(left: string[], right: string[]): OAType {
  const sameStart = left[0] === right[0];
  const sameEnd = left[0] === right[1];

  if (sameStart && !sameEnd) {
    return "OA_B2";
  }
  if (sameEnd) {
    return "OA_C2";
  }
  return "OA_A3";
}

/**
 * Classify a 2×1 case: left has 2 files, right has 1 file.
 * Symmetric to 1×2 case.
 */
function _classify_2_1(left: string[], right: string[]): OAType {
  const sameStart = left[0] === right[0];
  const sameEnd = left[1] === right[0];

  if (sameStart && !sameEnd) {
    return "OA_B2";
  }
  if (sameEnd) {
    return "OA_C2";
  }
  return "OA_A3";
}

/**
 * Classify a 2×2 case: both left and right have 2 files.
 *
 * Evaluation order is CRITICAL (see CONFLICT_CLASSIFICATION.md):
 * 1. Check left[1] == right[1] (same last file)
 * 2. Check left[0] == right[0] (same start file)
 * 3. Check E2 condition: left[0] == right[1] AND left[1] == right[0] (reversed)
 *    MUST come before D3!
 * 4. Check D3 condition: left[1] == right[0] OR left[0] == right[1] (chained)
 * 5. Default to A4
 */
function _classify_2_2(left: string[], right: string[]): OAType {
  // Rule 1: Check if same last file
  if (left[1] === right[1]) {
    // Different starts, same end → B3
    if (left[0] !== right[0]) {
      return "OA_B3";
    }
    // Same start and end → D2
    return "OA_D2";
  }

  // Rule 2: Check if same start file
  if (left[0] === right[0]) {
    // Same start, different ends → C3
    return "OA_C3";
  }

  // Rule 3: Check for E2 (reversed paths) - MUST come before D3!
  if (left[0] === right[1] && left[1] === right[0]) {
    return "OA_E2";
  }

  // Rule 4: Check for D3 (chained paths)
  if (left[1] === right[0] || left[0] === right[1]) {
    return "OA_D3";
  }

  // Rule 5: Default to A4 (all files distinct)
  return "OA_A4";
}

/**
 * Classify an OA conflict based on file sequences.
 *
 * Dispatch by (leftFiles.length, rightFiles.length):
 * - (1, 1) → _classify_1_1
 * - (1, 2) → _classify_1_2
 * - (2, 1) → _classify_2_1
 * - (2, 2) → _classify_2_2
 * - Other → error
 */
export function classifyOA(
  leftFiles: string[],
  rightFiles: string[]
): OAType | `Error: ${string}` {
  const leftLen = leftFiles.length;
  const rightLen = rightFiles.length;

  if (leftLen === 1 && rightLen === 1) {
    return _classify_1_1(leftFiles, rightFiles);
  }
  if (leftLen === 1 && rightLen === 2) {
    return _classify_1_2(leftFiles, rightFiles);
  }
  if (leftLen === 2 && rightLen === 1) {
    return _classify_2_1(leftFiles, rightFiles);
  }
  if (leftLen === 2 && rightLen === 2) {
    return _classify_2_2(leftFiles, rightFiles);
  }

  return `Error: Invalid file sequence combination (${leftLen}×${rightLen})`;
}

/**
 * Classify a DF conflict based on file sequences.
 *
 * Identical to OA classification logic, but with DF_ prefix.
 */
export function classifyDF(
  leftFiles: string[],
  rightFiles: string[]
): DFType | `Error: ${string}` {
  const oaResult = classifyOA(leftFiles, rightFiles);

  if (oaResult.startsWith("Error:")) {
    return oaResult as `Error: ${string}`;
  }

  // Convert OA_ prefix to DF_
  const dfLabel = oaResult.replace(/^OA_/, "DF_");
  return dfLabel as DFType;
}

// ============================================================================
// CF CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Extract file sequence from a CF source node.
 *
 * Steps:
 * 1. Iterate stack trace frames
 * 2. Skip frames with no valid line number
 * 3. Extract file key from frame
 * 4. Deduplicate consecutive same file keys
 * 5. If no frames yield file key, fall back to node's location.file
 */
function _extractFiles(sourceNode: any): string[] {
  const files: string[] = [];

  const stackTrace = sourceNode.stackTrace || [];
  let lastFileKey: string | undefined;

  // Process stack trace frames
  for (const frame of stackTrace as any[]) {
    const line = frame.line ?? frame.location?.line;
    if (line === undefined || line === null || line < 0 || isNaN(line)) {
      continue;
    }

    let fileKey: string | undefined;
    if (frame.file) {
      fileKey = normalizeFileKey(frame.file);
    } else if (frame.location?.file) {
      fileKey = normalizeFileKey(frame.location.file);
    } else if (frame.class) {
      fileKey = normalizeFileKey(frame.class);
    } else if (frame.location?.class) {
      fileKey = normalizeFileKey(frame.location.class);
    }

    if (!fileKey) {
      continue;
    }

    // Add if different from last (deduplicate consecutive)
    if (fileKey !== lastFileKey) {
      files.push(fileKey);
      lastFileKey = fileKey;
    }
  }

  // Fall back to location.file if no frames yielded anything
  if (files.length === 0 && sourceNode.location) {
    const locFileKey =
      normalizeFileKey(sourceNode.location.file) ||
      normalizeFileKey(sourceNode.location.class);
    if (locFileKey) {
      files.push(locFileKey);
    }
  }

  return files;
}

/**
 * Extract confluence file from CF confluence node.
 *
 * Returns only location.file (or location.class), normalized to file key.
 * Single file, not a sequence.
 */
function _extractConfluenceFile(confluenceNode: any): string | undefined {
  if (!confluenceNode.location) {
    return undefined;
  }

  return (
    normalizeFileKey(confluenceNode.location.file) ||
    normalizeFileKey(confluenceNode.location.class)
  );
}

/**
 * Remove stack frames from sources that match the confluence point.
 *
 * Removes any frame from source1/source2 where:
 * - frame.class == confluence.location.class AND
 * - frame.method == confluence.location.method AND
 * - frame.line == confluence.location.line
 *
 * This isolates the "path to confluence" from the confluence point itself.
 */
function _filterConfluenceFrames(
  sourceFrames: FrameInfo[],
  confluenceNode: any
): FrameInfo[] {
  const cfClass = confluenceNode.location?.class;
  const cfMethod = confluenceNode.location?.method;
  const cfLine = confluenceNode.location?.line;

  if (!cfClass || !cfMethod || cfLine === undefined) {
    return sourceFrames;
  }

  return sourceFrames.filter((frame) => {
    const frameClass = frame.frame.class || frame.frame.location?.class;
    const frameMethod = frame.frame.method || frame.frame.location?.method;
    const frameLine = frame.frame.line ?? frame.frame.location?.line;

    // Remove if all three fields match exactly
    if (frameClass === cfClass && frameMethod === cfMethod && frameLine === cfLine) {
      return false; // Filter out this frame
    }

    return true; // Keep this frame
  });
}

/**
 * Reduce a file sequence for CF classification.
 *
 * Rules (same as OA/DF):
 * - If ≤ 2 files: return as-is
 * - If > 2 files: return [first, last]
 * - If first == last: return [first]
 */
function _reduceCFSequence(files: string[]): string[] {
  return filesForClassification(files);
}

/**
 * Interface for processed CF conflict
 */
export interface ProcessedCFConflict {
  source1Files: string[];
  source2Files: string[];
  confluenceFile: string;
  /** Representative frame (file + line) for each entry in source1Files, in order. */
  source1Frames?: FrameInfo[];
  /** Representative frame (file + line) for each entry in source2Files, in order. */
  source2Frames?: FrameInfo[];
  /** The frame (file + line) of the confluence point. */
  confluenceFrame?: FrameInfo;
  error?: string;
}

/**
 * Select the source1/source2/confluence interference nodes for a CF conflict.
 *
 * Single source of truth for "which nodes represent a CF conflict's endpoints",
 * used by classification (processCFConflict). CF graph rendering doesn't consume
 * this yet (buildNodesFromClassification only handles OA/DF), but it's kept
 * separate from processCFConflict so a future CF graph pipeline can reuse it.
 *
 * - source1: node with "source1" in type, fallback to first unassigned
 * - source2: node with "source2" in type, fallback to second unassigned
 * - confluence: node with "confluence" in type, fallback to third unassigned
 */
export function selectCFNodes(
  dependency: any
): { source1Node: any; source2Node: any; confluenceNode: any } | undefined {
  const interference = dependency.body?.interference || [];
  if (interference.length < 3) {
    return undefined;
  }

  // Find nodes by type
  let source1Node = interference.find((node: any) =>
    (node.type || "").toLowerCase().includes("source1")
  );
  let source2Node = interference.find((node: any) =>
    (node.type || "").toLowerCase().includes("source2")
  );
  let confluenceNode = interference.find((node: any) =>
    (node.type || "").toLowerCase().includes("confluence")
  );

  // Fallback to positional if not found by type
  const assigned = new Set<number>();
  if (source1Node) {
    assigned.add(interference.indexOf(source1Node));
  } else {
    source1Node = interference[0];
    assigned.add(0);
  }

  if (source2Node) {
    assigned.add(interference.indexOf(source2Node));
  } else {
    for (let i = 0; i < interference.length; i++) {
      if (!assigned.has(i)) {
        source2Node = interference[i];
        assigned.add(i);
        break;
      }
    }
  }

  if (confluenceNode) {
    assigned.add(interference.indexOf(confluenceNode));
  } else {
    for (let i = 0; i < interference.length; i++) {
      if (!assigned.has(i)) {
        confluenceNode = interference[i];
        break;
      }
    }
  }

  if (!source1Node || !source2Node || !confluenceNode) {
    return undefined;
  }

  return { source1Node, source2Node, confluenceNode };
}

/**
 * CF-specific entry point for conflict processing.
 *
 * Selects the source1, source2, and confluence nodes (via selectCFNodes), then
 * applies CF-specific filtering and reduction to produce the file sequences and
 * representative frames used for classification.
 */
export function processCFConflict(
  dependency: any,
  modifiedLines: ModifiedLinesMap | undefined
): ProcessedCFConflict {
  const selected = selectCFNodes(dependency);

  if (!selected) {
    return {
      source1Files: [],
      source2Files: [],
      confluenceFile: "",
      error: "missing_cf_nodes",
    };
  }

  const { source1Node, source2Node, confluenceNode } = selected;

  // Extract file sequences
  let source1FramesRaw = getFramesWithLines(source1Node);
  let source2FramesRaw = getFramesWithLines(source2Node);

  // Step 1: Filter confluence frames
  let source1Frames = _filterConfluenceFrames(source1FramesRaw, confluenceNode);
  let source2Frames = _filterConfluenceFrames(source2FramesRaw, confluenceNode);

  // Step 2: Modified-line trimming (simplified version of Rule 1)
  if (modifiedLines && Object.keys(modifiedLines).length > 0) {
    // Find first modified frame for source1
    let s1start = 0;
    for (let i = 0; i < source1Frames.length; i++) {
      if (isLineModified(source1Frames[i].line, source1Frames[i].fileKey, modifiedLines)) {
        s1start = i;
        break;
      }
    }
    source1Frames = source1Frames.slice(s1start);

    // Find first modified frame for source2
    let s2start = 0;
    for (let i = 0; i < source2Frames.length; i++) {
      if (isLineModified(source2Frames[i].line, source2Frames[i].fileKey, modifiedLines)) {
        s2start = i;
        break;
      }
    }
    source2Frames = source2Frames.slice(s2start);

    // Check for unmodified error
    if (source1Frames.length === 0 || source2Frames.length === 0) {
      return {
        source1Files: [],
        source2Files: [],
        confluenceFile: "",
        error: "unmodified_stack_trace",
      };
    }
  }

  // Step 3: Build file sequences
  const source1FilesFull = framesToFiles(source1Frames);
  const source2FilesFull = framesToFiles(source2Frames);

  // Check for symmetric error
  const s1Pairs = source1Frames.map((f) => `${f.fileKey}:${f.line}`);
  const s2Pairs = source2Frames.map((f) => `${f.fileKey}:${f.line}`);
  if (s1Pairs.length === s2Pairs.length && s1Pairs.every((p, i) => p === s2Pairs[i])) {
    return {
      source1Files: [],
      source2Files: [],
      confluenceFile: "",
      error: "symmetric_modified_lines",
    };
  }

  // Step 4: Reduce sequences
  const source1FilesReduced = _reduceCFSequence(source1FilesFull);
  const source2FilesReduced = _reduceCFSequence(source2FilesFull);

  // Extract confluence file
  const confluenceFile = _extractConfluenceFile(confluenceNode);
  if (!confluenceFile) {
    return {
      source1Files: [],
      source2Files: [],
      confluenceFile: "",
      error: "missing_confluence_file",
    };
  }

  return {
    source1Files: source1FilesReduced,
    source2Files: source2FilesReduced,
    confluenceFile,
    source1Frames: framesForClassification(framesToRepresentativeFrames(source1Frames)),
    source2Frames: framesForClassification(framesToRepresentativeFrames(source2Frames)),
    confluenceFrame: {
      fileKey: confluenceFile,
      line: confluenceNode.location.line,
      frame: confluenceNode.location,
    },
  };
}

/**
 * Classify a CF conflict based on file sequences.
 *
 * Placeholder implementation: always returns CF_A1. The full 32-type CF
 * classification is not yet implemented.
 *
 * TODO: Implement all 32 CF classification rules per CONFLICT_CLASSIFICATION.md
 */
export function classifyCF(
  source1Files: string[],
  source2Files: string[],
  confluenceFile: string
): CFType | `Error: ${string}` {
  return "CF_A1"; // Temporary: assume all are simple single-file cases for now
}

/**
 * Main entry point for conflict classification.
 *
 * Routes to appropriate classifier based on conflict type:
 * - OA: type contains "OA"
 * - DF: type contains "CONFLICT"
 * - CF: label contains "cf conflict" OR node types include source1/source2/confluence
 *
 * Returns ClassificationResult with all metadata.
 */
/**
 * Last-filter check: the graph's L and R nodes must each sit on a modified line, and on
 * *opposite* sides of the merge - if L is on a line the right branch added/removed, R must
 * be on a line the left branch added/removed (or vice versa). A conflict where both
 * endpoints trace back to the same side isn't a genuine two-sided conflict.
 */
function hasOppositeSideEndpoints(
  leftFrame: FrameInfo | undefined,
  rightFrame: FrameInfo | undefined,
  modifiedLines: ModifiedLinesMap | undefined
): boolean {
  if (!leftFrame || !rightFrame) {
    return false;
  }

  const leftOwner = determineOwner(leftFrame.line, leftFrame.fileKey, modifiedLines);
  const rightOwner = determineOwner(rightFrame.line, rightFrame.fileKey, modifiedLines);

  return !!leftOwner && !!rightOwner && leftOwner !== rightOwner;
}

export function classifyDependency(
  dependency: any,
  modifiedLines: ModifiedLinesMap | undefined
): ClassificationResult {
  try {
    const depType = (dependency.type || "").toUpperCase();
    const depLabel = (dependency.label || "").toLowerCase();
    const interference = dependency.body?.interference || [];

    // Detect CF by label or node types
    const hasCFLabel = depLabel.includes("cf conflict");
    const nodeTypes = new Set(interference.map((n: any) => (n.type || "").toLowerCase()));
    const hasCFNodes = nodeTypes.has("source1") && nodeTypes.has("source2") && nodeTypes.has("confluence");

    // Route to appropriate classifier
    if (hasCFLabel || hasCFNodes) {
      // CF Classification
      const processed = processCFConflict(dependency, modifiedLines);

      if (processed.error) {
        return {
          conflictType: "CF",
          label: `Error: ${processed.error}`,
        };
      }

      const label = classifyCF(processed.source1Files, processed.source2Files, processed.confluenceFile);

      return {
        conflictType: "CF",
        label,
        source1Files: processed.source1Files,
        source2Files: processed.source2Files,
        confluenceFile: processed.confluenceFile,
        source1Frames: processed.source1Frames,
        source2Frames: processed.source2Frames,
        confluenceFrame: processed.confluenceFrame,
      };
    } else if (depType.includes("CONFLICT")) {
      // DF Classification
      const processed = processDFConflict(dependency, modifiedLines);

      if (processed.error) {
        return {
          conflictType: "DF",
          label: `Error: ${processed.error}`,
        };
      }

      if (!hasOppositeSideEndpoints(processed.leftFrames[0], processed.rightFrames[0], modifiedLines)) {
        return {
          conflictType: "DF",
          label: "Error: missing both modified lines flows",
        };
      }

      const label = classifyDF(processed.leftFilesForClass, processed.rightFilesForClass);

      return {
        conflictType: "DF",
        label,
        leftFiles: processed.leftFilesFull,
        rightFiles: processed.rightFilesFull,
        leftFrames: processed.leftFrames,
        rightFrames: processed.rightFrames,
      };
    } else if (depType.includes("OA")) {
      // OA Classification
      const processed = processOAConflict(dependency, modifiedLines);

      if (processed.error) {
        return {
          conflictType: "OA",
          label: `Error: ${processed.error}`,
        };
      }

      if (!hasOppositeSideEndpoints(processed.leftFrames[0], processed.rightFrames[0], modifiedLines)) {
        return {
          conflictType: "OA",
          label: "Error: missing both modified lines flows",
        };
      }

      const label = classifyOA(processed.leftFilesForClass, processed.rightFilesForClass);

      return {
        conflictType: "OA",
        label,
        leftFiles: processed.leftFilesFull,
        rightFiles: processed.rightFilesFull,
        leftFrames: processed.leftFrames,
        rightFrames: processed.rightFrames,
      };
    } else {
      // Unknown type
      return {
        conflictType: "OA" as ConflictType, // Default to OA
        label: `Error: Unknown conflict type: ${depType}`,
      };
    }
  } catch (error) {
    return {
      conflictType: "OA" as ConflictType,
      label: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
