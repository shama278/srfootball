import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert} from 'react-native';
import {useScoreboard} from '../../context/ScoreboardContext';

/**
 * Компонент панели настроек
 */
const SettingsPanel = ({style, onShowLogs}) => {
  const {state, updateSettings, resetScoreboard} = useScoreboard();
  const {settings} = state;

  const handleResetScoreboard = () => {
    Alert.alert(
      'Сброс табло',
      'Вы уверены, что хотите сбросить счет и таймер? Названия команд и логотипы сохранятся.',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Сбросить',
          style: 'destructive',
          onPress: resetScoreboard,
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, style]}>
      <Text style={styles.sectionTitle}>Настройки отображения</Text>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Показывать логотипы</Text>
        <Switch
          value={settings.showLogos}
          onValueChange={(value) => updateSettings({showLogos: value})}
        />
      </View>

      <Text style={styles.sectionTitle}>Управление</Text>

      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleResetScoreboard}
        activeOpacity={0.7}>
        <Text style={styles.resetButtonText}>Сбросить табло</Text>
      </TouchableOpacity>

      {onShowLogs && (
        <TouchableOpacity
          style={styles.logsButton}
          onPress={onShowLogs}
          activeOpacity={0.7}>
          <Text style={styles.logsButtonText}>📋 Показать логи</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginVertical: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  resetButton: {
    marginTop: 20,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    backgroundColor: '#f44336',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  logsButton: {
    marginTop: 15,
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

export default SettingsPanel;
