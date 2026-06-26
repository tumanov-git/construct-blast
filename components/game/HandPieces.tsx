import { DRAG_JUMP_LENGTH, DRAG_UPWARD_GAIN, GRID_BLOCK_SIZE, HAND_BLOCK_SIZE } from "@/constants/Board";
import { Hand } from "@/constants/Hand";
import { PieceAssetImage } from "@/components/game/PieceAsset";
import { PieceData } from "@/constants/Piece";
import { SharedPoint, useDraggable } from "@mgcrea/react-native-dnd";
import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import Animated, {
	SharedValue,
	runOnJS,
	useAnimatedReaction,
	useAnimatedStyle,
} from "react-native-reanimated";
import { useCallback, useState } from "react";

const DRAG_LIFT_DISTANCE = DRAG_JUMP_LENGTH;
const HAND_SLOT_WIDTH = 108;
const HAND_SLOT_HEIGHT = 108;
const HAND_SLOT_GAP = 14;
const COMPACT_HAND_SLOT_WIDTH = 96;
const COMPACT_HAND_SLOT_HEIGHT = 96;
const COMPACT_HAND_SLOT_GAP = 8;
const COMPACT_HAND_BLOCK_SIZE = 30;

function getHandPieceScale(
	pieceWidth: number,
	pieceHeight: number,
	slotWidth: number,
	slotHeight: number,
	blockSize: number,
) {
	"worklet";
	const defaultScale = blockSize / GRID_BLOCK_SIZE;
	const fitWidthScale = slotWidth / (pieceWidth * GRID_BLOCK_SIZE);
	const fitHeightScale = slotHeight / (pieceHeight * GRID_BLOCK_SIZE);

	return Math.min(defaultScale, fitWidthScale, fitHeightScale);
}

interface HandProps {
	hand: SharedValue<Hand>;
	compact?: boolean;
}

export default function HandPieces({ hand, compact = false }: HandProps) {
	const handSize = hand.value.length;
	const handPieces = [];
	const slotWidth = compact ? COMPACT_HAND_SLOT_WIDTH : HAND_SLOT_WIDTH;
	const slotHeight = compact ? COMPACT_HAND_SLOT_HEIGHT : HAND_SLOT_HEIGHT;
	const slotGap = compact ? COMPACT_HAND_SLOT_GAP : HAND_SLOT_GAP;
	const blockSize = compact ? COMPACT_HAND_BLOCK_SIZE : HAND_BLOCK_SIZE;

	for (let i = 0; i < handSize; i++) {
		const id = String(i);

		const animatedStyle = (
			_sleeping: boolean,
			dragging: boolean,
			acting: boolean,
			offset: SharedPoint,
			currentHand: Hand,
		) => {
			"worklet";
			const piece = currentHand[i];
			if (piece == null) {
				return {
					width: GRID_BLOCK_SIZE,
					height: GRID_BLOCK_SIZE,
					opacity: 0,
					transform: [{ translateX: 0 }, { translateY: 0 }, { scale: getHandPieceScale(1, 1, slotWidth, slotHeight, blockSize) }],
				};
			}

			const pieceHeight = piece.matrix.length;
			const pieceWidth = piece.matrix[0].length;
			const restingScale = getHandPieceScale(pieceWidth, pieceHeight, slotWidth, slotHeight, blockSize);
			const visualTranslateY = offset.y.value < 0 ? offset.y.value * DRAG_UPWARD_GAIN : offset.y.value;

			return {
				width: pieceWidth * GRID_BLOCK_SIZE,
				height: pieceHeight * GRID_BLOCK_SIZE,
				opacity: 1,
				zIndex: dragging ? 999 : acting ? 998 : 1,
				bottom: dragging ? DRAG_LIFT_DISTANCE : 0,
				transform: [
					{ translateX: dragging || acting ? offset.x.value : 0 },
					{ translateY: dragging || acting ? visualTranslateY : 0 },
					{ scale: dragging ? 1 : restingScale },
				],
			};
		};

		handPieces.push(
			<View key={id} style={[styles.pieceSlot, { width: slotWidth, height: slotHeight }]}>
				<PieceDraggable id={id} createStyle={animatedStyle} hand={hand}>
					<HandPieceVisual hand={hand} handIndex={i} />
				</PieceDraggable>
			</View>,
		);
	}

	return (
		<View
			style={[
				styles.hand,
				{
					columnGap: slotGap,
					marginTop: compact ? 14 : 38,
					minHeight: compact ? COMPACT_HAND_SLOT_HEIGHT : HAND_BLOCK_SIZE * 3.5,
				},
			]}
		>
			{handPieces}
		</View>
	);
}

function HandPieceVisual({ hand, handIndex }: { hand: SharedValue<Hand>; handIndex: number }) {
	const [piece, setPiece] = useState<PieceData | null>(hand.value[handIndex]);

	useAnimatedReaction(
		() => hand.value[handIndex]?.assetId ?? 0,
		(assetId, prevAssetId) => {
			if (assetId !== prevAssetId) {
				runOnJS(setPiece)(hand.value[handIndex]);
			}
		},
	);

	if (!piece) {
		return null;
	}

	return (
		<PieceAssetImage
			assetId={piece.assetId}
			width={piece.matrix[0].length}
			height={piece.matrix.length}
			cellSize={GRID_BLOCK_SIZE}
		/>
	);
}

interface PieceDraggableProps {
	children: ReactNode;
	id: string;
	createStyle: (
		sleeping: boolean,
		dragging: boolean,
		acting: boolean,
		offset: SharedPoint,
		hand: Hand,
	) => object;
	hand: SharedValue<Hand>;
}

function PieceDraggable({ children, id, createStyle, hand, ...otherProps }: PieceDraggableProps) {
	const { props, offset, state, setNodeLayout } = useDraggable({ id });

	const updateLayout = useCallback(() => {
		(setNodeLayout as any)(null);
	}, [setNodeLayout]);

	useAnimatedReaction(
		() => hand.value[Number(id)]?.assetId ?? 0,
		(assetId, prevAssetId) => {
			if (assetId !== prevAssetId) {
				runOnJS(updateLayout)();
			}
		},
		[id],
	);

	useAnimatedReaction(
		() => state.value,
		(nextState, prevState) => {
			if (nextState === "resting" && nextState !== prevState) {
				runOnJS(updateLayout)();
			}
		},
	);

	const animatedStyle = useAnimatedStyle(() => {
		return createStyle(state.value === "sleeping", state.value === "dragging", state.value === "acting", offset, hand.value);
	}, [state, hand]);

	return (
		<Animated.View {...props} style={animatedStyle} {...otherProps}>
			{children}
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	hand: {
		width: "100%",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	pieceSlot: {
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
});
