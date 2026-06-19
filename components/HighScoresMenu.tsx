import { getHighScores, HighScore } from "@/constants/Storage";
import SimplePopupView from "./SimplePopupView";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import StylizedButton from "./StylizedButton";
import { cssColors } from "@/constants/Color";
import { GameModeType, useSetAppState } from "@/hooks/useAppState";

export default function HighScores() {
    const [ setAppState, _appendAppState, popAppState ] = useSetAppState();
    const [ highScores, setHighScores ] = useState<HighScore[]>([]);
    
    useEffect(() => {
        getHighScores(GameModeType.Classic, true, true, 10).then((value) => {
            setHighScores(value);
        });
    }, [setHighScores]);

    return <SimplePopupView style={[{justifyContent: 'flex-start'}]}>
        <StylizedButton text="Назад" onClick={popAppState} backgroundColor={cssColors.spaceGray}></StylizedButton>
        { highScores.length > 0 &&
            <>
                <Text style={styles.subHeader}>
                    {"Локально на устройстве"}
                </Text>
                <Text style={styles.header}>{"Топ 10"}</Text>
                <Text style={styles.subHeader}>
                    {"Глобальный рейтинг подключим через сервер"}
                </Text>
                {
                    highScores.map((score, idx) => {
                        return <Score key={idx} rank={idx + 1} score={score}/>
                    })
                }
            </>
        }
        { highScores.length == 0 && 
            <>
                <Text style={styles.noScoresText}>{"Пока нет рекордов"}</Text>
                <StylizedButton text="Играть" onClick={() => {
                    setAppState(GameModeType.Classic)
                }} backgroundColor={cssColors.brightNiceRed}></StylizedButton>
            </>
        }
    </SimplePopupView>
}

function Score({score, rank}: {score: HighScore, rank: number}) {
    return <>
        <Text style={styles.scoreValueText}>{"#" + String(rank) + " - " + String(score.score)}</Text>
        <Text style={styles.scoreTimeText}>{createTimeAgoString(score.date)}</Text>
    </>
}

function createTimeAgoString(date: number): string {
    const now = new Date();
    const seconds = Math.round((now.getTime() - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30);
    const years = Math.round(days / 365);
  
    if (seconds < 60) {
      return seconds <= 0 ? 'только что' : `${seconds} сек. назад`;
    } else if (minutes < 60) {
      return `${minutes} мин. назад`;
    } else if (hours < 24) {
      return `${hours} ч. назад`;
    } else if (days < 30) {
      return `${days} дн. назад`;
    } else if (months < 12) {
      return `${months} мес. назад`;
    } else {
      return `${years} г. назад`;
    }
  }

const styles = StyleSheet.create({
    noScoresText: {
        color: 'white',
        fontSize: 30,
        fontFamily: 'Silkscreen',
        textAlign: 'center',
        marginBottom: 20
    },
    scoreValueText: {
        color: 'white',
        fontSize: 30,
        fontFamily: 'Silkscreen'
    },
    scoreTimeText: {
        color: 'rgb(150, 150, 150)',
        fontSize: 15,
        fontFamily: 'Silkscreen'
    },
    header: {
        color: 'white',
        fontSize: 30,
        fontFamily: 'Silkscreen'
    },
    subHeader: {
        color: 'rgb(100, 100, 100)',
        fontSize: 24,
        fontFamily: 'Silkscreen'
    }
});
