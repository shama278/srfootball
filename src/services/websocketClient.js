import TcpSocket from 'react-native-tcp-socket';
import {Buffer} from 'buffer';

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
  constructor(host, port = 8080, localAddress = null) {
    this.host = host;
    this.port = port;
    this.localAddress = localAddress; // Локальный IPv4 адрес для принудительного использования IPv4
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
    this.isReconnecting = false; // Флаг для предотвращения множественных переподключений
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.heartbeatIntervalMs = 30000; // 30 секунд
    this.heartbeatTimeoutMs = 10000; // 10 секунд таймаут на ответ
    this.lastPongTime = null;
    this.isProcessingHandshake = false; // Флаг для предотвращения повторной обработки handshake
    this.isConnecting = false; // Флаг для отслеживания процесса подключения
    this.onOpenCallbackExecuting = false; // Флаг для отслеживания выполнения onOpenCallback
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
    // Если уже идет процесс подключения, не начинаем новый
    if (this.isConnecting) {
      return;
    }

    // Если уже подключены и handshake завершен, не переподключаемся
    if (this.isConnected && this.isHandshakeComplete && this.socket && !this.socket.destroyed) {
      this.onOpenCallback = onOpen;
      this.onMessageCallback = onMessage;
      this.onErrorCallback = onError;
      this.onCloseCallback = onClose;
      // Вызываем onOpen, если соединение уже установлено
      if (onOpen) {
        try {
          onOpen();
        } catch (error) {
          console.error(`[WebSocket Client] Ошибка при вызове onOpen для уже подключенного соединения:`, error);
        }
      }
      return;
    }

    // Устанавливаем флаг подключения
    this.isConnecting = true;

    // Если есть сокет, но handshake не завершен, ждем завершения или отключаемся
    // Но только если сокет действительно существует и не уничтожен
    // И только если это не новое соединение, которое только что создается
    if (this.socket && !this.socket.destroyed && !this.isHandshakeComplete) {
      // Даем больше времени на завершение handshake (до 500 мс)
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        // Проверяем, что сокет все еще существует и не уничтожен
        if (!this.socket || this.socket.destroyed) {
          break;
        }
        if (this.isHandshakeComplete && this.isConnected) {
          this.isConnecting = false;
          this.onOpenCallback = onOpen;
          this.onMessageCallback = onMessage;
          this.onErrorCallback = onError;
          this.onCloseCallback = onClose;
          if (onOpen) {
            try {
              onOpen();
            } catch (error) {
              console.error(`[WebSocket Client] Ошибка при вызове onOpen:`, error);
            }
          }
          return;
        }
      }
      // Если handshake не завершился после ожидания, отключаемся и переподключаемся
      // Но только если сокет все еще существует
      if (this.socket && !this.socket.destroyed) {
        this.isConnecting = false;
        this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } else if (this.socket && !this.socket.destroyed && this.isHandshakeComplete && !this.isConnected) {
      // Сокет существует, handshake завершен, но isConnected=false - это странно
      // Но не отключаемся сразу, возможно это временное состояние
      await new Promise(resolve => setTimeout(resolve, 100));
      // Проверяем, что сокет все еще существует
      if (!this.socket || this.socket.destroyed) {
        this.isConnecting = false;
      } else if (!this.isConnected) {
        this.isConnecting = false;
        this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        this.isConnecting = false;
        this.onOpenCallback = onOpen;
        this.onMessageCallback = onMessage;
        this.onErrorCallback = onError;
        this.onCloseCallback = onClose;
        if (onOpen) {
          try {
            onOpen();
          } catch (error) {
            console.error(`[WebSocket Client] Ошибка при вызове onOpen:`, error);
          }
        }
        return;
      }
    } else if (this.socket && this.socket.destroyed) {
      // Сокет существует, но уничтожен - очищаем ссылку
      this.socket = null;
      this.isConnected = false;
      this.isHandshakeComplete = false;
    }

    this.onOpenCallback = onOpen;
    this.onMessageCallback = onMessage;
    this.onErrorCallback = onError;
    this.onCloseCallback = onClose;

    return new Promise((resolve, reject) => {
      try {
        // Убеждаемся, что старое соединение полностью очищено
        if (this.socket) {
          try {
            this.socket.destroy();
          } catch (e) {
            // Игнорируем ошибки при закрытии
          }
          this.socket = null;
        }
        this.isConnected = false;
        this.isHandshakeComplete = false;
        this.buffer = Buffer.alloc(0);
        this.reconnectAttempts = 0;

        // Генерируем ключ для handshake
        this.webSocketKey = generateWebSocketKey();
        this.expectedAcceptKey = null;

        // Таймаут на подключение
        const connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            const timeoutError = new Error(`Таймаут подключения к ${this.host}:${this.port} (превышено 10 секунд)`);
            this.isConnecting = false; // Сбрасываем флаг подключения при таймауте
            this.handleError(timeoutError);
            if (this.socket) {
              try {
                this.socket.destroy();
              } catch (e) {
                // Игнорируем ошибки при закрытии
              }
            }
            reject(timeoutError);
          }
        }, 10000); // 10 секунд таймаут

        // Вычисляем ожидаемый accept key
        this.calculateAcceptKey(this.webSocketKey).then((acceptKey) => {
          this.expectedAcceptKey = acceptKey;

          // Создаем TCP соединение
          // Используем localAddress для принудительного использования IPv4
          // Это решает проблему ECONNREFUSED при подключении к внешним IP адресам на Android
          // host - это IP табло (куда подключаемся)
          // localAddress - это IP контроллера (откуда подключаемся)
          const connectionOptions = {
            port: this.port,
            host: this.host, // IP табло (сервер)
          };

          // Если указан localAddress, используем его для принудительного IPv4
          // localAddress - это IP контроллера (клиент)
          if (this.localAddress) {
            connectionOptions.localAddress = this.localAddress;
          }

          this.socket = TcpSocket.createConnection(
            connectionOptions,
            () => {
              try {
                clearTimeout(connectionTimeout);

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

                if (this.socket && !this.socket.destroyed) {
                  this.socket.write(handshake);
                } else {
                  reject(new Error('Сокет уничтожен до отправки handshake'));
                }
              } catch (error) {
                clearTimeout(connectionTimeout);
                this.handleError(error);
                reject(error);
              }
            }
          );

          // Убеждаемся, что обработчики устанавливаются только один раз
          // Удаляем старые обработчики перед установкой новых (на случай повторного подключения)
          this.socket.removeAllListeners('data');
          this.socket.removeAllListeners('error');
          this.socket.removeAllListeners('close');

          this.socket.on('data', (data) => {
            try {
              this.handleData(data);
            } catch (error) {
              this.handleError(error);
            }
          });

          this.socket.on('error', (error) => {
            try {
              clearTimeout(connectionTimeout);
              const errorMessage = error.message || error.toString();
              const errorCode = error.code || '';
              console.error(`[WebSocket Client] Ошибка сокета: ${errorMessage}, код: ${errorCode}`);
              console.error(`[WebSocket Client] isHandshakeComplete=${this.isHandshakeComplete}, isConnected=${this.isConnected}`);
              this.isConnecting = false; // Сбрасываем флаг подключения при ошибке

              // Если handshake не завершен, это ошибка подключения - запускаем переподключение
              if (!this.isHandshakeComplete) {
                // Очищаем сокет
                if (this.socket) {
                  try {
                    this.socket.removeAllListeners();
                    if (!this.socket.destroyed) {
                      this.socket.destroy();
                    }
                  } catch (e) {
                    // Игнорируем ошибки при закрытии
                  }
                  this.socket = null;
                }

                this.handleError(error);

                // Запускаем переподключение, если еще не превышен лимит попыток и не идет переподключение
                if (this.reconnectAttempts < this.maxReconnectAttempts && !this.reconnectTimer && !this.isReconnecting) {
                  this.reconnectAttempts++;
                  this.isReconnecting = true;
                  this.reconnectTimer = setTimeout(() => {
                    if (!this.isConnecting && !this.isConnected) {
                      this.connect(
                        this.onOpenCallback,
                        this.onMessageCallback,
                        this.onErrorCallback,
                        this.onCloseCallback
                      ).catch((reconnectError) => {
                        // Ошибка переподключения уже обработана
                        this.isReconnecting = false;
                      }).then(() => {
                        // Сбрасываем флаг переподключения после завершения попытки
                        this.isReconnecting = false;
                      });
                    } else {
                      this.isReconnecting = false;
                    }
                    this.reconnectTimer = null;
                  }, this.reconnectDelay);
                }

                reject(error);
              } else {
                // Handshake завершен - это может быть временная ошибка
                this.handleError(error);
              }
            } catch (errorHandlerError) {
              console.error(`[WebSocket Client] Ошибка в обработчике ошибок сокета:`, errorHandlerError);
            }
          });

          this.socket.on('close', () => {
            try {
              clearTimeout(connectionTimeout);
              // Вызываем handleClose только если handshake был завершен
              if (this.isHandshakeComplete) {
                this.handleClose();
              }
            } catch (error) {
              console.error(`[WebSocket Client] Ошибка в обработчике close:`, error);
            }
          });

          resolve();
        }).catch((error) => {
          clearTimeout(connectionTimeout);
          reject(error);
        });
      } catch (error) {
        this.handleError(error);
        reject(error);
      }
    });
  }

  /**
   * Обрабатывает WebSocket frames из буфера (без добавления новых данных)
   */
  processWebSocketFrames() {
    if (!this.isHandshakeComplete || !this.isConnected) {
      return;
    }

    try {
      while (this.buffer.length > 0) {
        let frame;
        try {
          frame = parseWebSocketFrame(this.buffer);
        } catch (parseError) {
          console.error(`[WebSocket Client] ОШИБКА при парсинге frame в processWebSocketFrames:`, parseError);
          break;
        }

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
          try {
            const message = frame.payload.toString('utf8');
            if (this.onMessageCallback) {
              try {
                const parsed = JSON.parse(message);
                this.onMessageCallback(parsed);
              } catch (e) {
                this.onMessageCallback(message);
              }
            }
          } catch (messageError) {
            // Продолжаем работу
          }
        } else if (frame.opcode === 0x8) {
          // Закрытие соединения
          // Не вызываем disconnect() сразу, если это происходит сразу после handshake
          // Это может быть ответ на наш Close frame, который мы отправили
          // Вместо этого просто останавливаем обработку
          break;
        } else if (frame.opcode === 0x9) {
          // Ping - отправляем Pong
          try {
            this.sendPong();
          } catch (pongError) {
            console.error(`[WebSocket Client] Ошибка при отправке Pong:`, pongError);
          }
        } else if (frame.opcode === 0xa) {
          // Pong
          this.lastPongTime = Date.now();
          if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
          }
        }
      }
    } catch (error) {
      console.error(`[WebSocket Client] ОШИБКА в processWebSocketFrames:`, error);
    }
  }

  /**
   * Обрабатывает входящие данные
   * @param {Buffer} data Данные
   */
  handleData(data) {
    try {
      if (!this.isHandshakeComplete) {
        // Защита от повторной обработки handshake
        if (this.isProcessingHandshake) {
          return;
        }
        this.isProcessingHandshake = true;
        // Обработка handshake ответа
        try {
          this.buffer = Buffer.concat([this.buffer, data]);
          const responseStr = this.buffer.toString();

          if (responseStr.includes('\r\n\r\n')) {
            // Находим конец HTTP заголовков
            const headerEnd = responseStr.indexOf('\r\n\r\n');
            const headerLength = headerEnd + 4; // +4 для \r\n\r\n

            if (parseHandshakeResponse(responseStr, this.expectedAcceptKey)) {
              this.isHandshakeComplete = true;
              this.isConnected = true;
              this.isConnecting = false; // Сбрасываем флаг подключения после успешного handshake
              this.isReconnecting = false; // Сбрасываем флаг переподключения при успешном подключении

              // Проверяем, есть ли данные после HTTP заголовков (WebSocket frames)
              if (this.buffer.length > headerLength) {
                const remainingData = this.buffer.slice(headerLength);
                // Очищаем буфер от HTTP заголовков, оставляем только WebSocket данные
                this.buffer = remainingData;
                // Обрабатываем оставшиеся данные как WebSocket frames
                // Но делаем это после вызова onOpenCallback, чтобы не вызвать disconnect() до установки соединения
                // Используем более длинную задержку, чтобы убедиться, что onOpenCallback полностью выполнен
                // Обработку оставшихся данных переносим ПОСЛЕ вызова onOpenCallback
              } else {
                // Нет данных после заголовков, очищаем буфер
                this.buffer = Buffer.alloc(0);
              }

              this.reconnectAttempts = 0; // Сбрасываем счетчик попыток при успешном подключении
              this.lastPongTime = Date.now();

              // Запускаем heartbeat
              this.startHeartbeat();

              if (this.onOpenCallback) {
                try {
                  // Устанавливаем флаг выполнения onOpenCallback
                  this.onOpenCallbackExecuting = true;
                  this.onOpenCallback();
                  // Сбрасываем флаг через небольшую задержку, чтобы защитить от асинхронных вызовов disconnect()
                  setTimeout(() => {
                    this.onOpenCallbackExecuting = false;
                  }, 500); // 500 мс должно быть достаточно для завершения всех асинхронных операций
                } catch (callbackError) {
                  this.onOpenCallbackExecuting = false;
                  console.error(`[WebSocket Client] ОШИБКА в onOpenCallback:`, callbackError);
                  console.error(`[WebSocket Client] Stack trace:`, callbackError?.stack);
                  // НЕ отключаемся при ошибке в callback, это может быть временная проблема
                }
              }

              // Обрабатываем оставшиеся данные ПОСЛЕ вызова onOpenCallback
              // Используем setTimeout, чтобы убедиться, что onOpenCallback полностью выполнен
              if (this.buffer.length > 0) {
                setTimeout(() => {
                  if (this.isHandshakeComplete && this.isConnected && this.buffer.length > 0) {
                    try {
                      // Обрабатываем данные напрямую, без рекурсивного вызова handleData
                      // чтобы избежать проблем с повторной обработкой
                      this.processWebSocketFrames();
                    } catch (error) {
                      console.error(`[WebSocket Client] Ошибка при обработке оставшихся данных:`, error);
                    }
                  }
                }, 100); // Увеличиваем задержку до 100 мс, чтобы убедиться, что onOpenCallback полностью выполнен
              }
              this.isProcessingHandshake = false;
            } else {
              console.error(`[WebSocket Client] Неверный handshake ответ`);
              this.isProcessingHandshake = false;
              this.isConnecting = false; // Сбрасываем флаг подключения при ошибке handshake
              this.handleError(new Error('Неверный handshake ответ'));
              this.disconnect();
            }
          } else {
            // Handshake еще не завершен, ждем еще данных
            this.isProcessingHandshake = false;
          }
        } catch (handshakeError) {
          this.isProcessingHandshake = false;
          this.isConnecting = false; // Сбрасываем флаг подключения при ошибке handshake
          this.handleError(handshakeError);
          this.disconnect();
        }
      } else {
        // Обработка WebSocket frames
        try {
          this.buffer = Buffer.concat([this.buffer, data]);

          while (this.buffer.length > 0) {

            let frame;
            try {
              frame = parseWebSocketFrame(this.buffer);
            } catch (parseError) {
              console.error(`[WebSocket Client] ОШИБКА при парсинге frame:`, parseError);
              console.error(`[WebSocket Client] Stack trace:`, parseError?.stack);
              // НЕ отключаемся при ошибке парсинга, возможно это временная проблема
              break;
            }

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
              try {
                const message = frame.payload.toString('utf8');

                if (this.onMessageCallback) {
                  try {
                    const parsed = JSON.parse(message);
                    this.onMessageCallback(parsed);
                  } catch (e) {
                    this.onMessageCallback(message);
                  }
                }
              } catch (messageError) {
                // Продолжаем работу, не отключаемся из-за ошибки обработки сообщения
              }
            } else if (frame.opcode === 0x8) {
              // Закрытие соединения
              this.disconnect();
            } else if (frame.opcode === 0x9) {
              // Ping - отправляем Pong
              try {
                this.sendPong();
              } catch (pongError) {
                console.error(`[WebSocket Client] Ошибка при отправке Pong:`, pongError);
              }
            } else if (frame.opcode === 0xa) {
              // Pong
              this.lastPongTime = Date.now();
              if (this.heartbeatTimeout) {
                clearTimeout(this.heartbeatTimeout);
                this.heartbeatTimeout = null;
              }
            }
          }
        } catch (frameError) {
          // При ошибке обработки frame НЕ отключаемся сразу, это может быть временная проблема
          console.error(`[WebSocket Client] ОШИБКА при обработке frame:`, frameError);
          console.error(`[WebSocket Client] Stack trace:`, frameError?.stack);
          console.error(`[WebSocket Client] НЕ отключаемся, продолжаем работу`);
          this.handleError(frameError);
          // НЕ вызываем disconnect() при ошибке обработки frame, продолжаем работу
          // this.disconnect();
        }
      }
    } catch (error) {
      console.error(`[WebSocket Client] КРИТИЧЕСКАЯ ошибка в handleData:`, error);
      console.error(`[WebSocket Client] Stack trace:`, error?.stack);
      this.handleError(error);
      // Не отключаемся автоматически при критической ошибке, чтобы дать возможность восстановиться
      // this.disconnect();
    }
  }

  /**
   * Отправляет сообщение на сервер
   * @param {Object|string} data Данные для отправки
   */
  send(data) {
    if (!this.isConnected || !this.isHandshakeComplete) {
      return;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      const frame = createWebSocketFrame(message, 0x1);
      this.socket.write(frame);
    } catch (error) {
      console.error(`[WebSocket Client] Ошибка при отправке сообщения:`, error);
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
      try {
        this.onErrorCallback(error);
      } catch (callbackError) {
        console.error(`[WebSocket Client] Ошибка в onErrorCallback:`, callbackError);
      }
    }
  }

  /**
   * Обрабатывает закрытие соединения
   */
  handleClose() {
    this.stopHeartbeat();
    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.buffer = Buffer.alloc(0);
    this.lastPongTime = null;
    this.isConnecting = false; // Сбрасываем флаг подключения при закрытии

    if (this.onCloseCallback) {
      try {
        this.onCloseCallback();
      } catch (callbackError) {
        console.error(`[WebSocket Client] Ошибка в onCloseCallback:`, callbackError);
      }
    }

    // Попытка переподключения только если не идет уже процесс подключения или переподключения
    if (!this.isConnecting && !this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      // Очищаем предыдущий таймер переподключения, если он есть
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.isReconnecting = true;
      this.reconnectTimer = setTimeout(() => {
        // Проверяем еще раз перед переподключением
        if (!this.isConnecting && !this.isConnected) {
          this.connect(
            this.onOpenCallback,
            this.onMessageCallback,
            this.onErrorCallback,
            this.onCloseCallback
          ).catch((error) => {
            // Ошибка переподключения уже обработана в handleError
            this.isReconnecting = false;
          }).then(() => {
            // Сбрасываем флаг переподключения после завершения попытки
            this.isReconnecting = false;
          });
        } else {
          this.isReconnecting = false;
        }
        this.reconnectTimer = null;
      }, this.reconnectDelay);
    }
  }

  /**
   * Запускает heartbeat (keep-alive)
   */
  startHeartbeat() {
    this.stopHeartbeat();

    // Отправляем Ping периодически
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.isHandshakeComplete) {
        this.sendPing();
      } else {
        this.stopHeartbeat();
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Останавливает heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Отправляет Ping frame
   */
  sendPing() {
    if (!this.isConnected || !this.isHandshakeComplete) {
      return;
    }

    try {
      const frame = createWebSocketFrame('', 0x9); // Ping opcode
      this.socket.write(frame);

      // Устанавливаем таймаут на ответ
      this.heartbeatTimeout = setTimeout(() => {
        const now = Date.now();
        if (this.lastPongTime && (now - this.lastPongTime) > this.heartbeatTimeoutMs) {
          this.handleError(new Error('Heartbeat timeout'));
          this.disconnect();
        }
      }, this.heartbeatTimeoutMs);
    } catch (error) {
    }
  }

  /**
   * Отключается от сервера
   */
  disconnect() {
    // Защита: не отключаемся, если соединение только устанавливается и сокета нет
    if (!this.socket && !this.isHandshakeComplete && !this.isConnected) {
      this.isConnecting = false; // Сбрасываем флаг подключения
      return;
    }
    // Защита: не отключаемся сразу после успешного handshake, если onOpenCallback еще выполняется
    // Это предотвращает случайное отключение из-за асинхронных вызовов onOpenCallback
    if (this.isHandshakeComplete && this.isConnected && this.socket && !this.socket.destroyed && this.onOpenCallbackExecuting) {
      return;
    }
    this.isConnecting = false; // Сбрасываем флаг подключения при отключении
    this.stopHeartbeat();

    // Очищаем таймер переподключения
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Сбрасываем флаг переподключения
    this.isReconnecting = false;

    // Сбрасываем счетчик попыток переподключения при явном отключении
    // (но не при автоматическом переподключении)
    // this.reconnectAttempts = 0; // Не сбрасываем, чтобы сохранить логику переподключения

    // Удаляем все обработчики событий перед закрытием сокета
    if (this.socket) {
      try {
        // Удаляем обработчики, чтобы избежать утечек памяти и конфликтов
        this.socket.removeAllListeners('data');
        this.socket.removeAllListeners('error');
        this.socket.removeAllListeners('close');

        // Отправляем Close frame только если handshake завершен
        let closeFrameSent = false;
        if (this.isHandshakeComplete && !this.socket.destroyed) {
          try {
            const frame = createWebSocketFrame('', 0x8); // Close opcode
            this.socket.write(frame);
            closeFrameSent = true;
          } catch (writeError) {
            // Игнорируем ошибки записи при закрытии
            console.error(`[WebSocket Client] Ошибка при отправке Close frame:`, writeError);
          }
        }

        // Закрываем сокет с задержкой, если был отправлен Close frame
        // чтобы дать время табло получить Close frame
        if (closeFrameSent) {
          // Даем время на отправку Close frame перед закрытием сокета
          setTimeout(() => {
            try {
              if (this.socket && !this.socket.destroyed) {
                this.socket.destroy();
              }
            } catch (destroyError) {
              // Игнорируем ошибки при закрытии
            }
          }, 150); // 150 мс должно быть достаточно для отправки Close frame
        } else {
          // Если Close frame не был отправлен, закрываем сразу
          if (!this.socket.destroyed) {
            this.socket.destroy();
          }
        }
      } catch (error) {
      } finally {
        this.socket = null;
      }
    }

    // Полная очистка состояния
    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.buffer = Buffer.alloc(0);
    this.reconnectAttempts = 0;
    this.lastPongTime = null;
    this.webSocketKey = null;
    this.expectedAcceptKey = null;
    this.isProcessingHandshake = false;

    // Очищаем колбэки, чтобы избежать утечек памяти
    // Но не удаляем их полностью, так как они могут быть нужны для переподключения
    // this.onOpenCallback = null;
    // this.onMessageCallback = null;
    // this.onErrorCallback = null;
    // this.onCloseCallback = null;
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
