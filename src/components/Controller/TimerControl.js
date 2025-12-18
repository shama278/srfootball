import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

/**
 * Компонент управления таймером
 */
const TimerControl = ({minutes, seconds, isRunning, onStart, onStop, onReset, onSetTime, style}) => {
  const formatTime = (mins, secs) => {
    const formattedMins = String(mins).padStart(2, '0');
    const formattedSecs = String(secs).padStart(2, '0');
    return `${formattedMins}:${formattedSecs}`;
  };

  const handleIncrementMinutes = () => {
    if (!isRunning && onSetTime) {
      onSetTime(Math.min(99, minutes + 1), seconds);
    }
  };

  const handleDecrementMinutes = () => {
    if (!isRunning && onSetTime) {
      onSetTime(Math.max(0, minutes - 1), seconds);
    }
  };

  const handleIncrementSeconds = () => {
    if (!isRunning && onSetTime) {
      let newSeconds = seconds + 1;
      let newMinutes = minutes;
      if (newSeconds >= 60) {
        newSeconds = 0;
        newMinutes = Math.min(99, newMinutes + 1);
      }
      onSetTime(newMinutes, newSeconds);
    }
  };

  const handleDecrementSeconds = () => {
    if (!isRunning && onSetTime) {
      let newSeconds = seconds - 1;
      let newMinutes = minutes;
      if (newSeconds < 0) {
        if (newMinutes > 0) {
          newSeconds = 59;
          newMinutes = Math.max(0, newMinutes - 1);
        } else {
          newSeconds = 0;
        }
      }
      onSetTime(newMinutes, newSeconds);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Таймер</Text>
      <View style={styles.timerContainer}>
        {!isRunning && onSetTime && (
          <View style={styles.timeControls}>
            <View style={styles.timeControlColumn}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={handleIncrementMinutes}
                disabled={isRunning}
                activeOpacity={0.7}>
                <Text style={styles.timeButtonText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.timeLabel}>мин</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={handleDecrementMinutes}
                disabled={isRunning}
                activeOpacity={0.7}>
                <Text style={styles.timeButtonText}>-</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.timer}>{formatTime(minutes, seconds)}</Text>
            <View style={styles.timeControlColumn}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={handleIncrementSeconds}
                disabled={isRunning}
                activeOpacity={0.7}>
                <Text style={styles.timeButtonText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.timeLabel}>сек</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={handleDecrementSeconds}
                disabled={isRunning}
                activeOpacity={0.7}>
                <Text style={styles.timeButtonText}>-</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {(!onSetTime || isRunning) && (
          <Text style={styles.timer}>{formatTime(minutes, seconds)}</Text>
        )}
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, isRunning ? styles.stopButton : styles.startButton]}
          onPress={isRunning ? onStop : onStart}
          activeOpacity={0.7}>
          <Text style={styles.buttonText}>{isRunning ? 'Пауза' : 'Старт'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={onReset}
          activeOpacity={0.7}>
          <Text style={styles.buttonText}>Сброс</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
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
    marginVertical: 15,
  },
  timer: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 2,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  timeControlColumn: {
    alignItems: 'center',
    marginHorizontal: 15,
  },
  timeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
  },
  timeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginVertical: 5,
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
