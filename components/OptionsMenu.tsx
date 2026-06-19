import { cssColors } from "@/constants/Color";
import { MenuStateType, useAppState } from "@/hooks/useAppState";
import { StyleSheet, Switch, Text, View } from "react-native";
import SimplePopupView from "./SimplePopupView";
import StylizedButton from "./StylizedButton";
import { useSettings } from "@/hooks/useSettings";
import { clearHighScores } from "@/constants/Storage";

export default function OptionsMenu() {
	const [ appState, setAppState, _appendAppState, popAppState ] = useAppState();
	const [settings, setSettings] = useSettings();

	return <SimplePopupView>
		<StylizedButton onClick={popAppState} text="Назад" backgroundColor={cssColors.spaceGray}></StylizedButton>
		<SettingLabel title="Вибрация" description="Короткий отклик при постановке блока">
			<Switch
				value={settings.hapticsEnabled}
				onValueChange={(value) => {
					setSettings((current) => ({ ...current, hapticsEnabled: value }));
				}}
			/>
		</SettingLabel>
		<SettingLabel title="Dev оценка" description="Показывать качество последнего хода">
			<Switch
				value={settings.devHudEnabled}
				onValueChange={(value) => {
					setSettings((current) => ({ ...current, devHudEnabled: value }));
				}}
			/>
		</SettingLabel>
		{ appState.containsGameMode() && 
			<StylizedButton onClick={() => { setAppState(MenuStateType.MENU) }} text="Выйти" backgroundColor={cssColors.brightNiceRed}></StylizedButton>
		}
		<StylizedButton onClick={() => { clearHighScores(); }} text="Сброс рекордов" backgroundColor={cssColors.pitchBlack} borderColor="rgb(80, 80, 80)"></StylizedButton>
	</SimplePopupView>
}

function SettingLabel({title, description, children}: {title: string, description?: string, children?: any}) {
	return <View style={styles.settingLabelContainer}>
		<Text style={styles.settingTitle}>{title}</Text>
		{description && <Text style={styles.settingDesc}>{description}</Text>}
		<View style={styles.settingLabelChildren}>
			{children}
		</View>
	</View>
}

const styles = StyleSheet.create({
	settingLabelContainer: {
		width: '80%',
		height: 'auto',
		justifyContent: 'flex-start',
		alignItems: 'flex-start',
		marginTop: 6,
		marginBottom: 6
	},
	settingLabelChildren: {
		width: 'auto',
		height: 'auto',
		position: 'absolute',
		alignSelf: 'flex-end',
		justifyContent: 'flex-end',
	},
	settingTitle: {
		color: 'white',
		fontSize: 16,
		fontFamily: 'Silkscreen'
	},
	settingDesc: {
		color: 'rgb(160, 160, 160)',
		fontSize: 8,
		fontFamily: 'Silkscreen'
	}
});
