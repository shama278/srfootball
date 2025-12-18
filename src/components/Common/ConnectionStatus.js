import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

/**
 * Компонент индикатора статуса подключения
 */
const ConnectionStatus = ({isConnected, style}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.indicator, isConnected ? styles.connected : styles.disconnected]} />
      <Text style={styles.text}>
        {isConnected ? 'Подключено' : 'Не подключено'}
      </Text>
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
  connected: {
    backgroundColor: '#4caf50',
  },
  disconnected: {
    backgroundColor: '#f44336',
  },
  text: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default ConnectionStatus;
