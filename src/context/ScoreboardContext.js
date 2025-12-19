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
    direction: 'down', // 'up' или 'down'
    targetMinutes: 0, // Целевое время для отсчета вверх
    targetSeconds: 0,
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
            } catch (getCountError) {
              setIsConnected(false);
            }
          } else {
            setIsConnected(false);
          }
        } catch (error) {
          // Устанавливаем статус отключено при ошибке
          try {
            setIsConnected(false);
          } catch (setError) {
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
              console.error(`[ScoreboardContext] Ошибка в originalOnConnection для ${socketId}:`, error);
            }
          }
          // Обновляем статус асинхронно, чтобы не блокировать поток
          setTimeout(() => {
            try {
              updateConnectionStatus();
            } catch (statusError) {
              console.error(`[ScoreboardContext] Ошибка при обновлении статуса для ${socketId}:`, statusError);
            }
          }, 0);
        } catch (error) {
          // Не пробрасываем ошибку дальше
          console.error(`[ScoreboardContext] Критическая ошибка в onConnectionCallback для ${socketId}:`, error);
        }
      };

      websocketServer.onDisconnectCallback = (socketId) => {
        try {
          if (originalOnDisconnect) {
            try {
              originalOnDisconnect(socketId);
            } catch (error) {
              console.error(`[ScoreboardContext] Ошибка в originalOnDisconnect для ${socketId}:`, error);
            }
          }
          // Обновляем статус асинхронно, чтобы не блокировать поток
          setTimeout(() => {
            try {
              updateConnectionStatus();
            } catch (statusError) {
              console.error(`[ScoreboardContext] Ошибка при обновлении статуса после отключения ${socketId}:`, statusError);
            }
          }, 0);
        } catch (error) {
          // Не пробрасываем ошибку дальше
          console.error(`[ScoreboardContext] Критическая ошибка в onDisconnectCallback для ${socketId}:`, error);
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

        // Проверяем, не являются ли пути к логотипам временными файлами
        const isTemporaryLogo = (logo) => {
          if (!logo || typeof logo !== 'string') {
            return false;
          }
          // Base64 логотипы (data:image/...) не являются временными
          if (logo.startsWith('data:image/')) {
            return false;
          }
          // Проверяем, содержит ли путь указания на временные файлы
          return logo.includes('temp') || logo.includes('cache') || logo.includes('rn_image_picker_lib_temp');
        };

        // Убеждаемся, что загружаем все поля с проверкой и значениями по умолчанию
        const loadedState = {
          team1: {
            name: parsed?.team1?.name || initialState.team1.name,
            score: typeof parsed?.team1?.score === 'number' ? parsed.team1.score : initialState.team1.score,
            // Загружаем base64 логотипы и валидные URI, но не временные файлы
            logo: (parsed?.team1?.logo && !isTemporaryLogo(parsed.team1.logo)) ? parsed.team1.logo : initialState.team1.logo,
          },
          team2: {
            name: parsed?.team2?.name || initialState.team2.name,
            score: typeof parsed?.team2?.score === 'number' ? parsed.team2.score : initialState.team2.score,
            // Загружаем base64 логотипы и валидные URI, но не временные файлы
            logo: (parsed?.team2?.logo && !isTemporaryLogo(parsed.team2.logo)) ? parsed.team2.logo : initialState.team2.logo,
          },
          timer: {
            minutes: typeof parsed?.timer?.minutes === 'number' ? parsed.timer.minutes : initialState.timer.minutes,
            seconds: typeof parsed?.timer?.seconds === 'number' ? parsed.timer.seconds : initialState.timer.seconds,
            isRunning: typeof parsed?.timer?.isRunning === 'boolean' ? parsed.timer.isRunning : initialState.timer.isRunning,
            direction: parsed?.timer?.direction || initialState.timer.direction,
            // Важно: загружаем targetMinutes и targetSeconds для корректной работы отсчета вверх
            targetMinutes: typeof parsed?.timer?.targetMinutes === 'number' ? parsed.timer.targetMinutes : (parsed?.timer?.targetMinutes === undefined ? initialState.timer.targetMinutes : 0),
            targetSeconds: typeof parsed?.timer?.targetSeconds === 'number' ? parsed.timer.targetSeconds : (parsed?.timer?.targetSeconds === undefined ? initialState.timer.targetSeconds : 0),
          },
          period: typeof parsed?.period === 'number' ? parsed.period : initialState.period,
          settings: {
            primaryColor: parsed?.settings?.primaryColor || initialState.settings.primaryColor,
            secondaryColor: parsed?.settings?.secondaryColor || initialState.settings.secondaryColor,
            accentColor: parsed?.settings?.accentColor || initialState.settings.accentColor,
            fontSize: typeof parsed?.settings?.fontSize === 'number' ? parsed.settings.fontSize : initialState.settings.fontSize,
            showLogos: typeof parsed?.settings?.showLogos === 'boolean' ? parsed.settings.showLogos : initialState.settings.showLogos,
          },
        };

        setState(loadedState);
        return loadedState;
      }
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка при загрузке состояния:', error);
    }
    return null;
  }, []);

  /**
   * Сохраняет состояние в локальное хранилище
   */
  const saveState = useCallback(async (newState) => {
    try {
      // Проверяем, не являются ли пути к логотипам временными файлами
      const isTemporaryLogo = (logo) => {
        if (!logo || typeof logo !== 'string') {
          return false;
        }
        // Проверяем, содержит ли путь указания на временные файлы
        // Base64 логотипы (data:image/...) не являются временными
        if (logo.startsWith('data:image/')) {
          return false;
        }
        return logo.includes('temp') || logo.includes('cache') || logo.includes('rn_image_picker_lib_temp');
      };

      // Убеждаемся, что сохраняем полное состояние со всеми полями
      const stateToSave = {
        team1: {
          name: newState?.team1?.name || initialState.team1.name,
          score: typeof newState?.team1?.score === 'number' ? newState.team1.score : initialState.team1.score,
          // Сохраняем base64 логотипы и валидные URI, но не временные файлы
          logo: (newState?.team1?.logo && !isTemporaryLogo(newState.team1.logo)) ? newState.team1.logo : initialState.team1.logo,
        },
        team2: {
          name: newState?.team2?.name || initialState.team2.name,
          score: typeof newState?.team2?.score === 'number' ? newState.team2.score : initialState.team2.score,
          // Сохраняем base64 логотипы и валидные URI, но не временные файлы
          logo: (newState?.team2?.logo && !isTemporaryLogo(newState.team2.logo)) ? newState.team2.logo : initialState.team2.logo,
        },
        timer: {
          minutes: typeof newState?.timer?.minutes === 'number' ? newState.timer.minutes : initialState.timer.minutes,
          seconds: typeof newState?.timer?.seconds === 'number' ? newState.timer.seconds : initialState.timer.seconds,
          isRunning: typeof newState?.timer?.isRunning === 'boolean' ? newState.timer.isRunning : initialState.timer.isRunning,
          direction: newState?.timer?.direction || initialState.timer.direction,
          targetMinutes: typeof newState?.timer?.targetMinutes === 'number' ? newState.timer.targetMinutes : (initialState.timer.targetMinutes || 0),
          targetSeconds: typeof newState?.timer?.targetSeconds === 'number' ? newState.timer.targetSeconds : (initialState.timer.targetSeconds || 0),
        },
        period: typeof newState?.period === 'number' ? newState.period : initialState.period,
        settings: {
          primaryColor: newState?.settings?.primaryColor || initialState.settings.primaryColor,
          secondaryColor: newState?.settings?.secondaryColor || initialState.settings.secondaryColor,
          accentColor: newState?.settings?.accentColor || initialState.settings.accentColor,
          fontSize: typeof newState?.settings?.fontSize === 'number' ? newState.settings.fontSize : initialState.settings.fontSize,
          showLogos: typeof newState?.settings?.showLogos === 'boolean' ? newState.settings.showLogos : initialState.settings.showLogos,
        },
      };

      await AsyncStorage.setItem('scoreboardState', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('[ScoreboardContext] Ошибка при сохранении состояния:', error);
      // Не пробрасываем ошибку, чтобы не крашить приложение
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
        }
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
    const currentTimer = stateRef.current.timer;
    const direction = currentTimer.direction || 'down';

    const updates = {
      timer: {
        ...currentTimer,
        minutes: Math.max(0, minutes),
        seconds: Math.max(0, Math.min(59, seconds)),
        // Если отсчет вверх, сохраняем целевое время и сбрасываем текущее на 0:00
        // Если отсчет вниз, устанавливаем текущее время
        ...(direction === 'up'
          ? {
              targetMinutes: Math.max(0, minutes),
              targetSeconds: Math.max(0, Math.min(59, seconds)),
              minutes: 0,
              seconds: 0,
            }
          : {}),
      },
    };
    updateState(updates);
  }, [updateState]);

  /**
   * Запускает таймер
   */
  const startTimer = useCallback(() => {
    const currentTimer = stateRef.current.timer;
    const direction = currentTimer.direction || 'down';

    // Если отсчет вверх, убеждаемся что начинаем с 0:00
    if (direction === 'up') {
      updateTimer({
        isRunning: true,
        minutes: 0,
        seconds: 0,
      });
    } else {
      updateTimer({isRunning: true});
    }
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
    const currentTimer = stateRef.current.timer;
    const direction = currentTimer.direction || 'down';

    updateTimer({
      minutes: direction === 'up' ? 0 : (currentTimer.targetMinutes !== undefined ? currentTimer.targetMinutes : 0),
      seconds: direction === 'up' ? 0 : (currentTimer.targetSeconds !== undefined ? currentTimer.targetSeconds : 0),
      isRunning: false,
      direction: direction,
      // Сохраняем целевое время для отсчета вверх
      targetMinutes: currentTimer.targetMinutes || 0,
      targetSeconds: currentTimer.targetSeconds || 0,
    });
  }, [updateTimer]);

  /**
   * Обновляет период
   */
  const updatePeriod = useCallback((period) => {
    updateState({period});
  }, [updateState]);

  /**
   * Обновляет направление таймера
   */
  const updateTimerDirection = useCallback((direction) => {
    const currentTimer = stateRef.current.timer;
    const newDirection = direction === 'up' ? 'up' : 'down';

    const updates = {
      timer: {
        ...currentTimer,
        direction: newDirection,
        // При смене направления:
        // Если переключаемся на "вверх" - сохраняем текущее время как целевое и сбрасываем на 0:00
        // Если переключаемся на "вниз" - используем текущее время (или целевое, если было)
        ...(newDirection === 'up'
          ? {
              targetMinutes: currentTimer.minutes || currentTimer.targetMinutes || 0,
              targetSeconds: currentTimer.seconds || currentTimer.targetSeconds || 0,
              minutes: 0,
              seconds: 0,
            }
          : {
              minutes: currentTimer.targetMinutes !== undefined ? currentTimer.targetMinutes : currentTimer.minutes,
              seconds: currentTimer.targetSeconds !== undefined ? currentTimer.targetSeconds : currentTimer.seconds,
            }),
      },
    };
    updateState(updates);
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
                console.error('[ScoreboardContext] Ошибка в originalOnMessage:', originalError);
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
                        return prev || initialState;
                      }
                    });
                  } catch (setStateError) {
                    // Не пробрасываем ошибку дальше, приложение должно продолжать работать
                    console.error('[ScoreboardContext] Ошибка в setState:', setStateError);
                  }
                }, 0);
              } catch (error) {
                // Не пробрасываем ошибку дальше
                console.error('[ScoreboardContext] Ошибка при обработке scoreboard_update:', error);
              }
            }
          } catch (error) {
            // Не пробрасываем ошибку дальше, чтобы не крашить приложение
            console.error('[ScoreboardContext] Критическая ошибка в onMessageCallback:', error);
          }
        };
      } catch (error) {
      }
    }
  }, [websocketServer, isController]);

  // Ref для отслеживания процесса подключения
  const isConnectingRef = useRef(false);

  /**
   * Инициализация WebSocket клиента (для контроллера - подключение к табло)
   */
  useEffect(() => {
    if (isController && websocketClientRef.current) {
      // Проверяем, не подключены ли уже
      const alreadyConnected = websocketClientRef.current.getIsConnected();
      if (alreadyConnected) {
        isConnectingRef.current = false;
        return;
      }

      // Проверяем, не идет ли уже процесс подключения
      if (isConnectingRef.current) {
        return;
      }

      // Задержка для обеспечения полной очистки предыдущего соединения
      const connectDelay = 100;

      const connectTimeout = setTimeout(() => {
        try {
          // Проверяем еще раз перед подключением
          if (!websocketClientRef.current) {
            isConnectingRef.current = false;
            return;
          }

          if (websocketClientRef.current.getIsConnected()) {
            isConnectingRef.current = false;
            return;
          }

          // Проверяем еще раз, не идет ли уже подключение
          if (isConnectingRef.current) {
            return;
          }

          // Устанавливаем флаг подключения
          isConnectingRef.current = true;

          const handleOpen = () => {
            try {
              // Сбрасываем флаг подключения перед установкой isConnected
              isConnectingRef.current = false;
              // Устанавливаем isConnected асинхронно, чтобы избежать повторного рендера до завершения обработки
              setTimeout(() => {
                try {
                  // Проверяем еще раз, что соединение действительно установлено
                  if (websocketClientRef.current && websocketClientRef.current.getIsConnected()) {
                    setIsConnected(true);
                  } else {
                    isConnectingRef.current = false;
                  }
                } catch (error) {
                  console.error('[ScoreboardContext] Ошибка при установке isConnected:', error);
                  isConnectingRef.current = false;
                }
              }, 0);
              // При успешном подключении отправляем полное текущее состояние на табло
              // Используем небольшую задержку, чтобы убедиться, что соединение полностью готово
              setTimeout(() => {
                try {
                  if (isController && websocketClientRef.current) {
                    // Проверяем, что метод send существует и соединение готово
                    if (typeof websocketClientRef.current.send === 'function') {
                      const isReady = websocketClientRef.current.getIsConnected &&
                                     websocketClientRef.current.getIsConnected();
                      if (isReady) {
                        const currentState = stateRef.current;
                        if (currentState && typeof currentState === 'object') {
                          // Отправляем полное состояние, чтобы табло синхронизировалось
                          try {
                            websocketClientRef.current.send({
                              type: 'scoreboard_update',
                              data: currentState,
                            });
                          } catch (sendError) {
                            // Игнорируем ошибки отправки, чтобы не блокировать подключение
                            console.error('[ScoreboardContext] Ошибка отправки состояния при подключении:', sendError);
                          }
                        }
                      }
                    }
                  }
                } catch (error) {
                  // Игнорируем ошибки, чтобы не крашить приложение
                  console.error('[ScoreboardContext] Ошибка в handleOpen (setTimeout):', error);
                  console.error('[ScoreboardContext] Stack trace:', error?.stack);
                }
              }, 100); // Небольшая задержка для полной готовности соединения
            } catch (error) {
              // Игнорируем ошибки, чтобы не крашить приложение
              console.error('[ScoreboardContext] Критическая ошибка в handleOpen:', error);
              console.error('[ScoreboardContext] Stack trace:', error?.stack);
              isConnectingRef.current = false;
            }
          };

          const handleMessage = (message) => {
            try {
              // Контроллер может получать сообщения от табло (если нужно)
            } catch (error) {
            }
          };

          const handleError = (error) => {
            try {
              console.error('[ScoreboardContext] handleError вызван:', error?.message || error);
              console.error('[ScoreboardContext] Stack trace:', error?.stack);
              isConnectingRef.current = false;
              setIsConnected(false);
              // Не запускаем переподключение здесь - WebSocket клиент сам обработает переподключение
              // через handleClose или через свою логику переподключения
            } catch (errorHandlerError) {
              console.error('[ScoreboardContext] Ошибка в handleError:', errorHandlerError);
            }
          };

          const handleClose = () => {
            try {
              isConnectingRef.current = false;
              setIsConnected(false);
              // WebSocket клиент сам обработает переподключение через handleClose
              // Не нужно запускать переподключение здесь, чтобы избежать дублирования
            } catch (error) {
              console.error('[ScoreboardContext] Ошибка в handleClose:', error);
            }
          };

          // Подключаем обработчики
          if (websocketClientRef.current && !websocketClientRef.current.getIsConnected()) {
            websocketClientRef.current.connect(handleOpen, handleMessage, handleError, handleClose).catch((error) => {
              console.error('[ScoreboardContext] Ошибка при подключении:', error);
              isConnectingRef.current = false;
              setIsConnected(false);
              // Не пробрасываем ошибку дальше, чтобы не крашить приложение
            });
          } else {
            isConnectingRef.current = false;
          }
        } catch (error) {
          console.error('[ScoreboardContext] Критическая ошибка в connectTimeout:', error);
          isConnectingRef.current = false;
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
    } else {
      isConnectingRef.current = false;
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

            let {minutes, seconds, direction} = prev.timer;

            if (direction === 'down') {
              // Отсчет вниз - от указанного времени до 0:00
              if (seconds > 0) {
                seconds--;
              } else if (minutes > 0) {
                minutes--;
                seconds = 59;
              } else {
                // Таймер достиг нуля
                const stoppedState = {
                  ...prev,
                  timer: {
                    ...prev.timer,
                    isRunning: false,
                  },
                };
                // Сохраняем состояние при остановке таймера
                if (isController) {
                  try {
                    saveState(stoppedState);
                    broadcastUpdate({timer: stoppedState.timer});
                  } catch (saveError) {
                    console.error('[ScoreboardContext] Ошибка при сохранении состояния при остановке таймера:', saveError);
                  }
                }
                return stoppedState;
              }
            } else {
              // Отсчет вверх - от 0:00 до указанного времени
              const targetMinutes = prev.timer.targetMinutes !== undefined ? prev.timer.targetMinutes : prev.timer.minutes;
              const targetSeconds = prev.timer.targetSeconds !== undefined ? prev.timer.targetSeconds : prev.timer.seconds;

              seconds++;
              if (seconds >= 60) {
                seconds = 0;
                minutes++;
              }

              // Проверяем, достигли ли целевого времени
              if (minutes > targetMinutes || (minutes === targetMinutes && seconds > targetSeconds)) {
                // Достигли или превысили целевое время - останавливаем
                const stoppedState = {
                  ...prev,
                  timer: {
                    ...prev.timer,
                    minutes: targetMinutes,
                    seconds: targetSeconds,
                    isRunning: false,
                  },
                };
                // Сохраняем состояние при остановке таймера
                if (isController) {
                  try {
                    saveState(stoppedState);
                    broadcastUpdate({timer: stoppedState.timer});
                  } catch (saveError) {
                    console.error('[ScoreboardContext] Ошибка при сохранении состояния при остановке таймера:', saveError);
                  }
                }
                return stoppedState;
              }
            }

            const updates = {
              timer: {
                ...prev.timer,
                minutes,
                seconds,
              },
            };

            const newState = {...prev, ...updates};

            // Сохраняем состояние каждую секунду при работе таймера
            // Но не слишком часто, чтобы не перегружать AsyncStorage
            // Сохраняем каждую секунду, так как это важно для восстановления состояния
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
            console.error('[ScoreboardContext] Ошибка в автоматическом обновлении таймера:', error);
            return prev || initialState;
          }
        });
      } catch (error) {
        // Не останавливаем интервал, продолжаем работу
        console.error('[ScoreboardContext] Ошибка в setInterval таймера:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.timer.isRunning, state.timer.direction, isController, saveState, broadcastUpdate]);

  // Обертываем все методы в безопасные обертки
  const safeUpdateTeam1Score = useCallback((delta) => {
    try {
      updateTeam1Score(delta);
    } catch (error) {
    }
  }, [updateTeam1Score]);

  const safeUpdateTeam2Score = useCallback((delta) => {
    try {
      updateTeam2Score(delta);
    } catch (error) {
    }
  }, [updateTeam2Score]);

  const safeSetTeam1Score = useCallback((score) => {
    try {
      setTeam1Score(score);
    } catch (error) {
    }
  }, [setTeam1Score]);

  const safeSetTeam2Score = useCallback((score) => {
    try {
      setTeam2Score(score);
    } catch (error) {
    }
  }, [setTeam2Score]);

  const safeUpdateTeam1Name = useCallback((name) => {
    try {
      updateTeam1Name(name);
    } catch (error) {
    }
  }, [updateTeam1Name]);

  const safeUpdateTeam2Name = useCallback((name) => {
    try {
      updateTeam2Name(name);
    } catch (error) {
    }
  }, [updateTeam2Name]);

  const safeUpdateTeam1Logo = useCallback((logo) => {
    try {
      updateTeam1Logo(logo);
    } catch (error) {
    }
  }, [updateTeam1Logo]);

  const safeUpdateTeam2Logo = useCallback((logo) => {
    try {
      updateTeam2Logo(logo);
    } catch (error) {
    }
  }, [updateTeam2Logo]);

  const safeUpdateTimer = useCallback((timerUpdates) => {
    try {
      updateTimer(timerUpdates);
    } catch (error) {
    }
  }, [updateTimer]);

  const safeSetTimer = useCallback((minutes, seconds) => {
    try {
      setTimer(minutes, seconds);
    } catch (error) {
    }
  }, [setTimer]);

  const safeStartTimer = useCallback(() => {
    try {
      startTimer();
    } catch (error) {
    }
  }, [startTimer]);

  const safeStopTimer = useCallback(() => {
    try {
      stopTimer();
    } catch (error) {
    }
  }, [stopTimer]);

  const safeResetTimer = useCallback(() => {
    try {
      resetTimer();
    } catch (error) {
    }
  }, [resetTimer]);

  const safeUpdatePeriod = useCallback((period) => {
    try {
      updatePeriod(period);
    } catch (error) {
    }
  }, [updatePeriod]);

  const safeUpdateTimerDirection = useCallback((direction) => {
    try {
      updateTimerDirection(direction);
    } catch (error) {
    }
  }, [updateTimerDirection]);

  const safeUpdateSettings = useCallback((settings) => {
    try {
      updateSettings(settings);
    } catch (error) {
    }
  }, [updateSettings]);

  const safeUpdateState = useCallback((updates, shouldBroadcast = true) => {
    try {
      updateState(updates, shouldBroadcast);
    } catch (error) {
    }
  }, [updateState]);

  const safeResetScoreboard = useCallback(() => {
    try {
      resetScoreboard();
    } catch (error) {
    }
  }, [resetScoreboard]);

  const safeLoadState = useCallback(async () => {
    try {
      return await loadState();
    } catch (error) {
      return null;
    }
  }, [loadState]);

  const safeSaveState = useCallback(async (newState) => {
    try {
      await saveState(newState);
    } catch (error) {
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
    updateTimerDirection: safeUpdateTimerDirection,

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
        updateTimerDirection: () => {},
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
