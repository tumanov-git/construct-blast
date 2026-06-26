import { uiColors } from "@/constants/Color";
import { StyleSheet, Text, View } from "react-native";

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.blocks}>
        <View style={[styles.block, { backgroundColor: uiColors.play }]} />
        <View style={[styles.block, { backgroundColor: uiColors.leaderboard }]} />
        <View style={[styles.block, { backgroundColor: uiColors.settings }]} />
      </View>
      <Text style={styles.title}>construct blast</Text>
      <Text style={styles.caption}>loading</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: uiColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  blocks: {
    flexDirection: "row",
    marginBottom: 22,
  },
  block: {
    width: 26,
    height: 26,
    marginHorizontal: 4,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  title: {
    color: uiColors.text,
    fontSize: 26,
    fontFamily: "GraphikLC-Bold",
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  caption: {
    color: uiColors.textMuted,
    fontFamily: "GraphikLC-Bold",
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
});
