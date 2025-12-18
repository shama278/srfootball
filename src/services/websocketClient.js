import TcpSocket from 'react-native-tcp-socket';
import logger from './logger';

// Полифилл для Buffer в React Native
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

/**
 * Генерирует случайный ключ для WebSocket handshake
 * @returns {string} Base64 строка (16 байт)
 */
const generateWebSocketKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let key = '';
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Конвертируем в Base64 (упрощенная версия)
  const bytes = [];
  for (let i = 0; i < key.length; i++) {
    bytes.push(key.charCodeAt(i));
  }

  // Простая Base64 кодировка для 16 байт
  const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] || 0;
    const b3 = bytes[i + 2] || 0;
    const bitmap = (b1 << 16) | (b2 << 8) | b3;
    result += base64chars.charAt((bitmap >> 18) & 63);
    result += base64chars.charAt((bitmap >> 12) & 63);
    result += i + 1 < bytes.length ? base64chars.charAt((bitmap >> 6) & 63) : '=';
    result += i + 2 < bytes.length ? base64chars.charAt(bitmap & 63) : '=';
  }
  return result;
};

/**
 * Парсит WebSocket frame (сервер не маскирует данные)
 * @param {Buffer} buffer Буфер с данными
 * @returns {Object|null} Распарсенный frame или null
 */
const parseWebSocketFrame = (buffer) => {
  if (buffer.length < 2) {
    return null;
  }

  const firstByte = buffer[0];
  const secondByte = buffer[1];

  const fin = (firstByte & 0x80) !== 0;
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;

  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    // Для упрощения не поддерживаем 64-битные длины
    return null;
  }

  // Сервер не должен маскировать данные, но проверим
  if (masked) {
    if (buffer.length < offset + 4) return null;
    offset += 4; // Пропускаем masking key
  }

  if (buffer.length < offset + payloadLength) {
    return null; // Неполный frame
  }

  const payload = buffer.slice(offset, offset + payloadLength);

  return {
    fin,
    opcode,
    masked,
    payloadLength,
    payload,
  };
};

/**
 * Создает WebSocket frame (клиент должен маскировать данные)
 * @param {string|Buffer} data Данные для отправки
 * @param {number} opcode Код операции (1 для текста, 2 для бинарных данных)
 * @returns {Buffer} WebSocket frame
 */
const createWebSocketFrame = (data, opcode = 0x1) => {
  const isString = typeof data === 'string';
  const payload = isString ? Buffer.from(data, 'utf8') : data;
  const payloadLength = payload.length;

  // Генерируем masking key (4 байта)
  const maskingKey = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    maskingKey[i] = Math.floor(Math.random() * 256);
  }

  // Маскируем payload
  const maskedPayload = Buffer.from(payload);
  for (let i = 0; i < maskedPayload.length; i++) {
    maskedPayload[i] = maskedPayload[i] ^ maskingKey[i % 4];
  }

  let frame = Buffer.alloc(2);
  frame[0] = 0x80 | opcode; // FIN = 1, opcode
  frame[1] = 0x80; // MASK = 1

  if (payloadLength < 126) {
    frame[1] = 0x80 | payloadLength;
    frame = Buffer.concat([frame, maskingKey, maskedPayload]);
  } else if (payloadLength < 65536) {
    frame[1] = 0x80 | 126;
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(payloadLength, 0);
    frame = Buffer.concat([frame, lengthBuffer, maskingKey, maskedPayload]);
  } else {
    // Для больших сообщений (не реализовано полностью)
    frame[1] = 0x80 | 127;
    const lengthBuffer = Buffer.alloc(8);
    lengthBuffer.writeUInt32BE(0, 0);
    lengthBuffer.writeUInt32BE(payloadLength, 4);
    frame = Buffer.concat([frame, lengthBuffer, maskingKey, maskedPayload]);
  }

  return frame;
};

/**
 * Парсит HTTP ответ для WebSocket handshake
 * @param {string} response HTTP ответ от сервера
 * @param {string} expectedKey Ожидаемый Sec-WebSocket-Accept ключ
 * @returns {boolean} true если handshake успешен
 */
const parseHandshakeResponse = (response, expectedKey) => {
  if (!response.includes('HTTP/1.1 101')) {
    return false;
  }

  const acceptMatch = response.match(/Sec-WebSocket-Accept:\s*(.+)/i);
  if (!acceptMatch) {
    return false;
  }

  const acceptKey = acceptMatch[1].trim();
  return acceptKey === expectedKey;
};

class WebSocketClient {
  constructor(host, port = 8080) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.buffer = Buffer.alloc(0);
    this.webSocketKey = null;
    this.expectedAcceptKey = null;
    this.onOpenCallback = null;
    this.onMessageCallback = null;
    this.onErrorCallback = null;
    this.onCloseCallback = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.reconnectTimer = null;
  }

  /**
   * Вычисляет ожидаемый Sec-WebSocket-Accept ключ
   * @param {string} key Sec-WebSocket-Key
   * @returns {Promise<string>} Ожидаемый Sec-WebSocket-Accept
   */
  async calculateAcceptKey(key) {
    const WS_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

    // SHA1 хеширование
    const sha1 = (message) => {
      function rotateLeft(n, s) {
        return (n << s) | (n >>> (32 - s));
      }

      function toHexStr(n) {
        let s = '';
        for (let i = 7; i >= 0; i--) {
          const v = (n >>> (i * 4)) & 0x0f;
          s += v.toString(16);
        }
        return s;
      }

      const msgBytes = [];
      for (let i = 0; i < message.length; i++) {
        const charCode = message.charCodeAt(i);
        if (charCode < 0x80) {
          msgBytes.push(charCode);
        } else if (charCode < 0x800) {
          msgBytes.push(0xc0 | (charCode >> 6));
          msgBytes.push(0x80 | (charCode & 0x3f));
        } else {
          msgBytes.push(0xe0 | (charCode >> 12));
          msgBytes.push(0x80 | ((charCode >> 6) & 0x3f));
          msgBytes.push(0x80 | (charCode & 0x3f));
        }
      }

      const originalBitLength = msgBytes.length * 8;
      msgBytes.push(0x80);
      while (msgBytes.length % 64 !== 56) {
        msgBytes.push(0);
      }

      const high = Math.floor(originalBitLength / 0x100000000);
      const low = originalBitLength & 0xffffffff;

      for (let i = 7; i >= 4; i--) {
        msgBytes.push((high >>> ((i - 4) * 8)) & 0xff);
      }
      for (let i = 3; i >= 0; i--) {
        msgBytes.push((low >>> (i * 8)) & 0xff);
      }

      let H0 = 0x67452301;
      let H1 = 0xefcdab89;
      let H2 = 0x98badcfe;
      let H3 = 0x10325476;
      let H4 = 0xc3d2e1f0;

      for (let chunkStart = 0; chunkStart < msgBytes.length; chunkStart += 64) {
        const W = new Array(80);
        for (let i = 0; i < 16; i++) {
          W[i] = (msgBytes[chunkStart + i * 4] << 24) |
                 (msgBytes[chunkStart + i * 4 + 1] << 16) |
                 (msgBytes[chunkStart + i * 4 + 2] << 8) |
                 msgBytes[chunkStart + i * 4 + 3];
        }

        for (let t = 16; t < 80; t++) {
          W[t] = rotateLeft(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
        }

        let A = H0;
        let B = H1;
        let C = H2;
        let D = H3;
        let E = H4;

        for (let t = 0; t < 80; t++) {
          let f, k;
          if (t < 20) {
            f = (B & C) | (~B & D);
            k = 0x5a827999;
          } else if (t < 40) {
            f = B ^ C ^ D;
            k = 0x6ed9eba1;
          } else if (t < 60) {
            f = (B & C) | (B & D) | (C & D);
            k = 0x8f1bbcdc;
          } else {
            f = B ^ C ^ D;
            k = 0xca62c1d6;
          }

          const temp = (rotateLeft(A, 5) + f + E + k + W[t]) >>> 0;
          E = D;
          D = C;
          C = rotateLeft(B, 30) >>> 0;
          B = A;
          A = temp;
        }

        H0 = (H0 + A) >>> 0;
        H1 = (H1 + B) >>> 0;
        H2 = (H2 + C) >>> 0;
        H3 = (H3 + D) >>> 0;
        H4 = (H4 + E) >>> 0;
      }

      return toHexStr(H0) + toHexStr(H1) + toHexStr(H2) + toHexStr(H3) + toHexStr(H4);
    };

    // Конвертируем hex в Base64
    const hexToBase64 = (hex) => {
      const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }

      for (let i = 0; i < bytes.length; i += 3) {
        const b1 = bytes[i];
        const b2 = bytes[i + 1] || 0;
        const b3 = bytes[i + 2] || 0;
        const bitmap = (b1 << 16) | (b2 << 8) | b3;
        result += base64chars.charAt((bitmap >> 18) & 63);
        result += base64chars.charAt((bitmap >> 12) & 63);
        result += i + 1 < bytes.length ? base64chars.charAt((bitmap >> 6) & 63) : '=';
        result += i + 2 < bytes.length ? base64chars.charAt(bitmap & 63) : '=';
      }
      return result;
    };

    const hash = sha1(key + WS_MAGIC_STRING);
    return hexToBase64(hash);
  }

  /**
   * Подключается к WebSocket серверу
   * @param {Function} onOpen Колбэк при успешном подключении
   * @param {Function} onMessage Колбэк при получении сообщения
   * @param {Function} onError Колбэк при ошибке
   * @param {Function} onClose Колбэк при отключении
   * @returns {Promise<void>}
   */
  async connect(onOpen, onMessage, onError, onClose) {
    if (this.isConnected) {
      logger.warn('[WebSocket Client] Уже подключен');
      return;
    }

    this.onOpenCallback = onOpen;
    this.onMessageCallback = onMessage;
    this.onErrorCallback = onError;
    this.onCloseCallback = onClose;

    return new Promise((resolve, reject) => {
      try {
        // Генерируем ключ для handshake
        this.webSocketKey = generateWebSocketKey();
        this.expectedAcceptKey = null;

        // Таймаут для подключения (10 секунд)
        const connectionTimeout = setTimeout(() => {
          if (this.socket && !this.isConnected) {
            logger.error('[WebSocket Client] Таймаут подключения');
            try {
              this.socket.destroy();
            } catch (e) {
              // Игнорируем ошибки при закрытии
            }
            const timeoutError = new Error(`Таймаут подключения к ${this.host}:${this.port}. Проверьте IP адрес и что табло запущено.`);
            this.handleError(timeoutError);
            reject(timeoutError);
          }
        }, 10000);

        // Вычисляем ожидаемый accept key
        this.calculateAcceptKey(this.webSocketKey).then((acceptKey) => {
          this.expectedAcceptKey = acceptKey;

          // Создаем TCP соединение
          this.socket = TcpSocket.createConnection(
            {
              port: this.port,
              host: this.host,
            },
            () => {
              clearTimeout(connectionTimeout);
              logger.log(`[WebSocket Client] TCP соединение установлено с ${this.host}:${this.port}`);

              // Отправляем WebSocket handshake
              const handshake = [
                'GET / HTTP/1.1',
                `Host: ${this.host}:${this.port}`,
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Key: ${this.webSocketKey}`,
                'Sec-WebSocket-Version: 13',
                '',
                '',
              ].join('\r\n');

              this.socket.write(handshake);
              logger.log('[WebSocket Client] Handshake отправлен');
            }
          );

          this.socket.on('data', (data) => {
            try {
              this.handleData(data);
            } catch (error) {
              const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
              logger.error('[WebSocket Client] Ошибка при обработке данных:', errorMsg);
              // Не закрываем соединение при ошибке обработки данных
            }
          });

          this.socket.on('error', (error) => {
            clearTimeout(connectionTimeout);
            const errorMessage = error.message || error.toString();
            logger.error(`[WebSocket Client] Ошибка сокета при подключении к ${this.host}:${this.port}:`, errorMessage);

            // Сбрасываем состояние соединения при ошибке
            this.isConnected = false;
            this.isHandshakeComplete = false;

            // Более информативное сообщение об ошибке
            let userFriendlyError = errorMessage;
            if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
              userFriendlyError = `Не удалось подключиться к ${this.host}:${this.port}. Табло не запущено или неверный IP адрес.`;
            } else if (errorMessage.includes('ENETUNREACH') || errorMessage.includes('network unreachable') || errorMessage.includes('Host unreachable')) {
              userFriendlyError = `Сеть недоступна. Проверьте что устройства в одной Wi-Fi сети.`;
            } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout') || errorMessage.includes('connection time out')) {
              userFriendlyError = `Таймаут подключения. Проверьте IP адрес и что табло запущено.`;
            } else if (errorMessage.includes('Broken pipe') || errorMessage.includes('Connection reset')) {
              userFriendlyError = `Соединение разорвано. Возможно, табло закрыло соединение. Проверьте настройки табло.`;
            }

            const enhancedError = new Error(userFriendlyError);
            this.handleError(enhancedError);
            reject(enhancedError);
          });

          this.socket.on('close', () => {
            clearTimeout(connectionTimeout);
            logger.log('[WebSocket Client] Соединение закрыто');
            // Сбрасываем состояние соединения
            const wasConnected = this.isConnected;
            this.isConnected = false;
            this.isHandshakeComplete = false;
            // Вызываем handleClose только если соединение было установлено
            if (wasConnected) {
              this.handleClose();
            } else {
              // Если соединение закрылось до завершения handshake, это ошибка
              const closeError = new Error('Соединение закрыто до завершения handshake');
              this.handleError(closeError);
            }
          });

          resolve();
        }).catch((error) => {
          clearTimeout(connectionTimeout);
          logger.error('[WebSocket Client] Ошибка при вычислении accept key:', error);
          this.handleError(error);
          reject(error);
        });
      } catch (error) {
        logger.error('[WebSocket Client] Ошибка при подключении:', error);
        this.handleError(error);
        reject(error);
      }
    });
  }

  /**
   * Обрабатывает входящие данные
   * @param {Buffer} data Данные
   */
  handleData(data) {
    if (!this.isHandshakeComplete) {
      // Обработка handshake ответа
      this.buffer = Buffer.concat([this.buffer, data]);
      const responseStr = this.buffer.toString();

      if (responseStr.includes('\r\n\r\n')) {
        if (parseHandshakeResponse(responseStr, this.expectedAcceptKey)) {
          this.isHandshakeComplete = true;
          this.isConnected = true;
          this.buffer = Buffer.alloc(0);
          this.reconnectAttempts = 0;

          logger.log('[WebSocket Client] Handshake завершен, соединение установлено');

          if (this.onOpenCallback) {
            try {
              this.onOpenCallback();
            } catch (error) {
              logger.error('[WebSocket Client] Ошибка в onOpenCallback:', error);
            }
          }
        } else {
          logger.error('[WebSocket Client] Неверный handshake ответ');
          this.isConnected = false;
          this.isHandshakeComplete = false;
          this.handleError(new Error('Неверный handshake ответ'));
          this.disconnect();
        }
      }
    } else {
      // Обработка WebSocket frames
      this.buffer = Buffer.concat([this.buffer, data]);

      while (this.buffer.length > 0) {
        const frame = parseWebSocketFrame(this.buffer);

        if (!frame) {
          // Неполный frame, ждем еще данных
          break;
        }

        // Удаляем обработанные данные из буфера
        const frameLength = 2 + (frame.payloadLength < 126 ? 0 : frame.payloadLength < 65536 ? 2 : 8) + (frame.masked ? 4 : 0) + frame.payloadLength;
        this.buffer = this.buffer.slice(frameLength);

        // Обработка frame
        if (frame.opcode === 0x1) {
          // Текстовое сообщение
          const message = frame.payload.toString('utf8');
          logger.log('[WebSocket Client] Получено сообщение:', message);

          if (this.onMessageCallback) {
            try {
              const parsed = JSON.parse(message);
              this.onMessageCallback(parsed);
            } catch (e) {
              this.onMessageCallback(message);
            }
          }
        } else if (frame.opcode === 0x8) {
          // Закрытие соединения
          logger.log('[WebSocket Client] Сервер запросил закрытие');
          this.disconnect();
        } else if (frame.opcode === 0x9) {
          // Ping - отправляем Pong
          this.sendPong();
        } else if (frame.opcode === 0xa) {
          // Pong
          logger.log('[WebSocket Client] Получен Pong');
        }
      }
    }
  }

  /**
   * Отправляет сообщение на сервер
   * @param {Object|string} data Данные для отправки
   */
  send(data) {
    // Проверяем состояние соединения более тщательно
    if (!this.socket || !this.isConnected || !this.isHandshakeComplete) {
      logger.warn('[WebSocket Client] Попытка отправить данные без подключения');
      // Сбрасываем состояние, если сокет не существует
      if (!this.socket) {
        this.isConnected = false;
        this.isHandshakeComplete = false;
      }
      return;
    }

    try {
      // Дополнительная проверка состояния сокета перед отправкой
      if (this.socket.destroyed || this.socket.readyState === 'closed') {
        logger.warn('[WebSocket Client] Попытка отправить данные на закрытый сокет');
        this.isConnected = false;
        this.isHandshakeComplete = false;
        return;
      }

      const message = typeof data === 'string' ? data : JSON.stringify(data);
      const frame = createWebSocketFrame(message, 0x1);
      this.socket.write(frame);
    } catch (error) {
      logger.error('[WebSocket Client] Ошибка при отправке данных:', error);
      // При ошибке отправки сбрасываем состояние соединения
      this.isConnected = false;
      this.isHandshakeComplete = false;
      this.handleError(error);
    }
  }

  /**
   * Отправляет Pong frame
   */
  sendPong() {
    if (!this.isConnected || !this.isHandshakeComplete) {
      return;
    }

    const frame = createWebSocketFrame('', 0xa); // Pong opcode
    this.socket.write(frame);
  }

  /**
   * Обрабатывает ошибку
   * @param {Error} error Ошибка
   */
  handleError(error) {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  /**
   * Обрабатывает закрытие соединения
   */
  handleClose() {
    const wasConnected = this.isConnected;
    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.buffer = Buffer.alloc(0);

    if (this.onCloseCallback) {
      try {
        this.onCloseCallback();
      } catch (error) {
        logger.error('[WebSocket Client] Ошибка в onCloseCallback:', error);
      }
    }

    // Попытка переподключения только если соединение было установлено
    if (wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.log(`[WebSocket Client] Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${this.reconnectDelay}ms`);

      this.reconnectTimer = setTimeout(() => {
        this.connect(
          this.onOpenCallback,
          this.onMessageCallback,
          this.onErrorCallback,
          this.onCloseCallback
        ).catch((error) => {
          logger.error('[WebSocket Client] Ошибка при переподключении:', error);
        });
      }, this.reconnectDelay);
    } else if (wasConnected) {
      logger.log('[WebSocket Client] Достигнуто максимальное количество попыток переподключения');
    }
  }

  /**
   * Отключается от сервера
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        // Отправляем Close frame
        if (this.isHandshakeComplete) {
          const frame = createWebSocketFrame('', 0x8); // Close opcode
          this.socket.write(frame);
        }
        this.socket.destroy();
      } catch (error) {
        logger.error('[WebSocket Client] Ошибка при отключении:', error);
      }
      this.socket = null;
    }

    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.buffer = Buffer.alloc(0);
    this.reconnectAttempts = 0;
  }

  /**
   * Проверяет, подключен ли клиент
   * @returns {boolean}
   */
  getIsConnected() {
    return this.isConnected && this.isHandshakeComplete;
  }
}

export default WebSocketClient;
