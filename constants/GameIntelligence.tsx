import {
  Board,
  BoardBlockType,
  breakLines,
  placePieceOntoBoard,
} from "./Board";
import { Hand, createRandomHandWorklet } from "./Hand";
import { PieceData, getBlockCount } from "./Piece";

export type MoveQualityTier = "miss" | "ok" | "good" | "great" | "best";

export interface Placement {
  x: number;
  y: number;
}

export interface SimulatedMove {
  board: Board;
  linesCleared: number;
  clearedBlocks: number;
}

export interface MoveQualityReport {
  rating: number;
  tier: MoveQualityTier;
  rank: number;
  totalMoves: number;
  moveScore: number;
  bestScore: number;
  worstScore: number;
  linesCleared: number;
  clearedBlocks: number;
}

const MOVE_SEARCH_DEPTH = 2;
const SMART_HAND_ATTEMPTS = 96;
const MAX_PLACEMENTS_PER_PIECE = 96;

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

export function cloneBoard(board: Board): Board {
  "worklet";
  const length = board.length;
  const nextBoard = new Array(length);
  for (let y = 0; y < length; y++) {
    nextBoard[y] = new Array(length);
    for (let x = 0; x < length; x++) {
      const block = board[y][x];
      nextBoard[y][x] = {
        blockType: block.blockType,
        color: block.color,
        hoveredBreakColor: block.hoveredBreakColor,
      };
    }
  }
  return nextBoard;
}

export function canPlacePieceAt(
  board: Board,
  piece: PieceData,
  dropX: number,
  dropY: number,
): boolean {
  "worklet";
  const boardLength = board.length;
  const pieceHeight = piece.matrix.length;
  const pieceWidth = piece.matrix[0].length;

  if (dropX < 0 || dropY < 0) {
    return false;
  }
  if (dropX + pieceWidth > boardLength || dropY + pieceHeight > boardLength) {
    return false;
  }

  for (let y = 0; y < pieceHeight; y++) {
    for (let x = 0; x < pieceWidth; x++) {
      if (
        piece.matrix[y][x] === 1 &&
        board[dropY + y][dropX + x].blockType === BoardBlockType.FILLED
      ) {
        return false;
      }
    }
  }

  return true;
}

export function getPlacementsForPiece(
  board: Board,
  piece: PieceData | null,
): Placement[] {
  "worklet";
  if (piece == null) {
    return [];
  }

  const boardLength = board.length;
  const pieceHeight = piece.matrix.length;
  const pieceWidth = piece.matrix[0].length;
  const placements: Placement[] = [];

  for (let y = 0; y <= boardLength - pieceHeight; y++) {
    for (let x = 0; x <= boardLength - pieceWidth; x++) {
      if (canPlacePieceAt(board, piece, x, y)) {
        placements.push({ x, y });
      }
    }
  }

  return placements;
}

export function canPlaceAnyPiece(board: Board, hand: Hand): boolean {
  "worklet";
  for (let i = 0; i < hand.length; i++) {
    const piece = hand[i];
    if (piece == null) {
      continue;
    }
    if (getPlacementsForPiece(board, piece).length > 0) {
      return true;
    }
  }
  return false;
}

function countFilledBlocks(board: Board): number {
  "worklet";
  const length = board.length;
  let filled = 0;
  for (let y = 0; y < length; y++) {
    for (let x = 0; x < length; x++) {
      if (board[y][x].blockType === BoardBlockType.FILLED) {
        filled++;
      }
    }
  }
  return filled;
}

function countEmptyBlocks(board: Board): number {
  "worklet";
  return board.length * board.length - countFilledBlocks(board);
}

function getLargestEmptyRegion(board: Board): number {
  "worklet";
  const length = board.length;
  const visited = new Array(length);
  for (let y = 0; y < length; y++) {
    visited[y] = new Array(length).fill(false);
  }

  let largest = 0;
  const queueX = new Array(length * length);
  const queueY = new Array(length * length);

  for (let startY = 0; startY < length; startY++) {
    for (let startX = 0; startX < length; startX++) {
      if (
        visited[startY][startX] ||
        board[startY][startX].blockType === BoardBlockType.FILLED
      ) {
        continue;
      }

      let head = 0;
      let tail = 0;
      let size = 0;
      visited[startY][startX] = true;
      queueX[tail] = startX;
      queueY[tail] = startY;
      tail++;

      while (head < tail) {
        const x = queueX[head];
        const y = queueY[head];
        head++;
        size++;

        const neighbors = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ];

        for (let i = 0; i < neighbors.length; i++) {
          const next = neighbors[i];
          if (
            next.x < 0 ||
            next.y < 0 ||
            next.x >= length ||
            next.y >= length ||
            visited[next.y][next.x] ||
            board[next.y][next.x].blockType === BoardBlockType.FILLED
          ) {
            continue;
          }
          visited[next.y][next.x] = true;
          queueX[tail] = next.x;
          queueY[tail] = next.y;
          tail++;
        }
      }

      largest = Math.max(largest, size);
    }
  }

  return largest;
}

function getNearLineScore(board: Board): number {
  "worklet";
  const length = board.length;
  let score = 0;

  for (let row = 0; row < length; row++) {
    let filled = 0;
    for (let col = 0; col < length; col++) {
      if (board[row][col].blockType === BoardBlockType.FILLED) {
        filled++;
      }
    }
    if (filled === length - 1) {
      score += 18;
    } else if (filled === length - 2) {
      score += 8;
    } else if (filled === length - 3) {
      score += 3;
    }
  }

  for (let col = 0; col < length; col++) {
    let filled = 0;
    for (let row = 0; row < length; row++) {
      if (board[row][col].blockType === BoardBlockType.FILLED) {
        filled++;
      }
    }
    if (filled === length - 1) {
      score += 18;
    } else if (filled === length - 2) {
      score += 8;
    } else if (filled === length - 3) {
      score += 3;
    }
  }

  return score;
}

function countHandPlacements(board: Board, hand: Hand, cap: number): number {
  "worklet";
  let count = 0;
  for (let i = 0; i < hand.length; i++) {
    const piece = hand[i];
    if (piece == null) {
      continue;
    }
    const placements = getPlacementsForPiece(board, piece);
    count += Math.min(placements.length, MAX_PLACEMENTS_PER_PIECE);
    if (count >= cap) {
      return cap;
    }
  }
  return count;
}

function scoreBoardShape(board: Board, hand: Hand): number {
  "worklet";
  const empty = countEmptyBlocks(board);
  const largestRegion = getLargestEmptyRegion(board);
  const fragmentedEmpty = Math.max(0, empty - largestRegion);
  const mobility = countHandPlacements(board, hand, 160);
  const nearLines = getNearLineScore(board);
  const boardArea = board.length * board.length;
  const emptyRatio = empty / boardArea;

  let score = 0;
  score += empty * 1.2;
  score += largestRegion * 1.8;
  score += mobility * 1.1;
  score += nearLines;
  score -= fragmentedEmpty * 1.6;

  if (emptyRatio < 0.18) {
    score -= 95;
  } else if (emptyRatio < 0.28) {
    score -= 38;
  }

  return score;
}

export function simulateMove(
  board: Board,
  piece: PieceData,
  dropX: number,
  dropY: number,
): SimulatedMove {
  "worklet";
  const nextBoard = cloneBoard(board);
  placePieceOntoBoard(nextBoard, piece, dropX, dropY, BoardBlockType.FILLED);
  const filledBeforeClear = countFilledBlocks(nextBoard);
  const linesCleared = breakLines(nextBoard);
  const filledAfterClear = countFilledBlocks(nextBoard);

  return {
    board: nextBoard,
    linesCleared,
    clearedBlocks: filledBeforeClear - filledAfterClear,
  };
}

function scoreImmediateMove(piece: PieceData, simulatedMove: SimulatedMove): number {
  "worklet";
  const pieceBlocks = getBlockCount(piece);
  const boardLength = simulatedMove.board.length;
  const lineScore = simulatedMove.linesCleared * boardLength * 14;
  const clearScore = simulatedMove.clearedBlocks * 4;
  const comboShapeBonus =
    simulatedMove.linesCleared > 1 ? simulatedMove.linesCleared * 28 : 0;

  return pieceBlocks + lineScore + clearScore + comboShapeBonus;
}

function handHasPieces(hand: Hand): boolean {
  "worklet";
  for (let i = 0; i < hand.length; i++) {
    if (hand[i] != null) {
      return true;
    }
  }
  return false;
}

function scoreFuture(board: Board, hand: Hand, depth: number): number {
  "worklet";
  if (depth <= 0 || !handHasPieces(hand)) {
    return scoreBoardShape(board, hand);
  }

  let bestScore = -999999;
  let legalMoveCount = 0;

  for (let i = 0; i < hand.length; i++) {
    const piece = hand[i];
    if (piece == null) {
      continue;
    }

    const placements = getPlacementsForPiece(board, piece);
    for (let p = 0; p < placements.length; p++) {
      const placement = placements[p];
      const simulated = simulateMove(board, piece, placement.x, placement.y);
      const nextHand = [...hand];
      nextHand[i] = null;
      const moveScore =
        scoreImmediateMove(piece, simulated) +
        scoreFuture(simulated.board, nextHand, depth - 1) * 0.72;

      bestScore = Math.max(bestScore, moveScore);
      legalMoveCount++;
    }
  }

  if (legalMoveCount === 0) {
    return scoreBoardShape(board, hand) - 650;
  }

  return bestScore;
}

function scoreFirstMove(
  board: Board,
  hand: Hand,
  handIndex: number,
  placement: Placement,
  depth: number,
): { score: number; simulated: SimulatedMove } {
  "worklet";
  const piece = hand[handIndex]!;
  const simulated = simulateMove(board, piece, placement.x, placement.y);
  const nextHand = [...hand];
  nextHand[handIndex] = null;
  const score =
    scoreImmediateMove(piece, simulated) +
    scoreFuture(simulated.board, nextHand, Math.max(0, depth - 1)) * 0.72;

  return { score, simulated };
}

function getMoveQualityTier(rating: number, rank: number): MoveQualityTier {
  "worklet";
  if (rank === 1 || rating >= 92) {
    return "best";
  }
  if (rating >= 78) {
    return "great";
  }
  if (rating >= 58) {
    return "good";
  }
  if (rating >= 34) {
    return "ok";
  }
  return "miss";
}

export function evaluateMoveQuality(
  board: Board,
  hand: Hand,
  handIndex: number,
  dropX: number,
  dropY: number,
): MoveQualityReport {
  "worklet";
  const piece = hand[handIndex];
  if (piece == null || !canPlacePieceAt(board, piece, dropX, dropY)) {
    return {
      rating: 0,
      tier: "miss",
      rank: 0,
      totalMoves: 0,
      moveScore: 0,
      bestScore: 0,
      worstScore: 0,
      linesCleared: 0,
      clearedBlocks: 0,
    };
  }

  const chosen = scoreFirstMove(
    board,
    hand,
    handIndex,
    { x: dropX, y: dropY },
    MOVE_SEARCH_DEPTH,
  );
  let bestScore = -999999;
  let worstScore = 999999;
  let totalMoves = 0;
  let betterMoves = 0;

  for (let i = 0; i < hand.length; i++) {
    const handPiece = hand[i];
    if (handPiece == null) {
      continue;
    }

    const placements = getPlacementsForPiece(board, handPiece);
    for (let p = 0; p < placements.length; p++) {
      const scored = scoreFirstMove(
        board,
        hand,
        i,
        placements[p],
        MOVE_SEARCH_DEPTH,
      );
      bestScore = Math.max(bestScore, scored.score);
      worstScore = Math.min(worstScore, scored.score);
      if (scored.score > chosen.score + 0.01) {
        betterMoves++;
      }
      totalMoves++;
    }
  }

  const scoreRange = Math.max(1, bestScore - worstScore);
  const scoreRating = ((chosen.score - worstScore) / scoreRange) * 100;
  const rankRating =
    totalMoves <= 1 ? 100 : (1 - betterMoves / Math.max(1, totalMoves - 1)) * 100;
  const rating = clamp(Math.round(scoreRating * 0.35 + rankRating * 0.65), 0, 100);
  const rank = betterMoves + 1;

  return {
    rating,
    tier: getMoveQualityTier(rating, rank),
    rank,
    totalMoves,
    moveScore: Math.round(chosen.score),
    bestScore: Math.round(bestScore),
    worstScore: Math.round(worstScore),
    linesCleared: chosen.simulated.linesCleared,
    clearedBlocks: chosen.simulated.clearedBlocks,
  };
}

function scoreHandCandidate(board: Board, hand: Hand): number {
  "worklet";
  if (!canPlaceAnyPiece(board, hand)) {
    return -999999;
  }
  return scoreFuture(board, hand, 1);
}

function getBoardDanger(board: Board): number {
  "worklet";
  const empty = countEmptyBlocks(board);
  const largestRegion = getLargestEmptyRegion(board);
  const area = board.length * board.length;
  const emptyRatio = empty / area;
  const fragmentation = empty === 0 ? 1 : 1 - largestRegion / empty;
  return clamp(1 - emptyRatio * 1.35 + fragmentation * 0.65, 0, 1);
}

export function createSmartHandWorklet(board: Board, handSize: number): Hand {
  "worklet";
  const candidates: { hand: Hand; score: number }[] = [];

  for (let i = 0; i < SMART_HAND_ATTEMPTS; i++) {
    const hand = createRandomHandWorklet(handSize);
    const score = scoreHandCandidate(board, hand);
    if (score > -999999) {
      candidates.push({ hand, score });
    }
  }

  if (candidates.length === 0) {
    return createRandomHandWorklet(handSize);
  }

  candidates.sort((a, b) => a.score - b.score);

  const danger = getBoardDanger(board);
  const basePercentile = danger > 0.72 ? 0.82 : danger > 0.46 ? 0.64 : 0.48;
  const jitter = (Math.random() - 0.5) * 0.18;
  const percentile = clamp(basePercentile + jitter, 0, 1);
  const index = Math.round((candidates.length - 1) * percentile);

  return candidates[index].hand;
}
