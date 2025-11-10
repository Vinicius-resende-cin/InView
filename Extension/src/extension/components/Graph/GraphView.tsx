import { useRef, useEffect, useState } from "react";
import Grid, { gridRef } from "./Grid";
import { FileObject } from "../grouping";
import { CodeNode, CodeNodeProps } from "./Node";
import { layout } from "./Grid";
import { FileComponent } from "./File";
import { getArrows } from "./arrowLayout";
import { Arrow } from "./arrowLayout";

export type ConflictGridType = {
  layout: layout;
  positions: [number, number][];
};

interface GraphViewProps {
  data: FileObject[];
  conflictGridType: ConflictGridType;
}

export default function GraphView({ data, conflictGridType }: GraphViewProps) {
  const gridRef = useRef<gridRef>(null);
  const padding = 32;

  const [fileContours, setFileContours] = useState<
    { key: string; file: FileObject; width: number; height: number, left: number, top: number }[]
  >([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);

  const nodeRefs = useRef<Array<Array<HTMLDivElement | null>>>([]);

  useEffect(() => {
    if (gridRef.current && conflictGridType) {
      gridRef.current.setLayout(conflictGridType.layout);

      let curNodeIndex = 0;
      nodeRefs.current = [];

      data.forEach((fileObject, fileIndex) => {
        const nodesIndex: number[] = [];
        nodeRefs.current[fileIndex] = [];

        fileObject.nodes.forEach((node, nodeIndex) => {
          const posIndex = curNodeIndex++;
          const position = conflictGridType.positions[posIndex];
          nodesIndex.push(nodeIndex);

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
          const gridContainer = document.querySelector('#grid-container');
          const gridRect = gridContainer?.getBoundingClientRect();
          
          if (!gridRect) return;
          data.forEach((fileObject, fileIndex) => {
              const rects = (nodeRefs.current[fileIndex] ?? [])
              .filter(Boolean)
              .map(el => el!.getBoundingClientRect());

            if (rects.length > 0) {
              const minLeft = Math.min(...rects.map(r => r.left));
              const minTop = Math.min(...rects.map(r => r.top));
              const maxRight = Math.max(...rects.map(r => r.right));
              const maxBottom = Math.max(...rects.map(r => r.bottom));

              const minX = Math.min(...rects.map(r => r.x));
              const minY = Math.min(...rects.map(r => r.y));

              let width = maxRight - minLeft;
              const height = maxBottom - minTop;

              const left = minX - gridRect.x;
              const top = minY - gridRect.y;

              if ( width < 363) {
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

          const nodeCoords: { [role: string]: { x: number; y: number; idx: number; node: CodeNodeProps } } = {};
          data.forEach((fileObject, fileIndex) => {
            fileObject.nodes.forEach((node, nodeIndex) => {
              const el = nodeRefs.current[fileIndex][nodeIndex];
              if (el && node.role) {
                const rect = el.getBoundingClientRect();
                nodeCoords[node.role] = {
                  x: rect.x,
                  y: rect.y,
                  idx: nodeIndex,
                  node: node
                };
              }
            })
          })
          const newArrows = getArrows(nodeCoords, gridRect);
          setArrows(newArrows);
  }, 0);
    }
  }, [data, conflictGridType]);

  const gridContainer = document.querySelector('#grid-container');
  const gridRect = gridContainer?.getBoundingClientRect();

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
            width={contour.width - 3 * padding}
            height={contour.height + 2.3 * padding}
          />
        </div>
      ))}
      <Grid width={300} height={100} layout={conflictGridType.layout} ref={gridRef} />
      <svg
        width={gridRect?.width ?? 0}
        height={gridRect?.height ?? 0}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
          zIndex: 2
        }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="5"
            refY="3.5"
            orient="auto"
            viewBox="0 0 10 7"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#ff9800" />
          </marker>
        </defs>
        {arrows?.map((arrow, i) => (
          <line
            key={i}
            x1={arrow.from.x1}
            y1={arrow.from.y1}
            x2={arrow.to.x2}
            y2={arrow.to.y2}
            stroke="#ff9800"
            strokeWidth={3}
            markerEnd="url(#arrowhead)"
          />
        ))}
      </svg>
    </div>
  ) : null;
}
