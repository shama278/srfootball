import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

/**
 * Компонент отображения таймера
 */
const TimerDisplay = ({minutes, seconds, isRunning, style, textStyle}) => {
  const formatTime = (mins, secs) => {
    const formattedMins = String(mins).padStart(2, '0');
    const formattedSecs = String(secs).padStart(2, '0');
    return `${formattedMins}:${formattedSecs}`;
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.timer, textStyle, isRunning && styles.running]}>
        {formatTime(minutes, seconds)}
      </Text>
      {isRunning && <View style={styles.indicator} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  timer: {
    fontSize: 60,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 3, height: 3},
    textShadowRadius: 8,
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  running: {
    color: '#ff6b6b',
    textShadowColor: 'rgba(255, 107, 107, 0.6)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 20,
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff6b6b',
    marginTop: 12,
    shadowColor: '#ff6b6b',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
});

export default TimerDisplay;
