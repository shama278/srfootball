import {getLocalIPAddress, getDefaultWebSocketPort, getBroadcastAddress} from './networkUtils';
import {Platform} from 'react-native';
import {Buffer} from 'buffer';

// Импорт UDP модуля - используем react-native-udp (более стабильный модуль)
import dgram from 'react-native-udp';

const DISCOVERY_PORT = 41234; // Порт для UDP discovery (как указано в требованиях)
const DISCOVERY_INTERVAL = 500; // Отправка каждые 500ms для быстрого обнаружения
const DISCOVERY_MESSAGE = 'SRFOOTBALL_DISCOVERY'; // Сообщение от контроллера (ищет табло)
const DISCOVERY_RESPONSE_PREFIX = 'SRFOOTBALL_HERE:'; // Префикс ответа от табло

/**
 * Сервис для автоматического обнаружения устройств через UDP broadcast/multicast
 * Архитектура:
 * - CONTROLLER (контроллер) отправляет "SRFOOTBALL_DISCOVERY" в сеть и слушает ответы
 * - DISPLAY (табло) слушает "SRFOOTBALL_DISCOVERY" и отвечает "SRFOOTBALL_HERE:<deviceName>:<tcpPort>"
 */
class DiscoveryService {
  constructor() {
    // Сохраняем ссылку на dgram модуль
    if (!dgram || typeof dgram.createSocket !== 'function') {
      throw new Error('UDP модуль (dgram) не инициализирован. Проверьте импорт react-native-udp и пересоберите приложение');
    }
    this.dgram = dgram; // Сохраняем ссылку на модуль в экземпляре класса

    // Для контроллера (отправляет запросы и слушает ответы)
    this.broadcastSocket = null; // UDP сокет для отправки discovery запросов (контроллер)
    this.listenSocket = null; // UDP сокет для приема ответов от табло (контроллер)
    this.broadcastInterval = null;
    this.isBroadcasting = false; // Контроллер отправляет discovery запросы

    // Для табло (слушает запросы и отвечает)
    this.responseListenSocket = null; // UDP сокет для приема discovery запросов (табло)
    this.responseSocket = null; // UDP сокет для отправки ответов (табло)
    this.isResponding = false; // Табло отвечает на discovery запросы

    this.onDeviceFound = null; // Колбэк при обнаружении устройства (для контроллера)
    this.foundDevices = new Map(); // Map<deviceKey, {ip, port, deviceName, lastSeen}>
    this.deviceName = Platform.OS === 'android' ? 'Android Device' : 'iOS Device';
    this.cleanupInterval = null;
    this.localIP = null; // Кэшируем локальный IP для фильтрации собственных сообщений
  }

  /**
   * Устанавливает имя устройства
   * @param {string} name Имя устройства
   */
  setDeviceName(name) {
    this.deviceName = name || this.deviceName;
  }

  /**
   * Отправляет discovery запрос на конкретный IP адрес (для тестирования)
   * @param {string} targetIP IP адрес для отправки запроса
   */
  sendDiscoveryToIP(targetIP) {
    if (!this.broadcastSocket || !this.isBroadcasting) {
      return;
    }

    try {
      const buffer = Buffer.from(DISCOVERY_MESSAGE, 'utf8');
      this.broadcastSocket.send(
        buffer,
        0,
        buffer.length,
        DISCOVERY_PORT,
        targetIP,
        (err) => {
        }
      );
    } catch (error) {
    }
  }

  /**
   * Запускает broadcast для контроллера (ищет табло)
   * Контроллер отправляет "SRFOOTBALL_DISCOVERY" и слушает ответы "SRFOOTBALL_HERE:..."
   * @param {Function} onDeviceFound Колбэк при обнаружении табло (ip, port, deviceName)
   * @param {string|null} knownIP Известный IP адрес табло (для дополнительной отправки запросов)
   * @returns {Promise<void>}
   */
  startBroadcast(onDeviceFound, knownIP = null) {
    if (this.isBroadcasting) {
      return Promise.resolve();
    }

    return new Promise(async (resolve, reject) => {
      try {
        this.onDeviceFound = onDeviceFound;

        // Получаем локальный IP для фильтрации собственных сообщений
        try {
          this.localIP = await getLocalIPAddress();
        } catch (error) {
          this.localIP = null;
        }

        // Создаем UDP сокет для отправки discovery запросов
        if (!this.dgram || typeof this.dgram.createSocket !== 'function') {
          throw new Error('UDP модуль недоступен в методе startBroadcast');
        }
        this.broadcastSocket = this.dgram.createSocket('udp4');

        // Флаг для отслеживания состояния сокета
        let socketClosed = false;

        // Устанавливаем обработчик закрытия сокета ДО bind
        if (this.broadcastSocket && typeof this.broadcastSocket.on === 'function') {
          this.broadcastSocket.on('close', () => {
            socketClosed = true;
          });
        }

        this.broadcastSocket.bind(0, '0.0.0.0', () => {
          // Проверяем, что сокет еще не закрыт и broadcast еще активен
          if (!this.broadcastSocket || !this.isBroadcasting || socketClosed) {
            return; // Сокет уже закрыт или broadcast остановлен
          }

          // Включаем broadcast с проверкой состояния сокета
          try {
            if (this.broadcastSocket && typeof this.broadcastSocket.setBroadcast === 'function' && !socketClosed) {
              // Проверяем, не закрыт ли сокет перед вызовом setBroadcast
              // В react-native-udp нет прямого способа проверить состояние, но можно попробовать
              // Если сокет закрыт, setBroadcast выбросит ошибку, которую мы перехватим
              try {
                this.broadcastSocket.setBroadcast(true);
              } catch (setBroadcastError) {
                // Сокет закрыт или недоступен - игнорируем ошибку
                // Не логируем, так как это нормально при переподключении
                return;
              }
            }
          } catch (broadcastError) {
            // Игнорируем ошибки установки broadcast (сокет может быть уже закрыт)
            return;
          }

          // Проверяем еще раз перед установкой флага
          if (!this.broadcastSocket || !this.isBroadcasting) {
            return;
          }

          this.isBroadcasting = true;

          // Вычисляем broadcast адрес сети
          const broadcastAddresses = ['255.255.255.255']; // Всегда отправляем на глобальный broadcast
          if (this.localIP) {
            const computedBroadcast = getBroadcastAddress(this.localIP);
            if (computedBroadcast && !broadcastAddresses.includes(computedBroadcast)) {
              broadcastAddresses.push(computedBroadcast);
            }
          }
          // Если известен IP табло, добавляем его для прямых запросов
          if (knownIP && !broadcastAddresses.includes(knownIP)) {
            broadcastAddresses.push(knownIP);
          }

          // Отправляем discovery запросы периодически
          let requestCount = 0;
          this.broadcastInterval = setInterval(() => {
            if (!this.broadcastSocket || !this.isBroadcasting) {
              return; // Сокет закрыт или broadcast остановлен
            }
            const message = DISCOVERY_MESSAGE;
            requestCount++;
            const buffer = Buffer.from(message, 'utf8');

            // Отправляем на все broadcast адреса для максимальной надежности
            broadcastAddresses.forEach((broadcastAddress) => {
              try {
                this.broadcastSocket.send(
                  buffer,
                  0,
                  buffer.length,
                  DISCOVERY_PORT,
                  broadcastAddress,
                  (err) => {
                  }
                );
              } catch (error) {
              }
            });
          }, DISCOVERY_INTERVAL);

          // Отправляем сразу при запуске на все адреса
          if (this.broadcastSocket) {
            const initialBuffer = Buffer.from(DISCOVERY_MESSAGE, 'utf8');
            broadcastAddresses.forEach((broadcastAddress) => {
              try {
                this.broadcastSocket.send(
                  initialBuffer,
                  0,
                  initialBuffer.length,
                  DISCOVERY_PORT,
                  broadcastAddress,
                  (err) => {
                  }
                );
              } catch (error) {
              }
            });
          }

          resolve();
        });

        if (this.broadcastSocket && typeof this.broadcastSocket.on === 'function') {
          this.broadcastSocket.on('error', (error) => {
            reject(error);
          });
        }

        // Запускаем прослушивание ответов от табло
        this.startListeningForResponses();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Контроллер слушает ответы от табло
   */
  startListeningForResponses() {
    if (this.listenSocket) {
      return;
    }

    try {
      // Создаем UDP сокет для приема ответов от табло
      if (!this.dgram || typeof this.dgram.createSocket !== 'function') {
        throw new Error('UDP модуль недоступен в методе startListeningForResponses');
      }
      this.listenSocket = this.dgram.createSocket('udp4');

      // Флаг для отслеживания состояния сокета
      let listenSocketClosed = false;

      // Устанавливаем обработчик закрытия сокета ДО bind
      if (this.listenSocket && typeof this.listenSocket.on === 'function') {
        this.listenSocket.on('close', () => {
          listenSocketClosed = true;
        });
      }

      this.listenSocket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
        // Проверяем, что сокет еще существует и не закрыт
        if (!this.listenSocket || listenSocketClosed) {
          return; // Сокет уже закрыт
        }

        // Включаем broadcast для приема с защитой от ошибок
        try {
          if (this.listenSocket && typeof this.listenSocket.setBroadcast === 'function' && !listenSocketClosed) {
            try {
              this.listenSocket.setBroadcast(true);
            } catch (setBroadcastError) {
              // Сокет закрыт или недоступен - игнорируем ошибку
              // Не логируем, так как это нормально при переподключении
              return;
            }
          }
        } catch (broadcastError) {
          // Игнорируем ошибки установки broadcast (сокет может быть уже закрыт)
          return;
        }

        if (this.listenSocket && typeof this.listenSocket.on === 'function') {
          this.listenSocket.on('message', (msg, rinfo) => {
          const buffer = Buffer.from(msg);
          try {
            const messageStr = buffer.toString('utf8').trim();

            // Игнорируем собственные broadcast сообщения
            if (this.localIP && rinfo.address === this.localIP) {
              return;
            }

            // Также игнорируем discovery запросы (не ответы)
            if (messageStr === DISCOVERY_MESSAGE) {
              return;
            }

            // Проверяем формат ответа: "SRFOOTBALL_HERE:<deviceName>:<tcpPort>"
            if (messageStr.startsWith(DISCOVERY_RESPONSE_PREFIX)) {
              const responseData = messageStr.substring(DISCOVERY_RESPONSE_PREFIX.length);
              const parts = responseData.split(':');

              if (parts.length >= 2) {
                const deviceName = parts[0];
                const tcpPort = parseInt(parts[1], 10);
                const serverIP = rinfo.address;

                if (!isNaN(tcpPort) && tcpPort > 0 && tcpPort < 65536) {
                  const deviceKey = `${serverIP}:${tcpPort}`;

                  // Проверяем, не нашли ли мы уже это устройство
                  const alreadyFound = this.foundDevices.has(deviceKey);

                  // Обновляем информацию об устройстве
                  this.foundDevices.set(deviceKey, {
                    ip: serverIP,
                    port: tcpPort,
                    deviceName: deviceName || 'Unknown Device',
                    lastSeen: Date.now(),
                  });

                  if (!alreadyFound) {
                    // Это новое устройство - вызываем колбэк
                    if (this.onDeviceFound) {
                      this.onDeviceFound(serverIP, tcpPort, deviceName);
                    }
                  }
                }
              }
            }
          } catch (error) {
          }
          });

          this.listenSocket.on('error', (error) => {
            console.error('[Discovery] Контроллер: ошибка listen сокета:', error);
          });
        }
      });

      if (this.listenSocket && typeof this.listenSocket.on === 'function') {
        this.listenSocket.on('error', (error) => {
          console.error('[Discovery] Контроллер: ошибка при привязке listen сокета:', error);
        });
      }

      // Запускаем очистку устаревших устройств
      this.startCleanup();
    } catch (error) {
      console.error('[Discovery] Контроллер: ошибка при запуске прослушивания:', error);
    }
  }

  /**
   * Табло начинает слушать discovery запросы от контроллера и отвечать на них
   * @param {string} serverIP IP адрес табло
   * @param {number} serverPort Порт WebSocket сервера табло
   */
  startResponding(serverIP, serverPort) {
    if (this.isResponding) {
      return;
    }

    try {
      // Создаем UDP сокет для приема discovery запросов
      if (!this.dgram || typeof this.dgram.createSocket !== 'function') {
        throw new Error('UDP модуль недоступен в методе startResponding');
      }
      this.responseListenSocket = this.dgram.createSocket('udp4');

      // Флаг для отслеживания состояния сокета
      let responseListenSocketClosed = false;

      // Устанавливаем обработчики событий ДО привязки, чтобы не пропустить события
      if (this.responseListenSocket && typeof this.responseListenSocket.on === 'function') {
        this.responseListenSocket.on('message', (msg, rinfo) => {
          try {
            const buffer = Buffer.from(msg);
            const messageStr = buffer.toString('utf8').trim();

            // Проверяем discovery запрос
            if (messageStr === DISCOVERY_MESSAGE) {
              // Отвечаем на запрос
              this.sendResponse(rinfo.address, rinfo.port, serverIP, serverPort);
            }
          } catch (error) {
            console.error('[Discovery] Табло: ошибка при обработке запроса:', error);
          }
        });

        this.responseListenSocket.on('error', (error) => {
          console.error('[Discovery] Табло: ошибка listen сокета:', error);
        });

        this.responseListenSocket.on('close', () => {
          responseListenSocketClosed = true;
        });
      }

      this.responseListenSocket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
        // Проверяем, что сокет еще существует и не закрыт
        if (!this.responseListenSocket || responseListenSocketClosed) {
          return; // Сокет уже закрыт
        }

        // Включаем broadcast для приема с защитой от ошибок
        try {
          if (this.responseListenSocket && typeof this.responseListenSocket.setBroadcast === 'function' && !responseListenSocketClosed) {
            try {
              this.responseListenSocket.setBroadcast(true);
            } catch (setBroadcastError) {
              // Сокет закрыт или недоступен - игнорируем ошибку
              // Не логируем, так как это нормально при переподключении
              return;
            }
          }
        } catch (broadcastError) {
          // Игнорируем ошибки установки broadcast (сокет может быть уже закрыт)
          return;
        }

        // Проверяем еще раз перед установкой флага
        if (!this.responseListenSocket) {
          return;
        }

        this.isResponding = true;

      });

      // Обработчики уже установлены выше, перед bind
    } catch (error) {
      console.error('[Discovery] Табло: ошибка при запуске прослушивания:', error);
    }
  }

  /**
   * Табло отправляет ответ на discovery запрос
   * @param {string} clientIP IP адрес контроллера
   * @param {number} clientPort Порт контроллера
   * @param {string} serverIP IP адрес табло
   * @param {number} serverPort Порт WebSocket сервера табло
   */
  sendResponse(clientIP, clientPort, serverIP, serverPort) {
    try {
      // Создаем временный сокет для отправки ответа
      if (!this.responseSocket) {
        if (!this.dgram || typeof this.dgram.createSocket !== 'function') {
          throw new Error('UDP модуль недоступен в методе sendResponse');
        }
        this.responseSocket = this.dgram.createSocket('udp4');

        // Флаг для отслеживания состояния сокета
        let responseSocketClosed = false;

        // Устанавливаем обработчик закрытия сокета ДО bind
        if (this.responseSocket && typeof this.responseSocket.on === 'function') {
          this.responseSocket.on('close', () => {
            responseSocketClosed = true;
          });
        }

        this.responseSocket.bind(0, '0.0.0.0', () => {
          // Проверяем, что сокет еще существует и не закрыт
          if (!this.responseSocket || responseSocketClosed) {
            return; // Сокет уже закрыт
          }

          // Включаем broadcast с защитой от ошибок
          try {
            if (this.responseSocket && typeof this.responseSocket.setBroadcast === 'function' && !responseSocketClosed) {
              try {
                this.responseSocket.setBroadcast(true);
              } catch (setBroadcastError) {
                // Сокет закрыт или недоступен - игнорируем ошибку
                // Не логируем, так как это нормально при переподключении
                return;
              }
            }
          } catch (broadcastError) {
            // Игнорируем ошибки установки broadcast (сокет может быть уже закрыт)
            return;
          }
        });

        if (this.responseSocket && typeof this.responseSocket.on === 'function') {
          this.responseSocket.on('error', (error) => {
            console.error('[Discovery] Табло: ошибка response сокета:', error);
          });
        }
      }

      if (!this.responseSocket) {
        console.error('[Discovery] Табло: responseSocket не создан');
        return;
      }

      const responseMessage = `${DISCOVERY_RESPONSE_PREFIX}${this.deviceName}:${serverPort}`;
      const buffer = Buffer.from(responseMessage, 'utf8');

      // Отвечаем на DISCOVERY_PORT, иначе при broadcast с эфемерного порта
      // ответы улетают туда, где контроллер не слушает, и discovery не срабатывает.
      try {
        this.responseSocket.send(
          buffer,
          0,
          buffer.length,
          DISCOVERY_PORT,
          clientIP,
          (err) => {
            if (err) {
              console.error('[Discovery] Табло: ошибка при отправке ответа:', err);
            }
          }
        );
      } catch (error) {
        console.error('[Discovery] Табло: ошибка при отправке ответа:', error);
      }
    } catch (error) {
      console.error('[Discovery] Табло: ошибка при отправке ответа:', error);
    }
  }

  /**
   * Запускает периодическую очистку устаревших устройств
   */
  startCleanup() {
    if (this.cleanupInterval) {
      return;
    }

    // Очищаем устройства, которые не отвечали более 10 секунд
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 10000; // 10 секунд

      this.foundDevices.forEach((device, key) => {
        if (now - device.lastSeen > timeout) {
          this.foundDevices.delete(key);
        }
      });
    }, 5000); // Проверяем каждые 5 секунд
  }

  /**
   * Получает список найденных устройств
   * @returns {Array<{ip: string, port: number, deviceName: string, lastSeen: number}>}
   */
  getFoundDevices() {
    return Array.from(this.foundDevices.values());
  }

  /**
   * Останавливает broadcast (контроллер)
   */
  stopBroadcast() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.broadcastSocket) {
      try {
        // Удаляем все обработчики перед закрытием, чтобы избежать ошибок
        try {
          if (this.broadcastSocket.removeAllListeners) {
            this.broadcastSocket.removeAllListeners();
          }
        } catch (e) {
          // Игнорируем ошибки при удалении обработчиков
        }
        // Проверяем, не закрыт ли уже сокет
        try {
          if (this.broadcastSocket.close && typeof this.broadcastSocket.close === 'function') {
            this.broadcastSocket.close();
          }
        } catch (closeError) {
          // Игнорируем ошибки при закрытии
        }
      } catch (error) {
        console.error('[Discovery] Ошибка при закрытии broadcast сокета:', error);
      }
      this.broadcastSocket = null;
    }

    if (this.listenSocket) {
      try {
        // Удаляем все обработчики перед закрытием
        try {
          if (this.listenSocket.removeAllListeners) {
            this.listenSocket.removeAllListeners();
          }
        } catch (e) {
          // Игнорируем ошибки при удалении обработчиков
        }
        // Проверяем, не закрыт ли уже сокет
        try {
          if (this.listenSocket.close && typeof this.listenSocket.close === 'function') {
            this.listenSocket.close();
          }
        } catch (closeError) {
          // Игнорируем ошибки при закрытии
        }
      } catch (error) {
        console.error('[Discovery] Ошибка при закрытии listen сокета:', error);
      }
      this.listenSocket = null;
    }

    this.isBroadcasting = false;
  }

  /**
   * Останавливает прослушивание и ответы (табло)
   */
  stopResponding() {
    if (this.responseListenSocket) {
      try {
        this.responseListenSocket.close();
      } catch (error) {
        console.error('[Discovery] Ошибка при закрытии response listen сокета:', error);
      }
      this.responseListenSocket = null;
    }

    if (this.responseSocket) {
      try {
        this.responseSocket.close();
      } catch (error) {
        console.error('[Discovery] Ошибка при закрытии response сокета:', error);
      }
      this.responseSocket = null;
    }

    this.isResponding = false;
  }

  /**
   * Останавливает очистку
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Останавливает все сервисы
   */
  stop() {
    this.stopBroadcast();
    this.stopResponding();
    this.stopCleanup();
    this.foundDevices.clear();
  }
}

export default DiscoveryService;
