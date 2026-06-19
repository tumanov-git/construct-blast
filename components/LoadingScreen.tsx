import { cssColors } from "@/constants/Color";
import { StyleSheet, Text, View } from "react-native";

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.blocks}>
        <View style={[styles.block, { backgroundColor: cssColors.brightNiceRed }]} />
        <View style={[styles.block, { backgroundColor: cssColors.green }]} />
        <View style={[styles.block, { backgroundColor: cssColors.pink }]} />
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
    backgroundColor: "black",
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
    borderColor: "rgba(255, 255, 255, 0.32)",
  },
  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  caption: {
    color: "rgb(120, 120, 120)",
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
});
