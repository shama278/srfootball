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
import {getDefaultWebSocketPort, getLocalIPAddress} from '../services/networkUtils';
import WebSocketClient from '../services/websocketClient';

const CONTROLLER_IP_KEY = 'controller_ip_address';

/**
 * Экран настройки подключения для контроллера (поиск табло)
 */
const ConnectionSetupScreen = ({onConnect, onCancel, discoveryService, isController = false}) => {
  const [ipAddress, setIpAddress] = useState('');
  const [savedIp, setSavedIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const [focusedInput, setFocusedInput] = useState(false);
  const [foundDevices, setFoundDevices] = useState([]); // Список найденных устройств
  const [deviceUpdateInterval, setDeviceUpdateInterval] = useState(null);
  const inputRef = useRef(null);
  const scanButtonRef = useRef(null);
  const connectButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    loadSavedIp();
    startAutoDiscovery();

    // Обновляем список найденных устройств периодически
    const interval = setInterval(() => {
      if (discoveryService) {
        const devices = discoveryService.getFoundDevices();
        setFoundDevices(devices);
      }
    }, 1000);

    setDeviceUpdateInterval(interval);

    return () => {
      if (discoveryService) {
        discoveryService.stopBroadcast();
      }
      if (interval) {
        clearInterval(interval);
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
    }
  };

  const saveIp = useCallback(async (ip) => {
    try {
      await AsyncStorage.setItem(CONTROLLER_IP_KEY, ip);
      setSavedIp(ip);
    } catch (error) {
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

  const testConnection = async (ip, port, timeoutMs = 500) => {
    return new Promise(async (resolve) => {
      let testClient = null;
      let resolved = false;

      try {
        // Получаем локальный IP адрес для принудительного использования IPv4
        const localIP = await getLocalIPAddress();
        testClient = new WebSocketClient(ip, port, localIP || null);
      } catch (error) {
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
      }, timeoutMs); // Быстрая проверка (500ms по умолчанию)

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
      discoveryService.stopBroadcast();
    }

    try {
      // Тестируем подключение перед сохранением (быстрая проверка)
      const port = getDefaultWebSocketPort();
      const isConnected = await testConnection(trimmedIp, port);

      if (isConnected) {
        await saveIp(trimmedIp);
        // Останавливаем discovery перед подключением
        if (discoveryService) {
          discoveryService.stopBroadcast();
        }
        onConnect(trimmedIp);
      } else {
        Alert.alert('Ошибка', `Не удалось подключиться к табло ${trimmedIp}:${port}\n\nПроверьте:\n- Правильность IP адреса\n- Что табло запущено\n- Что устройства в одной сети`);
        // Перезапускаем discovery если подключение не удалось
        if (discoveryService) {
          startAutoDiscovery();
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось подключиться к табло');
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
      if (!state.isConnected) {
        Alert.alert('Ошибка', 'Нет подключения к сети');
        setScanning(false);
        return;
      }

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

      if (!currentIp) {
        Alert.alert('Информация', 'Не удалось определить IP адрес. Введите IP вручную.');
        setScanning(false);
        return;
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

      // Приоритетные IP адреса для быстрой проверки (обычно роутеры, популярные адреса)
      const priorityIps = [
        `${baseIp}.1`,   // Обычно роутер
        `${baseIp}.2`,
        `${baseIp}.100`,
        `${baseIp}.101`,
        `${baseIp}.254`, // Часто используется
      ].filter(ip => ip !== currentIp); // Убираем свой IP

      // Дополнительные IP для проверки (первые 30 адресов, но не приоритетные)
      const additionalIps = [];
      for (let i = 1; i <= 30; i++) {
        const testIp = `${baseIp}.${i}`;
        if (testIp !== currentIp && !priorityIps.includes(testIp)) {
          additionalIps.push(testIp);
        }
      }

      // Объединяем: сначала приоритетные, потом дополнительные
      const testIps = [...priorityIps, ...additionalIps];
      let foundController = null;

      Alert.alert('Поиск табло', 'Идет быстрое сканирование сети...');

      // Параллельное сканирование нескольких адресов одновременно (батчами по 5)
      const batchSize = 5;
      for (let i = 0; i < testIps.length; i += batchSize) {
        const batch = testIps.slice(i, i + batchSize);

        // Проверяем батч параллельно
        const results = await Promise.all(
          batch.map(async (testIp) => {
            try {
              const isConnected = await testConnection(testIp, port, 800); // 800ms на проверку
              return isConnected ? testIp : null;
            } catch (error) {
              return null;
            }
          })
        );

        // Проверяем результаты
        const found = results.find(result => result !== null);
        if (found) {
          foundController = found;
          break; // Нашли, прекращаем поиск
        }

        // Небольшая пауза между батчами
        if (i + batchSize < testIps.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      if (foundController) {
        setIpAddress(foundController);
        Alert.alert('Табло найдено!', `Найдено табло по адресу:\n${foundController}\n\nНажмите "Подключиться" для соединения.`);
      } else {
        Alert.alert(
          'Табло не найдено',
          `Проверено ${testIps.length} адресов в сети.\n\nПопробуйте:\n1. Убедиться, что табло запущено\n2. Ввести IP адрес вручную\n3. Проверить, что устройства в одной сети`
        );
      }
    } catch (error) {
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
   * Запускает автоматическое обнаружение устройств через UDP broadcast
   */
  const startAutoDiscovery = useCallback(async () => {
    if (!discoveryService) {
      return;
    }

    setAutoDiscovering(true);
    try {
      // Передаем сохраненный IP, если он есть, для дополнительных прямых запросов
      const knownIP = savedIp || ipAddress || null;

      await discoveryService.startBroadcast((foundIp, foundPort, deviceName) => {

        // Обновляем список найденных устройств
        const devices = discoveryService.getFoundDevices();
        setFoundDevices(devices);

        // Автоматически подключаемся к первому найденному устройству через небольшую задержку
        // (только если еще не подключены)
        if (!loading && foundIp) {
          setTimeout(async () => {
            const trimmedIp = foundIp.trim();
            if (trimmedIp && !ipAddress) {
              setIpAddress(trimmedIp);
              // Не подключаемся автоматически - даем пользователю выбрать устройство
            }
          }, 500);
        }
      });
    } catch (error) {
      setAutoDiscovering(false);
    }
  }, [discoveryService, loading, ipAddress, savedIp]);

  /**
   * Подключается к выбранному устройству
   */
  const handleDeviceSelect = useCallback(async (device) => {
    const trimmedIp = device.ip.trim();
    if (!trimmedIp) {
      Alert.alert('Ошибка', 'Неверный IP адрес устройства');
      return;
    }

    setLoading(true);
    setAutoDiscovering(false);

    // Останавливаем discovery при ручном подключении
    if (discoveryService) {
      discoveryService.stopBroadcast();
    }

    try {
      // Тестируем подключение перед сохранением
      const port = device.port || getDefaultWebSocketPort();
      const isConnected = await testConnection(trimmedIp, port);

      if (isConnected) {
        await saveIp(trimmedIp);
        onConnect(trimmedIp);
      } else {
        Alert.alert(
          'Ошибка',
          `Не удалось подключиться к устройству ${trimmedIp}:${port}\n\nПроверьте:\n- Правильность IP адреса\n- Что устройство запущено\n- Что устройства в одной сети`
        );
        // Перезапускаем discovery если подключение не удалось
        if (discoveryService) {
          startAutoDiscovery();
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось подключиться к устройству');
      // Перезапускаем discovery если подключение не удалось
      if (discoveryService) {
        startAutoDiscovery();
      }
    } finally {
      setLoading(false);
    }
  }, [discoveryService, onConnect, saveIp, startAutoDiscovery]);

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
              <ActivityIndicator size="small" color="#2196f3" style={styles.autoDiscoverySpinner} />
              <Text style={styles.autoDiscoveryText}>
                🔍 Автоматический поиск устройств в сети...
              </Text>
            </View>
          )}

          {/* Список найденных устройств */}
          {foundDevices.length > 0 && (
            <View style={styles.devicesContainer}>
              <Text style={styles.devicesTitle}>Найденные устройства ({foundDevices.length}):</Text>
              <ScrollView style={styles.devicesList} nestedScrollEnabled={true}>
                {foundDevices.map((device, index) => (
                  <TouchableOpacity
                    key={`${device.ip}:${device.port}`}
                    style={[
                      styles.deviceItem,
                      ipAddress === device.ip && styles.deviceItemSelected,
                    ]}
                    onPress={() => handleDeviceSelect(device)}
                    disabled={loading || scanning}
                    activeOpacity={0.7}>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.deviceName || 'Unknown Device'}</Text>
                      <Text style={styles.deviceAddress}>{device.ip}:{device.port}</Text>
                    </View>
                    {ipAddress === device.ip && (
                      <View style={styles.deviceSelectedIndicator}>
                        <Text style={styles.deviceSelectedText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
              placeholder="192.168.0.217"
              placeholderTextColor="#999"
              keyboardType="default"
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  autoDiscoverySpinner: {
    marginRight: 10,
  },
  autoDiscoveryText: {
    fontSize: Platform.isTV ? 18 : 16,
    color: '#1976d2',
    fontWeight: '500',
  },
  devicesContainer: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    maxHeight: 200,
  },
  devicesTitle: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  devicesList: {
    maxHeight: 150,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  deviceItemSelected: {
    borderColor: '#2196f3',
    backgroundColor: '#e3f2fd',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceAddress: {
    fontSize: Platform.isTV ? 16 : 14,
    color: '#666',
  },
  deviceSelectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  deviceSelectedText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ConnectionSetupScreen;
