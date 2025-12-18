import React from 'react';
import {View, StyleSheet, TouchableOpacity, Text} from 'react-native';
import Scoreboard from '../components/Display/Scoreboard';
import ConnectionStatus from '../components/Common/ConnectionStatus';
import {useScoreboard} from '../context/ScoreboardContext';

/**
 * Экран отображения табло для телевизора
 */
const DisplayScreen = ({onShowLogs}) => {
  const {isConnected} = useScoreboard();

  return (
    <View style={styles.container}>
      <Scoreboard />
      <View style={styles.statusBar}>
        <ConnectionStatus isConnected={isConnected} />
        {onShowLogs && (
          <TouchableOpacity
            style={styles.logsButton}
            onPress={onShowLogs}
            activeOpacity={0.7}>
            <Text style={styles.logsButtonText}>📋</Text>
          </TouchableOpacity>
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
  },
  logsButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
});

export default DisplayScreen;
