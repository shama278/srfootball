import React, {useState} from 'react';
import {View, Text, TextInput, StyleSheet, Switch} from 'react-native';

/**
 * Компонент настройки таймера (только для настроек, без кнопок управления)
 */
const TimerSettings = ({minutes, seconds, direction = 'down', onSetTime, onDirectionChange, style}) => {
  const [minutesInput, setMinutesInput] = useState(String(minutes));
  const [secondsInput, setSecondsInput] = useState(String(seconds));

  React.useEffect(() => {
    setMinutesInput(String(minutes));
    setSecondsInput(String(seconds));
  }, [minutes, seconds]);

  const handleMinutesChange = (text) => {
    setMinutesInput(text);
    const mins = parseInt(text, 10) || 0;
    const secs = parseInt(secondsInput, 10) || 0;
    if (onSetTime && !isNaN(mins) && mins >= 0 && mins <= 99) {
      onSetTime(mins, secs);
    }
  };

  const handleSecondsChange = (text) => {
    setSecondsInput(text);
    const mins = parseInt(minutesInput, 10) || 0;
    const secs = parseInt(text, 10) || 0;
    if (onSetTime && !isNaN(secs) && secs >= 0 && secs < 60) {
      onSetTime(mins, secs);
    }
  };

  const handleMinutesBlur = () => {
    const mins = parseInt(minutesInput, 10);
    if (isNaN(mins) || mins < 0) {
      setMinutesInput('0');
      onSetTime(0, parseInt(secondsInput, 10) || 0);
    } else if (mins > 99) {
      setMinutesInput('99');
      onSetTime(99, parseInt(secondsInput, 10) || 0);
    }
  };

  const handleSecondsBlur = () => {
    const secs = parseInt(secondsInput, 10);
    if (isNaN(secs) || secs < 0) {
      setSecondsInput('0');
      onSetTime(parseInt(minutesInput, 10) || 0, 0);
    } else if (secs >= 60) {
      setSecondsInput('59');
      onSetTime(parseInt(minutesInput, 10) || 0, 59);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Настройка направления отсчета */}
      <View style={styles.directionContainer}>
        <View>
          <Text style={styles.directionLabel}>
            {direction === 'up' ? 'Отсчет вверх' : 'Отсчет вниз'}
          </Text>
          <Text style={styles.directionHint}>
            {direction === 'up'
              ? 'Таймер будет считать до указанного времени'
              : 'Таймер будет считать от указанного времени'}
          </Text>
        </View>
        <Switch
          value={direction === 'up'}
          onValueChange={(value) => onDirectionChange(value ? 'up' : 'down')}
        />
      </View>

      {/* Настройка времени */}
      <View style={styles.timeSection}>
        <Text style={styles.timeLabel}>
          {direction === 'up' ? 'Считать до' : 'Считать от'}
        </Text>
        <View style={styles.timeInputs}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Минуты</Text>
            <TextInput
              style={styles.input}
              value={minutesInput}
              onChangeText={handleMinutesChange}
              onBlur={handleMinutesBlur}
              keyboardType="numeric"
              maxLength={2}
              placeholder="0"
            />
          </View>
          <Text style={styles.separator}>:</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Секунды</Text>
            <TextInput
              style={styles.input}
              value={secondsInput}
              onChangeText={handleSecondsChange}
              onBlur={handleSecondsBlur}
              keyboardType="numeric"
              maxLength={2}
              placeholder="0"
            />
          </View>
        </View>
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
  },
  directionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 5,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  directionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  directionHint: {
    fontSize: 12,
    color: '#666',
  },
  timeSection: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 15,
  },
  inputGroup: {
    alignItems: 'center',
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 80,
    backgroundColor: '#f9f9f9',
  },
  separator: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
});

export default TimerSettings;
