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
  const {state} = useScoreboard();
  const {team1, team2, timer, period, settings} = state;

  const periodLabels = {
    1: '1-й тайм',
    2: '2-й тайм',
    3: 'ОТ',
    4: 'Доп. время',
  };

  const periodLabel = periodLabels[period] || `${period}-й период`;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: settings.primaryColor || '#1a1a1a'}]}>
      <StatusBar hidden />

      {/* Заголовок с периодом */}
      <View style={styles.header}>
        <Text style={styles.periodLabel}>{periodLabel}</Text>
      </View>

      {/* Основное содержимое */}
      <View style={styles.content}>
        {/* Левая команда */}
        <View style={styles.teamSection}>
          {settings.showLogos && team1.logo && (
            <Image
              source={{uri: team1.logo}}
              style={styles.teamLogo}
              resizeMode="contain"
            />
          )}
          <Text style={[styles.teamName, {color: settings.secondaryColor || '#ffffff'}]}>
            {team1.name}
          </Text>
          <Text style={[styles.score, {color: settings.secondaryColor || '#ffffff'}]}>
            {team1.score}
          </Text>
        </View>

        {/* Центральная часть с таймером */}
        <View style={styles.centerSection}>
          <TimerDisplay
            minutes={timer.minutes}
            seconds={timer.seconds}
            isRunning={timer.isRunning}
            textStyle={{color: settings.secondaryColor || '#ffffff'}}
          />
        </View>

        {/* Правая команда */}
        <View style={styles.teamSection}>
          {settings.showLogos && team2.logo && (
            <Image
              source={{uri: team2.logo}}
              style={styles.teamLogo}
              resizeMode="contain"
            />
          )}
          <Text style={[styles.teamName, {color: settings.secondaryColor || '#ffffff'}]}>
            {team2.name}
          </Text>
          <Text style={[styles.score, {color: settings.secondaryColor || '#ffffff'}]}>
            {team2.score}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  periodLabel: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  teamName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
    maxWidth: 400,
  },
  score: {
    fontSize: 140,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 3, height: 3},
    textShadowRadius: 6,
  },
  centerSection: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});

export default Scoreboard;
