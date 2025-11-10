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
  role
}) => {
  const isSpecial = isCall || isSink;

  const width = isSpecial ? 290 : 363;
  const lineCharLimit = 32;
  const lineSpacing = isSpecial ? 2 : 4;
  const baseFontSize = isSpecial ? 16 : 20;
  const numberFontSize = isSpecial ? 12 : 14;
  const padding = 40;
  const lineHeight = baseFontSize + lineSpacing;
  const startY = 35;

  const handleClick = () => {
    const file= fileName;
    const line = lines[1];
    const diffLine = getDiffLine(file.endsWith(".java") ? file : `${file}.java`, Number(line));

    // checking if the diffLine is visible
    if (diffLine?.classList.contains("d2h-d-none")){
      let firstLine = firstVisibleLine(file);
      const diffFile = document.querySelector(`${file}`) as HTMLElement;
      while (diffLine?.classList.contains("d2h-d-none")) {
        if (Number(line) > firstLine){
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
    <svg width={width} height={lines.length * lineHeight + padding} xmlns="http://www.w3.org/2000/svg" overflow={"hidden"} style={{ ...style, position: "relative" }}>
      {/* Background */}
      <rect
        x="0"
        y="0"
        width={width}
        height={lines.length * lineHeight + padding}
        rx="24"
        ry="24"
        fill="#D9D9D9"
      />

      {isDashed && (
        <rect
          x="-4"
          y="-4"
          width={width + 8}
          height={lines.length * lineHeight + padding + 8}
          rx="28"
          ry="28"
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
          <g key={i} width={width - padding} >
            {isHighlight ? (
              <g onClick={handleClick} style={{ cursor: "pointer" }}>
                <rect
                  x="20"
                  y={y - baseFontSize}
                  width={width - padding}
                  height={lineHeight}
                  fill="#A9A9A9"
                  rx="8"
                />
                <text
                  x="30"
                  y={y}
                  fontFamily="Roboto"
                  fontSize={numberFontSize}
                  fontWeight="400"
                  fill="#333"
                >
                  {numberHighlight + i - 1}
                </text>
                <clipPath id={`bound-rect-${i}`}>
                  <rect
                    x="50"
                    y={y - baseFontSize}
                    width={width - padding - 30}
                    height={lineHeight}
                  />
                </clipPath>
                <text
                  x="50"
                  y={y}
                  fontFamily="Roboto"
                  fontSize={baseFontSize}
                  fontWeight="500"
                  fill="#000"
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
                  x="30"
                  y={y}
                  fontFamily="Roboto"
                  fontSize={numberFontSize}
                  fontWeight="400"
                  fill="#333"
                >
                  {numberHighlight + i - 1}
                </text>
                <clipPath id={`bound-rect-${i}`}>
                  <rect
                    x="50"
                    y={y - baseFontSize}
                    width={width - padding - 30}
                    height={lineHeight}
                  />
                </clipPath>
                <text
                  x="50"
                  y={y}
                  fontFamily="Roboto"
                  fontSize={baseFontSize}
                  fontWeight="400"
                  fill="#000"
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