import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
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
import TeamEditor from '../components/Controller/TeamEditor';
import LogoUpload from '../components/Controller/LogoUpload';
import SettingsPanel from '../components/Controller/SettingsPanel';
import ConnectionStatus from '../components/Common/ConnectionStatus';
import {getLocalIPAddress, getDefaultWebSocketPort} from '../services/networkUtils';
import logger from '../services/logger';

/**
 * Экран контроллера для планшета
 */
const ControllerScreen = ({onShowLogs, onModeChange}) => {
  const {
    state,
    updateTeam1Score,
    updateTeam2Score,
    updateTeam1Name,
    updateTeam2Name,
    updateTeam1Logo,
    updateTeam2Logo,
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
          {onModeChange && (
            <TouchableOpacity
              style={styles.modeButton}
              onPress={onModeChange}
              activeOpacity={0.7}>
              <Text style={styles.modeButtonText}>⚙️</Text>
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Управление счетом */}
        <View style={styles.section}>
          <ScoreControl
            teamName={team1.name}
            score={team1.score}
            onIncrement={() => updateTeam1Score(1)}
            onDecrement={() => updateTeam1Score(-1)}
          />
          <ScoreControl
            teamName={team2.name}
            score={team2.score}
            onIncrement={() => updateTeam2Score(1)}
            onDecrement={() => updateTeam2Score(-1)}
          />
        </View>

        {/* Управление таймером */}
        <TimerControl
          minutes={timer.minutes}
          seconds={timer.seconds}
          isRunning={timer.isRunning}
          onStart={startTimer}
          onStop={stopTimer}
          onReset={resetTimer}
          onSetTime={setTimer}
        />

        {/* Выбор периода */}
        <PeriodSelector currentPeriod={period} onSelectPeriod={updatePeriod} />

        {/* Редактирование команд */}
        <TeamEditor
          teamLabel="Команда 1"
          teamName={team1.name}
          logo={team1.logo}
          onNameChange={updateTeam1Name}
        />
        <LogoUpload
          teamLabel="Команда 1"
          currentLogo={team1.logo}
          onLogoSelected={updateTeam1Logo}
        />

        <TeamEditor
          teamLabel="Команда 2"
          teamName={team2.name}
          logo={team2.logo}
          onNameChange={updateTeam2Name}
        />
        <LogoUpload
          teamLabel="Команда 2"
          currentLogo={team2.logo}
          onLogoSelected={updateTeam2Logo}
        />

        {/* Настройки */}
        <SettingsPanel onShowLogs={onShowLogs} />
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 15,
  },
  section: {
    marginBottom: 10,
  },
});

export default ControllerScreen;
