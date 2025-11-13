import { useState, useImperativeHandle, forwardRef, useEffect, useRef, RefObject } from "react";

export type layout = {
  rows: number;
  columns: number;
  rowSizes?: number[];
  columnSizes?: number[];
}

export type gridRef = {
  setCellElement: (row: number, column: number, element: JSX.Element) => void;
  setLayout: (layout: layout) => void;
  getCells: () => Array<Array<JSX.Element>>;
  containerRef: RefObject<HTMLDivElement | null> | null;
};

interface GridProps {
  width: number;
  height: number;
  layout: layout;
}

/**
 * Component for managing the grid in the graph.
 * This component is responsible for positioning the graph nodes in equally spaced rows and columns.
 *
 * **!Edges and file contours are not limited to the grid!**
 *
 * @returns JSX.Element
 */
const Grid = forwardRef<gridRef, GridProps>(({ width, height, layout }, ref): JSX.Element => {
  // Save elements in a structure representing the grid layout
  // This structure will be used to position the nodes in the graph
  const [cells, setCells] = useState<Array<Array<JSX.Element>>>([]);
  const [gridLayout, setGridLayout] = useState<layout>(layout);

  //=============== Methods ===================

  // Set an element to a cell in the grid
  const setCellElement = (row: number, column: number, element: JSX.Element) => {
    setCells((prevCells) => {
      const newCells = [...prevCells];
      newCells[row][column] = element;
      return newCells;
    });
  };

  const setLayout = (newLayout: layout) => {
    setGridLayout(newLayout);
  };  

  // method to return the cells
  const getCells = () => {
    return cells;
  }

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Expose the grid methods to the parent component
  useImperativeHandle(ref, () => ({
    setCellElement,
    setLayout,
    getCells,
    containerRef
  }), [cells, gridLayout]);

  useEffect(() => {
    // Initialize the grid cells based on the layout
    const initializeGrid = () => {
      const newCells = Array.from({ length: gridLayout.rows }, () => Array.from({ length: gridLayout.columns }, () => <></>));
      setCells(newCells);
    };
    initializeGrid();
  }, [gridLayout]);

  useEffect(() => {
    console.log("Grid cells updated:", cells);
  }, [cells]);

  // Get the relative size of each row and column
  const rowSizes = gridLayout.rowSizes
    ? gridLayout.rowSizes.map((size) => size / height)
    : Array(gridLayout.rows).fill(1 / gridLayout.rows);
  const columnSizes = gridLayout.columnSizes
    ? gridLayout.columnSizes.map((size) => size / width)
    : Array(gridLayout.columns).fill(1 / gridLayout.columns);

  // Calculate the position of each row and column
  const rowPositions = rowSizes.reduce((acc, size, index) => {
    const position = acc[index - 1] ? acc[index - 1] + size : size;
    acc.push(position);
    return acc;
  }, [] as number[]);
  const columnPositions = columnSizes.reduce((acc, size, index) => {
    const position = acc[index - 1] ? acc[index - 1] + size : size;
    acc.push(position);
    return acc;
  }, [] as number[]);

  return (
    <div
      ref={containerRef}
      id= "grid-container"
      style={{
        height: "300px",
        display: "grid",
        gridTemplateRows: rowSizes.map((size) => `${size * 100}%`).join(" "),
        gridTemplateColumns: columnSizes.map((size) => `${size * 100}%`).join(" "),
      }}>
      {cells.map((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <div
            key={`${rowIndex}-${columnIndex}`}
            style={{
              gridRowStart: rowIndex + 1,
              gridColumnStart: columnIndex + 1,
            }}>
            {cell}
          </div>
        ))
      )}
    </div>
  );
});

export default Grid;
