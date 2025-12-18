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

const App = () => {
  const [mode, setMode] = useState(null);
  const [websocketServer, setWebsocketServer] = useState(null);
  const [websocketClient, setWebsocketClient] = useState(null);
  const [showConnectionSetup, setShowConnectionSetup] = useState(false);
  const [error, setError] = useState(null);
  const [discoveryService] = useState(() => new DiscoveryService());

  useEffect(() => {
    // Очистка при размонтировании
    return () => {
      // Вызываем async функции без await, так как cleanup не может быть async
      if (websocketServer) {
        websocketServer.stop().catch((error) => {
          console.error('[App] Ошибка при остановке сервера при размонтировании:', error);
        });
      }
      if (websocketClient) {
        try {
          websocketClient.disconnect();
        } catch (error) {
          console.error('[App] Ошибка при отключении клиента при размонтировании:', error);
        }
      }
      try {
        discoveryService.stop();
      } catch (error) {
        console.error('[App] Ошибка при остановке discovery сервиса:', error);
      }
    };
  }, [websocketServer, websocketClient, discoveryService]);

  const startDisplayServer = async () => {
    try {
      // Сначала останавливаем старый сервер, если он есть
      if (websocketServer) {
        console.log('[App] Останавливаем старый WebSocket сервер перед запуском нового');
        try {
          await websocketServer.stop();
          // Даем время на полную остановку
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (stopError) {
          console.error('[App] Ошибка при остановке старого сервера:', stopError);
        }
        setWebsocketServer(null);
      }

      const server = new WebSocketServer();
      const ipAddress = await server.start(
        (socketId) => {
          console.log(`[App] Контроллер подключен к табло: ${socketId}`);
          console.log(`[App] Всего подключенных контроллеров: ${server.getClientCount()}`);
        },
        (socketId, message) => {
          console.log(`[App] Сообщение от контроллера ${socketId}:`, message);
          // Сообщения обрабатываются в ScoreboardContext
        },
        (socketId) => {
          console.log(`[App] Контроллер отключен от табло: ${socketId}`);
          console.log(`[App] Всего подключенных контроллеров: ${server.getClientCount()}`);
        }
      );
      console.log(`[App] WebSocket сервер запущен на ${ipAddress}:${getDefaultWebSocketPort()}`);
      setWebsocketServer(server);

      // Запускаем ответы на discovery запросы от контроллеров
      if (ipAddress) {
        discoveryService.startResponding(ipAddress, getDefaultWebSocketPort());
        console.log(`[App] Discovery ответы запущены для табло`);
      }

      // Дополнительная задержка, чтобы сервер точно был готов принимать подключения
      await new Promise(resolve => setTimeout(resolve, 500));

      return true;
    } catch (error) {
      console.error('[App] Ошибка при запуске WebSocket сервера:', error);
      const errorMessage = error.message || error.toString();

      // Если порт занят, пытаемся остановить старый сервер и повторить попытку
      if (errorMessage.includes('EADDRINUSE') || errorMessage.includes('address already in use') || errorMessage.includes('port') && errorMessage.includes('already')) {
        console.log('[App] Порт занят, пытаемся освободить его и повторить запуск');
        try {
          // Ждем немного и пытаемся снова
          await new Promise(resolve => setTimeout(resolve, 1000));
          const server = new WebSocketServer();
          const ipAddress = await server.start(
            (socketId) => {
              console.log(`[App] Контроллер подключен к табло: ${socketId}`);
              console.log(`[App] Всего подключенных контроллеров: ${server.getClientCount()}`);
            },
            (socketId, message) => {
              console.log(`[App] Сообщение от контроллера ${socketId}:`, message);
            },
            (socketId) => {
              console.log(`[App] Контроллер отключен от табло: ${socketId}`);
              console.log(`[App] Всего подключенных контроллеров: ${server.getClientCount()}`);
            }
          );
          console.log(`[App] WebSocket сервер запущен на ${ipAddress}:${getDefaultWebSocketPort()}`);
          setWebsocketServer(server);
          if (ipAddress) {
            discoveryService.startResponding(ipAddress, getDefaultWebSocketPort());
          }
          return true;
        } catch (retryError) {
          console.error('[App] Ошибка при повторной попытке запуска сервера:', retryError);
        }
      }

      // Не показываем ошибку, просто логируем - приложение должно работать
      return false;
    }
  };

  const handleModeSelected = async (selectedMode) => {
    try {
      setError(null);
      setMode(selectedMode);

      if (selectedMode === APP_MODES.CONTROLLER) {
        // Контроллер ищет табло и подключается к нему
        // Показываем экран поиска табло
        setShowConnectionSetup(true);
      } else if (selectedMode === APP_MODES.DISPLAY) {
        // Табло запускает WebSocket сервер
        await startDisplayServer();
      }
    } catch (error) {
      console.error('[App] Ошибка при выборе режима:', error);
      // Не устанавливаем ошибку, чтобы приложение не закрывалось
      console.error('[App] Продолжаем работу несмотря на ошибку');
    }
  };

  const handleConnectToDisplay = async (displayIP) => {
    try {
      const port = getDefaultWebSocketPort();
      // Получаем локальный IP адрес для принудительного использования IPv4
      const localIP = await getLocalIPAddress();
      console.log(`[App] Получен локальный IP адрес: ${localIP || 'null'}`);

      if (!localIP) {
        console.warn(`[App] ВНИМАНИЕ: Не удалось получить локальный IP адрес! Подключение может использовать IPv6`);
      }

      const client = new WebSocketClient(displayIP, port, localIP || null);
      setWebsocketClient(client);
      setShowConnectionSetup(false);

      console.log(`[App] WebSocket клиент создан для подключения к табло ${displayIP}:${port}`);
      if (localIP) {
        console.log(`[App] Используется localAddress ${localIP} для принудительного IPv4`);
      } else {
        console.warn(`[App] localAddress не установлен - возможно использование IPv6!`);
      }
      console.log(`[App] Подключение будет выполнено в ScoreboardContext`);
    } catch (error) {
      console.error('[App] Ошибка при создании WebSocket клиента:', error);
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
      <ConnectionSetupScreen
        onConnect={handleConnectToDisplay}
        onCancel={handleCancelConnection}
        discoveryService={discoveryService}
        isController={true}
      />
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
        {isController ? (
          <ControllerScreen onModeChange={() => setMode(null)} />
        ) : (
          <DisplayScreen onModeChange={() => setMode(null)} />
        )}
      </SafeAreaView>
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
