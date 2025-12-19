import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, SafeAreaView, StatusBar, Image, Dimensions} from 'react-native';
import {useScoreboard} from '../../context/ScoreboardContext';
import ScoreDisplay from './ScoreDisplay';
import TimerDisplay from './TimerDisplay';
import TeamInfo from './TeamInfo';

// Логотип по умолчанию
const DEFAULT_LOGO = require('../../../assets/default-logo.png');

/**
 * Основной компонент табло для телевизора
 */
const Scoreboard = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [team1LogoError, setTeam1LogoError] = useState(false);
  const [team2LogoError, setTeam2LogoError] = useState(false);

  let context, state, team1, team2, timer, period, settings;

  try {
    context = useScoreboard();
    state = context?.state;

    // Защита от undefined state
    if (!state) {
      return null;
    }

    ({team1, team2, timer, period, settings} = state);
  } catch (error) {
    console.error('[Scoreboard] КРИТИЧЕСКАЯ ОШИБКА при получении контекста:', error);
    console.error('[Scoreboard] Stack trace:', error.stack);
    const errorStyles = getResponsiveStyles(dimensions.width, dimensions.height);
    return (
      <SafeAreaView style={errorStyles.container}>
        <View style={errorStyles.errorContainer}>
          <Text style={errorStyles.errorText}>Ошибка загрузки табло</Text>
          <Text style={errorStyles.errorDetails}>{error.toString()}</Text>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({window}) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  // Функция проверки временных файлов
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

  // Используем ref для отслеживания уже очищенных логотипов, чтобы не очищать повторно
  const cleanedLogosRef = React.useRef(new Set());

  // Проверяем и очищаем временные файлы при монтировании и изменении логотипов
  useEffect(() => {
    const logoKey = `team1_${team1?.logo || 'null'}`;
    // Очищаем только если это временный файл и мы еще не очищали этот конкретный путь
    if (team1?.logo && isTemporaryLogo(team1.logo) && !cleanedLogosRef.current.has(logoKey)) {
      cleanedLogosRef.current.add(logoKey);
      // Очищаем асинхронно, чтобы не блокировать рендеринг
      setTimeout(() => {
        try {
          if (context && context.updateTeam1Logo) {
            context.updateTeam1Logo(null);
          }
        } catch (error) {
          console.error('[Scoreboard] Ошибка при очистке логотипа команды 1:', error);
        }
      }, 0);
    }
    // Сбрасываем флаг ошибки, если логотип изменился на валидный
    if (!team1?.logo || !isTemporaryLogo(team1.logo)) {
      setTeam1LogoError(false);
    }
  }, [team1?.logo, context]);

  useEffect(() => {
    const logoKey = `team2_${team2?.logo || 'null'}`;
    // Очищаем только если это временный файл и мы еще не очищали этот конкретный путь
    if (team2?.logo && isTemporaryLogo(team2.logo) && !cleanedLogosRef.current.has(logoKey)) {
      cleanedLogosRef.current.add(logoKey);
      // Очищаем асинхронно, чтобы не блокировать рендеринг
      setTimeout(() => {
        try {
          if (context && context.updateTeam2Logo) {
            context.updateTeam2Logo(null);
          }
        } catch (error) {
          console.error('[Scoreboard] Ошибка при очистке логотипа команды 2:', error);
        }
      }, 0);
    }
    // Сбрасываем флаг ошибки, если логотип изменился на валидный
    if (!team2?.logo || !isTemporaryLogo(team2.logo)) {
      setTeam2LogoError(false);
    }
  }, [team2?.logo, context]);

  // Защита от undefined значений с полной проверкой
  const safePeriod = (typeof period === 'number' && period >= 1) ? period : 1;
  const safeTeam1 = {
    name: (team1 && typeof team1.name === 'string') ? team1.name : 'Команда 1',
    score: (team1 && typeof team1.score === 'number') ? team1.score : 0,
    // Очищаем временные файлы сразу при рендеринге
    logo: (team1 && team1.logo && !isTemporaryLogo(team1.logo)) ? team1.logo : null,
  };
  const safeTeam2 = {
    name: (team2 && typeof team2.name === 'string') ? team2.name : 'Команда 2',
    score: (team2 && typeof team2.score === 'number') ? team2.score : 0,
    // Очищаем временные файлы сразу при рендеринге
    logo: (team2 && team2.logo && !isTemporaryLogo(team2.logo)) ? team2.logo : null,
  };
  const safeTimer = {
    minutes: (timer && typeof timer.minutes === 'number') ? Math.max(0, Math.min(99, timer.minutes)) : 0,
    seconds: (timer && typeof timer.seconds === 'number') ? Math.max(0, Math.min(59, timer.seconds)) : 0,
    isRunning: (timer && typeof timer.isRunning === 'boolean') ? timer.isRunning : false,
  };
  const safeSettings = {
    primaryColor: (settings && settings.primaryColor) ? settings.primaryColor : '#1a1a1a',
    secondaryColor: (settings && settings.secondaryColor) ? settings.secondaryColor : '#ffffff',
    showLogos: (settings && typeof settings.showLogos === 'boolean') ? settings.showLogos : true,
  };

  const periodLabels = {
    1: '1-й тайм',
    2: '2-й тайм',
    3: 'ОТ',
    4: 'Доп. время',
  };

  const periodLabel = periodLabels[safePeriod] || `${safePeriod}-й период`;

  try {
    // Дополнительная проверка перед рендерингом
    if (!safeTimer || typeof safeTimer.minutes !== 'number' || typeof safeTimer.seconds !== 'number') {
      console.warn('[Scoreboard] Невалидные данные таймера, используем значения по умолчанию');
      safeTimer.minutes = 0;
      safeTimer.seconds = 0;
      safeTimer.isRunning = false;
    }

    const dynamicStyles = getResponsiveStyles(dimensions.width, dimensions.height);

    return (
      <SafeAreaView style={[dynamicStyles.container, {backgroundColor: safeSettings.primaryColor}]}>
        <StatusBar hidden />

        {/* Заголовок с периодом */}
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.periodLabel}>{periodLabel ? periodLabel.toUpperCase() : '1-Й ТАЙМ'}</Text>
        </View>

        {/* Основное содержимое */}
        <View style={dynamicStyles.content}>
          {/* Левая команда */}
          <View style={dynamicStyles.teamSection}>
            {safeSettings.showLogos && (
              <Image
                source={
                  safeTeam1.logo && typeof safeTeam1.logo === 'string' && safeTeam1.logo.trim().length > 0 && !team1LogoError
                    ? (safeTeam1.logo.startsWith('data:image/')
                        ? {uri: safeTeam1.logo}
                        : {uri: safeTeam1.logo})
                    : DEFAULT_LOGO
                }
                style={dynamicStyles.teamLogo}
                resizeMode="contain"
                onError={(error) => {
                  // Извлекаем только важную информацию об ошибке
                  const errorMessage = error?.nativeEvent?.error || error?.message || 'Неизвестная ошибка';
                  console.error('[Scoreboard] Ошибка загрузки логотипа команды 1:', errorMessage);

                  // Если файл не найден (ENOENT) или это временный файл, очищаем логотип из состояния
                  if (errorMessage.includes('ENOENT') || errorMessage.includes('No such file') || errorMessage.includes('temp') || isTemporaryLogo(team1?.logo)) {
                    console.warn('[Scoreboard] Файл логотипа команды 1 не найден или временный, очищаем логотип');
                    // Очищаем логотип через контекст асинхронно, чтобы не блокировать рендеринг
                    setTimeout(() => {
                      try {
                        if (context && context.updateTeam1Logo) {
                          context.updateTeam1Logo(null);
                          console.log('[Scoreboard] Логотип команды 1 успешно очищен');
                        }
                      } catch (updateError) {
                        console.error('[Scoreboard] Ошибка при очистке логотипа команды 1:', updateError);
                      }
                    }, 0);
                  }

                  setTeam1LogoError(true);
                }}
                onLoadStart={() => {
                  setTeam1LogoError(false);
                }}
                onLoadEnd={() => {
                  // Логируем завершение загрузки для отладки
                }}
              />
            )}
            <Text style={[dynamicStyles.teamName, {color: safeSettings.secondaryColor}]}>
              {safeTeam1.name}
            </Text>
            <Text style={[dynamicStyles.score, {color: safeSettings.secondaryColor}]}>
              {safeTeam1.score}
            </Text>
          </View>

          {/* Центральная часть с таймером */}
          <View style={dynamicStyles.centerSection}>
            <TimerDisplay
              minutes={safeTimer.minutes}
              seconds={safeTimer.seconds}
              isRunning={safeTimer.isRunning}
              textStyle={{color: safeSettings.secondaryColor}}
              screenWidth={dimensions.width}
              screenHeight={dimensions.height}
            />
          </View>

          {/* Правая команда */}
          <View style={dynamicStyles.teamSection}>
            {safeSettings.showLogos && (
              <Image
                source={
                  safeTeam2.logo && typeof safeTeam2.logo === 'string' && safeTeam2.logo.trim().length > 0 && !team2LogoError
                    ? (safeTeam2.logo.startsWith('data:image/')
                        ? {uri: safeTeam2.logo}
                        : {uri: safeTeam2.logo})
                    : DEFAULT_LOGO
                }
                style={dynamicStyles.teamLogo}
                resizeMode="contain"
                onError={(error) => {
                  // Извлекаем только важную информацию об ошибке
                  const errorMessage = error?.nativeEvent?.error || error?.message || 'Неизвестная ошибка';
                  console.error('[Scoreboard] Ошибка загрузки логотипа команды 2:', errorMessage);

                  // Если файл не найден (ENOENT) или это временный файл, очищаем логотип из состояния
                  if (errorMessage.includes('ENOENT') || errorMessage.includes('No such file') || errorMessage.includes('temp') || isTemporaryLogo(team2?.logo)) {
                    console.warn('[Scoreboard] Файл логотипа команды 2 не найден или временный, очищаем логотип');
                    // Очищаем логотип через контекст асинхронно, чтобы не блокировать рендеринг
                    setTimeout(() => {
                      try {
                        if (context && context.updateTeam2Logo) {
                          context.updateTeam2Logo(null);
                          console.log('[Scoreboard] Логотип команды 2 успешно очищен');
                        }
                      } catch (updateError) {
                        console.error('[Scoreboard] Ошибка при очистке логотипа команды 2:', updateError);
                      }
                    }, 0);
                  }

                  setTeam2LogoError(true);
                }}
                onLoadStart={() => {
                  setTeam2LogoError(false);
                }}
                onLoadEnd={() => {
                  // Логируем завершение загрузки для отладки
                }}
              />
            )}
            <Text style={[dynamicStyles.teamName, {color: safeSettings.secondaryColor}]}>
              {safeTeam2.name}
            </Text>
            <Text style={[dynamicStyles.score, {color: safeSettings.secondaryColor}]}>
              {safeTeam2.score}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  } catch (error) {
    console.error('[Scoreboard] Критическая ошибка при рендеринге:', error);
    console.error('[Scoreboard] Сообщение:', error?.message);
    console.error('[Scoreboard] Stack:', error?.stack);
    console.error('[Scoreboard] Текущее состояние:', {
      team1: team1,
      team2: team2,
      timer: timer,
      period: period,
      settings: settings,
    });
    const errorStyles = getResponsiveStyles(dimensions.width, dimensions.height);
    return (
      <SafeAreaView style={errorStyles.container}>
        <StatusBar hidden />
        <View style={errorStyles.errorContainer}>
          <Text style={errorStyles.errorText}>Ошибка отображения табло</Text>
          <Text style={errorStyles.errorDetails}>{error?.message || error?.toString() || 'Неизвестная ошибка'}</Text>
        </View>
      </SafeAreaView>
    );
  }
};

// Вычисляем адаптивные размеры на основе экрана
const getResponsiveStyles = (screenWidth, screenHeight) => {
  const scale = Math.min(screenWidth / 1920, screenHeight / 1080); // Базовое разрешение 1920x1080
  const isLandscape = screenWidth > screenHeight;
  const isSmallScreen = screenWidth < 800 || screenHeight < 600;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1a1a1a',
    },
    header: {
      paddingTop: Math.max(20, screenHeight * 0.03),
      paddingHorizontal: Math.max(20, screenWidth * 0.02),
      alignItems: 'center',
      marginBottom: Math.max(10, screenHeight * 0.02),
    },
    periodLabel: {
      fontSize: Math.max(24, Math.min(screenWidth * 0.022, 60)),
      fontWeight: '800',
      color: '#ffffff',
      letterSpacing: 2 * scale,
      textShadowColor: 'rgba(0, 0, 0, 0.8)',
      textShadowOffset: {width: 3 * scale, height: 3 * scale},
      textShadowRadius: 6 * scale,
      paddingHorizontal: Math.max(15, screenWidth * 0.015),
      paddingVertical: Math.max(8, screenHeight * 0.01),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12 * scale,
      borderWidth: 2 * scale,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Math.max(20, screenWidth * 0.05),
    },
    errorText: {
      fontSize: Math.max(18, screenWidth * 0.04),
      color: '#ffffff',
      textAlign: 'center',
    },
    content: {
      flex: 1,
      flexDirection: isLandscape ? 'row' : 'column',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: Math.max(20, screenWidth * 0.025),
      paddingVertical: Math.max(15, screenHeight * 0.02),
    },
    teamSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Math.max(15, screenHeight * 0.02),
      paddingHorizontal: Math.max(10, screenWidth * 0.01),
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: Math.max(10, 20 * scale),
      marginHorizontal: Math.max(5, screenWidth * 0.01),
      marginVertical: isLandscape ? 0 : Math.max(5, screenHeight * 0.01),
      borderWidth: 2 * scale,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4 * scale},
      shadowOpacity: 0.3,
      shadowRadius: 8 * scale,
      elevation: 5,
    },
    teamLogo: {
      width: Math.max(80, Math.min(screenWidth * 0.15, screenHeight * 0.2)),
      height: Math.max(80, Math.min(screenWidth * 0.15, screenHeight * 0.2)),
      marginBottom: Math.max(10, screenHeight * 0.02),
      borderRadius: Math.max(40, Math.min(screenWidth * 0.075, screenHeight * 0.1)),
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 3 * scale,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4 * scale},
      shadowOpacity: 0.4,
      shadowRadius: 8 * scale,
    },
    teamName: {
      fontSize: Math.max(24, Math.min(screenWidth * 0.04, 72)),
      fontWeight: '800',
      color: '#ffffff',
      textAlign: 'center',
      marginBottom: Math.max(15, screenHeight * 0.03),
      textShadowColor: 'rgba(0, 0, 0, 0.8)',
      textShadowOffset: {width: 2 * scale, height: 2 * scale},
      textShadowRadius: 6 * scale,
      maxWidth: screenWidth * 0.4,
      letterSpacing: 1 * scale,
    },
    score: {
      fontSize: Math.max(60, Math.min(screenWidth * 0.12, screenHeight * 0.2)),
      fontWeight: '900',
      color: '#ffffff',
      textShadowColor: 'rgba(0, 0, 0, 0.8)',
      textShadowOffset: {width: 4 * scale, height: 4 * scale},
      textShadowRadius: 8 * scale,
      letterSpacing: 4 * scale,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: Math.max(15, screenWidth * 0.02),
      paddingVertical: Math.max(10, screenHeight * 0.015),
      borderRadius: Math.max(10, 20 * scale),
      borderWidth: 3 * scale,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 6 * scale},
      shadowOpacity: 0.5,
      shadowRadius: 10 * scale,
      elevation: 8,
    },
    centerSection: {
      flex: isLandscape ? 0.9 : 0.7,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Math.max(20, screenWidth * 0.025),
      paddingVertical: Math.max(15, screenHeight * 0.02),
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: Math.max(12, 24 * scale),
      borderWidth: 2 * scale,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4 * scale},
      shadowOpacity: 0.4,
      shadowRadius: 10 * scale,
      elevation: 6,
      marginVertical: isLandscape ? 0 : Math.max(5, screenHeight * 0.01),
    },
  });
};

export default Scoreboard;
