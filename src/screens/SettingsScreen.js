import React, {useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  StatusBar,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {useScoreboard} from '../context/ScoreboardContext';
import TeamEditor from '../components/Controller/TeamEditor';
import LogoUpload from '../components/Controller/LogoUpload';
import TimerSettings from '../components/Controller/TimerSettings';
import ConnectionStatus from '../components/Common/ConnectionStatus';

/**
 * Экран настроек для контроллера
 */
const SettingsScreen = ({visible, onClose, onShowLogs}) => {
  const {
    state,
    updateTeam1Name,
    updateTeam2Name,
    updateTeam1Logo,
    updateTeam2Logo,
    setTimer,
    updateTimerDirection,
    isConnected,
  } = useScoreboard();

  const {team1, team2, timer} = state;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* Заголовок */}
        <View style={styles.header}>
          <Text style={styles.title}>Настройки</Text>
          <View style={styles.headerRight}>
            <ConnectionStatus isConnected={isConnected} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Настройки команды 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Команда 1</Text>
            <TeamEditor
              teamLabel="Название команды"
              teamName={team1.name}
              logo={team1.logo}
              onNameChange={updateTeam1Name}
            />
            <LogoUpload
              teamLabel="Логотип команды"
              currentLogo={team1.logo}
              onLogoSelected={updateTeam1Logo}
            />
          </View>

          {/* Настройки команды 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Команда 2</Text>
            <TeamEditor
              teamLabel="Название команды"
              teamName={team2.name}
              logo={team2.logo}
              onNameChange={updateTeam2Name}
            />
            <LogoUpload
              teamLabel="Логотип команды"
              currentLogo={team2.logo}
              onLogoSelected={updateTeam2Logo}
            />
          </View>

          {/* Настройки таймера */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Таймер</Text>
            <TimerSettings
              minutes={
                timer?.direction === 'up' && timer?.targetMinutes !== undefined
                  ? timer.targetMinutes
                  : timer?.minutes || 0
              }
              seconds={
                timer?.direction === 'up' && timer?.targetSeconds !== undefined
                  ? timer.targetSeconds
                  : timer?.seconds || 0
              }
              direction={timer?.direction || 'down'}
              onSetTime={setTimer}
              onDirectionChange={updateTimerDirection}
            />
          </View>

          {/* Дополнительные настройки */}
          {onShowLogs && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.logsButton}
                onPress={onShowLogs}
                activeOpacity={0.7}>
                <Text style={styles.logsButtonText}>📋 Показать логи</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  closeButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  logsButton: {
    marginTop: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    backgroundColor: '#2196f3',
    alignItems: 'center',
  },
  logsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default SettingsScreen;
