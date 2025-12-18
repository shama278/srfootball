import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getRecommendedMode, APP_MODES} from '../utils/deviceDetection';

const MODE_STORAGE_KEY = 'app_mode';

/**
 * Экран выбора режима работы приложения
 */
const ModeSelectorScreen = ({onModeSelected}) => {
  const [loading, setLoading] = useState(true);
  const [recommendedMode, setRecommendedMode] = useState(null);

  useEffect(() => {
    loadSavedMode();
  }, []);

  const loadSavedMode = async () => {
    try {
      // Пытаемся загрузить сохраненный режим
      const savedMode = await AsyncStorage.getItem(MODE_STORAGE_KEY);
      if (savedMode && (savedMode === APP_MODES.CONTROLLER || savedMode === APP_MODES.DISPLAY)) {
        onModeSelected(savedMode);
        return;
      }

      // Если сохраненного режима нет, определяем рекомендуемый
      const recommended = await getRecommendedMode();
      setRecommendedMode(recommended);
    } catch (error) {
      console.error('Ошибка при загрузке режима:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelect = async (mode) => {
    try {
      await AsyncStorage.setItem(MODE_STORAGE_KEY, mode);
      onModeSelected(mode);
    } catch (error) {
      console.error('Ошибка при сохранении режима:', error);
      // Продолжаем даже при ошибке сохранения
      onModeSelected(mode);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text style={styles.title}>Выберите режим работы</Text>
        <Text style={styles.subtitle}>
          {recommendedMode === APP_MODES.DISPLAY
            ? 'Рекомендуется режим "Табло"'
            : recommendedMode === APP_MODES.CONTROLLER
            ? 'Рекомендуется режим "Контроллер"'
            : 'Выберите режим работы приложения'}
        </Text>

        <TouchableOpacity
          style={[
            styles.modeButton,
            styles.controllerButton,
            recommendedMode === APP_MODES.CONTROLLER && styles.recommendedButton,
          ]}
          onPress={() => handleModeSelect(APP_MODES.CONTROLLER)}
          activeOpacity={0.8}>
          <Text style={styles.modeButtonIcon}>📱</Text>
          <Text style={styles.modeButtonTitle}>Контроллер</Text>
          <Text style={styles.modeButtonDescription}>
            Управление табло с планшета
          </Text>
          {recommendedMode === APP_MODES.CONTROLLER && (
            <Text style={styles.recommendedLabel}>Рекомендуется</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            styles.displayButton,
            recommendedMode === APP_MODES.DISPLAY && styles.recommendedButton,
          ]}
          onPress={() => handleModeSelect(APP_MODES.DISPLAY)}
          activeOpacity={0.8}>
          <Text style={styles.modeButtonIcon}>📺</Text>
          <Text style={styles.modeButtonTitle}>Табло</Text>
          <Text style={styles.modeButtonDescription}>
            Отображение табло на телевизоре
          </Text>
          {recommendedMode === APP_MODES.DISPLAY && (
            <Text style={styles.recommendedLabel}>Рекомендуется</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          Выбранный режим будет сохранен и использоваться при следующих запусках
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  modeButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  recommendedButton: {
    borderColor: '#2196f3',
    backgroundColor: '#e3f2fd',
  },
  controllerButton: {},
  displayButton: {},
  modeButtonIcon: {
    fontSize: 64,
    marginBottom: 15,
  },
  modeButtonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modeButtonDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  recommendedLabel: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#2196f3',
  },
  note: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
});

export default ModeSelectorScreen;
