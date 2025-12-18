import TcpSocket from 'react-native-tcp-socket';
import {getLocalIPAddress, getDefaultWebSocketPort} from './networkUtils';
import logger from './logger';

// Импортируем UdpSocket с проверкой на доступность
let UdpSocket = null;
try {
  const udpModule = require('@ohmi/react-native-udp');
  // Проверяем разные варианты экспорта
  UdpSocket = udpModule.default || udpModule.UdpSocket || udpModule;
  // Проверяем, что это действительно объект с методом createSocket
  if (!UdpSocket || typeof UdpSocket.createSocket !== 'function') {
    logger.error('[Discovery] UdpSocket не содержит метод createSocket');
    UdpSocket = null;
  }
} catch (error) {
  logger.error('[Discovery] Не удалось загрузить @ohmi/react-native-udp:', error?.message || error);
  UdpSocket = null;
}

// Полифилл для Buffer в React Native
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

const DISCOVERY_PORT = 8889; // Порт для UDP broadcast
const DISCOVERY_INTERVAL = 2000; // Отправка каждые 2 секунды
const DISCOVERY_MAGIC = 'SRFOOTBALL_DISPLAY'; // Магическая строка для идентификации табло

/**
 * Сервис для автоматического обнаружения контроллера через UDP broadcast
 */
class DiscoveryService {
  constructor() {
    this.broadcastSocket = null;
    this.listenSocket = null;
    this.broadcastInterval = null;
    this.isBroadcasting = false;
    this.isListening = false;
    this.onControllerFound = null;
  }

  /**
   * Вычисляет broadcast адрес для заданного IP адреса
   * @param {string} ip IP адрес
   * @returns {string} Broadcast адрес
   */
  calculateBroadcastAddress(ip) {
    try {
      const parts = ip.split('.');
      if (parts.length === 4) {
        // Для большинства домашних сетей используем стандартные broadcast адреса
        // В зависимости от диапазона IP
        const firstOctet = parseInt(parts[0], 10);
        const secondOctet = parseInt(parts[1], 10);

        // Стандартные диапазоны
        if (firstOctet === 192 && secondOctet === 168) {
          return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
        } else if (firstOctet === 10) {
          return '10.255.255.255';
        } else if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
          return `${parts[0]}.${parts[1]}.255.255`;
        }
      }
    } catch (error) {
      logger.error('[Discovery] Ошибка при вычислении broadcast адреса:', error);
    }

    // По умолчанию используем глобальный broadcast
    return '255.255.255.255';
  }

  /**
   * Запускает broadcast для табло
   * @param {string} displayIP IP адрес табло
   * @param {number} displayPort Порт WebSocket сервера
   */
  startBroadcast(displayIP, displayPort) {
    if (this.isBroadcasting) {
      return;
    }

    try {
      if (!UdpSocket) {
        logger.error('[Discovery] UdpSocket не доступен (модуль не загружен), broadcast не может быть запущен');
        return;
      }

      if (typeof UdpSocket.createSocket !== 'function') {
        logger.error('[Discovery] UdpSocket не содержит метод createSocket для broadcast. Тип:', typeof UdpSocket);
        return;
      }

      // Создаем UDP сокет для отправки broadcast
      try {
        this.broadcastSocket = UdpSocket.createSocket('udp4');
        if (!this.broadcastSocket) {
          logger.error('[Discovery] createSocket для broadcast вернул null или undefined');
          return;
        }
      } catch (createError) {
        const errorMsg = createError?.message || createError?.toString() || String(createError) || 'Неизвестная ошибка';
        logger.error('[Discovery] Ошибка при создании UDP сокета для broadcast:', errorMsg);
        logger.error('[Discovery] Стек ошибки:', createError?.stack);
        return;
      }

      if (!this.broadcastSocket) {
        logger.error('[Discovery] Не удалось создать UDP сокет для broadcast');
        return;
      }

      this.broadcastSocket.bind(0, () => {
        // Включаем broadcast
        this.broadcastSocket.setBroadcast(true);
        this.isBroadcasting = true;

        // Вычисляем broadcast адрес для сети
        const broadcastAddr = this.calculateBroadcastAddress(displayIP);
        logger.log(`[Discovery] Используется broadcast адрес: ${broadcastAddr} для IP ${displayIP}`);

        // Функция для отправки broadcast сообщения
        const sendBroadcast = (targetAddress) => {
          const message = JSON.stringify({
            magic: DISCOVERY_MAGIC,
            type: 'display',
            ip: displayIP,
            port: displayPort,
            timestamp: Date.now(),
          });

          const buffer = Buffer.from(message, 'utf8');

          // Отправляем на вычисленный broadcast адрес
          this.broadcastSocket.send(
            buffer,
            0,
            buffer.length,
            DISCOVERY_PORT,
            targetAddress,
            (err, bytes) => {
              if (err) {
                // Не логируем каждую ошибку, чтобы не засорять консоль
                // Только периодически
                if (Math.random() < 0.1) { // Логируем только 10% ошибок
                  logger.error('[Discovery] Ошибка при отправке broadcast:', err.message || err);
                }
              } else {
                // Логируем только периодически, чтобы не засорять консоль
                if (Math.random() < 0.1) { // Логируем только 10% успешных отправок
                  logger.log(`[Discovery] Broadcast отправлен на ${targetAddress}: ${displayIP}:${displayPort}`);
                }
              }
            }
          );
        };

        // Отправляем broadcast сообщения периодически
        this.broadcastInterval = setInterval(() => {
          // Пробуем отправить на несколько адресов для надежности
          sendBroadcast(broadcastAddr);
          // Также пробуем глобальный broadcast на случай если сетевой не работает
          if (broadcastAddr !== '255.255.255.255') {
            sendBroadcast('255.255.255.255');
          }
        }, DISCOVERY_INTERVAL);

        // Отправляем сразу при запуске
        sendBroadcast(broadcastAddr);
        if (broadcastAddr !== '255.255.255.255') {
          sendBroadcast('255.255.255.255');
        }
      });

      this.broadcastSocket.on('error', (error) => {
        // Не критичная ошибка, просто логируем
        logger.error('[Discovery] Ошибка broadcast сокета:', error.message || error);
        // Не останавливаем broadcast при ошибках, так как это может быть временная проблема
      });
    } catch (error) {
      logger.error('[Discovery] Ошибка при запуске broadcast:', error.message || error);
      // Не выбрасываем ошибку, чтобы не блокировать работу приложения
    }
  }

  /**
   * Останавливает broadcast
   */
  stopBroadcast() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.broadcastSocket) {
      try {
        this.broadcastSocket.close();
      } catch (error) {
        logger.error('[Discovery] Ошибка при закрытии broadcast сокета:', error);
      }
      this.broadcastSocket = null;
    }

    this.isBroadcasting = false;
  }

  /**
   * Начинает слушать broadcast сообщения от табло
   * @param {Function} onDisplayFound Колбэк при обнаружении табло (ip, port)
   * @returns {Promise<void>}
   */
  startListening(onDisplayFound) {
    if (this.isListening) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        if (!UdpSocket) {
          const errorMsg = 'UdpSocket не доступен (модуль не загружен), прослушивание не может быть запущено';
          logger.error('[Discovery] ' + errorMsg);
          this.isListening = false;
          resolve(); // Разрешаем промис, чтобы не блокировать UI
          return;
        }

        if (typeof UdpSocket.createSocket !== 'function') {
          logger.error('[Discovery] UdpSocket не содержит метод createSocket. Тип:', typeof UdpSocket, 'Ключи:', Object.keys(UdpSocket || {}));
          this.isListening = false;
          resolve(); // Разрешаем промис, чтобы не блокировать UI
          return;
        }

        this.onControllerFound = onDisplayFound;

        // Создаем UDP сокет для приема broadcast
        try {
          this.listenSocket = UdpSocket.createSocket('udp4');
          if (!this.listenSocket) {
            logger.error('[Discovery] createSocket вернул null или undefined');
            this.isListening = false;
            resolve(); // Разрешаем промис, чтобы не блокировать UI
            return;
          }
        } catch (createError) {
          const errorMsg = createError?.message || createError?.toString() || String(createError) || 'Неизвестная ошибка';
          logger.error('[Discovery] Ошибка при создании UDP сокета:', errorMsg);
          logger.error('[Discovery] Стек ошибки:', createError?.stack);
          this.isListening = false;
          resolve(); // Разрешаем промис, чтобы не блокировать UI
          return;
        }

        if (!this.listenSocket) {
          const errorMsg = 'Не удалось создать UDP сокет для прослушивания';
          logger.error('[Discovery] ' + errorMsg);
          this.isListening = false;
          resolve(); // Разрешаем промис, чтобы не блокировать UI
          return;
        }

        this.listenSocket.bind(DISCOVERY_PORT, () => {
          // Включаем broadcast для приема
          this.listenSocket.setBroadcast(true);
          this.isListening = true;

          logger.log('[Discovery] Начато прослушивание broadcast сообщений на порту', DISCOVERY_PORT);

          this.listenSocket.on('message', (buffer, rinfo) => {
            try {
              const messageStr = buffer.toString('utf8');
              const message = JSON.parse(messageStr);

              // Проверяем магическую строку
              if (message.magic === DISCOVERY_MAGIC && message.type === 'display') {
                logger.log(
                  `[Discovery] Найдено табло: ${message.ip}:${message.port} от ${rinfo.address}`
                );

                if (this.onControllerFound) {
                  this.onControllerFound(message.ip, message.port);
                }
              }
            } catch (error) {
              // Игнорируем некорректные сообщения
              const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
              logger.log('[Discovery] Получено некорректное сообщение:', errorMsg);
            }
          });

          this.listenSocket.on('error', (error) => {
            // Не отклоняем промис при ошибках после успешного запуска
            // Это может быть нормально при проблемах с сетью
            const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
            logger.error('[Discovery] Ошибка listen сокета:', errorMsg);
            // Не вызываем reject, так как это может быть временная проблема
          });

          // Разрешаем промис успешно, даже если могут быть ошибки
          resolve();
        });

        this.listenSocket.on('error', (error) => {
          // Ошибка при привязке - это критично
          const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
          logger.error('[Discovery] Ошибка при привязке listen сокета:', errorMsg);
          // Не отклоняем промис, чтобы не блокировать работу при раздаче Wi-Fi
          // Вместо этого просто логируем ошибку
          this.isListening = false;
          resolve(); // Разрешаем промис, чтобы не блокировать UI
        });
      } catch (error) {
        const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
        logger.error('[Discovery] Ошибка при запуске прослушивания:', errorMsg);
        // Не отклоняем промис, чтобы не блокировать работу
        this.isListening = false;
        resolve(); // Разрешаем промис, чтобы не блокировать UI
      }
    });
  }

  /**
   * Останавливает прослушивание
   */
  stopListening() {
    if (this.listenSocket) {
      try {
        this.listenSocket.close();
      } catch (error) {
        logger.error('[Discovery] Ошибка при закрытии listen сокета:', error);
      }
      this.listenSocket = null;
    }

    this.isListening = false;
    this.onControllerFound = null;
  }

  /**
   * Останавливает все сервисы
   */
  stop() {
    this.stopBroadcast();
    this.stopListening();
  }
}

export default DiscoveryService;
