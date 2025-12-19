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
import ErrorBoundary from './components/ErrorBoundary';

// Глобальная обработка необработанных ошибок
if (typeof ErrorUtils !== 'undefined') {
  const originalGlobalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Игнорируем ошибки, связанные с закрытыми сокетами - это нормально
    const errorMessage = error?.message || error?.toString() || '';
    if (errorMessage.includes('Socket is closed') || errorMessage.includes('setBroadcast')) {
      // Это нормальная ошибка при закрытии сокетов, не логируем как критичную
      return;
    }

    // Логируем только критичные ошибки
    if (isFatal || error) {
      console.error('[App] Глобальная ошибка:', error?.message || error);
      if (error?.stack) {
        console.error('[App] Stack:', error.stack);
      }
    }

    // Вызываем оригинальный обработчик, но не крашим приложение
    if (originalGlobalHandler) {
      try {
        originalGlobalHandler(error, isFatal);
      } catch (handlerError) {
        console.error('[App] Ошибка в обработчике:', handlerError);
      }
    }
  });
}


// Обработка необработанных промисов
if (typeof global !== 'undefined' && global.Promise) {
  const originalUnhandledRejection = global.onunhandledrejection;
  global.onunhandledrejection = (event) => {
    // Логируем только критичные отклонения
    if (event?.reason) {
      console.error('[App] Необработанное отклонение промиса:', event.reason);
    }

    // Предотвращаем краш приложения
    event.preventDefault();

    if (originalUnhandledRejection) {
      try {
        originalUnhandledRejection(event);
      } catch (handlerError) {
        console.error('[App] Ошибка в обработчике:', handlerError);
      }
    }
  };
}

// Защита от hot reload - сохраняем состояние при перезагрузке
let appStateRef = null;
if (typeof global !== 'undefined') {
  if (!global.__APP_STATE_REF__) {
    global.__APP_STATE_REF__ = {
      mode: null,
      websocketServer: null,
      websocketClient: null,
      showConnectionSetup: false,
      error: null,
    };
  }
  appStateRef = global.__APP_STATE_REF__;
}

const App = () => {
  // Защита от ошибок инициализации при hot reload
  let modeState, websocketServerState, websocketClientState, showConnectionSetupState, errorState;
  let discoveryServiceInstance;

  try {
    // Используем ref для сохранения состояния при hot reload
    modeState = appStateRef?.mode ?? null;
    websocketServerState = appStateRef?.websocketServer ?? null;
    websocketClientState = appStateRef?.websocketClient ?? null;
    showConnectionSetupState = appStateRef?.showConnectionSetup ?? false;
    errorState = appStateRef?.error ?? null;
  } catch (error) {
    console.error('[App] Ошибка при чтении сохраненного состояния:', error);
    modeState = null;
    websocketServerState = null;
    websocketClientState = null;
    showConnectionSetupState = false;
    errorState = null;
  }

  const [mode, setMode] = useState(modeState);
  const [websocketServer, setWebsocketServer] = useState(websocketServerState);
  const [websocketClient, setWebsocketClient] = useState(websocketClientState);
  const [showConnectionSetup, setShowConnectionSetup] = useState(showConnectionSetupState);
  const [error, setError] = useState(errorState);

  const [discoveryService] = useState(() => {
    try {
      // Пытаемся переиспользовать существующий сервис при hot reload
      if (global.__DISCOVERY_SERVICE__) {
        return global.__DISCOVERY_SERVICE__;
      }
      const service = new DiscoveryService();
      global.__DISCOVERY_SERVICE__ = service;
      return service;
    } catch (error) {
      console.error('[App] Ошибка создания DiscoveryService:', error);
      try {
        return new DiscoveryService();
      } catch (fallbackError) {
        console.error('[App] Критическая ошибка создания DiscoveryService:', fallbackError);
        return null;
      }
    }
  });

  // Сохраняем состояние в глобальный ref при изменении (для hot reload)
  useEffect(() => {
    try {
      if (appStateRef) {
        appStateRef.mode = mode;
        appStateRef.websocketServer = websocketServer;
        appStateRef.websocketClient = websocketClient;
        appStateRef.showConnectionSetup = showConnectionSetup;
        appStateRef.error = error;
      }
    } catch (error) {
      console.error('[App] Ошибка при сохранении состояния в ref:', error);
    }
  }, [mode, websocketServer, websocketClient, showConnectionSetup, error]);


  useEffect(() => {
    // Очистка при размонтировании
    return () => {
      // НЕ очищаем ресурсы при hot reload, только при реальном размонтировании
      // Проверяем, это hot reload или реальное размонтирование
      const isHotReload = typeof global !== 'undefined' && global.__APP_STATE_REF__;

      if (!isHotReload) {
        // Только при реальном размонтировании очищаем ресурсы
        // Вызываем async функции без await, так как cleanup не может быть async
        if (websocketServer) {
          websocketServer.stop().catch((error) => {
            console.error('[App] Ошибка при остановке WebSocket сервера:', error);
          });
        }
        if (websocketClient) {
          try {
            websocketClient.disconnect();
          } catch (error) {
            console.error('[App] Ошибка при отключении WebSocket клиента:', error);
          }
        }
        if (discoveryService) {
          try {
            discoveryService.stop();
          } catch (error) {
            console.error('[App] Ошибка при остановке DiscoveryService:', error);
          }
        }
      }
    };
  }, [websocketServer, websocketClient, discoveryService]);

  const startDisplayServer = async () => {
    try {
      // Сначала останавливаем старый сервер, если он есть
      if (websocketServer) {
        try {
          await websocketServer.stop();
          // Даем время на полную остановку
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (stopError) {
        }
        setWebsocketServer(null);
      }

      const server = new WebSocketServer();
      const ipAddress = await server.start(
        (socketId) => {
          try {
            // Вызываем асинхронно, чтобы не блокировать поток и не вызывать ошибки во время рендеринга
            setTimeout(() => {
              try {
                try {
                  const count = server.getClientCount();
                } catch (countError) {
                }
              } catch (error) {
                // Не пробрасываем ошибку дальше
              }
            }, 0);
          } catch (error) {
            // Не пробрасываем ошибку дальше
          }
        },
        (socketId, message) => {
          try {
            // Вызываем асинхронно
            setTimeout(() => {
              try {
                // Сообщения обрабатываются в ScoreboardContext
              } catch (error) {
                // Не пробрасываем ошибку дальше
              }
            }, 0);
          } catch (error) {
            // Не пробрасываем ошибку дальше
          }
        },
        (socketId) => {
          try {
            // Вызываем асинхронно
            setTimeout(() => {
              try {
                try {
                  const count = server.getClientCount();
                } catch (countError) {
                }
              } catch (error) {
                // Не пробрасываем ошибку дальше
              }
            }, 0);
          } catch (error) {
            // Не пробрасываем ошибку дальше
          }
        }
      );
      setWebsocketServer(server);

      // Запускаем ответы на discovery запросы от контроллеров
      if (ipAddress && discoveryService) {
        try {
          discoveryService.startResponding(ipAddress, getDefaultWebSocketPort());
        } catch (error) {
          console.error('[App] Ошибка при запуске discovery ответов:', error);
        }
      }

      // Дополнительная задержка, чтобы сервер точно был готов принимать подключения
      await new Promise(resolve => setTimeout(resolve, 500));

      return true;
    } catch (error) {
      const errorMessage = error.message || error.toString();

      // Если порт занят, пытаемся остановить старый сервер и повторить попытку
      if (errorMessage.includes('EADDRINUSE') || errorMessage.includes('address already in use') || errorMessage.includes('port') && errorMessage.includes('already')) {
        try {
          // Ждем немного и пытаемся снова
          await new Promise(resolve => setTimeout(resolve, 1000));
          const server = new WebSocketServer();
          const ipAddress = await server.start(
            (socketId) => {
              try {
              } catch (error) {
              }
            },
            (socketId, message) => {
              try {
              } catch (error) {
              }
            },
            (socketId) => {
              try {
              } catch (error) {
              }
            }
          );
          setWebsocketServer(server);
          if (ipAddress && discoveryService) {
            try {
              discoveryService.startResponding(ipAddress, getDefaultWebSocketPort());
            } catch (error) {
              console.error('[App] Ошибка при запуске discovery ответов (retry):', error);
            }
          }
          return true;
        } catch (retryError) {
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
    }
  };

  const handleConnectToDisplay = async (displayIP) => {
    try {
      // Отключаем старый клиент перед созданием нового
      if (websocketClient) {
        try {
          websocketClient.disconnect();
        } catch (disconnectError) {
        }
        // Даем время на полное закрытие соединения
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const port = getDefaultWebSocketPort();
      // Получаем локальный IP адрес для принудительного использования IPv4
      const localIP = await getLocalIPAddress();

      const client = new WebSocketClient(displayIP, port, localIP || null);
      setWebsocketClient(client);
      setShowConnectionSetup(false);
    } catch (error) {
    }
  };

  const handleCancelConnection = () => {
    setShowConnectionSetup(false);
    setMode(null);
  };

  if (!mode) {
    return (
      <ErrorBoundary>
        <ModeSelectorScreen onModeSelected={handleModeSelected} />
      </ErrorBoundary>
    );
  }

  if (showConnectionSetup && mode === APP_MODES.CONTROLLER) {
    return (
      <ErrorBoundary>
        <ConnectionSetupScreen
          onConnect={handleConnectToDisplay}
          onCancel={handleCancelConnection}
          discoveryService={discoveryService}
          isController={true}
        />
      </ErrorBoundary>
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

  try {
    // Дополнительная защита от ошибок при hot reload
    if (typeof mode === 'undefined' || (mode === null && showConnectionSetup)) {
      // Не делаем setState в рендере, просто возвращаем безопасный UI
      return (
        <ErrorBoundary>
          <SafeAreaView style={styles.container}>
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Перезагрузка приложения...</Text>
            </View>
          </SafeAreaView>
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        <ScoreboardProvider
          websocketClient={websocketClient}
          websocketServer={websocketServer}
          isController={isController}>
          <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isController ? 'dark-content' : 'light-content'} />
            {isController ? (
              <ControllerScreen onModeChange={async () => {
                try {
                  // Явно отключаемся от WebSocket соединения перед переключением режима
                  if (websocketClient) {
                    try {
                      // Отключаемся без автоматического переподключения
                      websocketClient.disconnect();
                      // Даем время на полное закрытие соединения
                      await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (disconnectError) {
                      console.error('[App] Ошибка при отключении WebSocket клиента:', disconnectError);
                    }
                    setWebsocketClient(null);
                  }

                  // Останавливаем discovery broadcast (только для контроллера, не влияет на табло)
                  if (discoveryService && isController) {
                    try {
                      discoveryService.stopBroadcast();
                    } catch (stopError) {
                      console.error('[App] Ошибка при остановке discovery broadcast:', stopError);
                    }
                  }

                  // Небольшая задержка перед переключением режима для полной очистки
                  await new Promise(resolve => setTimeout(resolve, 200));
                  setMode(null);
                } catch (error) {
                  console.error('[App] Ошибка при изменении режима:', error);
                }
              }} />
            ) : (
              <DisplayScreen onModeChange={async () => {
                try {
                  // Явно останавливаем WebSocket сервер перед переключением режима
                  if (websocketServer) {
                    try {
                      // Останавливаем сервер и закрываем все соединения
                      await websocketServer.stop();
                      // Даем время на полную остановку сервера и закрытие всех соединений
                      await new Promise(resolve => setTimeout(resolve, 800));
                    } catch (stopError) {
                      console.error('[App] Ошибка при остановке WebSocket сервера:', stopError);
                    }
                    setWebsocketServer(null);
                  }

                  // Останавливаем discovery ответы (только для табло, не влияет на контроллер)
                  if (discoveryService && !isController) {
                    try {
                      discoveryService.stopResponding();
                    } catch (stopError) {
                      console.error('[App] Ошибка при остановке discovery ответов:', stopError);
                    }
                  }

                  // Небольшая задержка перед переключением режима для полной очистки
                  await new Promise(resolve => setTimeout(resolve, 200));
                  setMode(null);
                } catch (error) {
                  console.error('[App] Ошибка при изменении режима:', error);
                }
              }} />
            )}
          </SafeAreaView>
        </ScoreboardProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[App] Критическая ошибка в рендере:', error);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Критическая ошибка приложения</Text>
          <Text style={styles.errorDetails}>{error.toString()}</Text>
          {error.stack && (
            <Text style={[styles.errorDetails, {fontSize: 10, maxHeight: 200}]} numberOfLines={20}>
              {error.stack}
            </Text>
          )}
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => {
              try {
                setMode(null);
                setError(null);
              } catch (resetError) {
              }
            }}>
            <Text style={styles.errorButtonText}>Перезапустить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
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
    fontWeight: 'bold',
  },
  errorDetails: {
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'monospace',
    maxHeight: 200,
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
