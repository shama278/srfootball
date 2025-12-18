import React, {useState, useEffect} from 'react';
import {SafeAreaView, StatusBar, StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import {ScoreboardProvider} from './context/ScoreboardContext';
import ControllerScreen from './screens/ControllerScreen';
import DisplayScreen from './screens/DisplayScreen';
import ModeSelectorScreen from './screens/ModeSelectorScreen';
import ConnectionSetupScreen from './screens/ConnectionSetupScreen';
import WebSocketServer from './services/websocketServer';
import WebSocketClient from './services/websocketClient';
import DiscoveryService from './services/discoveryService';
import {getLocalIPAddress, getDefaultWebSocketPort} from './services/networkUtils';
import {APP_MODES} from './utils/deviceDetection';
import LogViewer from './components/LogViewer';
import logger from './services/logger';

const App = () => {
  const [mode, setMode] = useState(null);
  const [websocketServer, setWebsocketServer] = useState(null);
  const [websocketClient, setWebsocketClient] = useState(null);
  const [showConnectionSetup, setShowConnectionSetup] = useState(false);
  const [error, setError] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [discoveryService] = useState(() => {
    const service = new DiscoveryService();
    logger.log('[App] Приложение запущено');
    logger.log('[App] DiscoveryService инициализирован');
    return service;
  });

  useEffect(() => {
    // Очистка при размонтировании
    return () => {
      try {
        if (websocketServer) {
          websocketServer.stop();
        }
        if (websocketClient) {
          websocketClient.disconnect();
        }
        discoveryService.stop();
      } catch (error) {
        logger.error('[App] Ошибка при очистке ресурсов:', error);
      }
    };
  }, [websocketServer, websocketClient, discoveryService]);

  const handleModeSelected = async (selectedMode) => {
    try {
      setError(null);
      setMode(selectedMode);
      logger.log(`[App] Выбран режим: ${selectedMode === APP_MODES.CONTROLLER ? 'Контроллер' : 'Табло'}`);

      if (selectedMode === APP_MODES.CONTROLLER) {
        // Контроллер ищет табло и подключается к нему
        // Показываем экран поиска табло
        setShowConnectionSetup(true);
      } else if (selectedMode === APP_MODES.DISPLAY) {
        // Табло запускает WebSocket сервер и отправляет broadcast
        logger.log('[App] Запуск режима табло...');
        try {
          const server = new WebSocketServer();
          logger.log('[App] WebSocket сервер создан, запуск...');
          const ipAddress = await server.start(
            (socketId) => {
              try {
                logger.log(`[App] Контроллер подключен к табло: ${socketId}`);
                logger.log(`[App] Всего подключенных контроллеров: ${server.getClientCount()}`);
              } catch (error) {
                logger.error('[App] Ошибка в onConnectionCallback:', error);
              }
            },
            (socketId, message) => {
              try {
                logger.log(`[App] Сообщение от контроллера ${socketId}:`, message);
                // Сообщения обрабатываются в ScoreboardContext
              } catch (error) {
                logger.error('[App] Ошибка в onMessageCallback:', error);
              }
            },
            (socketId) => {
              try {
                logger.log(`[App] Контроллер отключен от табло: ${socketId}`);
                logger.log(`[App] Всего подключенных контроллеров: ${server.getClientCount()}`);
              } catch (error) {
                logger.error('[App] Ошибка в onDisconnectCallback:', error);
              }
            }
          );
          logger.log(`[App] WebSocket сервер запущен на ${ipAddress}:${getDefaultWebSocketPort()}`);
          setWebsocketServer(server);

          // Запускаем broadcast для автоматического обнаружения табло
          if (ipAddress) {
            try {
              discoveryService.startBroadcast(ipAddress, getDefaultWebSocketPort());
              logger.log(`[App] Discovery broadcast запущен для табло`);
            } catch (error) {
              logger.error('[App] Ошибка при запуске Discovery broadcast:', error);
              // Не блокируем работу приложения, если broadcast не запустился
            }
          }
        } catch (error) {
          const errorMsg = error?.message || error?.toString() || 'Неизвестная ошибка';
          logger.error('[App] Ошибка при запуске WebSocket сервера:', errorMsg);
          setError(`Ошибка при запуске сервера: ${errorMsg}`);
          // Показываем табло даже если сервер не запустился
        }
      }
    } catch (error) {
      const errorMsg = error?.message || error?.toString() || 'Неизвестная ошибка';
      logger.error('[App] Ошибка при выборе режима:', errorMsg);
      setError(`Ошибка: ${errorMsg}`);
    }
  };

  const handleConnectToDisplay = (displayIP) => {
    try {
      const port = getDefaultWebSocketPort();
      const client = new WebSocketClient(displayIP, port);
      setWebsocketClient(client);
      setShowConnectionSetup(false);

      logger.log(`[App] WebSocket клиент создан для подключения к табло ${displayIP}:${port}`);
      logger.log(`[App] Подключение будет выполнено в ScoreboardContext`);
    } catch (error) {
      logger.error('[App] Ошибка при создании WebSocket клиента:', error);
    }
  };

  const handleCancelConnection = () => {
    setShowConnectionSetup(false);
    setMode(null);
  };

  if (!mode) {
    return <ModeSelectorScreen onModeSelected={handleModeSelected} />;
  }

  if (showConnectionSetup && mode === APP_MODES.CONTROLLER) {
    return (
      <>
        <ConnectionSetupScreen
          onConnect={handleConnectToDisplay}
          onCancel={handleCancelConnection}
          discoveryService={discoveryService}
          isController={true}
          onShowLogs={() => setShowLogs(true)}
        />
        <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />
      </>
    );
  }

  const isController = mode === APP_MODES.CONTROLLER;

  // Показываем ошибку если есть
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка: {error}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => {
              setError(null);
              setMode(null);
            }}>
            <Text style={styles.errorButtonText}>Назад</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScoreboardProvider
      websocketClient={websocketClient}
      websocketServer={websocketServer}
      isController={isController}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isController ? 'dark-content' : 'light-content'} />
        {isController ? <ControllerScreen onShowLogs={() => setShowLogs(true)} /> : <DisplayScreen onShowLogs={() => setShowLogs(true)} />}
      </SafeAreaView>
      <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />
    </ScoreboardProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ff0000',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
