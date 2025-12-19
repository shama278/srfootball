import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Pressable, Text, Platform, Dimensions} from 'react-native';
import Scoreboard from '../components/Display/Scoreboard';
import {useScoreboard} from '../context/ScoreboardContext';
import {getLocalIPAddress} from '../services/networkUtils';

/**
 * Экран отображения табло для телевизора
 */
const DisplayScreen = ({onShowLogs, onModeChange}) => {
  let scoreboardContext, isConnected;
  const [ipAddress, setIpAddress] = useState('');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  try {
    scoreboardContext = useScoreboard();
    isConnected = scoreboardContext?.isConnected || false;
  } catch (error) {
    isConnected = false;
  }

  useEffect(() => {
    const loadIP = async () => {
      try {
        const ip = await getLocalIPAddress();
        if (ip) {
          setIpAddress(ip);
        }
      } catch (error) {
        console.error('[DisplayScreen] Ошибка при загрузке IP адреса:', error);
        console.error('[DisplayScreen] Stack trace:', error.stack);
      }
    };
    try {
      loadIP();
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({window}) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  try {
    const dynamicStyles = getResponsiveStyles(dimensions.width, dimensions.height);
    return (
      <View style={dynamicStyles.container}>
        <Scoreboard />
        <View style={dynamicStyles.statusBar}>
          {/* IP адрес */}
          {ipAddress && typeof ipAddress === 'string' && ipAddress.trim().length > 0 && (
            <Text style={dynamicStyles.ipAddress}>{ipAddress}</Text>
          )}
          {/* Статус подключения в виде кружка */}
          <View style={[dynamicStyles.statusIndicator, isConnected ? dynamicStyles.statusConnected : dynamicStyles.statusDisconnected]} />
        </View>
      </View>
    );
  } catch (error) {
    console.error('[DisplayScreen] Критическая ошибка при рендеринге:', error);
    console.error('[DisplayScreen] Сообщение:', error?.message);
    console.error('[DisplayScreen] Stack:', error?.stack);
    const errorStyles = getResponsiveStyles(dimensions.width, dimensions.height);
    return (
      <View style={errorStyles.container}>
        <View style={errorStyles.errorContainer}>
          <Text style={errorStyles.errorText}>Ошибка отображения экрана</Text>
          <Text style={errorStyles.errorDetails}>{error?.message || error?.toString() || 'Неизвестная ошибка'}</Text>
        </View>
      </View>
    );
  }
};

// Вычисляем адаптивные размеры для статус-бара
const getResponsiveStyles = (screenWidth, screenHeight) => {
  const scale = Math.min(screenWidth / 1920, screenHeight / 1080);
  const statusBarTop = Math.max(10, screenHeight * 0.02);
  const statusBarHorizontal = Math.max(15, screenWidth * 0.015);

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    statusBar: {
      position: 'absolute',
      top: statusBarTop,
      left: statusBarHorizontal,
      right: statusBarHorizontal,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingHorizontal: Math.max(12, screenWidth * 0.012),
      paddingVertical: Math.max(8, screenHeight * 0.01),
    },
    ipAddress: {
      fontSize: Math.max(12, Math.min(screenWidth * 0.015, screenHeight * 0.025)),
      fontWeight: '600',
      color: '#ffffff',
      letterSpacing: 0.5 * scale,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: {width: 1 * scale, height: 1 * scale},
      textShadowRadius: 3 * scale,
    },
    statusIndicator: {
      width: Math.max(10, Math.min(screenWidth * 0.012, screenHeight * 0.02)),
      height: Math.max(10, Math.min(screenWidth * 0.012, screenHeight * 0.02)),
      borderRadius: Math.max(5, Math.min(screenWidth * 0.006, screenHeight * 0.01)),
      marginLeft: Math.max(10, screenWidth * 0.01),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2 * scale},
      shadowOpacity: 0.4,
      shadowRadius: 4 * scale,
      elevation: 4,
      borderWidth: 2 * scale,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    statusConnected: {
      backgroundColor: '#4caf50',
      shadowColor: '#4caf50',
      shadowOpacity: 0.8,
    },
    statusDisconnected: {
      backgroundColor: '#f44336',
      shadowColor: '#f44336',
      shadowOpacity: 0.8,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Math.max(20, screenWidth * 0.05),
      backgroundColor: '#1a1a1a',
    },
    errorText: {
      fontSize: Math.max(18, screenWidth * 0.04),
      color: '#ff0000',
      textAlign: 'center',
      marginBottom: Math.max(15, screenHeight * 0.02),
    },
    errorDetails: {
      fontSize: Math.max(12, screenWidth * 0.025),
      color: '#ffffff',
      textAlign: 'center',
      fontFamily: 'monospace',
    },
  });
};

export default DisplayScreen;
