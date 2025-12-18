import React from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';

/**
 * Состояния соединения
 */
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  DISCOVERING: 'discovering',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

/**
 * Компонент индикатора статуса подключения
 * @param {string} state - Состояние соединения (disconnected, discovering, connecting, connected, reconnecting)
 * @param {boolean} isConnected - Альтернативный способ передачи статуса (true = connected, false = disconnected)
 * @param {Object} style - Дополнительные стили
 * @param {string} deviceInfo - Информация об устройстве (опционально)
 */
const ConnectionStatus = ({state, isConnected, style, deviceInfo}) => {
  // Если передан isConnected (boolean), конвертируем в state
  let actualState = state;
  if (actualState === undefined && isConnected !== undefined) {
    actualState = isConnected ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.DISCONNECTED;
  }
  actualState = actualState || CONNECTION_STATES.DISCONNECTED;

  const getStatusConfig = () => {
    switch (actualState) {
      case CONNECTION_STATES.CONNECTED:
        return {
          color: '#4caf50',
          text: deviceInfo ? `Подключено: ${deviceInfo}` : 'Подключено',
          showSpinner: false,
        };
      case CONNECTION_STATES.DISCOVERING:
        return {
          color: '#ff9800',
          text: 'Поиск устройств...',
          showSpinner: true,
        };
      case CONNECTION_STATES.CONNECTING:
        return {
          color: '#2196f3',
          text: deviceInfo ? `Подключение к ${deviceInfo}...` : 'Подключение...',
          showSpinner: true,
        };
      case CONNECTION_STATES.RECONNECTING:
        return {
          color: '#ff9800',
          text: 'Переподключение...',
          showSpinner: true,
        };
      case CONNECTION_STATES.DISCONNECTED:
      default:
        return {
          color: '#f44336',
          text: 'Не подключено',
          showSpinner: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, style]}>
      {config.showSpinner ? (
        <ActivityIndicator size="small" color={config.color} style={styles.spinner} />
      ) : (
        <View style={[styles.indicator, {backgroundColor: config.color}]} />
      )}
      <Text style={styles.text}>{config.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  spinner: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default ConnectionStatus;
