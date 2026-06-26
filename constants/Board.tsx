import { Color } from "./Color";
import { getRandomPieceColor, PieceData } from "./Piece";

export const GRID_BLOCK_SIZE = 44;
export const HAND_BLOCK_SIZE = 34;
export const BOARD_CELL_STEP = 44;
export const BOARD_PADDING = 4;
export const BOARD_FRAME_SIZE = 360;
export const HITBOX_SIZE = 30;
export const DRAG_JUMP_LENGTH = 92;
export const DRAG_UPWARD_GAIN = 1.5;

export interface XYPoint {
  x: number;
  y: number;
}

export enum BoardBlockType {
  EMPTY,
  HOVERED,
  HOVERED_BREAK_FILLED,
  HOVERED_BREAK_EMPTY,
  FILLED,
}

export interface BoardBlock {
  blockType: BoardBlockType;
  color: Color;
  hoveredBreakColor: Color;
  assetId?: number;
  assetX?: number;
  assetY?: number;
  assetWidth?: number;
  assetHeight?: number;
  assetOriginX?: number;
  assetOriginY?: number;
}

export type Board = BoardBlock[][];

export function cloneBoard(board: Board): Board {
  "worklet";
  return board.map((row) => row.map((block) => ({ ...block })));
}

function clearBlockAsset(block: BoardBlock) {
  "worklet";
  block.assetId = undefined;
  block.assetX = undefined;
  block.assetY = undefined;
  block.assetWidth = undefined;
  block.assetHeight = undefined;
  block.assetOriginX = undefined;
  block.assetOriginY = undefined;
}

export function newEmptyBoard(boardLength: number): Board {
  return new Array(boardLength).fill(null).map(() => {
    return new Array(boardLength).fill(null).map(() => {
      return {
        blockType: BoardBlockType.EMPTY,
        color: getRandomPieceColor(), // used in the load up animation where blocks show on the grid
        hoveredBreakColor: { r: 0, g: 0, b: 0 },
      };
    });
  });
}

export type PossibleBoardSpots = number[][];

export function emptyPossibleBoardSpots(
  boardLength: number,
): PossibleBoardSpots {
  "worklet";
  return new Array(boardLength).fill(null).map(() => {
    return new Array(boardLength).fill(null).map(() => {
      return 0;
    });
  });
}

export function JS_emptyPossibleBoardSpots(
  boardLength: number,
): PossibleBoardSpots {
  return new Array(boardLength).fill(null).map(() => {
    return new Array(boardLength).fill(null).map(() => {
      return 0;
    });
  });
}
export function createPossibleBoardSpots(
  board: Board,
  piece: PieceData | null,
): PossibleBoardSpots {
  "worklet";
  const boardLength = board.length;
  if (piece == null) {
    return [];
  }
  const pieceHeight = piece.matrix.length;
  const pieceWidth = piece.matrix[0].length;
  const fitPositions: PossibleBoardSpots = emptyPossibleBoardSpots(boardLength);

  for (let boardY = 0; boardY <= boardLength - pieceHeight; boardY++) {
    for (let boardX = 0; boardX <= boardLength - pieceWidth; boardX++) {
      let canFit = true;

      for (let pieceY = 0; pieceY < pieceHeight; pieceY++) {
        for (let pieceX = 0; pieceX < pieceWidth; pieceX++) {
          if (
            piece.matrix[pieceY][pieceX] === 1 &&
            board[boardY + pieceY][boardX + pieceX].blockType ==
              BoardBlockType.FILLED
          ) {
            canFit = false;
            break;
          }
        }
        if (!canFit) break;
      }

      if (canFit) {
        fitPositions[boardY][boardX] = 1;
      }
    }
  }

  return fitPositions;
}

export function clearHoverBlocks(board: Board): Board {
  "worklet";
  const boardLength = board.length;
  for (let y = 0; y < boardLength; y++) {
    for (let x = 0; x < boardLength; x++) {
      const blockType = board[y][x].blockType;
      if (
        blockType == BoardBlockType.HOVERED ||
        blockType == BoardBlockType.HOVERED_BREAK_EMPTY
      ) {
        board[y][x].blockType = BoardBlockType.EMPTY;
        clearBlockAsset(board[y][x]);
      } else if (blockType == BoardBlockType.HOVERED_BREAK_FILLED) {
        board[y][x].blockType = BoardBlockType.FILLED;
      }
    }
  }
  return board;
}

export function placePieceOntoBoard(
  board: Board,
  piece: PieceData,
  dropX: number,
  dropY: number,
  blockType: BoardBlockType,
) {
  "worklet";
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[0].length; x++) {
      if (piece.matrix[y][x] == 1) {
        const block = board[dropY + y][dropX + x];
        block.blockType = blockType;
        block.color = piece.color;
        block.assetId = piece.assetId;
        block.assetX = x;
        block.assetY = y;
        block.assetWidth = piece.matrix[0].length;
        block.assetHeight = piece.matrix.length;
        block.assetOriginX = dropX;
        block.assetOriginY = dropY;
      }
    }
  }
}

export function updateHoveredBreaks(
  board: Board,
  piece: PieceData,
  dropX: number,
  dropY: number,
) {
  "worklet";
  const boardLength = board.length;
  const tempBoard = cloneBoard(board);
  placePieceOntoBoard(tempBoard, piece, dropX, dropY, BoardBlockType.HOVERED);

  const rowsToClear = new Set<number>();
  const colsToClear = new Set<number>();

  for (let row = 0; row < boardLength; row++) {
    if (
      tempBoard[row].every(
        (cell) =>
          cell.blockType == BoardBlockType.FILLED ||
          cell.blockType == BoardBlockType.HOVERED,
      )
    ) {
      rowsToClear.add(row);
    }
  }

  for (let col = 0; col < boardLength; col++) {
    if (
      tempBoard.every(
        (row) =>
          row[col].blockType == BoardBlockType.FILLED ||
          row[col].blockType == BoardBlockType.HOVERED,
      )
    ) {
      colsToClear.add(col);
    }
  }

  const count = rowsToClear.size + colsToClear.size;

  placePieceOntoBoard(board, piece, dropX, dropY, BoardBlockType.HOVERED);

  if (count > 0) {
    rowsToClear.forEach((row) => {
      for (let col = 0; col < boardLength; col++) {
        if (board[row][col].blockType == BoardBlockType.FILLED) {
          board[row][col].blockType = BoardBlockType.HOVERED_BREAK_FILLED;
          board[row][col].hoveredBreakColor = piece.color;
        } else if (board[row][col].blockType === BoardBlockType.EMPTY) {
          board[row][col].blockType = BoardBlockType.HOVERED_BREAK_EMPTY;
        }
      }
    });

    colsToClear.forEach((col) => {
      for (let row = 0; row < boardLength; row++) {
        if (board[row][col].blockType == BoardBlockType.FILLED) {
          board[row][col].blockType = BoardBlockType.HOVERED_BREAK_FILLED;
          board[row][col].hoveredBreakColor = piece.color;
        } else if (board[row][col].blockType === BoardBlockType.EMPTY) {
          board[row][col].blockType = BoardBlockType.HOVERED_BREAK_EMPTY;
        }
      }
    });
  }
}

export function breakLines(board: Board): number {
  "worklet";
  const boardLength = board.length;
  const rowsToClear = new Set<number>();
  const colsToClear = new Set<number>();

  for (let row = 0; row < boardLength; row++) {
    if (board[row].every((cell) => cell.blockType == BoardBlockType.FILLED)) {
      rowsToClear.add(row);
    }
  }

  for (let col = 0; col < boardLength; col++) {
    if (board.every((row) => row[col].blockType == BoardBlockType.FILLED)) {
      colsToClear.add(col);
    }
  }

  const count = rowsToClear.size + colsToClear.size;

  if (count > 0) {
    rowsToClear.forEach((row) => {
      for (let col = 0; col < boardLength; col++) {
        board[row][col].blockType = BoardBlockType.EMPTY;
        clearBlockAsset(board[row][col]);
      }
    });

    colsToClear.forEach((col) => {
      for (let row = 0; row < boardLength; row++) {
        board[row][col].blockType = BoardBlockType.EMPTY;
        clearBlockAsset(board[row][col]);
      }
    });
  }

  return count;
}

export function forEachBoardBlock(board: Board, each: ((block: BoardBlock, x: number, y: number) => boolean) | ((block: BoardBlock, x: number, y: number) => void)) {
  const length = board.length;
  for (let y = 0; y < length; y++) {
    for (let x = 0; x < length; x++) {
      each(board[y][x], x, y);
    }
  }
}
