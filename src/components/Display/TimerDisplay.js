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
    fontSize: 96,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
    letterSpacing: 4,
  },
  running: {
    color: '#ff6b6b',
  },
  indicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff6b6b',
    marginTop: 8,
  },
});

export default TimerDisplay;
