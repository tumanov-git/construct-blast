import { BOARD_CELL_STEP, GRID_BLOCK_SIZE } from "@/constants/Board";
import { piecesData } from "@/constants/Piece";
import type { ReactNode } from "react";
import { useId } from "react";
import { Image, ImageSourcePropType, View } from "react-native";
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path, Rect } from "react-native-svg";

const pieceAssetSources: Record<number, ImageSourcePropType> = {
	1: require("@/assets/blocks/01.png"),
	2: require("@/assets/blocks/02.png"),
	3: require("@/assets/blocks/03.png"),
	4: require("@/assets/blocks/04.png"),
	5: require("@/assets/blocks/05.png"),
	6: require("@/assets/blocks/06.png"),
	7: require("@/assets/blocks/07.png"),
	8: require("@/assets/blocks/08.png"),
	9: require("@/assets/blocks/09.png"),
	10: require("@/assets/blocks/10.png"),
	11: require("@/assets/blocks/11.png"),
	12: require("@/assets/blocks/12.png"),
	13: require("@/assets/blocks/13.png"),
	14: require("@/assets/blocks/14.png"),
	15: require("@/assets/blocks/15.png"),
	16: require("@/assets/blocks/16.png"),
	17: require("@/assets/blocks/17.png"),
	18: require("@/assets/blocks/18.png"),
	19: require("@/assets/blocks/19.png"),
	20: require("@/assets/blocks/20.png"),
	21: require("@/assets/blocks/21.png"),
	22: require("@/assets/blocks/22.png"),
	23: require("@/assets/blocks/23.png"),
	24: require("@/assets/blocks/24.png"),
	25: require("@/assets/blocks/25.png"),
};

const piecePreviewColors: Record<number, string> = {
	1: "#111111",
	2: "#111111",
	3: "#10499A",
	4: "#B71212",
	5: "#FF4800",
	6: "#ED4D79",
	7: "#CDCDCD",
	8: "#49B5E8",
	9: "#B71212",
	10: "#57CA12",
	11: "#CDCDCD",
	12: "#34A711",
	13: "#CDCDCD",
	14: "#2834D5",
	15: "#CDCDCD",
	16: "#E96A37",
	17: "#CDCDCD",
	18: "#CDCDCD",
	19: "#CDCDCD",
	20: "#111111",
	21: "#CDCDCD",
	22: "#CDCDCD",
	23: "#B86614",
	24: "#959595",
	25: "#CDCDCD",
};

export type PieceCell = {
	x: number;
	y: number;
};

export function getPieceAssetSource(assetId: number): ImageSourcePropType {
	return pieceAssetSources[assetId];
}

export function getPiecePreviewColor(assetId: number): string {
	return piecePreviewColors[assetId] ?? "#CDCDCD";
}

export function PieceAssetImage({
	assetId,
	width,
	height,
	cellSize,
	cellStep,
	opacity = 1,
}: {
	assetId: number;
	width: number;
	height: number;
	cellSize: number;
	cellStep?: number;
	opacity?: number;
}) {
	const step = cellStep ?? cellSize;
	const targetWidth = width * step;
	const targetHeight = height * step;

	return (
		<View style={{ width: targetWidth, height: targetHeight, opacity }}>
			<Image source={getPieceAssetSource(assetId)} resizeMode="stretch" style={fillStyle} />
			<PieceBevelOverlay
				width={width}
				height={height}
				cellSize={cellSize}
				cellStep={step}
				cells={matrixToCells(getPieceMatrix(assetId))}
			/>
		</View>
	);
}

export function BoardPieceAsset({
	assetId,
	width,
	height,
	cells,
	opacity = 1,
}: {
	assetId: number;
	width: number;
	height: number;
	cells: PieceCell[];
	opacity?: number;
}) {
	const clipId = `pieceClip${useId().replace(/:/g, "")}`;
	const targetWidth = width * GRID_BLOCK_SIZE + (width - 1) * boardGap;
	const targetHeight = height * GRID_BLOCK_SIZE + (height - 1) * boardGap;
	const shapeRects = getShapeRects(cells, BOARD_CELL_STEP, GRID_BLOCK_SIZE);

	return (
		<View style={{ width: targetWidth, height: targetHeight, opacity }}>
			<Svg width={targetWidth} height={targetHeight} viewBox={`0 0 ${targetWidth} ${targetHeight}`}>
				<Defs>
					<ClipPath id={clipId}>
						{shapeRects.map((rect, index) => (
							<Rect
								key={index}
								x={rect.left}
								y={rect.top}
								width={rect.right - rect.left}
								height={rect.bottom - rect.top}
							/>
						))}
					</ClipPath>
				</Defs>
				<SvgImage
					href={getPieceAssetSource(assetId)}
					width={targetWidth}
					height={targetHeight}
					preserveAspectRatio="none"
					clipPath={`url(#${clipId})`}
				/>
			</Svg>
			<PieceBevelOverlay
				width={width}
				height={height}
				cellSize={GRID_BLOCK_SIZE}
				cellStep={BOARD_CELL_STEP}
				cells={cells}
			/>
		</View>
	);
}

export function SolidBlockAsset({
	color,
	size = GRID_BLOCK_SIZE,
}: {
	color: string;
	size?: number;
}) {
	return (
		<View style={{ width: size, height: size }}>
			<View style={[solidBlockStyle, { backgroundColor: color }]} />
			<PieceBevelOverlay width={1} height={1} cellSize={size} cellStep={size} cells={[{ x: 0, y: 0 }]} />
		</View>
	);
}

function PieceBevelOverlay({
	width,
	height,
	cellSize,
	cellStep,
	cells,
}: {
	width: number;
	height: number;
	cellSize: number;
	cellStep: number;
	cells: PieceCell[];
}) {
	const clipId = `bevelClip${useId().replace(/:/g, "")}`;
	const gap = Math.max(cellStep - cellSize, 0);
	const totalWidth = width * cellSize + (width - 1) * gap;
	const totalHeight = height * cellSize + (height - 1) * gap;
	const bevel = Math.max(2, (cellSize * 7) / 46);
	const shapeRects = getShapeRects(cells, cellStep, cellSize);
	const paths = getInsetBevelPaths(cells, cellStep, cellSize, bevel);

	return (
		<Svg
			width={totalWidth}
			height={totalHeight}
			viewBox={`0 0 ${totalWidth} ${totalHeight}`}
			pointerEvents="none"
			style={overlayStyle}
		>
			<Defs>
				<ClipPath id={clipId}>
					{shapeRects.map((rect, index) => (
						<Rect
							key={index}
							x={rect.left}
							y={rect.top}
							width={rect.right - rect.left}
							height={rect.bottom - rect.top}
						/>
					))}
				</ClipPath>
			</Defs>
			<G clipPath={`url(#${clipId})`} style={overlayBlendStyle}>
				{paths}
			</G>
		</Svg>
	);
}

type ShapeRect = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

type Point = {
	x: number;
	y: number;
};

type Normal = {
	x: -1 | 0 | 1;
	y: -1 | 0 | 1;
};

type BevelEdge = {
	start: Point;
	end: Point;
	normal: Normal;
	side: "top" | "left" | "right" | "bottom";
};

function getShapeRects(cells: PieceCell[], cellStep: number, cellSize: number): ShapeRect[] {
	const occupied = createCellSet(cells);

	return cells.map((cell) => {
		const left = cell.x * cellStep;
		const top = cell.y * cellStep;
		const connectRight = occupied.has(cellKey(cell.x + 1, cell.y));
		const connectBottom = occupied.has(cellKey(cell.x, cell.y + 1));

		return {
			left,
			top,
			right: left + cellSize + (connectRight ? cellStep - cellSize : 0),
			bottom: top + cellSize + (connectBottom ? cellStep - cellSize : 0),
		};
	});
}

function getInsetBevelPaths(
	cells: PieceCell[],
	cellStep: number,
	cellSize: number,
	bevel: number,
): ReactNode[] {
	return getBoundaryLoops(getShapeRects(cells, cellStep, cellSize)).flatMap((loop, loopIndex) =>
		loop.map((edge, edgeIndex) => {
			const previous = loop[(edgeIndex - 1 + loop.length) % loop.length];
			const next = loop[(edgeIndex + 1) % loop.length];
			const innerStart = getInsetJoinPoint(edge.start, previous.normal, edge.normal, bevel);
			const innerEnd = getInsetJoinPoint(edge.end, edge.normal, next.normal, bevel);
			const color = getSideColor(edge.side);

			return (
				<Path
					key={`${loopIndex}:${edgeIndex}`}
					d={`M ${edge.start.x} ${edge.start.y} L ${edge.end.x} ${edge.end.y} L ${innerEnd.x} ${innerEnd.y} L ${innerStart.x} ${innerStart.y} Z`}
					fill={color.fill}
					opacity={color.opacity}
				/>
			);
		}),
	);
}

function getBoundaryLoops(rects: ShapeRect[]): BevelEdge[][] {
	const edges = getShapeBoundaryEdges(rects);
	const outgoing = new Map<string, BevelEdge[]>();

	for (const edge of edges) {
		const key = pointKey(edge.start);
		const list = outgoing.get(key) ?? [];
		list.push(edge);
		outgoing.set(key, list);
	}

	const used = new Set<BevelEdge>();
	const loops: BevelEdge[][] = [];

	for (const firstEdge of edges) {
		if (used.has(firstEdge)) {
			continue;
		}

		const loop: BevelEdge[] = [];
		let edge: BevelEdge | undefined = firstEdge;

		while (edge && !used.has(edge)) {
			used.add(edge);
			loop.push(edge);

			const candidates: BevelEdge[] = outgoing.get(pointKey(edge.end)) ?? [];
			edge = candidates.find((candidate: BevelEdge) => !used.has(candidate));
		}

		if (loop.length > 0 && pointsEqual(loop[0].start, loop[loop.length - 1].end)) {
			loops.push(mergeCollinearEdges(loop));
		}
	}

	return loops;
}

function getShapeBoundaryEdges(rects: ShapeRect[]): BevelEdge[] {
	const xs = uniqueSorted(rects.flatMap((rect) => [rect.left, rect.right]));
	const ys = uniqueSorted(rects.flatMap((rect) => [rect.top, rect.bottom]));
	const columns = xs.length - 1;
	const rows = ys.length - 1;
	const filled = new Array(rows).fill(null).map(() => new Array(columns).fill(false));

	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			const centerX = (xs[x] + xs[x + 1]) / 2;
			const centerY = (ys[y] + ys[y + 1]) / 2;
			filled[y][x] = rects.some(
				(rect) => centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom,
			);
		}
	}

	const edges: BevelEdge[] = [];

	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			if (!filled[y][x]) {
				continue;
			}

			const left = xs[x];
			const right = xs[x + 1];
			const top = ys[y];
			const bottom = ys[y + 1];

			if (y === 0 || !filled[y - 1][x]) {
				edges.push({
					start: { x: left, y: top },
					end: { x: right, y: top },
					normal: { x: 0, y: 1 },
					side: "top",
				});
			}
			if (x === columns - 1 || !filled[y][x + 1]) {
				edges.push({
					start: { x: right, y: top },
					end: { x: right, y: bottom },
					normal: { x: -1, y: 0 },
					side: "right",
				});
			}
			if (y === rows - 1 || !filled[y + 1][x]) {
				edges.push({
					start: { x: right, y: bottom },
					end: { x: left, y: bottom },
					normal: { x: 0, y: -1 },
					side: "bottom",
				});
			}
			if (x === 0 || !filled[y][x - 1]) {
				edges.push({
					start: { x: left, y: bottom },
					end: { x: left, y: top },
					normal: { x: 1, y: 0 },
					side: "left",
				});
			}
		}
	}

	return edges;
}

function getInsetJoinPoint(point: Point, previousNormal: Normal, nextNormal: Normal, bevel: number): Point {
	const sameDirection = previousNormal.x === nextNormal.x && previousNormal.y === nextNormal.y;
	const x = point.x + (sameDirection ? nextNormal.x : previousNormal.x + nextNormal.x) * bevel;
	const y = point.y + (sameDirection ? nextNormal.y : previousNormal.y + nextNormal.y) * bevel;

	return { x, y };
}

function mergeCollinearEdges(loop: BevelEdge[]): BevelEdge[] {
	const merged: BevelEdge[] = [];

	for (const edge of loop) {
		const previous = merged[merged.length - 1];
		if (
			previous &&
			previous.side === edge.side &&
			previous.normal.x === edge.normal.x &&
			previous.normal.y === edge.normal.y &&
			pointsEqual(previous.end, edge.start)
		) {
			previous.end = edge.end;
		} else {
			merged.push({ ...edge, start: { ...edge.start }, end: { ...edge.end } });
		}
	}

	const first = merged[0];
	const last = merged[merged.length - 1];
	if (
		first &&
		last &&
		first !== last &&
		first.side === last.side &&
		first.normal.x === last.normal.x &&
		first.normal.y === last.normal.y &&
		pointsEqual(last.end, first.start)
	) {
		last.end = first.end;
		merged.shift();
	}

	return merged;
}

function getSideColor(side: BevelEdge["side"]): { fill: string; opacity: number } {
	switch (side) {
		case "top":
			return { fill: "#FFFFFF", opacity: 1 };
		case "left":
			return { fill: "#FFFFFF", opacity: 0.7 };
		case "right":
			return { fill: "#000000", opacity: 0.3 };
		case "bottom":
			return { fill: "#000000", opacity: 0.6 };
	}
}

function uniqueSorted(values: number[]): number[] {
	return Array.from(new Set(values)).sort((a, b) => a - b);
}

function pointKey(point: Point): string {
	return `${point.x}:${point.y}`;
}

function pointsEqual(a: Point, b: Point): boolean {
	return a.x === b.x && a.y === b.y;
}

function getPieceMatrix(assetId: number): number[][] {
	if (assetId === 25) {
		return piecesData.find((piece) => piece.assetId === 18)?.matrix ?? [[1, 1], [1, 1]];
	}

	return piecesData.find((piece) => piece.assetId === assetId)?.matrix ?? [[1]];
}

function matrixToCells(matrix: number[][]): PieceCell[] {
	const cells: PieceCell[] = [];
	for (let y = 0; y < matrix.length; y++) {
		for (let x = 0; x < matrix[y].length; x++) {
			if (matrix[y][x] === 1) {
				cells.push({ x, y });
			}
		}
	}
	return cells;
}

function createCellSet(cells: PieceCell[]): Set<string> {
	return new Set(cells.map((cell) => cellKey(cell.x, cell.y)));
}

function cellKey(x: number, y: number): string {
	return `${x}:${y}`;
}

const boardGap = BOARD_CELL_STEP - GRID_BLOCK_SIZE;

const fillStyle = {
	width: "100%" as const,
	height: "100%" as const,
};

const solidBlockStyle = {
	width: "100%" as const,
	height: "100%" as const,
};

const overlayStyle = {
	position: "absolute" as const,
	top: 0,
	left: 0,
};

const overlayBlendStyle = {
	mixBlendMode: "overlay",
} as any;
