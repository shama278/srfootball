import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Platform,
} from 'react-native';
import logger from '../services/logger';

/**
 * Компонент для просмотра логов приложения
 */
const LogViewer = ({visible, onClose}) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // all, log, error, warn, info
  const scrollViewRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!visible) {
      return;
    }

    // Загружаем текущие логи
    setLogs(logger.getLogs());

    // Подписываемся на новые логи
    const unsubscribe = logger.subscribe((newLog) => {
      if (newLog) {
        setLogs((prevLogs) => {
          const updated = [...prevLogs, newLog];
          // Ограничиваем количество отображаемых логов
          if (updated.length > 500) {
            return updated.slice(-500);
          }
          return updated;
        });
      } else {
        // Очистка логов
        setLogs([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible]);

  // Автопрокрутка к последнему логу
  useEffect(() => {
    if (autoScroll && logs.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [logs, autoScroll]);

  const getFilteredLogs = () => {
    if (filter === 'all') {
      return logs;
    }
    return logs.filter((log) => log.level === filter);
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'error':
        return '#f44336';
      case 'warn':
        return '#ff9800';
      case 'info':
        return '#2196f3';
      default:
        return '#666';
    }
  };

  const getLogBackground = (level) => {
    switch (level) {
      case 'error':
        return '#ffebee';
      case 'warn':
        return '#fff3e0';
      case 'info':
        return '#e3f2fd';
      default:
        return '#f5f5f5';
    }
  };

  const filteredLogs = getFilteredLogs();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Логи приложения</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => logger.clearLogs()}>
              <Text style={styles.buttonText}>Очистить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filters}>
          {['all', 'log', 'error', 'warn', 'info'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.filterButton,
                filter === level && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(level)}>
              <Text
                style={[
                  styles.filterButtonText,
                  filter === level && styles.filterButtonTextActive,
                ]}>
                {level === 'all' ? 'Все' : level.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.filterButton,
              autoScroll && styles.filterButtonActive,
            ]}
            onPress={() => setAutoScroll(!autoScroll)}>
            <Text
              style={[
                styles.filterButtonText,
                autoScroll && styles.filterButtonTextActive,
              ]}>
              Авто
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
          {filteredLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Логи отсутствуют</Text>
            </View>
          ) : (
            filteredLogs.map((log) => (
              <View
                key={log.id}
                style={[
                  styles.logEntry,
                  {backgroundColor: getLogBackground(log.level)},
                ]}>
                <View style={styles.logHeader}>
                  <Text
                    style={[styles.logTimestamp, {color: getLogColor(log.level)}]}>
                    {log.timestamp}
                  </Text>
                  <Text
                    style={[styles.logLevel, {color: getLogColor(log.level)}]}>
                    {log.level.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.logMessage}>{log.message}</Text>
                {log.data && (
                  <Text style={styles.logData}>{log.data}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Всего логов: {logs.length} | Показано: {filteredLogs.length}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#2196f3',
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  filters: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  filterButtonActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
  },
  logEntry: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 5,
    borderLeftWidth: 3,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  logTimestamp: {
    fontSize: 11,
    fontWeight: '600',
  },
  logLevel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  logMessage: {
    fontSize: 13,
    color: '#333',
    marginBottom: 5,
  },
  logData: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginTop: 5,
    padding: 5,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  footer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default LogViewer;





