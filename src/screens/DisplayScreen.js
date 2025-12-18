import React, {useState} from 'react';
import {View, StyleSheet, Pressable, Text, Platform} from 'react-native';
import Scoreboard from '../components/Display/Scoreboard';
import ConnectionStatus from '../components/Common/ConnectionStatus';
import {useScoreboard} from '../context/ScoreboardContext';

/**
 * Экран отображения табло для телевизора
 */
const DisplayScreen = ({onShowLogs, onModeChange}) => {
  const {isConnected} = useScoreboard();
  const [focusedButton, setFocusedButton] = useState(null);

  return (
    <View style={styles.container}>
      <Scoreboard />
      <View style={styles.statusBar}>
        <ConnectionStatus isConnected={isConnected} />
        {onShowLogs && (
          <Pressable
            style={({pressed, focused}) => [
              styles.logsButton,
              (focused || focusedButton === 'logs') && styles.logsButtonFocused,
              pressed && styles.logsButtonPressed,
            ]}
            onPress={onShowLogs}
            onFocus={() => setFocusedButton('logs')}
            onBlur={() => setFocusedButton(null)}
            // Для TV: поддержка навигации пультом
            hasTVPreferredFocus={false}
            tvParallaxProperties={{
              enabled: true,
              shiftDistanceX: 2.0,
              shiftDistanceY: 2.0,
            }}>
            <Text style={styles.logsButtonText}>📋</Text>
          </Pressable>
        )}
        {onModeChange && (
          <Pressable
            style={({pressed, focused}) => [
              styles.modeButton,
              (focused || focusedButton === 'mode') && styles.modeButtonFocused,
              pressed && styles.modeButtonPressed,
            ]}
            onPress={onModeChange}
            onFocus={() => setFocusedButton('mode')}
            onBlur={() => setFocusedButton(null)}
            // Для TV: поддержка навигации пультом
            hasTVPreferredFocus={false}
            tvParallaxProperties={{
              enabled: true,
              shiftDistanceX: 2.0,
              shiftDistanceY: 2.0,
            }}>
            <Text style={styles.modeButtonText}>⚙️</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logsButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  logsButtonFocused: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(33, 150, 243, 1)',
    shadowColor: '#ffffff',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    transform: [{scale: 1.1}],
  },
  logsButtonPressed: {
    opacity: 0.8,
  },
  logsButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  modeButton: {
    backgroundColor: 'rgba(158, 158, 158, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeButtonFocused: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(158, 158, 158, 1)',
    shadowColor: '#ffffff',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    transform: [{scale: 1.1}],
  },
  modeButtonPressed: {
    opacity: 0.8,
  },
  modeButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
});

export default DisplayScreen;
