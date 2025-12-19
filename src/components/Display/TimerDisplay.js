import React from 'react';
import {View, Text, StyleSheet, Dimensions} from 'react-native';

/**
 * Компонент отображения таймера
 */
const TimerDisplay = ({minutes, seconds, isRunning, style, textStyle, screenWidth, screenHeight}) => {
  const dimensions = screenWidth && screenHeight
    ? {width: screenWidth, height: screenHeight}
    : Dimensions.get('window');
  // Безопасная проверка и нормализация значений
  const safeMinutes = (typeof minutes === 'number' && !isNaN(minutes) && minutes >= 0)
    ? Math.max(0, Math.min(99, Math.floor(minutes)))
    : 0;
  const safeSeconds = (typeof seconds === 'number' && !isNaN(seconds) && seconds >= 0)
    ? Math.max(0, Math.min(59, Math.floor(seconds)))
    : 0;
  const safeIsRunning = typeof isRunning === 'boolean' ? isRunning : false;

  const formatTime = (mins, secs) => {
    try {
      const formattedMins = String(mins).padStart(2, '0');
      const formattedSecs = String(secs).padStart(2, '0');
      return `${formattedMins}:${formattedSecs}`;
    } catch (error) {
      console.error('[TimerDisplay] Ошибка форматирования времени:', error);
      return '00:00';
    }
  };

  try {
    const dynamicStyles = getResponsiveStyles(dimensions.width, dimensions.height);
    return (
      <View style={[dynamicStyles.container, style]}>
        <Text style={[dynamicStyles.timer, textStyle, safeIsRunning && dynamicStyles.running]}>
          {formatTime(safeMinutes, safeSeconds)}
        </Text>
        {safeIsRunning && <View style={dynamicStyles.indicator} />}
      </View>
    );
  } catch (error) {
    console.error('[TimerDisplay] Критическая ошибка рендеринга:', error);
    // Возвращаем минимальный безопасный компонент
    const fallbackStyles = getResponsiveStyles(dimensions.width, dimensions.height);
    return (
      <View style={[fallbackStyles.container, style]}>
        <Text style={[fallbackStyles.timer, textStyle]}>00:00</Text>
      </View>
    );
  }
};

// Вычисляем адаптивные размеры для таймера
const getResponsiveStyles = (screenWidth, screenHeight) => {
  const scale = Math.min(screenWidth / 1920, screenHeight / 1080);
  const isLandscape = screenWidth > screenHeight;
  const baseFontSize = isLandscape
    ? Math.max(40, Math.min(screenWidth * 0.05, screenHeight * 0.08))
    : Math.max(40, Math.min(screenWidth * 0.08, screenHeight * 0.06));

  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Math.max(5, screenHeight * 0.005),
    },
    timer: {
      fontSize: baseFontSize,
      fontWeight: '900',
      color: '#ffffff',
      textShadowColor: 'rgba(0, 0, 0, 0.8)',
      textShadowOffset: {width: 3 * scale, height: 3 * scale},
      textShadowRadius: 8 * scale,
      letterSpacing: 6 * scale,
      fontFamily: 'monospace',
    },
    running: {
      color: '#ff6b6b',
      textShadowColor: 'rgba(255, 107, 107, 0.6)',
      textShadowOffset: {width: 0, height: 0},
      textShadowRadius: 20 * scale,
    },
    indicator: {
      width: Math.max(12, 20 * scale),
      height: Math.max(12, 20 * scale),
      borderRadius: Math.max(6, 10 * scale),
      backgroundColor: '#ff6b6b',
      marginTop: Math.max(8, 12 * scale),
      shadowColor: '#ff6b6b',
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.8,
      shadowRadius: 10 * scale,
      elevation: 5,
    },
  });
};

export default TimerDisplay;
