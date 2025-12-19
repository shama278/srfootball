import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

/**
 * Компонент управления таймером
 */
const TimerControl = ({minutes = 0, seconds = 0, isRunning = false, onStart, onStop, onReset, style}) => {
  const formatTime = (mins, secs) => {
    const formattedMins = String(mins || 0).padStart(2, '0');
    const formattedSecs = String(secs || 0).padStart(2, '0');
    return `${formattedMins}:${formattedSecs}`;
  };

  const safeMinutes = minutes !== undefined && minutes !== null ? minutes : 0;
  const safeSeconds = seconds !== undefined && seconds !== null ? seconds : 0;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Таймер</Text>
      <View style={styles.timerContainer}>
        <Text style={styles.timer}>{formatTime(safeMinutes, safeSeconds)}</Text>
      </View>

      <View style={styles.buttonRow}>
        {onStart && (
          <TouchableOpacity
            style={[styles.button, isRunning ? styles.stopButton : styles.startButton]}
            onPress={isRunning ? onStop : onStart}
            activeOpacity={0.7}>
            <Text style={styles.buttonText}>{isRunning ? 'Пауза' : 'Старт'}</Text>
          </TouchableOpacity>
        )}
        {onReset && (
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={onReset}
            activeOpacity={0.7}>
            <Text style={styles.buttonText}>Сброс</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    flex: 1,
    minHeight: 200,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  timerContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 20,
  },
  timer: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  startButton: {
    backgroundColor: '#4caf50',
  },
  stopButton: {
    backgroundColor: '#ff9800',
  },
  resetButton: {
    backgroundColor: '#9e9e9e',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default TimerControl;
