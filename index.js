/**
 * @format
 */

import React from 'react';
import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';
import ErrorBoundary from './src/components/ErrorBoundary';

// Стабильная обертка для защиты от hot reload
const AppWrapper = () => {
  try {
    return (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[index.js] КРИТИЧЕСКАЯ ОШИБКА при загрузке App:', error);
    console.error('[index.js] Stack:', error?.stack);
    // Возвращаем минимальный компонент вместо краша
    return null;
  }
};

// Регистрируем обернутый компонент
AppRegistry.registerComponent(appName, () => AppWrapper);
