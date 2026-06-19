import { MoveQualityReport } from "@/constants/GameIntelligence";
import { cssColors } from "@/constants/Color";
import StylizedButton from "@/components/StylizedButton";
import { StyleSheet, Text, View } from "react-native";

function getQualityText(moveQuality: MoveQualityReport | null): string {
  if (moveQuality == null) {
    return "Последний ход не оценен";
  }

  if (moveQuality.tier === "best") {
    return `Лучший ход: ${moveQuality.rating}/100`;
  }
  if (moveQuality.tier === "great") {
    return `Сильный ход: ${moveQuality.rating}/100`;
  }
  if (moveQuality.tier === "good") {
    return `Нормальный ход: ${moveQuality.rating}/100`;
  }
  if (moveQuality.tier === "ok") {
    return `Слабый ход: ${moveQuality.rating}/100`;
  }
  return `Плохой ход: ${moveQuality.rating}/100`;
}

export default function GameOverOverlay({
  score,
  moveQuality,
  onRestart,
  onMenu,
}: {
  score: number;
  moveQuality: MoveQualityReport | null;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>Партия окончена</Text>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.quality}>{getQualityText(moveQuality)}</Text>
        <View style={styles.actions}>
          <StylizedButton
            text="Еще раз"
            onClick={onRestart}
            backgroundColor={cssColors.brightNiceRed}
          />
          <StylizedButton
            text="В меню"
            onClick={onMenu}
            backgroundColor={cssColors.spaceGray}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2000,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    width: "84%",
    maxWidth: 440,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgb(92, 92, 92)",
    backgroundColor: "rgb(8, 8, 8)",
    alignItems: "center",
    padding: 24,
  },
  kicker: {
    color: "rgb(175, 175, 175)",
    fontFamily: "Silkscreen",
    fontSize: 18,
    textAlign: "center",
  },
  score: {
    color: "white",
    fontFamily: "Silkscreen",
    fontSize: 54,
    marginTop: 16,
    marginBottom: 8,
  },
  quality: {
    color: "rgb(220, 220, 220)",
    fontFamily: "Silkscreen",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
  },
  actions: {
    alignItems: "center",
  },
});
