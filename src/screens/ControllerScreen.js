import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {useScoreboard} from '../context/ScoreboardContext';
import ScoreControl from '../components/Controller/ScoreControl';
import TimerControl from '../components/Controller/TimerControl';
import PeriodSelector from '../components/Controller/PeriodSelector';
import ConnectionStatus from '../components/Common/ConnectionStatus';
import SettingsScreen from './SettingsScreen';
import {getLocalIPAddress} from '../services/networkUtils';
import logger from '../services/logger';

/**
 * Экран контроллера для планшета
 */
const ControllerScreen = ({onShowLogs, onModeChange}) => {
  const {
    state,
    updateTeam1Score,
    updateTeam2Score,
    startTimer,
    stopTimer,
    resetTimer,
    setTimer,
    updatePeriod,
    isConnected,
  } = useScoreboard();

  const {team1, team2, timer, period} = state;
  const [ipAddress, setIpAddress] = useState('');
  const [showIpInfo, setShowIpInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadIpAddress();
  }, []);

  const loadIpAddress = async () => {
    try {
      const ip = await getLocalIPAddress();
      if (ip) {
        setIpAddress(ip);
      }
    } catch (error) {
      logger.error('Ошибка при получении IP адреса:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Заголовок с индикатором подключения */}
      <View style={styles.header}>
        <Text style={styles.title}>Управление табло</Text>
        <View style={styles.headerRight}>
          <ConnectionStatus isConnected={isConnected} />
          {ipAddress && (
            <TouchableOpacity
              style={styles.ipButton}
              onPress={() => setShowIpInfo(!showIpInfo)}
              activeOpacity={0.7}>
              <Text style={styles.ipButtonText}>IP</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.7}>
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
          {onModeChange && (
            <TouchableOpacity
              style={styles.modeButton}
              onPress={onModeChange}
              activeOpacity={0.7}>
              <Text style={styles.modeButtonText}>🔄</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Информация об IP адресе */}
      {showIpInfo && ipAddress && (
        <View style={styles.ipInfoContainer}>
          <Text style={styles.ipInfoTitle}>IP адрес этого устройства:</Text>
          <Text style={styles.ipInfoText}>{ipAddress}</Text>
          <Text style={styles.ipInfoHint}>
            Контроллер автоматически найдет табло в сети
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Управление счетом - компактно в ряд */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreColumn}>
            <ScoreControl
              teamName={team1.name}
              score={team1.score}
              logo={team1.logo}
              onIncrement={() => updateTeam1Score(1)}
              onDecrement={() => updateTeam1Score(-1)}
            />
          </View>
          <View style={styles.scoreColumn}>
            <ScoreControl
              teamName={team2.name}
              score={team2.score}
              logo={team2.logo}
              onIncrement={() => updateTeam2Score(1)}
              onDecrement={() => updateTeam2Score(-1)}
            />
          </View>
        </View>

        {/* Управление таймером и периодом - рядом */}
        <View style={styles.timerPeriodRow}>
          <View style={styles.timerColumn}>
            <TimerControl
              minutes={timer?.minutes || 0}
              seconds={timer?.seconds || 0}
              isRunning={timer?.isRunning || false}
              onStart={startTimer}
              onStop={stopTimer}
              onReset={resetTimer}
            />
          </View>
          <View style={styles.periodColumn}>
            <PeriodSelector currentPeriod={period || 1} onSelectPeriod={updatePeriod} />
          </View>
        </View>
      </View>

      {/* Экран настроек */}
      <SettingsScreen
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onShowLogs={onShowLogs}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ipButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ipButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  modeButton: {
    backgroundColor: '#9e9e9e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  ipInfoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  ipInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 5,
  },
  ipInfoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  ipInfoHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  scoreColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  timerPeriodRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timerColumn: {
    flex: 1,
    marginRight: 5,
  },
  periodColumn: {
    flex: 1,
    marginLeft: 5,
  },
  settingsButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  settingsButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
});

export default ControllerScreen;
