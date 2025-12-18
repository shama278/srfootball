import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {getDefaultWebSocketPort} from '../services/networkUtils';
import WebSocketClient from '../services/websocketClient';
import logger from '../services/logger';

// Полифилл для Buffer в React Native
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

const CONTROLLER_IP_KEY = 'controller_ip_address';

/**
 * Экран настройки подключения для контроллера (поиск табло)
 */
const ConnectionSetupScreen = ({onConnect, onCancel, discoveryService, isController = false, onShowLogs}) => {
  const [ipAddress, setIpAddress] = useState('');
  const [savedIp, setSavedIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const [focusedInput, setFocusedInput] = useState(false);
  const inputRef = useRef(null);
  const scanButtonRef = useRef(null);
  const connectButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    loadSavedIp();
    startAutoDiscovery();

    return () => {
      if (discoveryService) {
        discoveryService.stopListening();
      }
    };
  }, []);

  const loadSavedIp = async () => {
    try {
      const saved = await AsyncStorage.getItem(CONTROLLER_IP_KEY);
      if (saved) {
        setSavedIp(saved);
        setIpAddress(saved);
      }
    } catch (error) {
      logger.error('Ошибка при загрузке сохраненного IP:', error);
    }
  };

  const saveIp = useCallback(async (ip) => {
    try {
      await AsyncStorage.setItem(CONTROLLER_IP_KEY, ip);
      setSavedIp(ip);
    } catch (error) {
      logger.error('Ошибка при сохранении IP:', error);
    }
  }, []);

  const validateIp = (ip) => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return false;
    }
    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  };

  const testConnection = async (ip, port) => {
    return new Promise((resolve) => {
      let testClient = null;
      let resolved = false;

      try {
        testClient = new WebSocketClient(ip, port);
      } catch (error) {
        logger.error(`[testConnection] Ошибка при создании клиента для ${ip}:${port}:`, error.message || error.toString() || error);
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            if (testClient) {
              testClient.disconnect();
            }
          } catch (error) {
            // Игнорируем ошибки при отключении
          }
          resolve(false);
        }
      }, 5000); // 5 секунд на проверку (увеличено для более надежного подключения)

      try {
        testClient.connect(
          () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try {
                if (testClient) {
                  testClient.disconnect();
                }
              } catch (error) {
                // Игнорируем ошибки при отключении
              }
              resolve(true);
            }
          },
          () => {
            // Игнорируем сообщения
          },
          (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try {
                if (testClient) {
                  testClient.disconnect();
                }
              } catch (e) {
                // Игнорируем ошибки при отключении
              }
              resolve(false);
            }
          },
          () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(false);
            }
          }
        ).catch((error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            try {
              if (testClient) {
                testClient.disconnect();
              }
            } catch (e) {
              // Игнорируем ошибки при отключении
            }
            resolve(false);
          }
        });
      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(false);
        }
      }
    });
  };

  const handleConnect = async () => {
    const trimmedIp = ipAddress.trim();

    if (!trimmedIp) {
      Alert.alert('Ошибка', 'Введите IP адрес табло');
      return;
    }

    if (!validateIp(trimmedIp)) {
      Alert.alert('Ошибка', 'Неверный формат IP адреса');
      return;
    }

    setLoading(true);
    setAutoDiscovering(false);

    // Останавливаем discovery при ручном подключении
    if (discoveryService) {
      discoveryService.stopListening();
    }

    try {
      // Тестируем подключение перед сохранением
      const port = getDefaultWebSocketPort();
      const isConnected = await testConnection(trimmedIp, port);

      if (isConnected) {
        await saveIp(trimmedIp);
        onConnect(trimmedIp);
      } else {
        const errorMessage = `Не удалось подключиться к табло ${trimmedIp}:${port}\n\nВозможные причины:\n- Неверный IP адрес\n- Табло не запущено\n- Устройства не в одной сети\n- Брандмауэр блокирует подключение\n\nПопробуйте:\n1. Проверить IP адрес табло в настройках Wi-Fi\n2. Убедиться что табло запущено\n3. Проверить что оба устройства в одной Wi-Fi сети\n4. Попробовать сканирование сети`;
        Alert.alert('Ошибка подключения', errorMessage);
        // Перезапускаем discovery если подключение не удалось
        if (discoveryService) {
          startAutoDiscovery();
        }
      }
    } catch (error) {
      logger.error('Ошибка при подключении:', error);
      const errorMessage = error.message || error.toString();
      Alert.alert('Ошибка подключения', `Не удалось подключиться к табло:\n${errorMessage}\n\nПроверьте:\n- Правильность IP адреса\n- Что табло запущено\n- Что устройства в одной сети`);
      // Перезапускаем discovery если подключение не удалось
      if (discoveryService) {
        startAutoDiscovery();
      }
    } finally {
      setLoading(false);
    }
  };

  const scanNetwork = async () => {
    setScanning(true);
    try {
      const state = await NetInfo.fetch();

      // Не блокируем сканирование даже если NetInfo считает что нет подключения
      // Это важно для работы при раздаче Wi-Fi с телефона
      // if (!state.isConnected) {
      //   Alert.alert('Ошибка', 'Нет подключения к сети');
      //   setScanning(false);
      //   return;
      // }

      // Получаем IP адрес текущего устройства
      let currentIp = null;
      if (state.details) {
        // Пробуем разные способы получить IP
        if (state.details.ipAddress) {
          currentIp = state.details.ipAddress;
        } else if (state.details.wifi && state.details.wifi.ipAddress) {
          currentIp = state.details.wifi.ipAddress;
        } else if (state.details.cellular && state.details.cellular.ipAddress) {
          currentIp = state.details.cellular.ipAddress;
        }
      }

      // Если не удалось получить IP из NetInfo, пробуем стандартные диапазоны
      if (!currentIp) {
        // При раздаче Wi-Fi с телефона часто используется диапазон 192.168.43.x
        // или 192.168.137.x, или другие стандартные диапазоны
        logger.log('[Scan] Не удалось определить IP из NetInfo, пробуем стандартные диапазоны');

        // Пробуем сканировать стандартные диапазоны
        const commonRanges = [
          '192.168.43',  // Android Hotspot
          '192.168.137', // Windows Mobile Hotspot
          '192.168.1',   // Обычная домашняя сеть
          '192.168.0',   // Обычная домашняя сеть
          '10.0.0',      // Корпоративная сеть
        ];

        let foundController = null;

        for (const baseIp of commonRanges) {
          const port = getDefaultWebSocketPort();
          const testIps = [];

          // Проверяем только наиболее вероятные адреса в каждом диапазоне
          // Используем те же приоритетные диапазоны
          const priorityRanges = [
            { start: 1, end: 20 },
            { start: 100, end: 120 },
            { start: 200, end: 220 },
          ];
          
          priorityRanges.forEach((range) => {
            for (let i = range.start; i <= range.end; i++) {
              testIps.push(`${baseIp}.${i}`);
            }
          });

          logger.log(`[Scan] Сканирование диапазона ${baseIp}.x`);

          for (const testIp of testIps) {
            try {
              logger.log(`[Scan] Проверка ${testIp}:${port}`);
              const isConnected = await testConnection(testIp, port);
              if (isConnected) {
                foundController = testIp;
                break;
              }
              // Небольшая задержка между проверками
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              logger.error(`[Scan] Ошибка при проверке ${testIp}:`, error);
              continue;
            }
          }

          if (foundController) {
            break;
          }
        }

        if (foundController) {
          setIpAddress(foundController);
          Alert.alert('Табло найдено!', `Найдено табло по адресу:\n${foundController}\n\nНажмите "Подключиться" для соединения.`);
          setScanning(false);
          return;
        } else {
          Alert.alert('Информация', 'Не удалось определить IP адрес и найти табло автоматически. Введите IP вручную.');
          setScanning(false);
          return;
        }
      }

      // Проверяем формат IP адреса
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(currentIp)) {
        Alert.alert('Информация', `Неверный формат IP адреса: ${currentIp}. Введите IP вручную.`);
        setScanning(false);
        return;
      }

      // Определяем базовый IP сети (первые 3 октета)
      const ipParts = currentIp.split('.');
      if (ipParts.length !== 4) {
        Alert.alert('Информация', 'Не удалось определить сеть. Введите IP вручную.');
        setScanning(false);
        return;
      }

      const baseIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      const port = getDefaultWebSocketPort();

      // Генерируем список возможных IP адресов для проверки
      const possibleIps = [];

      // Добавляем IP адреса в диапазоне от 1 до 254
      for (let i = 1; i <= 254; i++) {
        if (i.toString() !== ipParts[3]) { // Пропускаем свой IP
          possibleIps.push(`${baseIp}.${i}`);
        }
      }

      // Умное сканирование: проверяем только наиболее вероятные адреса
      // Используем параллельные запросы для ускорения
      const priorityRanges = [
        // Стандартные диапазоны роутеров и устройств
        { start: 1, end: 20 },      // Обычно роутеры и первые устройства
        { start: 100, end: 120 },   // Средний диапазон
        { start: 200, end: 220 },   // Высокий диапазон
      ];

      const testIps = [];
      priorityRanges.forEach((range) => {
        for (let i = range.start; i <= range.end; i++) {
          const ip = `${baseIp}.${i}`;
          // Пропускаем свой IP
          if (ip !== currentIp) {
            testIps.push(ip);
          }
        }
      });

      // Если текущий IP не в приоритетных диапазонах, добавляем его соседей
      const currentLastOctet = parseInt(ipParts[3], 10);
      if (currentLastOctet < 1 || currentLastOctet > 220) {
        // Добавляем соседние адреса текущего IP
        for (let i = Math.max(1, currentLastOctet - 5); i <= Math.min(254, currentLastOctet + 5); i++) {
          if (i !== currentLastOctet) {
            const ip = `${baseIp}.${i}`;
            if (!testIps.includes(ip)) {
              testIps.push(ip);
            }
          }
        }
      }

      let foundController = null;
      let checkedCount = 0;
      const maxConcurrent = 10; // Максимум параллельных запросов

      Alert.alert('Поиск табло', `Идет сканирование сети...\nПроверяется ${testIps.length} наиболее вероятных адресов.`);

      // Параллельное сканирование с ограничением количества одновременных запросов
      for (let i = 0; i < testIps.length; i += maxConcurrent) {
        const batch = testIps.slice(i, i + maxConcurrent);
        const results = await Promise.allSettled(
          batch.map(async (testIp) => {
            try {
              checkedCount++;
              logger.log(`[Scan] Проверка ${testIp}:${port} (${checkedCount}/${testIps.length})`);
              const isConnected = await testConnection(testIp, port);
              return { ip: testIp, connected: isConnected };
            } catch (error) {
              logger.error(`[Scan] Ошибка при проверке ${testIp}:`, error);
              return { ip: testIp, connected: false };
            }
          })
        );

        // Проверяем результаты
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.connected) {
            foundController = result.value.ip;
            break;
          }
        }

        if (foundController) {
          break;
        }

        // Небольшая задержка между батчами
        if (i + maxConcurrent < testIps.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (foundController) {
        setIpAddress(foundController);
        Alert.alert('Табло найдено!', `Найдено табло по адресу:\n${foundController}\n\nНажмите "Подключиться" для соединения.`);
      } else {
        Alert.alert(
          'Табло не найдено',
          `Проверено ${checkedCount} адресов в сети ${baseIp}.x\n\nПопробуйте:\n1. Убедиться, что табло запущено\n2. Ввести IP адрес вручную\n3. Проверить, что устройства в одной сети\n4. Использовать автоматическое обнаружение (если доступно)`
        );
      }
    } catch (error) {
      logger.error('Ошибка при сканировании сети:', error);
      Alert.alert('Ошибка', `Не удалось просканировать сеть: ${error.message || error.toString()}`);
    } finally {
      setScanning(false);
    }
  };

  const handleInputFocus = () => {
    setFocusedInput(true);
  };

  const handleInputBlur = () => {
    setFocusedInput(false);
  };

  /**
   * Запускает автоматическое обнаружение контроллера через UDP broadcast
   */
  const startAutoDiscovery = useCallback(async () => {
    if (!discoveryService) {
      logger.log('[ConnectionSetup] DiscoveryService не доступен');
      return;
    }

    setAutoDiscovering(true);
    try {
      // Не проверяем состояние сети через NetInfo, так как это может блокировать
      // работу при раздаче Wi-Fi с телефона
      await discoveryService.startListening((foundIp, foundPort) => {
        logger.log(`[ConnectionSetup] Автоматически найдено табло: ${foundIp}:${foundPort}`);
        setIpAddress(foundIp);
        setAutoDiscovering(false);

        // Автоматически подключаемся через небольшую задержку
        setTimeout(async () => {
          const trimmedIp = foundIp.trim();
          if (trimmedIp) {
            try {
              await saveIp(trimmedIp);
              onConnect(trimmedIp);
            } catch (error) {
              logger.error('[ConnectionSetup] Ошибка при сохранении IP:', error);
              onConnect(trimmedIp); // Подключаемся даже если сохранение не удалось
            }
          }
        }, 500);
      });

      logger.log('[ConnectionSetup] Автоматическое обнаружение запущено');
    } catch (error) {
      logger.error('[ConnectionSetup] Ошибка при запуске автоматического обнаружения:', error);
      setAutoDiscovering(false);
      // Не показываем ошибку пользователю, так как это может быть нормально
      // при раздаче Wi-Fi с телефона или других особых случаях
    }
  }, [discoveryService, onConnect, saveIp]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Поиск табло</Text>
          <Text style={styles.subtitle}>
            Приложение автоматически ищет табло в сети
          </Text>

          {autoDiscovering && (
            <View style={styles.autoDiscoveryContainer}>
              <View style={styles.autoDiscoveryContent}>
                <ActivityIndicator size="small" color="#2196f3" style={styles.autoDiscoverySpinner} />
                <Text style={styles.autoDiscoveryText}>
                  🔍 Автоматический поиск табло...
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stopDiscoveryButton}
                onPress={() => {
                  if (discoveryService) {
                    discoveryService.stopListening();
                  }
                  setAutoDiscovering(false);
                  logger.log('[ConnectionSetup] Автоматический поиск остановлен пользователем');
                }}
                activeOpacity={0.7}>
                <Text style={styles.stopDiscoveryButtonText}>Остановить</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>IP адрес табло (если нужно ввести вручную)</Text>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                focusedInput && styles.inputFocused,
              ]}
              value={ipAddress}
              onChangeText={setIpAddress}
              placeholder="192.168.18.36"
              placeholderTextColor="#999"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading && !scanning}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onSubmitEditing={handleConnect}
              returnKeyType="done"
              // Для TV: делаем поле доступным для фокуса
              tvParallaxProperties={{
                enabled: true,
                shiftDistanceX: 2.0,
                shiftDistanceY: 2.0,
              }}
            />
            {savedIp && (
              <Text style={styles.savedIpText}>Сохраненный IP: {savedIp}</Text>
            )}
            <Text style={styles.portInfo}>Порт: {getDefaultWebSocketPort()}</Text>
          </View>

          <TouchableOpacity
            ref={scanButtonRef}
            style={[
              styles.button,
              styles.scanButton,
              (scanning || loading) && styles.buttonDisabled,
            ]}
            onPress={scanNetwork}
            disabled={scanning || loading}
            activeOpacity={0.7}
            // Для TV: поддержка навигации пультом
            hasTVPreferredFocus={!savedIp}
            tvParallaxProperties={{
              enabled: true,
              shiftDistanceX: 2.0,
              shiftDistanceY: 2.0,
            }}>
            {scanning ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#ffffff" style={styles.buttonSpinner} />
                <Text style={styles.buttonText}>Поиск...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>🔍 Найти в сети</Text>
            )}
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              ref={cancelButtonRef}
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading || scanning}
              activeOpacity={0.7}
              tvParallaxProperties={{
                enabled: true,
                shiftDistanceX: 2.0,
                shiftDistanceY: 2.0,
              }}>
              <Text style={styles.buttonText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              ref={connectButtonRef}
              style={[
                styles.button,
                styles.connectButton,
                (loading || scanning) && styles.buttonDisabled,
              ]}
              onPress={handleConnect}
              disabled={loading || scanning}
              activeOpacity={0.7}
              hasTVPreferredFocus={!!savedIp}
              tvParallaxProperties={{
                enabled: true,
                shiftDistanceX: 2.0,
                shiftDistanceY: 2.0,
              }}>
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#ffffff" style={styles.buttonSpinner} />
                  <Text style={styles.buttonText}>Подключение...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Подключиться</Text>
              )}
            </TouchableOpacity>
          </View>

          {onShowLogs && (
            <TouchableOpacity
              style={styles.logsButton}
              onPress={onShowLogs}
              activeOpacity={0.7}>
              <Text style={styles.logsButtonText}>📋 Показать логи</Text>
            </TouchableOpacity>
          )}

          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Автоматическое подключение:</Text>
            <Text style={styles.infoText}>
              Приложение автоматически ищет табло в сети.{'\n'}
              Если табло найдено, подключение произойдет автоматически.{'\n\n'}
              Или введите IP адрес табло вручную:
            </Text>
            <Text style={styles.infoText}>
              1. На телевизоре с табло откройте настройки Wi-Fi → подключенная сеть → IP адрес{'\n'}
              2. Введите этот адрес выше{'\n'}
              3. Нажмите "Подключиться"
            </Text>
            <Text style={styles.infoHint}>
              💡 Совет: Убедитесь, что табло запущено и оба устройства в одной Wi-Fi сети
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: Platform.isTV ? 32 : 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Platform.isTV ? 18 : 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: Platform.isTV ? 20 : 15,
    fontSize: Platform.isTV ? 24 : 18,
    color: '#333',
    minHeight: Platform.isTV ? 60 : 50,
  },
  inputFocused: {
    borderColor: '#2196f3',
    borderWidth: 3,
  },
  savedIpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  portInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  scanButton: {
    backgroundColor: '#2196f3',
    marginBottom: 15,
    minHeight: Platform.isTV ? 60 : 50,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  button: {
    flex: 1,
    paddingVertical: Platform.isTV ? 20 : 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    minHeight: Platform.isTV ? 60 : 50,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSpinner: {
    marginRight: 10,
  },
  cancelButton: {
    backgroundColor: '#9e9e9e',
  },
  connectButton: {
    backgroundColor: '#4caf50',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoTitle: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 10,
  },
  infoHint: {
    fontSize: Platform.isTV ? 16 : 14,
    color: '#1976d2',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  autoDiscoveryContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  autoDiscoveryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  autoDiscoverySpinner: {
    marginRight: 10,
  },
  autoDiscoveryText: {
    fontSize: Platform.isTV ? 18 : 16,
    color: '#1976d2',
    fontWeight: '500',
  },
  stopDiscoveryButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f44336',
    borderRadius: 6,
    alignSelf: 'center',
  },
  stopDiscoveryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  logsButton: {
    marginTop: 15,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    marginBottom: 20,
  },
  logsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ConnectionSetupScreen;
