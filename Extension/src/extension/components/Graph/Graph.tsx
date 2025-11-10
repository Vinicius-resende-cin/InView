// // components/Graph.tsx
// import React from "react";
// import { File, FileComponent } from "./File";
// import { Node } from "./Node";

// interface GraphProps {
//   files: File[];
// }

// export const Graph: React.FC<GraphProps> = ({ files }) => {
//   const padding = 60;
//   const columnSpacing = 100;
//   const rowSpacing = 100;

//   const layout = files.length === 1 ? [1] : files.length === 2 ? [1, 1] : files.length <= 4 ? [2, 2] : [];

//   const filePositions: { x: number; y: number }[] = [];
//   let fileWidths: number[] = [];
//   let fileHeights: number[] = [];

//   const dummyRender = files.map((file, index) => {
//     const col = index % 2;
//     const row = Math.floor(index / 2);
//     const x = padding + col * (400 + columnSpacing); // 300 is approximate width
//     const y = padding + row * (200 + rowSpacing);
//     filePositions.push({ x, y });
//     return (
//       <foreignObject width={0} height={0} key={index}>
//         <FileComponent file={file} x={x} y={y} />
//       </foreignObject>
//     );
//   });

//   fileWidths = files.map((file) => {
//     const nodeWidths = file.nodes.map((n) => n.getWidth());
//     const columns = file.nodes.length <= 2 ? 1 : 2;
//     const maxNodeWidth = Math.max(...nodeWidths);
//     return columns * maxNodeWidth + (columns - 1) * 20 + 40;
//   });

//   fileHeights = files.map((file) => {
//     const nodeHeights = file.nodes.map((n) => n.getHeight(30));
//     const rows = Math.ceil(file.nodes.length / 2);
//     const rowHeights: number[] = [];
//     for (let r = 0; r < rows; r++) {
//       const rowNodes = file.nodes.slice(r * 2, r * 2 + 2);
//       const rowHeight = Math.max(...rowNodes.map((n) => n.getHeight(30)));
//       rowHeights.push(rowHeight);
//     }
//     return rowHeights.reduce((a, b) => a + b, 0) + (rows - 1) * 60 + 40;
//   });

//   const arrows = files.flatMap((fromFile, i) => {
//     return fromFile.nodes.flatMap((fromNode) => {
//       return files.flatMap((toFile, j) => {
//         return toFile.nodes.flatMap((toNode) => {
//           if (i === j || fromNode === toNode) return [];

//           const fromPos = filePositions[i];
//           const toPos = filePositions[j];

//           const fromIndex = fromFile.nodes.indexOf(fromNode);
//           const toIndex = toFile.nodes.indexOf(toNode);

//           const fromNodeX = fromPos.x + 20 + (fromIndex % 2) * (fromNode.getWidth() + 20) + fromNode.getWidth() / 2;
//           const fromNodeY = fromPos.y + 20 + Math.floor(fromIndex / 2) * (fromNode.getHeight(30) + 60) + fromNode.getHeight(30);

//           const toNodeX = toPos.x + 20 + (toIndex % 2) * (toNode.getWidth() + 20) + toNode.getWidth() / 2;
//           const toNodeY = toPos.y + 20 + Math.floor(toIndex / 2) * (toNode.getHeight(30) + 60) + 35 + 30;

//           const isCallMatch =
//             fromNode.isCall && (toNode.isSource || toNode.isSink) && fromNode.calledFile === toNode.fileName;
//           const isSourceSink = fromNode.isSource && toNode.isSink;

//           if (isCallMatch || isSourceSink) {
//             return (
//               <g key={`arrow-${i}-${j}-${fromIndex}-${toIndex}`}>
//                 <line
//                   x1={fromNodeX}
//                   y1={fromNodeY}
//                   x2={toNodeX}
//                   y2={toNodeY}
//                   stroke="#7E7E7E"
//                   strokeWidth={2}
//                   markerEnd="url(#arrowhead)"
//                 />
//               </g>
//             );
//           }
//           return [];
//         });
//       });
//     });
//   });

//   const totalWidth = Math.max(...filePositions.map((p, i) => p.x + fileWidths[i])) + padding;
//   const totalHeight = Math.max(...filePositions.map((p, i) => p.y + fileHeights[i])) + padding;

//   return (
//     <svg width={totalWidth} height={totalHeight}>
//       <defs>
//         <marker
//           id="arrowhead"
//           markerWidth="10"
//           markerHeight="7"
//           refX="5"
//           refY="3.5"
//           orient="auto"
//         >
//           <polygon points="0 0, 10 3.5, 0 7" fill="#7E7E7E" />
//         </marker>
//       </defs>

//       {arrows}

//       {/* Files */}
//       {files.map((file, i) => (
//         <FileComponent key={i} file={file} x={filePositions[i].x} y={filePositions[i].y} />
//       ))}
//     </svg>
//   );
// };
