import React from 'react';
import {View, Text, StyleSheet, SafeAreaView} from 'react-native';

/**
 * Компонент для перехвата ошибок React и предотвращения крашей приложения
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, error: null, errorInfo: null};
  }

  static getDerivedStateFromError(error) {
    // Обновляем состояние так, чтобы следующий рендер показал запасной UI
    return {hasError: true};
  }

  componentDidCatch(error, errorInfo) {
    // Детальное логирование ошибки
    console.error('[ErrorBoundary] Поймана ошибка:', error);
    console.error('[ErrorBoundary] Сообщение:', error?.message);
    console.error('[ErrorBoundary] Stack:', error?.stack);
    console.error('[ErrorBoundary] Component Stack:', errorInfo?.componentStack);
    console.error('[ErrorBoundary] Полная информация:', JSON.stringify(errorInfo, null, 2));

    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Можно также отправить ошибку в сервис отчетов об ошибках
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Можно отрендерить любой запасной UI
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Произошла ошибка</Text>
            <Text style={styles.errorText}>
              Приложение столкнулось с неожиданной ошибкой.
            </Text>
            {this.state.error && (
              <>
                <Text style={styles.errorDetails}>
                  {this.state.error.toString()}
                </Text>
                {this.state.error.message && (
                  <Text style={styles.errorDetails}>
                    {this.state.error.message}
                  </Text>
                )}
                {this.state.error.stack && (
                  <Text style={[styles.errorDetails, {fontSize: 10, maxHeight: 200}]} numberOfLines={20}>
                    {this.state.error.stack}
                  </Text>
                )}
              </>
            )}
            <Text style={styles.errorHint}>
              Приложение продолжит работу, но могут быть проблемы с функциональностью
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorDetails: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  errorHint: {
    fontSize: 16,
    color: '#4caf50',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default ErrorBoundary;
