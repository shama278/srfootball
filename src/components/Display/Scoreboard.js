import React from 'react';
import {View, Text, StyleSheet, SafeAreaView, StatusBar, Image} from 'react-native';
import {useScoreboard} from '../../context/ScoreboardContext';
import ScoreDisplay from './ScoreDisplay';
import TimerDisplay from './TimerDisplay';
import TeamInfo from './TeamInfo';

/**
 * Основной компонент табло для телевизора
 */
const Scoreboard = () => {
  let state, team1, team2, timer, period, settings;

  try {
    const context = useScoreboard();
    state = context?.state;

    // Защита от undefined state
    if (!state) {
      return null;
    }

    ({team1, team2, timer, period, settings} = state);
  } catch (error) {
    console.error('[Scoreboard] КРИТИЧЕСКАЯ ОШИБКА при получении контекста:', error);
    console.error('[Scoreboard] Stack trace:', error.stack);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка загрузки табло</Text>
          <Text style={styles.errorDetails}>{error.toString()}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Защита от undefined значений с полной проверкой
  const safePeriod = (typeof period === 'number' && period >= 1) ? period : 1;
  const safeTeam1 = {
    name: (team1 && typeof team1.name === 'string') ? team1.name : 'Команда 1',
    score: (team1 && typeof team1.score === 'number') ? team1.score : 0,
    logo: (team1 && team1.logo) ? team1.logo : null,
  };
  const safeTeam2 = {
    name: (team2 && typeof team2.name === 'string') ? team2.name : 'Команда 2',
    score: (team2 && typeof team2.score === 'number') ? team2.score : 0,
    logo: (team2 && team2.logo) ? team2.logo : null,
  };
  const safeTimer = {
    minutes: (timer && typeof timer.minutes === 'number') ? Math.max(0, Math.min(99, timer.minutes)) : 0,
    seconds: (timer && typeof timer.seconds === 'number') ? Math.max(0, Math.min(59, timer.seconds)) : 0,
    isRunning: (timer && typeof timer.isRunning === 'boolean') ? timer.isRunning : false,
  };
  const safeSettings = {
    primaryColor: (settings && settings.primaryColor) ? settings.primaryColor : '#1a1a1a',
    secondaryColor: (settings && settings.secondaryColor) ? settings.secondaryColor : '#ffffff',
    showLogos: (settings && typeof settings.showLogos === 'boolean') ? settings.showLogos : true,
  };

  const periodLabels = {
    1: '1-й тайм',
    2: '2-й тайм',
    3: 'ОТ',
    4: 'Доп. время',
  };

  const periodLabel = periodLabels[safePeriod] || `${safePeriod}-й период`;

  try {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: safeSettings.primaryColor}]}>
        <StatusBar hidden />

        {/* Заголовок с периодом */}
        <View style={styles.header}>
          <Text style={styles.periodLabel}>{periodLabel.toUpperCase()}</Text>
        </View>

        {/* Основное содержимое */}
        <View style={styles.content}>
          {/* Левая команда */}
          <View style={styles.teamSection}>
            {safeSettings.showLogos && safeTeam1.logo && typeof safeTeam1.logo === 'string' && (
              <Image
                source={{uri: safeTeam1.logo}}
                style={styles.teamLogo}
                resizeMode="contain"
                onError={(error) => {
                  console.error('[Scoreboard] Ошибка загрузки логотипа команды 1:', error);
                }}
              />
            )}
            <Text style={[styles.teamName, {color: safeSettings.secondaryColor}]}>
              {safeTeam1.name}
            </Text>
            <Text style={[styles.score, {color: safeSettings.secondaryColor}]}>
              {safeTeam1.score}
            </Text>
          </View>

          {/* Центральная часть с таймером */}
          <View style={styles.centerSection}>
            <TimerDisplay
              minutes={safeTimer.minutes}
              seconds={safeTimer.seconds}
              isRunning={safeTimer.isRunning}
              textStyle={{color: safeSettings.secondaryColor}}
            />
          </View>

          {/* Правая команда */}
          <View style={styles.teamSection}>
            {safeSettings.showLogos && safeTeam2.logo && typeof safeTeam2.logo === 'string' && (
              <Image
                source={{uri: safeTeam2.logo}}
                style={styles.teamLogo}
                resizeMode="contain"
                onError={(error) => {
                  console.error('[Scoreboard] Ошибка загрузки логотипа команды 2:', error);
                }}
              />
            )}
            <Text style={[styles.teamName, {color: safeSettings.secondaryColor}]}>
              {safeTeam2.name}
            </Text>
            <Text style={[styles.score, {color: safeSettings.secondaryColor}]}>
              {safeTeam2.score}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  } catch (error) {
    console.error('[Scoreboard] Критическая ошибка при рендеринге:', error);
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка отображения табло</Text>
        </View>
      </SafeAreaView>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 30,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  periodLabel: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 3, height: 3},
    textShadowRadius: 6,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 50,
    paddingVertical: 30,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    marginHorizontal: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  teamLogo: {
    width: 180,
    height: 180,
    marginBottom: 25,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  teamName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 6,
    maxWidth: 450,
    letterSpacing: 1,
  },
  score: {
    fontSize: 160,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 4, height: 4},
    textShadowRadius: 8,
    letterSpacing: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  centerSection: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 50,
    paddingVertical: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});

export default Scoreboard;
