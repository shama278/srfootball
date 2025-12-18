import React, {createContext, useContext, useState, useEffect, useCallback, useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../services/logger';

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
        const clientCount = websocketServer.getClientCount();
        setIsConnected(clientCount > 0);
      };

      // Проверяем статус сразу
      updateConnectionStatus();

      // Проверяем статус периодически (каждые 2 секунды)
      const interval = setInterval(updateConnectionStatus, 2000);

      return () => clearInterval(interval);
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
      logger.error('Ошибка при загрузке состояния:', error);
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
      logger.error('Ошибка при сохранении состояния:', error);
    }
  }, []);

  /**
   * Отправляет обновление состояния через WebSocket (контроллер отправляет на табло)
   */
  const broadcastUpdate = useCallback((update) => {
    if (isController && websocketClientRef.current) {
      try {
        // Проверяем состояние соединения перед отправкой
        if (websocketClientRef.current.getIsConnected && websocketClientRef.current.getIsConnected()) {
          websocketClientRef.current.send({
            type: 'scoreboard_update',
            data: update,
          });
        } else {
          logger.warn('[ScoreboardContext] Попытка отправить обновление без активного соединения');
        }
      } catch (error) {
        logger.error('Ошибка при отправке обновления:', error);
        // При ошибке отправки сбрасываем статус подключения
        setIsConnected(false);
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
              originalOnMessage(socketId, message);
            }

            // Обрабатываем обновления состояния от контроллера
            if (message && message.type === 'scoreboard_update' && message.data) {
              setState((prev) => {
                const newState = {...prev, ...message.data};
                return newState;
              });
            }
          } catch (error) {
            logger.error('[ScoreboardContext] Ошибка при обработке сообщения:', error);
          }
        };
      } catch (error) {
        logger.error('[ScoreboardContext] Ошибка при установке обработчика сообщений:', error);
      }
    }
  }, [websocketServer, isController]);

  /**
   * Инициализация WebSocket клиента (для контроллера - подключение к табло)
   */
  useEffect(() => {
    if (isController && websocketClientRef.current) {
      const handleOpen = () => {
        logger.log('[ScoreboardContext] Контроллер подключен к табло');
        setIsConnected(true);
      };

      const handleMessage = (message) => {
        // Контроллер может получать сообщения от табло (если нужно)
        logger.log('[ScoreboardContext] Сообщение от табло:', message);
      };

      const handleError = (error) => {
        const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
        logger.error('[ScoreboardContext] Ошибка WebSocket:', errorMsg);
        setIsConnected(false);
      };

      const handleClose = () => {
        logger.log('[ScoreboardContext] Отключен от табло');
        setIsConnected(false);
      };

      // Подключаем обработчики
      websocketClientRef.current.connect(handleOpen, handleMessage, handleError, handleClose).catch((error) => {
        logger.error('[ScoreboardContext] Ошибка при подключении к табло:', error);
      });

      return () => {
        if (websocketClientRef.current) {
          websocketClientRef.current.disconnect();
        }
      };
    }
  }, [isController]);

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
