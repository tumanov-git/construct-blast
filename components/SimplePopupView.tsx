import { StyleSheet, View } from "react-native";
import { uiColors } from "@/constants/Color";

export default function SimplePopupView({children, style = []}: {children: any, style?: any[]}) {
    return (
		<View style={styles.backdrop}>
			<View style={[styles.panel, ...style]}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		zIndex: 100,
		backgroundColor: uiColors.overlay,
		justifyContent: "center",
		alignItems: "center",
		padding: 18,
	},
	panel: {
		width: "100%",
		maxWidth: 500,
		maxHeight: "82%",
		backgroundColor: uiColors.panel,
		borderRadius: 8,
		borderColor: uiColors.panelLine,
		borderWidth: 1,
		justifyContent: "center",
		alignItems: "stretch",
		padding: 20,
		overflow: "hidden",
	},
});
