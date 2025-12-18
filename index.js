/**
 * @format
 */

import {AppRegistry, ErrorUtils} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';
import logger from './src/services/logger';

// Глобальный обработчик ошибок для предотвращения закрытия приложения
const originalHandler = ErrorUtils.getGlobalHandler();

ErrorUtils.setGlobalHandler((error, isFatal) => {
  try {
    logger.error('[Global Error Handler] Необработанная ошибка:', {
      message: error?.message || error?.toString() || 'Неизвестная ошибка',
      stack: error?.stack,
      isFatal,
    });

    // Вызываем оригинальный обработчик, но не даем приложению закрыться
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  } catch (handlerError) {
    // Если даже обработчик ошибок упал, просто логируем
    console.error('[Global Error Handler] Критическая ошибка в обработчике:', handlerError);
  }
});

AppRegistry.registerComponent(appName, () => App);
