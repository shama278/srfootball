/**
 * Сервис для логирования с возможностью просмотра логов в UI
 */
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 500; // Максимальное количество логов
    this.listeners = [];
  }

  /**
   * Добавляет лог
   * @param {string} level Уровень лога (log, error, warn, info)
   * @param {string} message Сообщение
   * @param {any} data Дополнительные данные
   */
  addLog(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data, null, 2) : null,
    };

    this.logs.push(logEntry);

    // Ограничиваем количество логов
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Уведомляем слушателей
    this.listeners.forEach((listener) => {
      try {
        listener(logEntry);
      } catch (error) {
        // Игнорируем ошибки в слушателях
      }
    });
  }

  /**
   * Логирует обычное сообщение
   * @param {string} message Сообщение
   * @param {any} data Дополнительные данные
   */
  log(message, data = null) {
    this.addLog('log', message, data);
  }

  /**
   * Логирует ошибку
   * @param {string} message Сообщение
   * @param {any} data Дополнительные данные
   */
  error(message, data = null) {
    this.addLog('error', message, data);
  }

  /**
   * Логирует предупреждение
   * @param {string} message Сообщение
   * @param {any} data Дополнительные данные
   */
  warn(message, data = null) {
    this.addLog('warn', message, data);
  }

  /**
   * Логирует информационное сообщение
   * @param {string} message Сообщение
   * @param {any} data Дополнительные данные
   */
  info(message, data = null) {
    this.addLog('info', message, data);
  }

  /**
   * Получает все логи
   * @returns {Array} Массив логов
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Очищает все логи
   */
  clearLogs() {
    this.logs = [];
    this.listeners.forEach((listener) => {
      try {
        listener(null); // Уведомляем об очистке
      } catch (error) {
        // Игнорируем ошибки
      }
    });
  }

  /**
   * Подписывается на новые логи
   * @param {Function} callback Функция обратного вызова
   * @returns {Function} Функция для отписки
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Получает логи определенного уровня
   * @param {string} level Уровень лога
   * @returns {Array} Массив логов
   */
  getLogsByLevel(level) {
    return this.logs.filter((log) => log.level === level);
  }
}

// Создаем единственный экземпляр
const logger = new Logger();

export default logger;
