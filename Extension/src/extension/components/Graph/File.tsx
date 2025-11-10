import React from "react";
import { FileObject } from "../grouping";
import "../../../app/App.css";

interface FileComponentProps {
  file: FileObject;
  width: number;
  height: number;
}

export const FileComponent: React.FC<FileComponentProps> = ({ file, width, height }) => {
  const foldSize = 32;

  return (
    <svg width={width} height={height}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="5"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#7E7E7E" />
        </marker>
      </defs>

      <polygon
        points={`
          0,0
          ${width - foldSize},0
          ${width},${foldSize}
          ${width},${height}
          0,${height}
        `}
        fill="white"
        stroke="black"
        strokeWidth={2}
        rx={8}
      />

      <text x={16} y={24} fontSize={16} fontWeight="bold" fill="#000">
        {file.fileName}
      </text>

      <polygon
        points={`
          ${width - foldSize},0
          ${width - foldSize}, ${foldSize}
          ${width},${foldSize},
          ${width - foldSize},0
        `}
        fill="white"
        stroke="black"
        strokeWidth={1}
      />
    </svg>
  );
};
