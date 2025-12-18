import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Pressable, Text, Platform} from 'react-native';
import Scoreboard from '../components/Display/Scoreboard';
import {useScoreboard} from '../context/ScoreboardContext';
import {getLocalIPAddress} from '../services/networkUtils';

/**
 * Экран отображения табло для телевизора
 */
const DisplayScreen = ({onShowLogs, onModeChange}) => {
  let scoreboardContext, isConnected;
  const [ipAddress, setIpAddress] = useState('');

  try {
    scoreboardContext = useScoreboard();
    isConnected = scoreboardContext?.isConnected || false;
  } catch (error) {
    console.error('[DisplayScreen] КРИТИЧЕСКАЯ ОШИБКА при получении контекста:', error);
    console.error('[DisplayScreen] Stack trace:', error.stack);
    isConnected = false;
  }

  useEffect(() => {
    const loadIP = async () => {
      try {
        const ip = await getLocalIPAddress();
        if (ip) {
          setIpAddress(ip);
        }
      } catch (error) {
        console.error('[DisplayScreen] Ошибка при загрузке IP адреса:', error);
        console.error('[DisplayScreen] Stack trace:', error.stack);
      }
    };
    try {
      loadIP();
    } catch (error) {
      console.error('[DisplayScreen] КРИТИЧЕСКАЯ ОШИБКА при запуске loadIP:', error);
      console.error('[DisplayScreen] Stack trace:', error.stack);
    }
  }, []);

  try {
    return (
      <View style={styles.container}>
        <Scoreboard />
        <View style={styles.statusBar}>
          {/* IP адрес */}
          {ipAddress && (
            <Text style={styles.ipAddress}>{ipAddress}</Text>
          )}
          {/* Статус подключения в виде кружка */}
          <View style={[styles.statusIndicator, isConnected ? styles.statusConnected : styles.statusDisconnected]} />
        </View>
      </View>
    );
  } catch (error) {
    console.error('[DisplayScreen] КРИТИЧЕСКАЯ ОШИБКА при рендеринге:', error);
    console.error('[DisplayScreen] Stack trace:', error.stack);
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка отображения экрана</Text>
          <Text style={styles.errorDetails}>{error.toString()}</Text>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: Platform.isTV ? 30 : 20,
    left: Platform.isTV ? 30 : 20,
    right: Platform.isTV ? 30 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 14,
    // backgroundColor: 'rgba(0, 0, 0, 0.5)',
    // borderRadius: 16,
    // borderWidth: 1,
    // borderColor: 'rgba(255, 255, 255, 0.1)',
    // shadowColor: '#000',
    // shadowOffset: {width: 0, height: 4},
    // shadowOpacity: 0.3,
    // shadowRadius: 8,
    // elevation: 5,
  },
  ipAddress: {
    fontSize: Platform.isTV ? 24 : 18,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  statusIndicator: {
    width: Platform.isTV ? 18 : 16,
    height: Platform.isTV ? 18 : 16,
    borderRadius: Platform.isTV ? 9 : 8,
    marginLeft: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusConnected: {
    backgroundColor: '#4caf50',
    shadowColor: '#4caf50',
    shadowOpacity: 0.8,
  },
  statusDisconnected: {
    backgroundColor: '#f44336',
    shadowColor: '#f44336',
    shadowOpacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    fontSize: 24,
    color: '#ff0000',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorDetails: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

export default DisplayScreen;
