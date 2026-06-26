import { PieceData, getBlockCount } from '@/constants/Piece';
import { DndProvider, DndProviderProps, Rectangle } from '@mgcrea/react-native-dnd';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { ReduceMotion, runOnJS, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BoardBlockType, BOARD_CELL_STEP, BOARD_PADDING, DRAG_JUMP_LENGTH, DRAG_UPWARD_GAIN, GRID_BLOCK_SIZE, JS_emptyPossibleBoardSpots, PossibleBoardSpots, XYPoint, breakLines, clearHoverBlocks, cloneBoard, createPossibleBoardSpots, emptyPossibleBoardSpots, newEmptyBoard, placePieceOntoBoard, updateHoveredBreaks } from '@/constants/Board';
import { StatsGameHud, StickyGameHud } from '@/components/game/GameHud';
import BlockGrid from '@/components/game/BlockGrid';
import HandPieces from '@/components/game/HandPieces';
import { GameModeType, MenuStateType, useAppState } from '@/hooks/useAppState';
import { createHighScore, HighScoreId, updateHighScore } from '@/constants/Storage';
import { canPlaceAnyPiece, createSmartHandWorklet } from '@/constants/GameIntelligence';
import GameOverOverlay from './GameOverOverlay';
import { useSettings } from '@/hooks/useSettings';
import { uiColors } from '@/constants/Color';
import { getTelegramWebApp } from '@/constants/Telegram';
import { startTournamentRun, submitTournamentScore, TournamentRun } from '@/constants/Leaderboard';

// layout = active/dragging
const pieceOverlapsRectangle = (layout: Rectangle, other: Rectangle) => {
	"worklet";
	if (other.width == 0 && other.height == 0) {
		return false;
	}

	const visualY = layout.y - DRAG_JUMP_LENGTH;

	return (
		layout.x < other.x + other.width &&
		layout.x + GRID_BLOCK_SIZE > other.x &&
		visualY < other.y + other.height &&
		visualY + GRID_BLOCK_SIZE > other.y
	);
};

const SPRING_CONFIG_MISSED_DRAG = {
	mass: 1,
	damping: 1,
	stiffness: 500,
	overshootClamping: true,
	restDisplacementThreshold: 0.01,
	restSpeedThreshold: 0.01,
	reduceMotion: ReduceMotion.Never,
}

const MAGNET_ATTACH_DISTANCE_CELLS = 1;
const MAGNET_RELEASE_DISTANCE_CELLS = 1;

function getRawDropFromLayout(
	activeLayout: Rectangle,
	translationY: number,
	boardOriginX: number,
	boardOriginY: number,
): XYPoint {
	"worklet";
	const extraLiftY = translationY < 0 ? translationY * (DRAG_UPWARD_GAIN - 1) : 0;
	const visualX = activeLayout.x;
	const visualY = activeLayout.y - DRAG_JUMP_LENGTH + extraLiftY;

	return {
		x: Math.round((visualX - boardOriginX - BOARD_PADDING) / BOARD_CELL_STEP),
		y: Math.round((visualY - boardOriginY - BOARD_PADDING) / BOARD_CELL_STEP),
	};
}

function getCellDistance(ax: number, ay: number, bx: number, by: number): number {
	"worklet";
	const dx = ax - bx;
	const dy = ay - by;
	return Math.sqrt(dx * dx + dy * dy);
}

function canDropOnSpot(spots: PossibleBoardSpots, dropX: number, dropY: number): boolean {
	"worklet";
	const row = spots[dropY];
	return row !== undefined && row[dropX] === 1;
}

function getNearestPossibleDrop(
	spots: PossibleBoardSpots,
	rawX: number,
	rawY: number,
	maxDistance: number,
): XYPoint | null {
	"worklet";
	let best: XYPoint | null = null;
	let bestDistance = maxDistance;

	for (let y = 0; y < spots.length; y++) {
		for (let x = 0; x < spots[y].length; x++) {
			if (spots[y][x] !== 1) {
				continue;
			}

			const distance = getCellDistance(rawX, rawY, x, y);
			if (distance <= bestDistance) {
				bestDistance = distance;
				best = { x, y };
			}
		}
	}

	return best;
}

function getPreviewDrop(
	spots: PossibleBoardSpots,
	rawX: number,
	rawY: number,
	stickyX: number,
	stickyY: number,
): { drop: XYPoint | null; sticky: boolean } {
	"worklet";
	if (canDropOnSpot(spots, rawX, rawY)) {
		return { drop: { x: rawX, y: rawY }, sticky: false };
	}

	if (
		stickyX >= 0 &&
		stickyY >= 0 &&
		canDropOnSpot(spots, stickyX, stickyY) &&
		getCellDistance(rawX, rawY, stickyX, stickyY) <= MAGNET_RELEASE_DISTANCE_CELLS
	) {
		return { drop: { x: stickyX, y: stickyY }, sticky: true };
	}

	const nearest = getNearestPossibleDrop(
		spots,
		rawX,
		rawY,
		MAGNET_ATTACH_DISTANCE_CELLS,
	);

	return { drop: nearest, sticky: nearest != null };
}

function runImpactHapticJS(style: Haptics.ImpactFeedbackStyle) {
	if (Platform.OS === "web") {
		const webApp = getTelegramWebApp();
		const telegramStyle =
			style === Haptics.ImpactFeedbackStyle.Heavy ? "heavy" :
			style === Haptics.ImpactFeedbackStyle.Medium ? "medium" :
			"light";
		webApp?.HapticFeedback?.impactOccurred?.(telegramStyle);
		return;
	}

	Haptics.impactAsync(style);
}

function runSelectionHapticJS() {
	if (Platform.OS === "web") {
		getTelegramWebApp()?.HapticFeedback?.selectionChanged?.();
		return;
	}

	Haptics.selectionAsync();
}

function runPiecePlacedHaptic() {
	"worklet";
	runOnJS(runImpactHapticJS)(Haptics.ImpactFeedbackStyle.Light);
}

function runPreviewChangedHaptic() {
	"worklet";
	runOnJS(runSelectionHapticJS)();
}

function runLineBreakHaptic(linesBroken: number) {
	"worklet";
	runOnJS(runImpactHapticJS)(
		linesBroken >= 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
	);
}

export const Game = (({gameMode}: {gameMode: GameModeType}) => {
	const boardLength = 8;
	const handSize = 3;
	const board = useSharedValue(newEmptyBoard(boardLength));
	const draggingPiece = useSharedValue<number | null>(null);
	const possibleBoardDropSpots = useSharedValue<PossibleBoardSpots>(JS_emptyPossibleBoardSpots(boardLength));
	const previewDropX = useSharedValue(-1);
	const previewDropY = useSharedValue(-1);
	const stickyDropX = useSharedValue(-1);
	const stickyDropY = useSharedValue(-1);
	const boardOriginX = useSharedValue(0);
	const boardOriginY = useSharedValue(0);
	const hand = useSharedValue(createSmartHandWorklet(board.value, handSize));
	const score = useSharedValue(0);
	const combo = useSharedValue(0);
	// How many moves ago was the last broken line?
	const lastBrokenLine = useSharedValue(0);
	const scoreStorageId = useSharedValue<HighScoreId | undefined>(undefined);
	const hapticsEnabled = useSharedValue(true);
	const [settings] = useSettings();
	const [_appState, setAppState] = useAppState();
	const [gameOver, setGameOver] = useState(false);
	const [finalScore, setFinalScore] = useState(0);
	const [runVersion, setRunVersion] = useState(0);
	const tournamentRunRef = useRef<TournamentRun | null>(null);
	const { height: windowHeight } = useWindowDimensions();
	const [telegramViewportHeight, setTelegramViewportHeight] = useState<number | null>(null);
	const viewportHeight = telegramViewportHeight ?? windowHeight;
	const compactLayout = viewportHeight > 0 && viewportHeight <= 700;

	useEffect(() => {
		const webApp = getTelegramWebApp();
		if (!webApp) {
			return;
		}

		const updateViewportHeight = () => {
			const nextHeight = webApp.viewportStableHeight || webApp.viewportHeight || null;
			setTelegramViewportHeight(Number.isFinite(nextHeight) ? nextHeight : null);
		};

		updateViewportHeight();
		webApp.onEvent?.("viewportChanged", updateViewportHeight);

		return () => {
			webApp.offEvent?.("viewportChanged", updateViewportHeight);
		};
	}, []);

	useEffect(() => {
		scoreStorageId.value = undefined;
		createHighScore({score: score.value, date: new Date().getTime(), type: gameMode}).then((id) => {
			scoreStorageId.value = id;
		});
	}, [gameMode, runVersion, scoreStorageId]);

	useEffect(() => {
		let alive = true;
		tournamentRunRef.current = null;
		startTournamentRun()
			.then((run) => {
				if (alive) {
					tournamentRunRef.current = run;
				}
			})
			.catch((error) => {
				console.warn("Tournament run start failed", error);
			});

		return () => {
			alive = false;
		};
	}, [gameMode, runVersion]);

	useEffect(() => {
		hapticsEnabled.value = settings.hapticsEnabled;
	}, [settings.hapticsEnabled, hapticsEnabled]);

	const finishGame = (scoreValue: number) => {
		setFinalScore(scoreValue);
		setGameOver(true);
		submitTournamentScore(scoreValue, tournamentRunRef.current).catch((error) => {
			console.warn("Tournament score submit failed", error);
		});
	};

	const resetRun = () => {
		const nextBoard = newEmptyBoard(boardLength);
		board.value = nextBoard;
		draggingPiece.value = null;
		possibleBoardDropSpots.value = JS_emptyPossibleBoardSpots(boardLength);
		previewDropX.value = -1;
		previewDropY.value = -1;
		stickyDropX.value = -1;
		stickyDropY.value = -1;
		hand.value = createSmartHandWorklet(nextBoard, handSize);
		score.value = 0;
		combo.value = 0;
		lastBrokenLine.value = 0;
		scoreStorageId.value = undefined;
		setFinalScore(0);
		setGameOver(false);
		setRunVersion((current) => current + 1);
	};

	const returnToMenu = () => {
		setAppState(MenuStateType.MENU);
	};

	const handleDragEnd: DndProviderProps["onDragEnd"] = () => {
		"worklet";
		if (draggingPiece.value == null) {
			return;
		}

		const dropX = previewDropX.value;
		const dropY = previewDropY.value;

		if (!canDropOnSpot(possibleBoardDropSpots.value, dropX, dropY)) {
			board.value = clearHoverBlocks(cloneBoard(board.value));
			draggingPiece.value = null;
			possibleBoardDropSpots.value = emptyPossibleBoardSpots(boardLength);
			previewDropX.value = -1;
			previewDropY.value = -1;
			stickyDropX.value = -1;
			stickyDropY.value = -1;
			return;
		}

		const piece: PieceData = hand.value[draggingPiece.value!]!;

		// the block is gonna fit, let's place the block
		// we'll do the haptics now
		if (Platform.OS != 'web' && hapticsEnabled.value)
			runPiecePlacedHaptic();

		const newBoard = clearHoverBlocks(cloneBoard(board.value));
		placePieceOntoBoard(newBoard, piece, dropX, dropY, BoardBlockType.FILLED)
		const linesBroken = breakLines(newBoard);
		if (linesBroken > 0 && hapticsEnabled.value) {
			runLineBreakHaptic(linesBroken);
		}
		// add score from placing block
		const pieceBlockCount = getBlockCount(piece);
		score.value += pieceBlockCount;
		if (linesBroken > 0) {
			lastBrokenLine.value = 0;
			combo.value += linesBroken;
			// line break score + combo multiplier stuff
			score.value += linesBroken * boardLength * (combo.value / 2) * pieceBlockCount;
		} else {
			lastBrokenLine.value++;
			if (lastBrokenLine.value >= handSize) {
				combo.value = 0;
			}
		}
		if (scoreStorageId.value != undefined)
			runOnJS(updateHighScore)(scoreStorageId.value!, {score: score.value, date: new Date().getTime(), type: gameMode});
		
		const newHand = [...hand.value];
		newHand[draggingPiece.value!] = null;

		// is hand empty?
		let empty = true
		for (let i = 0; i < handSize; i++) {
			if (newHand[i] != null) {
				empty = false;
				break;
			}
		}
		if (empty) {
			hand.value = createSmartHandWorklet(newBoard, handSize);
		} else {
			hand.value = newHand;
		}
		board.value = newBoard;
		if (!canPlaceAnyPiece(newBoard, hand.value)) {
			runOnJS(finishGame)(score.value);
		}
		draggingPiece.value = null;
		possibleBoardDropSpots.value = emptyPossibleBoardSpots(boardLength);
		previewDropX.value = -1;
		previewDropY.value = -1;
		stickyDropX.value = -1;
		stickyDropY.value = -1;
	};

	const handleBegin: DndProviderProps["onBegin"] = (event, meta) => {
		"worklet";
		const handIndex = Number(meta.activeId.toString());
		if (hand.value[handIndex] != null) {
			draggingPiece.value = handIndex;
			possibleBoardDropSpots.value = createPossibleBoardSpots(board.value, hand.value[handIndex]);
			previewDropX.value = -1;
			previewDropY.value = -1;
			stickyDropX.value = -1;
			stickyDropY.value = -1;
		}
	};

	const handleFinalize: DndProviderProps["onFinalize"] = ({ state }) => {
		"worklet";
		if (state !== State.END) {
			draggingPiece.value = null;
			previewDropX.value = -1;
			previewDropY.value = -1;
			stickyDropX.value = -1;
			stickyDropY.value = -1;
		}
	};

	const handleUpdate: DndProviderProps["onUpdate"] = (event, {activeLayout}) => {
		"worklet";
		if (draggingPiece.value == null) {
			return;
		}

		const rawDrop = getRawDropFromLayout(
			activeLayout,
			event.translationY,
			boardOriginX.value,
			boardOriginY.value,
		);
		const preview = getPreviewDrop(
			possibleBoardDropSpots.value,
			rawDrop.x,
			rawDrop.y,
			stickyDropX.value,
			stickyDropY.value,
		);
		if (!preview.drop) {
			if (previewDropX.value >= 0 || previewDropY.value >= 0) {
				board.value = clearHoverBlocks(cloneBoard(board.value));
			}
			previewDropX.value = -1;
			previewDropY.value = -1;
			stickyDropX.value = -1;
			stickyDropY.value = -1;
			return;
		}

		const piece: PieceData = hand.value[draggingPiece.value!]!;
		const nextStickyX = preview.sticky ? preview.drop.x : -1;
		const nextStickyY = preview.sticky ? preview.drop.y : -1;

		if (
			previewDropX.value === preview.drop.x &&
			previewDropY.value === preview.drop.y &&
			stickyDropX.value === nextStickyX &&
			stickyDropY.value === nextStickyY
		) {
			return;
		}

		if (hapticsEnabled.value) {
			runPreviewChangedHaptic();
		}

		const newBoard = clearHoverBlocks(cloneBoard(board.value));
		updateHoveredBreaks(newBoard, piece, preview.drop.x, preview.drop.y);

		previewDropX.value = preview.drop.x;
		previewDropY.value = preview.drop.y;
		stickyDropX.value = nextStickyX;
		stickyDropY.value = nextStickyY;
		board.value = newBoard
	}
	
	return (        
		<SafeAreaView style={styles.root}>
			<GestureHandlerRootView style={styles.root}>
				<View style={styles.root}>
					<StickyGameHud gameMode={gameMode} score={score} compact={compactLayout}></StickyGameHud>
					<DndProvider shouldDropWorklet={pieceOverlapsRectangle} springConfig={SPRING_CONFIG_MISSED_DRAG} onBegin={handleBegin} onFinalize={handleFinalize} onDragEnd={handleDragEnd} onUpdate={handleUpdate}>
						<View style={styles.playArea}>
							<StatsGameHud score={score} compact={compactLayout}></StatsGameHud>
							<BlockGrid
								board={board}
								possibleBoardDropSpots={possibleBoardDropSpots}
								hand={hand}
								draggingPiece={draggingPiece}
								boardOriginX={boardOriginX}
								boardOriginY={boardOriginY}
							></BlockGrid>
							<HandPieces hand={hand} compact={compactLayout}></HandPieces>
						</View>
					</DndProvider>
					{gameOver && (
						<GameOverOverlay
							score={finalScore}
							onRestart={resetRun}
							onMenu={returnToMenu}
						/>
					)}
				</View>
			</GestureHandlerRootView>
		</SafeAreaView>
	);
})

const styles = StyleSheet.create({
	root: {
		width: '100%',
		flex: 1,
		justifyContent: 'flex-start',
		alignItems: 'center',
		padding: 0,
		overflow: 'hidden',
		backgroundColor: uiColors.background,
	},
	playArea: {
		width: '100%',
		alignItems: 'center',
	},
})

export default Game;
