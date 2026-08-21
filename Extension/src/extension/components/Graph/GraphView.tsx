import { useRef, useEffect, useState, useMemo } from "react";
import Grid, { gridRef } from "./Grid";
import { FileObject } from "../grouping";
import { CodeNode, CodeNodeProps } from "./Node";
import { layout } from "./Grid";
import { FileComponent } from "./File";
import { getArrows } from "./arrowLayout";
import { Arrow } from "./arrowLayout";
import { getDiffLine } from "../Diff/diff-navigation";
import { EdgeRenderer } from "./EdgeRenderer";

const NodeColor = {
  LEFT: { main: "#B7007E", alt: "#950067" },
  RIGHT: { main: "#118900", alt: "#0C6200" },
  BASE: { main: "#030F28", alt: "#142A38" },
}

export type ConflictGridType = {
  layout: layout;
  positions: [number, number][];
};

interface GraphViewProps {
  data: FileObject[];
  conflictGridType: ConflictGridType;
  dependencyType?: string;
}

export default function GraphView({ data, conflictGridType, dependencyType }: GraphViewProps) {
  const gridKey = useMemo(() => `${JSON.stringify(data)}-${JSON.stringify(conflictGridType)}`, [data, conflictGridType]);
  const gridRef = useRef<gridRef>(null);
  const padding = 32;

  const [fileContours, setFileContours] = useState<
    { key: string; file: FileObject; width: number; height: number, left: number, top: number }[]
  >([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [gridRect, setGridRect] = useState<DOMRect | null>(null);

  const nodeRefs = useRef<Array<Array<HTMLDivElement | null>>>([]);

  useEffect(() => {
    if (gridRef.current && conflictGridType) {
      nodeRefs.current = [];
      gridRef.current.setLayout(conflictGridType.layout);

      setFileContours([]);
      setArrows([]);

      let curNodeIndex = 0;

      data.forEach((fileObject, fileIndex) => {
        const nodesIndex: number[] = [];
        nodeRefs.current[fileIndex] = [];

        fileObject.nodes.forEach((node, nodeIndex) => {
          const posIndex = curNodeIndex++;
          const position = conflictGridType.positions[posIndex];
          if (!position) {
            console.warn("No grid position for node", posIndex, "- skipping", node.fileName, node.numberHighlight);
            return;
          }
          nodesIndex.push(nodeIndex);

          let nodeColor: { main: string; alt: string } = NodeColor.BASE;
          try {
            console.log("Getting diff line for:", node.fileName, node.numberHighlight);
            const diffLine = getDiffLine(node.fileName.endsWith(".java") ? node.fileName : `${node.fileName}.java`, node.numberHighlight);
            if (diffLine) {
              console.log("Diff line found:", diffLine);
              const td = diffLine.querySelector("td") as HTMLTableCellElement;
              const cls = td.classList;
              if (cls.contains("d2h-ins-left") || cls.contains("d2h-del-left")) nodeColor = NodeColor.LEFT;
              else if (cls.contains("d2h-ins") || cls.contains("d2h-del")) nodeColor = NodeColor.RIGHT;
            } else {
              console.warn("Diff line not found for:", node.fileName, node.numberHighlight);
            }
          } catch (e) {
            // ignore if diff not rendered yet
            console.warn("Diff line not found:", e);
          }

          gridRef.current!.setCellElement(position[0] - 1, position[1] - 1,
            <div
              key={`${fileObject.fileName}-${nodeIndex}`}
              ref={el => nodeRefs.current[fileIndex][nodeIndex] = el}
              style={{
                position: "relative",
                left: padding,
                top: padding,
                width: `calc(100% - ${padding * 2}px)`,
                height: `calc(100% - ${padding * 2}px)`
              }}>
              <CodeNode
                key={`${fileObject.fileName}-${nodeIndex}`}
                nodeColor={nodeColor}
                fileName={node.fileName}
                lines={node.lines}
                numberHighlight={node.numberHighlight}
                calledFile={node.calledFile}
                isCall={node.isCall}
                isSource={node.isSource}
                isSink={node.isSink}
                isDashed={node.isDashed}
              />
            </div>
          );
        });
      });

      setTimeout(() => {
        const contours: typeof fileContours = [];
        const gridContainer = (gridRef.current as any)?.containerRef?.current;
        const newGridRect = gridContainer?.getBoundingClientRect();
        setGridRect(newGridRect);

        data.forEach((fileObject, fileIndex) => {
          const rects = (nodeRefs.current[fileIndex] ?? [])
            .filter(Boolean)
            .map(el => el!.querySelector("svg")!.getBoundingClientRect())
            .filter(r => r.width > 0 && r.height > 0);

          if (rects.length > 0) {
            const minX = Math.min(...rects.map(r => r.x));
            const maxX = Math.max(...rects.map(r => r.x + r.width));
            const minY = Math.min(...rects.map(r => r.y));
            const maxY = Math.max(...rects.map(r => r.y + r.height));

              let width = maxX - minX;
              const height = maxY - minY;

            const left = minX - newGridRect.x;
            const top = minY - newGridRect.y;

            if (width < 363) {
              width = 363 + 4 * padding;
            }

            contours.push({
              key: `file-contour-${fileObject.fileName}`,
              file: fileObject,
              width,
              height,
              left,
              top
            });
          }
        });
        setFileContours(contours);

        const nodeCoords: { [role: string]: { x: number; y: number; width: number; height: number; idx: number; node: CodeNodeProps } } = {};
        data.forEach((fileObject, fileIndex) => {
          fileObject.nodes.forEach((node, nodeIndex) => {
            const el = nodeRefs.current[fileIndex][nodeIndex];
            if (el && node.role) {
              const nodeSvg = el.querySelector("svg");
              const rect = nodeSvg?.getBoundingClientRect();
              if (!rect || rect.width === 0 || rect.height === 0) return;

              nodeCoords[node.role] = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                idx: nodeIndex,
                node: node
              };
            }
          })
        })
        const newArrows = getArrows(nodeCoords, newGridRect, dependencyType);
        setArrows(newArrows);
      }, 50);
    }
  }, [data, conflictGridType, dependencyType, gridKey]);

  return conflictGridType ? (
    <div style={{ position: "relative" }}>
      {fileContours.map(contour => (
        <div
          key={contour.key}
          style={{
            position: "absolute",
            left: contour.left - 6,
            top: contour.top - padding,
            zIndex: 0
          }}
        >
          <FileComponent
            file={contour.file}
            width={contour.width + padding}
            height={contour.height + 2 * padding}
          />
        </div>
      ))}
      <Grid key={gridKey} width={300} height={100} layout={conflictGridType.layout} ref={gridRef} />
      <EdgeRenderer arrows={arrows} gridRect={gridRect} />
    </div>
  ) : null;
}
