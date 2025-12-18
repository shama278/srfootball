import {getLocalIPAddress, getDefaultWebSocketPort} from './networkUtils';
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
      console.error('[Discovery] UDP модуль не загружен. Проверьте установку react-native-udp');
      throw new Error('UDP модуль (dgram) не инициализирован. Проверьте импорт react-native-udp и пересоберите приложение');
    }
    this.dgram = dgram; // Сохраняем ссылку на модуль в экземпляре класса
    console.log('[Discovery] UDP модуль успешно инициализирован');

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
   * Запускает broadcast для контроллера (ищет табло)
   * Контроллер отправляет "SRFOOTBALL_DISCOVERY" и слушает ответы "SRFOOTBALL_HERE:..."
   * @param {Function} onDeviceFound Колбэк при обнаружении табло (ip, port, deviceName)
   * @returns {Promise<void>}
   */
  startBroadcast(onDeviceFound) {
    if (this.isBroadcasting) {
      return Promise.resolve();
    }

    return new Promise(async (resolve, reject) => {
      try {
        this.onDeviceFound = onDeviceFound;

        // Получаем локальный IP для фильтрации собственных сообщений
        try {
          this.localIP = await getLocalIPAddress();
          console.log(`[Discovery] Контроллер: локальный IP для фильтрации: ${this.localIP || 'не определен'}`);
        } catch (error) {
          console.warn('[Discovery] Контроллер: не удалось получить локальный IP для фильтрации:', error);
          this.localIP = null;
        }

        // Создаем UDP сокет для отправки discovery запросов
        if (!this.dgram || typeof this.dgram.createSocket !== 'function') {
          throw new Error('UDP модуль недоступен в методе startBroadcast');
        }
        this.broadcastSocket = this.dgram.createSocket('udp4');

        this.broadcastSocket.bind(0, '0.0.0.0', () => {
          // Включаем broadcast
          if (this.broadcastSocket && typeof this.broadcastSocket.setBroadcast === 'function') {
            this.broadcastSocket.setBroadcast(true);
          }
          this.isBroadcasting = true;

          console.log(`[Discovery] Контроллер: запущен broadcast для поиска табло`);

          // Отправляем discovery запросы периодически
          let requestCount = 0;
          this.broadcastInterval = setInterval(() => {
            if (!this.broadcastSocket || !this.isBroadcasting) {
              return; // Сокет закрыт или broadcast остановлен
            }
            const message = DISCOVERY_MESSAGE;
            requestCount++;
            // Логируем только каждое 10-е сообщение, чтобы не засорять логи
            if (requestCount % 10 === 0) {
              console.log(`[Discovery] Контроллер: отправлено ${requestCount} discovery запросов, ответов пока нет`);
            }
            const buffer = Buffer.from(message, 'utf8');

            // Отправляем на broadcast адрес
            try {
              this.broadcastSocket.send(
                buffer,
                0,
                buffer.length,
                DISCOVERY_PORT,
                '255.255.255.255',
                (err) => {
                  if (err) {
                    console.error('[Discovery] Контроллер: ошибка при отправке discovery запроса:', err);
                  }
                  // Убираем успешное логирование, чтобы не засорять логи
                }
              );
            } catch (error) {
              console.error('[Discovery] Контроллер: ошибка при отправке:', error);
            }
          }, DISCOVERY_INTERVAL);

          // Отправляем сразу при запуске
          console.log(`[Discovery] Контроллер: отправка первого discovery запроса...`);
          if (this.broadcastSocket) {
            try {
              const initialBuffer = Buffer.from(DISCOVERY_MESSAGE, 'utf8');
              this.broadcastSocket.send(
                initialBuffer,
                0,
                initialBuffer.length,
                DISCOVERY_PORT,
                '255.255.255.255',
                (err) => {
                  if (err) {
                    console.error('[Discovery] Контроллер: ошибка при отправке начального discovery запроса:', err);
                  } else {
                    console.log('[Discovery] Контроллер: отправлен начальный discovery запрос');
                  }
                }
              );
            } catch (error) {
              console.error('[Discovery] Контроллер: ошибка при отправке начального запроса:', error);
            }
          }

          resolve();
        });

        if (this.broadcastSocket && typeof this.broadcastSocket.on === 'function') {
          this.broadcastSocket.on('error', (error) => {
            console.error('[Discovery] Контроллер: ошибка broadcast сокета:', error);
            reject(error);
          });
        }

        // Запускаем прослушивание ответов от табло
        this.startListeningForResponses();
      } catch (error) {
        console.error('[Discovery] Контроллер: ошибка при запуске broadcast:', error);
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

      this.listenSocket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
        // Включаем broadcast для приема
        if (this.listenSocket && typeof this.listenSocket.setBroadcast === 'function') {
          this.listenSocket.setBroadcast(true);
        }

        console.log('[Discovery] Контроллер: начато прослушивание ответов от табло');

        if (this.listenSocket && typeof this.listenSocket.on === 'function') {
          this.listenSocket.on('message', (msg, rinfo) => {
          const buffer = Buffer.from(msg);
          try {
            const messageStr = buffer.toString('utf8').trim();

            // Игнорируем собственные broadcast сообщения (без логирования, чтобы не засорять логи)
            if (this.localIP && rinfo.address === this.localIP) {
              return; // Игнорируем без логирования
            }

            // Также игнорируем discovery запросы (не ответы)
            if (messageStr === DISCOVERY_MESSAGE) {
              return; // Игнорируем без логирования
            }

            // Логируем только реальные сообщения от других устройств
            console.log(`[Discovery] Контроллер: получено сообщение от ${rinfo.address}:${rinfo.port}: "${messageStr}"`);

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
                    // Это новое устройство - логируем и вызываем колбэк
                    console.log(`[Discovery] ========================================`);
                    console.log(`[Discovery] КОНТРОЛЛЕР: НАЙДЕНО ТАБЛО!`);
                    console.log(`[Discovery] Имя устройства: ${deviceName || 'Unknown Device'}`);
                    console.log(`[Discovery] IP адрес: ${serverIP}`);
                    console.log(`[Discovery] Порт WebSocket: ${tcpPort}`);
                    console.log(`[Discovery] Полный адрес: ${serverIP}:${tcpPort}`);
                    console.log(`[Discovery] ========================================`);

                    // Вызываем колбэк
                    if (this.onDeviceFound) {
                      console.log(`[Discovery] Контроллер: вызов колбэка onDeviceFound с адресом ${serverIP}:${tcpPort}`);
                      this.onDeviceFound(serverIP, tcpPort, deviceName);
                    } else {
                      console.warn(`[Discovery] Контроллер: колбэк onDeviceFound не установлен!`);
                    }
                  } else {
                    // Устройство уже было найдено ранее - просто обновляем время
                    console.log(`[Discovery] Контроллер: обновлена информация о табло ${serverIP}:${tcpPort} (уже было найдено ранее)`);
                  }
                } else {
                  console.warn(`[Discovery] Контроллер: некорректный порт в ответе от ${serverIP}: ${parts[1]}`);
                }
              } else {
                console.warn(`[Discovery] Контроллер: некорректный формат ответа от ${rinfo.address}`);
              }
            }
            // Игнорируем другие сообщения
          } catch (error) {
            console.log('[Discovery] Контроллер: ошибка при обработке ответа:', error.message);
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

      // Устанавливаем обработчики событий ДО привязки, чтобы не пропустить события
      if (this.responseListenSocket && typeof this.responseListenSocket.on === 'function') {
        this.responseListenSocket.on('message', (msg, rinfo) => {
          try {
            const buffer = Buffer.from(msg);
            const messageStr = buffer.toString('utf8').trim();

            console.log(`[Discovery] Табло: получено сообщение от ${rinfo.address}:${rinfo.port}: "${messageStr}"`);

            // Проверяем discovery запрос
            if (messageStr === DISCOVERY_MESSAGE) {
              console.log(`[Discovery] Табло: получен discovery запрос от ${rinfo.address}:${rinfo.port}`);

              // Отвечаем на запрос
              this.sendResponse(rinfo.address, rinfo.port, serverIP, serverPort);
            } else {
              console.log(`[Discovery] Табло: неизвестное сообщение: "${messageStr}"`);
            }
          } catch (error) {
            console.error('[Discovery] Табло: ошибка при обработке запроса:', error);
          }
        });

        this.responseListenSocket.on('error', (error) => {
          console.error('[Discovery] Табло: ошибка listen сокета:', error);
        });

        this.responseListenSocket.on('close', () => {
          console.log('[Discovery] Табло: listen сокет закрыт');
        });
      }

      this.responseListenSocket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
        // Включаем broadcast для приема
        if (this.responseListenSocket && typeof this.responseListenSocket.setBroadcast === 'function') {
          this.responseListenSocket.setBroadcast(true);
          console.log('[Discovery] Табло: broadcast включен для listen сокета');
        }
        this.isResponding = true;

        console.log(`[Discovery] Табло: начато прослушивание discovery запросов на порту ${DISCOVERY_PORT}`);
        console.log(`[Discovery] Табло: будет отвечать с IP ${serverIP} и портом ${serverPort}`);
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

        this.responseSocket.bind(0, '0.0.0.0', () => {
          if (this.responseSocket && typeof this.responseSocket.setBroadcast === 'function') {
            this.responseSocket.setBroadcast(true);
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
      console.log(`[Discovery] Табло: отправка ответа "${responseMessage}" на ${clientIP}:${clientPort}`);
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
            } else {
              console.log(`[Discovery] Табло: отправлен ответ на ${clientIP}:${clientPort} (${serverIP}:${serverPort})`);
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
          console.log(`[Discovery] Устройство ${key} удалено (таймаут)`);
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
        this.broadcastSocket.close();
      } catch (error) {
        console.error('[Discovery] Ошибка при закрытии broadcast сокета:', error);
      }
      this.broadcastSocket = null;
    }

    if (this.listenSocket) {
      try {
        this.listenSocket.close();
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
