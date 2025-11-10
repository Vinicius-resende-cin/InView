import { CodeNodeProps } from "./Node";
import { getWidth, getHeight } from "./Node";

const padding = 32;
export type Arrow = {
  from: { x1?: number; y1?: number; x2?: number; y2?: number };
  to: { x1?: number; y1?: number; x2?: number; y2?: number };
};

// Função principal
export function getArrows(
  nodeCoords: { [role: string]: { x: number; y: number; idx: number; node: CodeNodeProps } },
  gridRect: { x: number; y: number; width: number; height: number } 
): Arrow[] {
  const arrows: Arrow[] = [];
  console.log("node coords: ", nodeCoords);

  // Changing the logic to get arrows
  if (nodeCoords["LC"] && nodeCoords ["RC"]){
    //conflitct arrow from LC to RC
    arrows.push(BuildArrow(nodeCoords["LC"], nodeCoords["RC"], gridRect)); 
    arrows.push(BuildArrow(nodeCoords["L"], nodeCoords["LC"], gridRect));
    arrows.push(BuildArrow(nodeCoords["R"], nodeCoords["RC"], gridRect));  

  } else if (nodeCoords["LC"]){
    arrows.push(BuildArrow(nodeCoords["L"], nodeCoords["LC"], gridRect));
    arrows.push(BuildArrow(nodeCoords["LC"], nodeCoords["R"], gridRect));

  }  else if (nodeCoords["RC"]){
    arrows.push(BuildArrow(nodeCoords["L"], nodeCoords["RC"], gridRect));
    arrows.push(BuildArrow(nodeCoords["R"], nodeCoords["RC"], gridRect));
  } else {
    arrows.push(BuildArrow(nodeCoords["L"], nodeCoords["R"], gridRect));
  }
  
  console.log("the arrows: ",arrows);
  return arrows;
}


const BuildArrow = (nodeL:{ x: number; y: number; idx: number; node: CodeNodeProps}, nodeR:{ x: number; y: number; idx: number; node: CodeNodeProps}, gridRect: { x: number; y: number; width: number; height: number }): Arrow => {
  if (nodeL.x  == nodeR.x){
    // vertical arrow
    return {
      from: {
        x1: nodeL.x + getWidth(nodeL.node.isSource || false)/2 + padding - gridRect.x,
        y1: nodeL.y + getHeight(nodeL.node.isCall || nodeL.node.isSink || false) - gridRect.y
      },
      to: {
        x2: nodeR.x + getWidth(nodeR.node.isSource || false)/2 + padding - gridRect.x,
        y2: nodeR.y - gridRect.y
      }
    }
  }else if ( nodeL.y == nodeR.y) {
    // horizontal arrows
    if (nodeL.x < nodeR.x){
      return {
      from: {
          x1: nodeL.x + getWidth(nodeL.node.isSource || false) + 2 * padding - gridRect.x,
          y1: nodeL.y + getHeight(nodeL.node.isCall || nodeL.node.isSink || false)/2 - gridRect.y
        },
        to: {
          x2: nodeR.x - gridRect.x,
          y2: nodeR.y + getHeight(nodeR.node.isCall || nodeR.node.isSink || false)/2 - gridRect.y
        }
      }
    } else {
      return {
      from: {
          x1: nodeR.x + getWidth(nodeR.node.isSource || false) + 2 * padding - gridRect.x,
          y1: nodeR.y + getHeight(nodeR.node.isCall || nodeR.node.isSink || false)/2 - gridRect.y
        },
        to: {
          x2: nodeL.x - gridRect.x,
          y2: nodeL.y + getHeight(nodeL.node.isCall || nodeL.node.isSink || false)/2 - gridRect.y
        }
      }
    }
  } else {
    // diagonal arrows
    ///0////1
    ///2////3
    if (nodeL.x < nodeR.x) {
      if (nodeL.y < nodeR.y) {
        // from position 0 to 3 
        return {
          from: {
            x1: nodeL.x + getWidth(nodeL.node.isSource || false) + 2 * padding - gridRect.x,
            y1: nodeL.y + getHeight(nodeL.node.isCall || nodeL.node.isSink || false)/2 - gridRect.y
          },
          to: {
            x2: nodeR.x + getWidth(nodeR.node.isSource || false)/2 - gridRect.x,
            y2: nodeR.y - padding - gridRect.y,
          }
        }
    } else {
      // from position 2 to 1
      return{
        from: {
          x1: nodeL.x + getWidth(nodeL.node.isSource || false) + 2 * padding - gridRect.x,
          y1: nodeL.y + getHeight(nodeL.node.isCall || nodeL.node.isSink || false)/2 - gridRect.y
        },
        to: {
          x2: nodeR.x + getWidth(nodeR.node.isCall || nodeR.node.isSink || false)/2 + padding - gridRect.x,
          y2: nodeR.y + getHeight(nodeR.node.isCall || nodeR.node.isSink || false) - gridRect.y
        }
      }
    }
  } else {
    if (nodeL.y < nodeR.y) {
      // form position 1 to 2
        return {
            from: {
            x1: nodeL.x + getWidth(nodeL.node.isCall || nodeL.node.isSink || false)/2 + padding - gridRect.x,
            y1: nodeL.y + getHeight(nodeL.node.isCall || nodeL.node.isSink || false) - gridRect.y
          },
          to: {
            x2: nodeR.x + getWidth(nodeR.node.isCall || nodeR.node.isSink || false)/2 + padding - gridRect.x,
            y2: nodeR.y - gridRect.y
          }
        }
    } else {
      // from position 3 to 0
      return{
        from: {
          x1: nodeL.x + getWidth(nodeL.node.isSource || false)/2 - gridRect.x,
          y1: nodeL.y - padding - gridRect.y
        },
        to: {
          x2: nodeR.x + getWidth(nodeR.node.isSource || false) + 2 * padding - gridRect.x,
          y2: nodeR.y + getHeight(nodeR.node.isCall || nodeR.node.isSink || false)/2 - gridRect.y
        }
      }
    }
  }

}
}