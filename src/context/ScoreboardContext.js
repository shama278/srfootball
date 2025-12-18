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
        try {
          if (websocketServer) {
            try {
              const clientCount = websocketServer.getClientCount();
              const isNowConnected = clientCount > 0;
              setIsConnected(isNowConnected);
              console.log(`[ScoreboardContext] Статус подключения обновлен: ${isNowConnected ? 'подключено' : 'не подключено'} (клиентов: ${clientCount})`);
            } catch (getCountError) {
              console.error('[ScoreboardContext] Ошибка при получении количества клиентов:', getCountError);
              setIsConnected(false);
            }
          } else {
            setIsConnected(false);
          }
        } catch (error) {
          console.error('[ScoreboardContext] Ошибка в updateConnectionStatus:', error);
          // Устанавливаем статус отключено при ошибке
          try {
            setIsConnected(false);
          } catch (setError) {
            console.error('[ScoreboardContext] Критическая ошибка при установке статуса:', setError);
          }
        }
      };

      // Сохраняем оригинальные колбэки
      const originalOnConnection = websocketServer.onConnectionCallback;
      const originalOnDisconnect = websocketServer.onDisconnectCallback;

      // Обновляем колбэки, чтобы сразу обновлять статус при подключении/отключении
      websocketServer.onConnectionCallback = (socketId) => {
        try {
          if (originalOnConnection) {
            try {
              originalOnConnection(socketId);
            } catch (error) {
              console.error('[ScoreboardContext] Ошибка в оригинальном onConnectionCallback:', error);
            }
          }
          // Обновляем статус асинхронно, чтобы не блокировать поток
          setTimeout(() => {
            try {
              updateConnectionStatus();
            } catch (statusError) {
              console.error('[ScoreboardContext] Ошибка при обновлении статуса подключения:', statusError);
            }
          }, 0);
        } catch (error) {
          console.error('[ScoreboardContext] Критическая ошибка в onConnectionCallback:', error);
          // Не пробрасываем ошибку дальше
        }
      };

      websocketServer.onDisconnectCallback = (socketId) => {
        try {
          if (originalOnDisconnect) {
            try {
              originalOnDisconnect(socketId);
            } catch (error) {
              console.error('[ScoreboardContext] Ошибка в оригинальном onDisconnectCallback:', error);
            }
          }
          // Обновляем статус асинхронно, чтобы не блокировать поток
          setTimeout(() => {
            try {
              updateConnectionStatus();
            } catch (statusError) {
              console.error('[ScoreboardContext] Ошибка при обновлении статуса отключения:', statusError);
            }
          }, 0);
        } catch (error) {
          console.error('[ScoreboardContext] Критическая ошибка в onDisconnectCallback:', error);
          // Не пробрасываем ошибку дальше
        }
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
                // Используем setTimeout для асинхронного обновления состояния, чтобы не блокировать поток
                setTimeout(() => {
                  try {
                    setState((prev) => {
                      try {
                        // Проверяем, что данные валидны перед обновлением состояния
                        if (!message || !message.data || typeof message.data !== 'object') {
                          console.warn('[ScoreboardContext] Некорректные данные сообщения, используем предыдущее состояние');
                          return prev || initialState;
                        }

                        // Безопасное объединение состояния с проверкой каждого поля
                        const safePrev = prev || initialState;
                        const safeData = message.data || {};

                        const newState = {
                          ...safePrev,
                          team1: {
                            ...(initialState.team1 || {}),
                            ...(safePrev.team1 || {}),
                            ...(safeData.team1 && typeof safeData.team1 === 'object' ? safeData.team1 : {}),
                          },
                          team2: {
                            ...(initialState.team2 || {}),
                            ...(safePrev.team2 || {}),
                            ...(safeData.team2 && typeof safeData.team2 === 'object' ? safeData.team2 : {}),
                          },
                          timer: {
                            ...(initialState.timer || {}),
                            ...(safePrev.timer || {}),
                            ...(safeData.timer && typeof safeData.timer === 'object' ? safeData.timer : {}),
                          },
                          period: safeData.period !== undefined && typeof safeData.period === 'number' && safeData.period >= 1
                            ? safeData.period
                            : (safePrev.period || initialState.period || 1),
                          settings: {
                            ...(initialState.settings || {}),
                            ...(safePrev.settings || {}),
                            ...(safeData.settings && typeof safeData.settings === 'object' ? safeData.settings : {}),
                          },
                        };
                        return newState;
                      } catch (stateError) {
                        console.error('[ScoreboardContext] Ошибка при обновлении состояния:', stateError);
                        console.error('[ScoreboardContext] Stack trace:', stateError.stack);
                        return prev || initialState;
                      }
                    });
                  } catch (setStateError) {
                    console.error('[ScoreboardContext] КРИТИЧЕСКАЯ ОШИБКА при вызове setState:', setStateError);
                    console.error('[ScoreboardContext] Stack trace:', setStateError.stack);
                    // Не пробрасываем ошибку дальше, приложение должно продолжать работать
                  }
                }, 0);
              } catch (error) {
                console.error('[ScoreboardContext] КРИТИЧЕСКАЯ ОШИБКА при планировании обновления состояния:', error);
                console.error('[ScoreboardContext] Stack trace:', error.stack);
                // Не пробрасываем ошибку дальше
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

      // Задержка для обеспечения полной очистки предыдущего соединения
      const connectDelay = 100;

      const connectTimeout = setTimeout(() => {
        try {
          // Проверяем еще раз перед подключением
          if (!websocketClientRef.current) {
            console.log('[ScoreboardContext] Клиент не существует, пропускаем');
            return;
          }

          if (websocketClientRef.current.getIsConnected()) {
            console.log('[ScoreboardContext] Клиент уже подключен, пропускаем');
            return;
          }

          const handleOpen = () => {
            try {
              console.log('[ScoreboardContext] Контроллер подключен к табло');
              setIsConnected(true);
            } catch (error) {
              console.error('[ScoreboardContext] Ошибка в handleOpen:', error);
            }
          };

          const handleMessage = (message) => {
            try {
              // Контроллер может получать сообщения от табло (если нужно)
              console.log('[ScoreboardContext] Сообщение от табло:', message);
            } catch (error) {
              console.error('[ScoreboardContext] Ошибка в handleMessage:', error);
            }
          };

          const handleError = (error) => {
            try {
              console.error('[ScoreboardContext] Ошибка WebSocket:', error);
              setIsConnected(false);
            } catch (errorHandlerError) {
              console.error('[ScoreboardContext] Ошибка в handleError:', errorHandlerError);
            }
          };

          const handleClose = () => {
            try {
              console.log('[ScoreboardContext] Отключен от табло');
              setIsConnected(false);
            } catch (error) {
              console.error('[ScoreboardContext] Ошибка в handleClose:', error);
            }
          };

          // Подключаем обработчики
          if (websocketClientRef.current && !websocketClientRef.current.getIsConnected()) {
            console.log('[ScoreboardContext] Начинаем подключение к табло...');
            websocketClientRef.current.connect(handleOpen, handleMessage, handleError, handleClose).catch((error) => {
              console.error('[ScoreboardContext] Ошибка при подключении к табло:', error);
              setIsConnected(false);
              // Не пробрасываем ошибку дальше, чтобы не крашить приложение
            });
          } else {
            console.log('[ScoreboardContext] Клиент уже подключен, пропускаем');
          }
        } catch (error) {
          console.error('[ScoreboardContext] Критическая ошибка при инициализации подключения:', error);
          setIsConnected(false);
          // Не пробрасываем ошибку дальше
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
      try {
        setState((prev) => {
          try {
            if (!prev || !prev.timer || !prev.timer.isRunning) {
              return prev || initialState;
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
              try {
                saveState(newState);
                broadcastUpdate(updates);
              } catch (saveError) {
                console.error('[ScoreboardContext] Ошибка при сохранении состояния таймера:', saveError);
              }
            }

            return newState;
          } catch (error) {
            console.error('[ScoreboardContext] Ошибка в setState таймера:', error);
            return prev || initialState;
          }
        });
      } catch (error) {
        console.error('[ScoreboardContext] Критическая ошибка в интервале таймера:', error);
        // Не останавливаем интервал, продолжаем работу
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.timer.isRunning, isController]);

  // Обертываем все методы в безопасные обертки
  const safeUpdateTeam1Score = useCallback((delta) => {
    try {
      updateTeam1Score(delta);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateTeam1Score:', error);
    }
  }, [updateTeam1Score]);

  const safeUpdateTeam2Score = useCallback((delta) => {
    try {
      updateTeam2Score(delta);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateTeam2Score:', error);
    }
  }, [updateTeam2Score]);

  const safeSetTeam1Score = useCallback((score) => {
    try {
      setTeam1Score(score);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в setTeam1Score:', error);
    }
  }, [setTeam1Score]);

  const safeSetTeam2Score = useCallback((score) => {
    try {
      setTeam2Score(score);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в setTeam2Score:', error);
    }
  }, [setTeam2Score]);

  const safeUpdateTeam1Name = useCallback((name) => {
    try {
      updateTeam1Name(name);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateTeam1Name:', error);
    }
  }, [updateTeam1Name]);

  const safeUpdateTeam2Name = useCallback((name) => {
    try {
      updateTeam2Name(name);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateTeam2Name:', error);
    }
  }, [updateTeam2Name]);

  const safeUpdateTeam1Logo = useCallback((logo) => {
    try {
      updateTeam1Logo(logo);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateTeam1Logo:', error);
    }
  }, [updateTeam1Logo]);

  const safeUpdateTeam2Logo = useCallback((logo) => {
    try {
      updateTeam2Logo(logo);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateTeam2Logo:', error);
    }
  }, [updateTeam2Logo]);

  const safeUpdateTimer = useCallback((timerUpdates) => {
    try {
      updateTimer(timerUpdates);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateTimer:', error);
    }
  }, [updateTimer]);

  const safeSetTimer = useCallback((minutes, seconds) => {
    try {
      setTimer(minutes, seconds);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в setTimer:', error);
    }
  }, [setTimer]);

  const safeStartTimer = useCallback(() => {
    try {
      startTimer();
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в startTimer:', error);
    }
  }, [startTimer]);

  const safeStopTimer = useCallback(() => {
    try {
      stopTimer();
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в stopTimer:', error);
    }
  }, [stopTimer]);

  const safeResetTimer = useCallback(() => {
    try {
      resetTimer();
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в resetTimer:', error);
    }
  }, [resetTimer]);

  const safeUpdatePeriod = useCallback((period) => {
    try {
      updatePeriod(period);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updatePeriod:', error);
    }
  }, [updatePeriod]);

  const safeUpdateSettings = useCallback((settings) => {
    try {
      updateSettings(settings);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateSettings:', error);
    }
  }, [updateSettings]);

  const safeUpdateState = useCallback((updates, shouldBroadcast = true) => {
    try {
      updateState(updates, shouldBroadcast);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в updateState:', error);
    }
  }, [updateState]);

  const safeResetScoreboard = useCallback(() => {
    try {
      resetScoreboard();
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в resetScoreboard:', error);
    }
  }, [resetScoreboard]);

  const safeLoadState = useCallback(async () => {
    try {
      return await loadState();
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в loadState:', error);
      return null;
    }
  }, [loadState]);

  const safeSaveState = useCallback(async (newState) => {
    try {
      await saveState(newState);
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка в saveState:', error);
    }
  }, [saveState]);

  const value = {
    // Состояние
    state: state || initialState,
    isConnected,

    // Методы обновления счета
    updateTeam1Score: safeUpdateTeam1Score,
    updateTeam2Score: safeUpdateTeam2Score,
    setTeam1Score: safeSetTeam1Score,
    setTeam2Score: safeSetTeam2Score,

    // Методы обновления команд
    updateTeam1Name: safeUpdateTeam1Name,
    updateTeam2Name: safeUpdateTeam2Name,
    updateTeam1Logo: safeUpdateTeam1Logo,
    updateTeam2Logo: safeUpdateTeam2Logo,

    // Методы работы с таймером
    updateTimer: safeUpdateTimer,
    setTimer: safeSetTimer,
    startTimer: safeStartTimer,
    stopTimer: safeStopTimer,
    resetTimer: safeResetTimer,

    // Методы работы с периодом
    updatePeriod: safeUpdatePeriod,

    // Методы работы с настройками
    updateSettings: safeUpdateSettings,

    // Общие методы
    updateState: safeUpdateState,
    resetScoreboard: safeResetScoreboard,
    loadState: safeLoadState,
    saveState: safeSaveState,
  };

  try {
    return (
      <ScoreboardContext.Provider value={value}>
        {children}
      </ScoreboardContext.Provider>
    );
  } catch (error) {
    console.error('[ScoreboardContext] КРИТИЧЕСКАЯ ОШИБКА при рендеринге провайдера:', error);
    // Возвращаем минимальный провайдер с начальным состоянием
    return (
      <ScoreboardContext.Provider value={{state: initialState, isConnected: false}}>
        {children}
      </ScoreboardContext.Provider>
    );
  }
};

/**
 * Хук для использования контекста табло
 */
export const useScoreboard = () => {
  try {
    const context = useContext(ScoreboardContext);
    if (!context) {
      console.error('[useScoreboard] Контекст не найден, возвращаем начальное состояние');
      // Возвращаем начальное состояние вместо выброса ошибки
      return {
        state: initialState,
        isConnected: false,
        // Пустые функции-заглушки
        updateTeam1Score: () => {},
        updateTeam2Score: () => {},
        setTeam1Score: () => {},
        setTeam2Score: () => {},
        updateTeam1Name: () => {},
        updateTeam2Name: () => {},
        updateTeam1Logo: () => {},
        updateTeam2Logo: () => {},
        updateTimer: () => {},
        setTimer: () => {},
        startTimer: () => {},
        stopTimer: () => {},
        resetTimer: () => {},
        updatePeriod: () => {},
        updateSettings: () => {},
        updateState: () => {},
        resetScoreboard: () => {},
        loadState: async () => null,
        saveState: async () => {},
      };
    }
    return context;
  } catch (error) {
    console.error('[useScoreboard] КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.error('[useScoreboard] Stack trace:', error.stack);
    // Возвращаем начальное состояние вместо выброса ошибки
    return {
      state: initialState,
      isConnected: false,
      // Пустые функции-заглушки
      updateTeam1Score: () => {},
      updateTeam2Score: () => {},
      setTeam1Score: () => {},
      setTeam2Score: () => {},
      updateTeam1Name: () => {},
      updateTeam2Name: () => {},
      updateTeam1Logo: () => {},
      updateTeam2Logo: () => {},
      updateTimer: () => {},
      setTimer: () => {},
      startTimer: () => {},
      stopTimer: () => {},
      resetTimer: () => {},
      updatePeriod: () => {},
      updateSettings: () => {},
      updateState: () => {},
      resetScoreboard: () => {},
      loadState: async () => null,
      saveState: async () => {},
    };
  }
};

export default ScoreboardContext;
