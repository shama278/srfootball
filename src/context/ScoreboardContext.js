import React, {createContext, useContext, useState, useEffect, useCallback, useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Начальное состояние табло
 */
const initialState = {
  team1: {
    name: 'Команда 1',
    score: 0,
    logo: null,
  },
  team2: {
    name: 'Команда 2',
    score: 0,
    logo: null,
  },
  timer: {
    minutes: 0,
    seconds: 0,
    isRunning: false,
  },
  period: 1,
  settings: {
    primaryColor: '#1a1a1a',
    secondaryColor: '#ffffff',
    accentColor: '#ff6b6b',
    fontSize: 16,
    showLogos: true,
  },
};

const ScoreboardContext = createContext(null);

/**
 * Провайдер контекста табло
 */
export const ScoreboardProvider = ({children, websocketClient = null, websocketServer = null, isController = false}) => {
  const [state, setState] = useState(initialState);
  const [isConnected, setIsConnected] = useState(false);
  const stateRef = useRef(state);
  const websocketClientRef = useRef(websocketClient);
  const websocketServerRef = useRef(websocketServer);

  // Обновляем ref при изменении состояния
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Обновляем ref при изменении WebSocket клиента
  useEffect(() => {
    websocketClientRef.current = websocketClient;
  }, [websocketClient]);

  // Обновляем ref при изменении WebSocket сервера и статус подключения
  useEffect(() => {
    websocketServerRef.current = websocketServer;
    // Обновляем статус подключения для табло на основе количества подключенных контроллеров
    if (!isController && websocketServer) {
      const updateConnectionStatus = () => {
        if (websocketServer) {
          const clientCount = websocketServer.getClientCount();
          const isNowConnected = clientCount > 0;
          setIsConnected(isNowConnected);
          console.log(`[ScoreboardContext] Статус подключения обновлен: ${isNowConnected ? 'подключено' : 'не подключено'} (клиентов: ${clientCount})`);
        } else {
          setIsConnected(false);
        }
      };

      // Сохраняем оригинальные колбэки
      const originalOnConnection = websocketServer.onConnectionCallback;
      const originalOnDisconnect = websocketServer.onDisconnectCallback;

      // Обновляем колбэки, чтобы сразу обновлять статус при подключении/отключении
      websocketServer.onConnectionCallback = (socketId) => {
        if (originalOnConnection) {
          try {
            originalOnConnection(socketId);
          } catch (error) {
            console.error('[ScoreboardContext] Ошибка в оригинальном onConnectionCallback:', error);
          }
        }
        // Немедленно обновляем статус
        updateConnectionStatus();
      };

      websocketServer.onDisconnectCallback = (socketId) => {
        if (originalOnDisconnect) {
          try {
            originalOnDisconnect(socketId);
          } catch (error) {
            console.error('[ScoreboardContext] Ошибка в оригинальном onDisconnectCallback:', error);
          }
        }
        // Немедленно обновляем статус
        updateConnectionStatus();
      };

      // Проверяем статус сразу
      updateConnectionStatus();

      // Также проверяем статус периодически (каждую секунду) для надежности
      const interval = setInterval(updateConnectionStatus, 1000);

      return () => {
        clearInterval(interval);
        // Восстанавливаем оригинальные колбэки при размонтировании (если нужно)
      };
    } else if (!isController && !websocketServer) {
      // Если сервер не существует, точно не подключено
      setIsConnected(false);
    }
  }, [websocketServer, isController]);


  /**
   * Загружает состояние из локального хранилища
   */
  const loadState = useCallback(async () => {
    try {
      const savedState = await AsyncStorage.getItem('scoreboardState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        setState((prev) => ({...prev, ...parsed}));
        return parsed;
      }
    } catch (error) {
      console.error('Ошибка при загрузке состояния:', error);
    }
    return null;
  }, []);

  /**
   * Сохраняет состояние в локальное хранилище
   */
  const saveState = useCallback(async (newState) => {
    try {
      await AsyncStorage.setItem('scoreboardState', JSON.stringify(newState));
    } catch (error) {
      console.error('Ошибка при сохранении состояния:', error);
    }
  }, []);

  /**
   * Отправляет обновление состояния через WebSocket (контроллер отправляет на табло)
   */
  const broadcastUpdate = useCallback((update) => {
    if (isController && websocketClientRef.current) {
      // Проверяем, что подключение установлено перед отправкой
      if (websocketClientRef.current.getIsConnected && websocketClientRef.current.getIsConnected()) {
        try {
          websocketClientRef.current.send({
            type: 'scoreboard_update',
            data: update,
          });
        } catch (error) {
          console.error('Ошибка при отправке обновления:', error);
        }
      } else {
        // Подключение еще не установлено, просто логируем (не ошибка)
        console.log('[ScoreboardContext] Пропущена отправка обновления - подключение еще не установлено');
      }
    }
  }, [isController]);

  /**
   * Обновляет состояние и синхронизирует
   */
  const updateState = useCallback((updates, shouldBroadcast = true) => {
    setState((prev) => {
      const newState = {...prev, ...updates};

      // Сохраняем в локальное хранилище
      if (isController) {
        saveState(newState);
      }

      // Отправляем обновление через WebSocket
      if (shouldBroadcast && isController) {
        broadcastUpdate(updates);
      }

      return newState;
    });
  }, [isController, saveState, broadcastUpdate]);

  /**
   * Обновляет счет команды 1
   */
  const updateTeam1Score = useCallback((delta) => {
    setState((prev) => {
      const newScore = Math.max(0, prev.team1.score + delta);
      const updates = {
        team1: {
          ...prev.team1,
          score: newScore,
        },
      };
      const newState = {...prev, ...updates};

      if (isController) {
        saveState(newState);
        broadcastUpdate(updates);
      }

      return newState;
    });
  }, [isController, saveState, broadcastUpdate]);

  /**
   * Обновляет счет команды 2
   */
  const updateTeam2Score = useCallback((delta) => {
    setState((prev) => {
      const newScore = Math.max(0, prev.team2.score + delta);
      const updates = {
        team2: {
          ...prev.team2,
          score: newScore,
        },
      };
      const newState = {...prev, ...updates};

      if (isController) {
        saveState(newState);
        broadcastUpdate(updates);
      }

      return newState;
    });
  }, [isController, saveState, broadcastUpdate]);

  /**
   * Устанавливает счет команды 1
   */
  const setTeam1Score = useCallback((score) => {
    const updates = {
      team1: {
        ...stateRef.current.team1,
        score: Math.max(0, score),
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Устанавливает счет команды 2
   */
  const setTeam2Score = useCallback((score) => {
    const updates = {
      team2: {
        ...stateRef.current.team2,
        score: Math.max(0, score),
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Обновляет название команды 1
   */
  const updateTeam1Name = useCallback((name) => {
    const updates = {
      team1: {
        ...stateRef.current.team1,
        name,
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Обновляет название команды 2
   */
  const updateTeam2Name = useCallback((name) => {
    const updates = {
      team2: {
        ...stateRef.current.team2,
        name,
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Обновляет логотип команды 1
   */
  const updateTeam1Logo = useCallback((logo) => {
    const updates = {
      team1: {
        ...stateRef.current.team1,
        logo,
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Обновляет логотип команды 2
   */
  const updateTeam2Logo = useCallback((logo) => {
    const updates = {
      team2: {
        ...stateRef.current.team2,
        logo,
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Обновляет таймер
   */
  const updateTimer = useCallback((timerUpdates) => {
    setState((prev) => {
      const updates = {
        timer: {
          ...prev.timer,
          ...timerUpdates,
        },
      };
      const newState = {...prev, ...updates};

      if (isController) {
        saveState(newState);
        broadcastUpdate(updates);
      }

      return newState;
    });
  }, [isController, saveState, broadcastUpdate]);

  /**
   * Устанавливает время таймера
   */
  const setTimer = useCallback((minutes, seconds) => {
    const updates = {
      timer: {
        ...stateRef.current.timer,
        minutes: Math.max(0, minutes),
        seconds: Math.max(0, Math.min(59, seconds)),
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Запускает таймер
   */
  const startTimer = useCallback(() => {
    updateTimer({isRunning: true});
  }, [updateTimer]);

  /**
   * Останавливает таймер
   */
  const stopTimer = useCallback(() => {
    updateTimer({isRunning: false});
  }, [updateTimer]);

  /**
   * Сбрасывает таймер
   */
  const resetTimer = useCallback(() => {
    updateTimer({
      minutes: 0,
      seconds: 0,
      isRunning: false,
    });
  }, [updateTimer]);

  /**
   * Обновляет период
   */
  const updatePeriod = useCallback((period) => {
    updateState({period});
  }, [updateState]);

  /**
   * Обновляет настройки
   */
  const updateSettings = useCallback((settings) => {
    const updates = {
      settings: {
        ...stateRef.current.settings,
        ...settings,
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Сбрасывает состояние табло
   */
  const resetScoreboard = useCallback(() => {
    const resetState = {
      ...initialState,
      team1: {
        ...initialState.team1,
        name: stateRef.current.team1.name,
        logo: stateRef.current.team1.logo,
      },
      team2: {
        ...initialState.team2,
        name: stateRef.current.team2.name,
        logo: stateRef.current.team2.logo,
      },
      settings: stateRef.current.settings,
    };

    setState(resetState);

    if (isController) {
      saveState(resetState);
      broadcastUpdate(resetState);
    }
  }, [isController, saveState, broadcastUpdate]);

  /**
   * Обрабатывает сообщения от WebSocket сервера (для табло)
   */
  useEffect(() => {
    if (!isController && websocketServer) {
      try {
        // Сохраняем оригинальный обработчик
        const originalOnMessage = websocketServer.onMessageCallback;

        // Устанавливаем новый обработчик, который обновляет состояние
        websocketServer.onMessageCallback = (socketId, message) => {
          try {
            // Вызываем оригинальный обработчик
            if (originalOnMessage) {
              try {
                originalOnMessage(socketId, message);
              } catch (originalError) {
                console.error('[ScoreboardContext] Ошибка в оригинальном обработчике сообщений:', originalError);
              }
            }

            // Обрабатываем обновления состояния от контроллера
            if (message && typeof message === 'object' && message.type === 'scoreboard_update' && message.data) {
              try {
                setState((prev) => {
                  try {
                    // Проверяем, что данные валидны перед обновлением состояния
                    if (message.data && typeof message.data === 'object') {
                      const newState = {...prev, ...message.data};
                      return newState;
                    }
                    return prev;
                  } catch (stateError) {
                    console.error('[ScoreboardContext] Ошибка при обновлении состояния:', stateError);
                    return prev;
                  }
                });
              } catch (setStateError) {
                console.error('[ScoreboardContext] Ошибка при вызове setState:', setStateError);
              }
            }
          } catch (error) {
            console.error('[ScoreboardContext] Ошибка при обработке сообщения:', error);
            // Не пробрасываем ошибку дальше, чтобы не крашить приложение
          }
        };
      } catch (error) {
        console.error('[ScoreboardContext] Ошибка при установке обработчика сообщений:', error);
      }
    }
  }, [websocketServer, isController]);

  /**
   * Инициализация WebSocket клиента (для контроллера - подключение к табло)
   */
  useEffect(() => {
    if (isController && websocketClientRef.current) {
      // Проверяем, не подключены ли уже
      if (websocketClientRef.current.getIsConnected()) {
        console.log('[ScoreboardContext] Уже подключен, пропускаем повторное подключение');
        return;
      }

      // Задержка не требуется для обычного режима
      const connectDelay = 0;

      const connectTimeout = setTimeout(() => {
        // Проверяем еще раз перед подключением
        if (!websocketClientRef.current || websocketClientRef.current.getIsConnected()) {
          console.log('[ScoreboardContext] Клиент уже подключен или не существует, пропускаем');
          return;
        }

        const handleOpen = () => {
          console.log('[ScoreboardContext] Контроллер подключен к табло');
          setIsConnected(true);
        };

        const handleMessage = (message) => {
          // Контроллер может получать сообщения от табло (если нужно)
          console.log('[ScoreboardContext] Сообщение от табло:', message);
        };

        const handleError = (error) => {
          console.error('[ScoreboardContext] Ошибка WebSocket:', error);
          setIsConnected(false);

        };

        const handleClose = () => {
          console.log('[ScoreboardContext] Отключен от табло');
          setIsConnected(false);
        };

        // Подключаем обработчики
        if (websocketClientRef.current && !websocketClientRef.current.getIsConnected()) {
          console.log('[ScoreboardContext] Начинаем подключение к табло...');
          websocketClientRef.current.connect(handleOpen, handleMessage, handleError, handleClose).catch((error) => {
            console.error('[ScoreboardContext] Ошибка при подключении к табло:', error);
          });
        } else {
          console.log('[ScoreboardContext] Клиент уже подключен, пропускаем');
        }
      }, connectDelay);

      return () => {
        clearTimeout(connectTimeout);
        // Не отключаем клиент при размонтировании, так как он может использоваться повторно
        // if (websocketClientRef.current) {
        //   websocketClientRef.current.disconnect();
        // }
      };
    }
  }, [isController, websocketClient]);

  /**
   * Загрузка состояния при монтировании (для контроллера)
   */
  useEffect(() => {
    if (isController) {
      loadState();
    }
  }, [isController, loadState]);

  /**
   * Автоматическое обновление таймера
   */
  useEffect(() => {
    if (!state.timer.isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setState((prev) => {
        if (!prev.timer.isRunning) {
          return prev;
        }

        let {minutes, seconds} = prev.timer;

        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else {
          // Таймер достиг нуля
          return {
            ...prev,
            timer: {
              ...prev.timer,
              isRunning: false,
            },
          };
        }

        const updates = {
          timer: {
            ...prev.timer,
            minutes,
            seconds,
          },
        };

        const newState = {...prev, ...updates};

        if (isController) {
          saveState(newState);
          broadcastUpdate(updates);
        }

        return newState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.timer.isRunning, isController]);

  const value = {
    // Состояние
    state,
    isConnected,

    // Методы обновления счета
    updateTeam1Score,
    updateTeam2Score,
    setTeam1Score,
    setTeam2Score,

    // Методы обновления команд
    updateTeam1Name,
    updateTeam2Name,
    updateTeam1Logo,
    updateTeam2Logo,

    // Методы работы с таймером
    updateTimer,
    setTimer,
    startTimer,
    stopTimer,
    resetTimer,

    // Методы работы с периодом
    updatePeriod,

    // Методы работы с настройками
    updateSettings,

    // Общие методы
    updateState,
    resetScoreboard,
    loadState,
    saveState,
  };

  return (
    <ScoreboardContext.Provider value={value}>
      {children}
    </ScoreboardContext.Provider>
  );
};

/**
 * Хук для использования контекста табло
 */
export const useScoreboard = () => {
  const context = useContext(ScoreboardContext);
  if (!context) {
    throw new Error('useScoreboard должен использоваться внутри ScoreboardProvider');
  }
  return context;
};

export default ScoreboardContext;
