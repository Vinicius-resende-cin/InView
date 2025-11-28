// components/CodeNode.tsx
import React, { CSSProperties } from "react";
import { getDiffLine, scrollAndHighlight } from "../Diff/diff-navigation";
import { firstVisibleLine, lastVisibleLine, expandBottom, expandTop } from "../Diff/InsertButtons";

interface CodeNodeProps {
  fileName: string;
  lines: string[];
  numberHighlight: number;
  calledFile: string;
  isCall?: boolean;
  isSource?: boolean;
  isSink?: boolean;
  isDashed?: boolean;
  style?: CSSProperties;
  role?: string;
  nodeColor?: { main: string; alt: string };
}

export class Node {
  fileName: string;
  lines: string[];
  numberHighlight: number;
  calledFile: string;
  isCall: boolean;
  isSource: boolean;
  isSink: boolean;
  isDashed: boolean;
  role?: string;

  constructor(
    fileName: string,
    lines: string[],
    numberHighlight: number,
    calledFile = "",
    isCall = false,
    isSource: boolean = false,
    isSink: boolean = false,
    isDashed: boolean = false,
    role: string = ""
  ) {
    this.fileName = fileName;
    this.lines = lines;
    this.numberHighlight = numberHighlight;
    this.calledFile = calledFile;
    this.isCall = isCall;
    this.isSource = isSource;
    this.isSink = isSink;
    this.isDashed = isDashed;
    this.role = role;
  }

  getHeight(lineHeight: number) {
    const padding = 40;
    return 3 * lineHeight + padding;
  }
}

export const CodeNode: React.FC<CodeNodeProps> = ({
  fileName,
  lines,
  numberHighlight,
  calledFile,
  isCall = false,
  isSource = false,
  isSink = false,
  isDashed,
  style,
  role,
  nodeColor
}) => {
  const isSpecial = isCall || isSink;

  const width = isSpecial ? 50 : 60;
  const lineCharLimit = 50;
  const lineSpacing = isSpecial ? 4 : 6;
  const baseFontSize = isSpecial ? 12 : 14;
  const numberFontSize = isSpecial ? 12 : 14;
  const padding = 8;
  const lineHeight = baseFontSize + lineSpacing;
  const startY = 2 * padding + baseFontSize;

  const handleClick = () => {
    const file= fileName;
    const diffLine = getDiffLine(file.endsWith(".java") ? file : `${file}.java`, numberHighlight);

    // checking if the diffLine is visible
    if (diffLine?.classList.contains("d2h-d-none")){
      let firstLine = firstVisibleLine(file);
      const diffFile = document.querySelector(`${file}`) as HTMLElement;
      while (diffLine?.classList.contains("d2h-d-none")) {
        if (numberHighlight > firstLine){
          let lastLine = lastVisibleLine(file);
          expandBottom(diffFile, lastLine, file);
        } else{
          firstLine = firstVisibleLine(file);
          expandTop(diffFile, firstLine, file);
        }
      }
    }

    scrollAndHighlight(diffLine);
  };

  return (
    <svg width={`${width}%`} height={lines.length * lineHeight + 4 * padding} xmlns="http://www.w3.org/2000/svg" overflow={"hidden"} style={{ ...style, position: "relative" }}>
      {/* Background */}
      <rect
        x="0"
        y="0"
        width="100%"
        height={lines.length * lineHeight + 4 * padding}
        rx="16"
        ry="16"
        fill={nodeColor ? nodeColor.alt : "#142A38"}
      />

      {isDashed && (
        <rect
          x={`-${padding}`}
          y={`-${padding}`}
          width={`calc(100% + ${2 * padding}px)`}
          height={lines.length * lineHeight + 6 * padding}
          rx="16"
          ry="16"
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      )}

      {/* Code Lines */}
      {lines.map((line, i) => {
        const y = startY + i * lineHeight;
        const isHighlight = i === 1;

        return (
          <g key={i} width={width - 2 * padding} >
            {isHighlight ? (
              <g onClick={handleClick} style={{ cursor: "pointer" }}>
                <rect
                  x="0"
                  y={y - baseFontSize}
                  width="100%"
                  height={lineHeight}
                  fill={nodeColor ? nodeColor.main : "#142A38"}
                />
                <text
                  x={padding}
                  y={y}
                  fontFamily="Roboto"
                  fontSize={numberFontSize}
                  fontWeight="400"
                  fill="#FFFFFF"
                >
                  {numberHighlight + i - 1}
                </text>
                <clipPath id={`bound-rect-${i}`}>
                  <rect
                    x={padding + 20}
                    y={y - baseFontSize}
                    width="100%"
                    height={lineHeight}
                  />
                </clipPath>
                <text
                  x={padding + 20}
                  y={y}
                  fontFamily="Roboto"
                  fontSize={baseFontSize}
                  fontWeight="500"
                  fill="#FFFFFF"
                  overflow={"hidden"}
                  style={{whiteSpace: "pre"}}
                  clipPath={`url(#bound-rect-${i})`}
                >
                  {line.slice(0, lineCharLimit) + (line.length > lineCharLimit ? " ..." : "")}
                </text>
              </g>
            ) : (
              <>
                <text
                  x={padding}
                  y={y}
                  fontFamily="Roboto"
                  fontSize={numberFontSize}
                  fontWeight="400"
                  fill="#FFFFFF"
                >
                  {numberHighlight + i - 1}
                </text>
                <clipPath id={`bound-rect-${i}`}>
                  <rect
                    x={padding + 20}
                    y={y - baseFontSize}
                    width="100%"
                    height={lineHeight}
                  />
                </clipPath>
                <text
                  x={padding + 20}
                  y={y}
                  fontFamily="Roboto"
                  fontSize={baseFontSize}
                  fontWeight="400"
                  fill="#FFFFFF"
                  overflow={"hidden"}
                  style={{whiteSpace: "pre"}}
                  clipPath={`url(#bound-rect-${i})`}
                >
                  {line.slice(0, lineCharLimit) + (line.length > lineCharLimit ? " ..." : "")}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export type { CodeNodeProps };

export function getWidth(isSource: boolean) {
    if (isSource){
      return 290;
    } else {
      return 363;
    }
  }

export function getHeight(isSpecial: boolean) {
  if (isSpecial){
    return 41;
  } else {
    return 112;
  }
}