import {
	Board,
	BoardBlock,
	BoardBlockType,
	BOARD_CELL_STEP,
	BOARD_FRAME_SIZE,
	BOARD_PADDING,
	GRID_BLOCK_SIZE,
	HITBOX_SIZE,
	PossibleBoardSpots,
} from "@/constants/Board";
import { uiColors } from "@/constants/Color";
import { Hand } from "@/constants/Hand";
import { BoardPieceAsset, getPiecePreviewColor, PieceCell, SolidBlockAsset } from "@/components/game/PieceAsset";
import { useDroppable } from "@mgcrea/react-native-dnd";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
	SharedValue,
	runOnJS,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

interface BlockGridProps {
	board: SharedValue<Board>;
	possibleBoardDropSpots: SharedValue<PossibleBoardSpots>;
	hand: SharedValue<Hand>;
	draggingPiece: SharedValue<number | null>;
	boardOriginX: SharedValue<number>;
	boardOriginY: SharedValue<number>;
}

function useCellAnimation(x: number, y: number, board: SharedValue<Board>) {
	const clearProgress = useSharedValue(0);
	const clearX = useSharedValue(0);
	const clearY = useSharedValue(0);

	useAnimatedReaction(
		() => board.value[y][x].blockType,
		(cur, prev) => {
			if (
				cur === BoardBlockType.EMPTY &&
				(prev === BoardBlockType.FILLED ||
					prev === BoardBlockType.HOVERED_BREAK_EMPTY ||
					prev === BoardBlockType.HOVERED_BREAK_FILLED)
			) {
				const angle = Math.random() * Math.PI * 2;
				clearX.value = Math.cos(angle) * 48;
				clearY.value = Math.sin(angle) * 48;
				clearProgress.value = 0;
				clearProgress.value = withTiming(1, { duration: 280 });
			}
		},
	);

	return useAnimatedStyle(() => {
		if (clearProgress.value <= 0) {
			return {};
		}
		return {
			opacity: 1 - clearProgress.value,
			transform: [
				{ translateX: clearX.value * clearProgress.value },
				{ translateY: clearY.value * clearProgress.value },
				{ scale: 1 - clearProgress.value * 0.35 },
			],
		};
	});
}

export default function BlockGrid({
	board,
	boardOriginX,
	boardOriginY,
}: BlockGridProps) {
	const boardLength = board.value.length;
	const [boardSnapshot, setBoardSnapshot] = useState<Board>(board.value);
	const blockElements: ReactNode[] = [];

	useAnimatedReaction(
		() =>
			board.value
				.map((row) =>
					row
						.map((block) =>
							[
								block.blockType,
								block.assetId ?? 0,
								block.assetX ?? -1,
								block.assetY ?? -1,
								block.assetOriginX ?? -1,
								block.assetOriginY ?? -1,
							].join(":"),
						)
						.join(","),
				)
				.join("|"),
		() => {
			const snapshot = board.value.map((row) =>
				row.map((block) => ({
					blockType: block.blockType,
					color: block.color,
					hoveredBreakColor: block.hoveredBreakColor,
					assetId: block.assetId,
					assetX: block.assetX,
					assetY: block.assetY,
					assetWidth: block.assetWidth,
					assetHeight: block.assetHeight,
					assetOriginX: block.assetOriginX,
					assetOriginY: block.assetOriginY,
				})),
			);
			runOnJS(setBoardSnapshot)(snapshot);
		},
	);

	for (let y = 0; y < boardLength; y++) {
		for (let x = 0; x < boardLength; x++) {
			blockElements.push(
				<GridBlock
					key={`${x}:${y}`}
					x={x}
					y={y}
					board={board}
				/>,
			);
		}
	}

	return (
		<View
			style={styles.boardFrame}
			onLayout={(event) => {
				boardOriginX.value = event.nativeEvent.layout.x;
				boardOriginY.value = event.nativeEvent.layout.y;
			}}
		>
			<BoardField boardLength={boardLength} />
			<LineClearPreviewLayer board={boardSnapshot} />
			<PlacedPieceLayer board={boardSnapshot} />
			<LineClearBlocksLayer board={boardSnapshot} />
			{blockElements}
		</View>
	);
}

function BoardField({ boardLength }: { boardLength: number }) {
	const cells: ReactNode[] = [];

	for (let y = 0; y < boardLength; y++) {
		for (let x = 0; x < boardLength; x++) {
			cells.push(
				<View
					key={`${x}:${y}`}
					style={[
						styles.boardCell,
						{
							left: BOARD_PADDING + x * BOARD_CELL_STEP,
							top: BOARD_PADDING + y * BOARD_CELL_STEP,
						},
					]}
				/>,
			);
		}
	}

	return (
		<View pointerEvents="none" style={styles.boardField}>
			<View style={styles.boardGrid}>{cells}</View>
		</View>
	);
}

function LineClearPreviewLayer({ board }: { board: Board }) {
	const rows = getPreviewRows(board);
	const columns = getPreviewColumns(board);

	return (
		<View pointerEvents="none" style={styles.linePreviewLayer}>
			{Array.from(rows).map((row) => (
				<LineGlow
					key={`row:${row}`}
					orientation="horizontal"
					style={{
						left: BOARD_PADDING - LINE_GLOW_OUTSET,
						top: BOARD_PADDING + row * BOARD_CELL_STEP - LINE_GLOW_OUTSET,
						width: BOARD_CELL_STEP * (board.length - 1) + GRID_BLOCK_SIZE + LINE_GLOW_OUTSET * 2,
						height: GRID_BLOCK_SIZE + LINE_GLOW_OUTSET * 2,
					}}
				/>
			))}
			{Array.from(columns).map((column) => (
				<LineGlow
					key={`column:${column}`}
					orientation="vertical"
					style={{
						left: BOARD_PADDING + column * BOARD_CELL_STEP - LINE_GLOW_OUTSET,
						top: BOARD_PADDING - LINE_GLOW_OUTSET,
						width: GRID_BLOCK_SIZE + LINE_GLOW_OUTSET * 2,
						height: BOARD_CELL_STEP * (board.length - 1) + GRID_BLOCK_SIZE + LINE_GLOW_OUTSET * 2,
					}}
				/>
			))}
		</View>
	);
}

function LineClearBlocksLayer({ board }: { board: Board }) {
	const assetId = getHoveredAssetId(board);
	if (!assetId) {
		return null;
	}

	const rows = getPreviewRows(board);
	const columns = getPreviewColumns(board);
	const cells = new Map<string, { x: number; y: number }>();

	for (const row of rows) {
		for (let x = 0; x < board.length; x++) {
			cells.set(`${x}:${row}`, { x, y: row });
		}
	}

	for (const column of columns) {
		for (let y = 0; y < board.length; y++) {
			cells.set(`${column}:${y}`, { x: column, y });
		}
	}

	if (cells.size === 0) {
		return null;
	}

	const color = getPiecePreviewColor(assetId);

	return (
		<View pointerEvents="none" style={styles.lineBlocksLayer}>
			{Array.from(cells.values()).map((cell) => (
				<View
					key={`${cell.x}:${cell.y}`}
					style={[
						styles.linePreviewBlock,
						{
							left: BOARD_PADDING + cell.x * BOARD_CELL_STEP,
							top: BOARD_PADDING + cell.y * BOARD_CELL_STEP,
						},
					]}
				>
					<SolidBlockAsset color={color} />
				</View>
			))}
		</View>
	);
}

function getHoveredAssetId(board: Board): number | undefined {
	for (const row of board) {
		for (const block of row) {
			if (block.blockType === BoardBlockType.HOVERED && block.assetId) {
				return block.assetId;
			}
		}
	}

	return undefined;
}

function isLinePreviewBlock(blockType: BoardBlockType): boolean {
	return (
		blockType === BoardBlockType.HOVERED ||
		blockType === BoardBlockType.HOVERED_BREAK_FILLED ||
		blockType === BoardBlockType.HOVERED_BREAK_EMPTY
	);
}

function getPreviewRows(board: Board): number[] {
	const rows: number[] = [];

	for (let y = 0; y < board.length; y++) {
		if (board[y].every((block) => isLinePreviewBlock(block.blockType))) {
			rows.push(y);
		}
	}

	return rows;
}

function getPreviewColumns(board: Board): number[] {
	const columns: number[] = [];

	for (let x = 0; x < board.length; x++) {
		if (board.every((row) => isLinePreviewBlock(row[x].blockType))) {
			columns.push(x);
		}
	}

	return columns;
}

function LineGlow({
	orientation,
	style,
}: {
	orientation: "horizontal" | "vertical";
	style: object;
}) {
	const start = orientation === "horizontal" ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 };
	const end = orientation === "horizontal" ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 };

	return (
		<View style={[styles.lineGlow, style]}>
			<LinearGradient
				start={start}
				end={end}
				colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.78)", "rgba(255, 255, 255, 0.1)"]}
				locations={[0, 0.5, 1]}
				style={styles.lineGlowCore}
			/>
		</View>
	);
}

type PieceGroup = {
	key: string;
	assetId: number;
	originX: number;
	originY: number;
	width: number;
	height: number;
	blockType: BoardBlockType;
	occupied: PieceCell[];
};

function PlacedPieceLayer({ board }: { board: Board }) {
	const groups = new Map<string, PieceGroup>();

	for (const row of board) {
		for (const block of row) {
			const visible =
				block.blockType === BoardBlockType.FILLED ||
				block.blockType === BoardBlockType.HOVERED ||
				block.blockType === BoardBlockType.HOVERED_BREAK_FILLED;
			if (
				!visible ||
				!block.assetId ||
				block.assetOriginX === undefined ||
				block.assetOriginY === undefined ||
				!block.assetWidth ||
				!block.assetHeight
			) {
				continue;
			}

			const visualBlockType =
				block.blockType === BoardBlockType.HOVERED_BREAK_FILLED ? BoardBlockType.FILLED : block.blockType;
			const key = `${block.assetOriginX}:${block.assetOriginY}:${block.assetId}:${visualBlockType}`;
			const group = groups.get(key) ?? {
				key,
				assetId: block.assetId,
				originX: block.assetOriginX,
				originY: block.assetOriginY,
				width: block.assetWidth,
				height: block.assetHeight,
				blockType: visualBlockType,
				occupied: [],
			};
			group.occupied.push({ x: block.assetX ?? 0, y: block.assetY ?? 0 });
			groups.set(key, group);
		}
	}

	return (
		<>
			{Array.from(groups.values()).map((group) => (
				<PlacedPiece key={group.key} group={group} />
			))}
		</>
	);
}

function PlacedPiece({ group }: { group: PieceGroup }) {
	const opacity = group.blockType === BoardBlockType.HOVERED ? 0.7 : 1;

	return (
		<View
			style={[
				styles.placedPiece,
				{
					left: BOARD_PADDING + group.originX * BOARD_CELL_STEP,
					top: BOARD_PADDING + group.originY * BOARD_CELL_STEP,
				},
			]}
		>
			<BoardPieceAsset
				assetId={group.assetId}
				width={group.width}
				height={group.height}
				cells={group.occupied}
				opacity={opacity}
			/>
		</View>
	);
}

function GridBlock({
	x,
	y,
	board,
}: {
	x: number;
	y: number;
	board: SharedValue<Board>;
}) {
	const [blockSnapshot, setBlockSnapshot] = useState<BoardBlock>(board.value[y][x]);
	const animatedCellStyle = useAnimatedStyle(() => {
		const block = board.value[y][x];
		return {
			opacity:
				block.blockType === BoardBlockType.HOVERED
					? 0.58
					: block.blockType === BoardBlockType.HOVERED_BREAK_FILLED ||
						  block.blockType === BoardBlockType.HOVERED_BREAK_EMPTY
						? 0.86
						: 1,
		};
	});

	useAnimatedReaction(
		() => {
			const block = board.value[y][x];
			return [
				block.blockType,
				block.assetId ?? 0,
				block.assetX ?? -1,
				block.assetY ?? -1,
				block.assetWidth ?? 0,
				block.assetHeight ?? 0,
			].join(":");
		},
		() => {
			const block = board.value[y][x];
			runOnJS(setBlockSnapshot)({
				blockType: block.blockType,
				color: block.color,
				hoveredBreakColor: block.hoveredBreakColor,
				assetId: block.assetId,
				assetX: block.assetX,
				assetY: block.assetY,
				assetWidth: block.assetWidth,
				assetHeight: block.assetHeight,
			});
		},
	);

	const clearStyle = useCellAnimation(x, y, board);
	const blockPositionStyle = {
		top: BOARD_PADDING + y * BOARD_CELL_STEP,
		left: BOARD_PADDING + x * BOARD_CELL_STEP,
	};

	return (
		<Animated.View style={[styles.cellLayer, blockPositionStyle, animatedCellStyle, clearStyle]}>
			<CellVisual block={blockSnapshot} />
			<BlockDroppable x={x} y={y} style={styles.hitbox} />
		</Animated.View>
	);
}

function CellVisual({ block }: { block: BoardBlock }) {
	if (
		(block.blockType === BoardBlockType.FILLED || block.blockType === BoardBlockType.HOVERED) &&
		block.assetId &&
		block.assetX !== undefined &&
		block.assetY !== undefined &&
		block.assetWidth &&
		block.assetHeight
	) {
		return null;
	}

	if (block.blockType === BoardBlockType.HOVERED_BREAK_FILLED) {
		return null;
	}

	if (block.blockType === BoardBlockType.HOVERED_BREAK_EMPTY) {
		return null;
	}

	return null;
}

interface BlockDroppableProps {
	children?: ReactNode;
	x: number;
	y: number;
	style: object;
}

function BlockDroppable({
	children,
	x,
	y,
	style,
	...otherProps
}: BlockDroppableProps) {
	const id = `${x},${y}`;
	const { props } = useDroppable({ id });

	return (
		<View {...props} style={style} {...otherProps}>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	boardFrame: {
		width: BOARD_FRAME_SIZE,
		height: BOARD_FRAME_SIZE,
		position: "relative",
		alignSelf: "center",
	},
	boardField: {
		width: BOARD_FRAME_SIZE,
		height: BOARD_FRAME_SIZE,
		position: "absolute",
		top: 0,
		left: 0,
		borderWidth: 2,
		borderColor: "#3A3A3A",
		borderRadius: 8,
		backgroundColor: "#1A1E20",
		overflow: "hidden",
	},
	boardGrid: {
		position: "absolute",
		top: 0,
		left: 0,
		width: BOARD_FRAME_SIZE,
		height: BOARD_FRAME_SIZE,
		backgroundColor: "#15191B",
	},
	boardCell: {
		position: "absolute",
		width: GRID_BLOCK_SIZE,
		height: GRID_BLOCK_SIZE,
		borderWidth: 2,
		borderColor: "#171D20",
		borderRadius: 4,
		backgroundColor: "#252D32",
	},
	linePreviewLayer: {
		position: "absolute",
		top: 0,
		left: 0,
		width: BOARD_FRAME_SIZE,
		height: BOARD_FRAME_SIZE,
	},
	lineBlocksLayer: {
		position: "absolute",
		top: 0,
		left: 0,
		width: BOARD_FRAME_SIZE,
		height: BOARD_FRAME_SIZE,
	},
	linePreviewBlock: {
		position: "absolute",
		width: GRID_BLOCK_SIZE,
		height: GRID_BLOCK_SIZE,
	},
	lineGlow: {
		position: "absolute",
		borderRadius: 6,
		backgroundColor: "rgba(255, 255, 255, 0.12)",
		boxShadow: "0px 0px 18px rgba(255, 255, 255, 0.72), 0px 0px 34px rgba(255, 255, 255, 0.32)",
		overflow: "hidden",
	},
	lineGlowCore: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.75,
	},
	cellLayer: {
		width: GRID_BLOCK_SIZE,
		height: GRID_BLOCK_SIZE,
		position: "absolute",
		justifyContent: "center",
		alignItems: "center",
	},
	placedPiece: {
		position: "absolute",
	},
	clearPreviewCell: {
		width: GRID_BLOCK_SIZE,
		height: GRID_BLOCK_SIZE,
		borderRadius: 4,
		backgroundColor: "rgba(255, 198, 1, 0.28)",
		borderWidth: 2,
		borderColor: uiColors.recordActive,
	},
	lineClearOverlay: {
		width: GRID_BLOCK_SIZE,
		height: GRID_BLOCK_SIZE,
		backgroundColor: "rgba(255, 198, 1, 0.24)",
		borderRadius: 4,
	},
	emptyLineClearOverlay: {
		borderWidth: 2,
		borderColor: uiColors.recordActive,
	},
	hitbox: {
		position: "absolute",
		width: HITBOX_SIZE,
		height: HITBOX_SIZE,
		left: (GRID_BLOCK_SIZE - HITBOX_SIZE) / 2,
		top: (GRID_BLOCK_SIZE - HITBOX_SIZE) / 2,
	},
});

const LINE_GLOW_OUTSET = 2;
