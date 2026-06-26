import { Color, colorToHex } from "./Color";

export interface PieceData {
	matrix: number[][];
	distributionPoints: number;
	color: Color;
	assetId: number;
}

// same as piecedata but with no color
// this is because color is random each time
// so we will use this one to store piece shape and info
interface PieceDataSaved {
	matrix: number[][];
	distributionPoints: number;
	assetId: number;
}

export const piecesData: PieceDataSaved[] = [
	// L-shape
	{
		assetId: 1,
		matrix: [
			[1, 0, 0],
			[1, 1, 1],
		],
		distributionPoints: 2,

	},
	{
		assetId: 2,
		matrix: [
			[1, 1],
			[1, 0],
			[1, 0],
		],
		distributionPoints: 2,

	},
	{
		assetId: 3,
		matrix: [
			[1, 1, 1],
			[0, 0, 1],
		],
		distributionPoints: 2,

	},
	{
		assetId: 4,
		matrix: [
			[0, 1],
			[0, 1],
			[1, 1],
		],
		distributionPoints: 2,

	},
	{
		assetId: 5,
		matrix: [
			[0, 0, 1],
			[1, 1, 1],
		],
		distributionPoints: 2,

	},
	{
		assetId: 6,
		matrix: [
			[1, 0],
			[1, 0],
			[1, 1],
		],
		distributionPoints: 2,

	},
	{
		assetId: 7,
		matrix: [
			[1, 1, 1],
			[1, 0, 0],
		],
		distributionPoints: 2,

	},
	{
		assetId: 8,
		matrix: [
			[1, 1],
			[0, 1],
			[0, 1],
		],
		distributionPoints: 2,

	},
	// Triangle shape
	{
		assetId: 9,
		matrix: [
			[1, 1, 1],
			[0, 1, 0],
		],
		distributionPoints: 1.5,

	},
	{
		assetId: 10,
		matrix: [
			[1, 0],
			[1, 1],
			[1, 0],
		],
		distributionPoints: 1.5,

	},
	{
		assetId: 11,
		matrix: [
			[0, 1, 0],
			[1, 1, 1],
		],
		distributionPoints: 1.5,

	},
	{
		assetId: 12,
		matrix: [
			[0, 1],
			[1, 1],
			[0, 1],
		],
		distributionPoints: 1.5,

	},
	// Z/S shape
	{
		assetId: 13,
		matrix: [
			[0, 1, 1],
			[1, 1, 0],
		],
		distributionPoints: 1,

	},
	{
		assetId: 14,
		matrix: [
			[1, 0],
			[1, 1],
			[0, 1],
		],
		distributionPoints: 1,

	},
	{
		assetId: 15,
		matrix: [
			[1, 1, 0],
			[0, 1, 1],
		],
		distributionPoints: 1,

	},
	{
		assetId: 16,
		matrix: [
			[0, 1],
			[1, 1],
			[1, 0],
		],
		distributionPoints: 1,

	},
	// 3x3
	{
		assetId: 17,
		matrix: [
			[1, 1, 1],
			[1, 1, 1],
			[1, 1, 1],
		],
		distributionPoints: 3,

	},
	// 2x2
	{
		assetId: 18,
		matrix: [
			[1, 1],
			[1, 1],
		],
		distributionPoints: 6,

	},
	// 4x1
	{
		assetId: 19,
		matrix: [
			[1],
			[1],
			[1],
			[1],
		],
		distributionPoints: 2,
	},
	// 1x4
	{
		assetId: 20,
		matrix: [
			[1, 1, 1, 1],
		],
		distributionPoints: 2,
	},
	// 3x1
	{
		assetId: 21,
		matrix: [
			[1],
			[1],
			[1],
		],
		distributionPoints: 4,
	},
	// 1x3
	{
		assetId: 22,
		matrix: [
			[1, 1, 1],
		],
		distributionPoints: 4,
	},
	// 2x1
	{
		assetId: 23,
		matrix: [
			[1],
			[1],
		],
		distributionPoints: 2,
	},
	// 1x2
	{
		assetId: 24,
		matrix: [
			[1, 1],
		],
		distributionPoints: 2,
	},
];

export const pieceColors = [
	{ r: 227, g: 143, b: 16 },
	{ r: 186, g: 19, b: 38 },
	{ r: 16, g: 158, b: 40 },
	{ r: 20, g: 56, b: 184 },
	{ r: 101, g: 19, b: 148 },
	{ r: 31, g: 165, b: 222 }
]

export function getBlockCount(piece: PieceData): number {
	"worklet";
	let count = 0;
	for (let y = 0; y < piece.matrix.length; y++) {
		for (let x = 0; x < piece.matrix[0].length; x++) {
			if (piece.matrix[y][x] == 1)
				count++;
		}
	}
	return count;
}

const totalDistributionPoints = piecesData.reduce((sum, piece) => sum + piece.distributionPoints, 0);

export function getRandomPieceColor(): Color {
	return pieceColors[Math.floor(Math.random() * pieceColors.length)];
}

export function getRandomPieceColorWorklet(): Color {
	"worklet";
	return pieceColors[Math.floor(Math.random() * pieceColors.length)];
}

export function getRandomPieceAssetId(assetId: number): number {
	if (assetId === 18) {
		return Math.random() < 0.5 ? 18 : 25;
	}

	return assetId;
}

export function getRandomPieceAssetIdWorklet(assetId: number): number {
	"worklet";
	if (assetId === 18) {
		return Math.random() < 0.5 ? 18 : 25;
	}

	return assetId;
}

export function getRandomPiece(): PieceData {
	let position = Math.random() * totalDistributionPoints;
	let piece: PieceDataSaved;
	for (let i = 0; i < piecesData.length; i++) {
		position -= piecesData[i].distributionPoints;
		if (position < 0) {
			piece = piecesData[i];
			break;
		}
	}

	return {
		...piece!,
		assetId: getRandomPieceAssetId(piece!.assetId),
		color: getRandomPieceColor()
	};
}

export function getRandomPieceWorklet(): PieceData {
	"worklet";
	let position = Math.random() * totalDistributionPoints;
	let piece: PieceDataSaved;
	for (let i = 0; i < piecesData.length; i++) {
		position -= piecesData[i].distributionPoints;
		if (position < 0) {
			piece = piecesData[i];
			break;
		}
	}

	return {
		...piece!,
		assetId: getRandomPieceAssetIdWorklet(piece!.assetId),
		color: getRandomPieceColorWorklet()
	};
}

function getBorderColors(backgroundColor: Color) {
	"worklet";
	const { r, g, b } = backgroundColor;

	// multipliers calculated from a screenshot
	const multipliers = {
		borderTopColor: { r: 214 / 131, g: 167 / 83, b: 247 / 203 },
		borderLeftColor: { r: 164 / 131, g: 119 / 83, b: 224 / 203 },
		borderRightColor: { r: 123 / 131, g: 69 / 83, b: 153 / 203 },
		borderBottomColor: { r: 92 / 131, g: 43 / 83, b: 132 / 203 }
	};

	const clamp = (value: number) => Math.min(Math.max(Math.round(value), 0), 255);

	const computeColor = (mult: any) =>
		`rgb(${clamp(r * mult.r)}, ${clamp(g * mult.g)}, ${clamp(b * mult.b)})`;

	return {
		borderTopColor: computeColor(multipliers.borderTopColor),
		borderLeftColor: computeColor(multipliers.borderLeftColor),
		borderRightColor: computeColor(multipliers.borderRightColor),
		borderBottomColor: computeColor(multipliers.borderBottomColor)
	};
}

export function createFilledBlockStyle(color: Color, borderWidth: number = 5): object {
	"worklet";
	const base = colorToHex(color);
	return {
		backgroundColor: base,
		...getBorderColors(color),
		borderWidth: borderWidth,
		borderRadius: 7,
		boxSizing: 'border-box',
		boxShadow: `0px 8px 18px rgba(${color.r}, ${color.g}, ${color.b}, 0.22)`,
		shadowColor: base,
		shadowOpacity: 0.24,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 5 },
	}
}

export function createEmptyBlockStyle(): object {
	"worklet";
	const borderColor = 'rgb(40, 40, 40)';
	return {
		backgroundColor: 'rgba(255, 255, 255, 0.025)',
		borderColor: borderColor,
		borderLeftColor: borderColor,
		borderTopColor: borderColor,
		borderRightColor: borderColor,
		borderBottomColor: borderColor,
		opacity: 1,
		borderWidth: 1,
		borderRadius: 7,
		boxSizing: 'border-box',
		boxShadow: 'none',
		shadowOpacity: 0,
	}
}
