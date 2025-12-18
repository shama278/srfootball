import TcpSocket from "react-native-tcp-socket";
import { getLocalIPAddress, getDefaultWebSocketPort } from "./networkUtils";
import {Buffer} from 'buffer';

/**
 * Реализация SHA1 на чистом JavaScript для React Native
 * @param {string} message Сообщение для хеширования
 * @returns {string} SHA1 хеш в виде hex строки
 */
const sha1 = (message) => {
  function rotateLeft(n, s) {
    return (n << s) | (n >>> (32 - s));
  }

  function toHexStr(n) {
    let s = "";
    let v;
    for (let i = 7; i >= 0; i--) {
      v = (n >>> (i * 4)) & 0x0f;
      s += v.toString(16);
    }
    return s;
  }

  // Конвертируем строку в байты (UTF-8)
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

  // Сохраняем исходную длину в битах (до padding)
  const originalBitLength = msgBytes.length * 8;

  // Добавляем padding
  msgBytes.push(0x80);
  while (msgBytes.length % 64 !== 56) {
    msgBytes.push(0);
  }

  // Добавляем длину сообщения (64 бита, big-endian)
  // Используем 32-битные числа для старшей и младшей части
  const high = Math.floor(originalBitLength / 0x100000000);
  const low = originalBitLength & 0xffffffff;

  for (let i = 7; i >= 4; i--) {
    msgBytes.push((high >>> ((i - 4) * 8)) & 0xff);
  }
  for (let i = 3; i >= 0; i--) {
    msgBytes.push((low >>> (i * 8)) & 0xff);
  }

  // Инициализация хеш-значений
  let H0 = 0x67452301;
  let H1 = 0xefcdab89;
  let H2 = 0x98badcfe;
  let H3 = 0x10325476;
  let H4 = 0xc3d2e1f0;

  // Обработка блоков по 512 бит (64 байта)
  for (let chunkStart = 0; chunkStart < msgBytes.length; chunkStart += 64) {
    const W = new Array(80);

    // Копируем блок в W[0..15]
    for (let i = 0; i < 16; i++) {
      W[i] =
        (msgBytes[chunkStart + i * 4] << 24) |
        (msgBytes[chunkStart + i * 4 + 1] << 16) |
        (msgBytes[chunkStart + i * 4 + 2] << 8) |
        msgBytes[chunkStart + i * 4 + 3];
    }

    // Расширяем W[16..79]
    for (let t = 16; t < 80; t++) {
      W[t] = rotateLeft(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let A = H0;
    let B = H1;
    let C = H2;
    let D = H3;
    let E = H4;

    // Основной цикл
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

  return (
    toHexStr(H0) + toHexStr(H1) + toHexStr(H2) + toHexStr(H3) + toHexStr(H4)
  );
};

/**
 * Конвертирует hex строку в Base64
 * @param {string} hex Hex строка
 * @returns {string} Base64 строка
 */
const hexToBase64 = (hex) => {
  const base64chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  // Конвертируем hex в байты
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }

  // Конвертируем байты в Base64
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] || 0;
    const b3 = bytes[i + 2] || 0;

    const bitmap = (b1 << 16) | (b2 << 8) | b3;

    result += base64chars.charAt((bitmap >> 18) & 63);
    result += base64chars.charAt((bitmap >> 12) & 63);
    result +=
      i + 1 < bytes.length ? base64chars.charAt((bitmap >> 6) & 63) : "=";
    result += i + 2 < bytes.length ? base64chars.charAt(bitmap & 63) : "=";
  }

  return result;
};

/**
 * Генерирует ключ для WebSocket handshake
 * @param {string} key Sec-WebSocket-Key от клиента
 * @returns {string} Sec-WebSocket-Accept
 */
const generateAcceptKey = (key) => {
  const WS_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  const hash = sha1(key + WS_MAGIC_STRING);
  return hexToBase64(hash);
};

/**
 * Парсит WebSocket frame
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
    if (buffer.length < 4) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) {
      return null;
    }
    // Для упрощения не поддерживаем 64-битные длины
    return null;
  }

  let maskingKey = null;
  if (masked) {
    if (buffer.length < offset + 4) {
      return null;
    }
    maskingKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLength) {
    return null; // Неполный frame
  }

  let payload = buffer.slice(offset, offset + payloadLength);

  if (masked && maskingKey) {
    // Демаскирование payload
    for (let i = 0; i < payload.length; i++) {
      payload[i] = payload[i] ^ maskingKey[i % 4];
    }
  }

  return {
    fin,
    opcode,
    masked,
    payloadLength,
    payload,
  };
};

/**
 * Создает WebSocket frame
 * @param {string|Buffer} data Данные для отправки
 * @param {number} opcode Код операции (1 для текста, 2 для бинарных данных)
 * @returns {Buffer} WebSocket frame
 */
const createWebSocketFrame = (data, opcode = 0x1) => {
  const isString = typeof data === "string";
  const payload = isString ? Buffer.from(data, "utf8") : data;
  const payloadLength = payload.length;

  let frame = Buffer.alloc(2);
  frame[0] = 0x80 | opcode; // FIN = 1, opcode
  frame[1] = 0x80; // MASK = 1 (клиент должен маскировать, но сервер не должен)

  if (payloadLength < 126) {
    frame[1] = payloadLength;
    frame = Buffer.concat([frame, payload]);
  } else if (payloadLength < 65536) {
    frame[1] = 126;
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(payloadLength, 0);
    frame = Buffer.concat([frame, lengthBuffer, payload]);
  } else {
    // Для больших сообщений (не реализовано полностью)
    frame[1] = 127;
    const lengthBuffer = Buffer.alloc(8);
    lengthBuffer.writeUInt32BE(0, 0);
    lengthBuffer.writeUInt32BE(payloadLength, 4);
    frame = Buffer.concat([frame, lengthBuffer, payload]);
  }

  return frame;
};

/**
 * Обрабатывает WebSocket handshake
 * @param {string} request HTTP запрос от клиента
 * @returns {string|null} HTTP ответ для handshake или null
 */
const handleWebSocketHandshake = (request) => {
  const requestStr = request.toString();

  if (!requestStr.includes("Upgrade: websocket")) {
    return null;
  }

  const keyMatch = requestStr.match(/Sec-WebSocket-Key:\s*(.+)/i);
  if (!keyMatch) {
    return null;
  }

  const clientKey = keyMatch[1].trim();
  const acceptKey = generateAcceptKey(clientKey);

  const response = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "",
    "",
  ].join("\r\n");

  return response;
};

class WebSocketServer {
  constructor(port = null) {
    this.port = port || getDefaultWebSocketPort();
    this.server = null;
    this.clients = new Map(); // Map<socketId, {socket, isHandshakeComplete, buffer, lastPingTime}>
    this.onConnectionCallback = null;
    this.onMessageCallback = null;
    this.onDisconnectCallback = null;
    this.isRunning = false;
    this.heartbeatInterval = null;
    this.heartbeatIntervalMs = 30000; // 30 секунд
    this.heartbeatTimeoutMs = 10000; // 10 секунд таймаут на ответ
  }

  /**
   * Запускает WebSocket сервер
   * @param {Function} onConnectionCallback Колбэк при новом подключении
   * @param {Function} onMessageCallback Колбэк при получении сообщения
   * @param {Function} onDisconnectCallback Колбэк при отключении клиента
   * @returns {Promise<string>} IP адрес сервера
   */
  async start(onConnectionCallback, onMessageCallback, onDisconnectCallback) {
    if (this.isRunning) {
      throw new Error("Сервер уже запущен");
    }

    this.onConnectionCallback = onConnectionCallback;
    this.onMessageCallback = onMessageCallback;
    this.onDisconnectCallback = onDisconnectCallback;

    return new Promise((resolve, reject) => {
      try {
        this.server = TcpSocket.createServer((socket) => {
          try {
            const socketId = `${socket.remoteAddress}:${socket.remotePort}`;

            // Инициализация клиента
            this.clients.set(socketId, {
              socket,
              isHandshakeComplete: false,
              buffer: Buffer.alloc(0),
              lastPingTime: null,
              lastPongTime: Date.now(),
            });

            console.log(`[WebSocket] Новое подключение: ${socketId}`);

            socket.on("data", (data) => {
              try {
                this.handleClientData(socketId, data);
              } catch (error) {
                console.error(`[WebSocket] Ошибка в обработчике data для ${socketId}:`, error);
                this.handleClientDisconnect(socketId);
              }
            });

            socket.on("error", (error) => {
              try {
                console.error(`[WebSocket] Ошибка сокета ${socketId}:`, error);
                this.handleClientDisconnect(socketId);
              } catch (errorHandlerError) {
                console.error(`[WebSocket] Ошибка при обработке ошибки сокета ${socketId}:`, errorHandlerError);
              }
            });

            socket.on("close", () => {
              try {
                console.log(`[WebSocket] Клиент отключен: ${socketId}`);
                this.handleClientDisconnect(socketId);
              } catch (closeHandlerError) {
                console.error(`[WebSocket] Ошибка при обработке закрытия сокета ${socketId}:`, closeHandlerError);
              }
            });
          } catch (connectionError) {
            console.error(`[WebSocket] Ошибка при создании нового подключения:`, connectionError);
            try {
              socket.destroy();
            } catch (e) {
              // Игнорируем ошибки при закрытии
            }
          }
        });

        // Используем "0.0.0.0" для IPv4 (на Android dual-stack с "::" может не работать корректно)
        this.server.listen({ port: this.port, host: "0.0.0.0" }, async () => {
          this.isRunning = true;
          const ipAddress = await getLocalIPAddress();
          console.log(
            `[WebSocket] Сервер запущен на ${ipAddress}:${this.port}`
          );

          // Запускаем heartbeat для всех клиентов
          this.startHeartbeat();

          resolve(ipAddress || "0.0.0.0");
        });

        this.server.on("error", (error) => {
          console.error("[WebSocket] Ошибка сервера:", error);
          const errorMessage = error.message || error.toString();
          const errorCode = error.code || '';

          // Проверяем, является ли это ошибкой "порт уже используется"
          if (errorCode === 'EADDRINUSE' || errorMessage.includes('address already in use') || errorMessage.includes('EADDRINUSE')) {
            console.error(`[WebSocket] Порт ${this.port} уже занят. Возможно, сервер уже запущен.`);
          }

          this.isRunning = false;
          this.server = null;
          reject(error);
        });
      } catch (error) {
        console.error("[WebSocket] Ошибка при запуске сервера:", error);
        this.isRunning = false;
        reject(error);
      }
    });
  }

  /**
   * Обрабатывает данные от клиента
   * @param {string} socketId ID сокета
   * @param {Buffer} data Данные
   */
  handleClientData(socketId, data) {
    try {
      const client = this.clients.get(socketId);
      if (!client) {
        return;
      }

      if (!client.isHandshakeComplete) {
        // Обработка handshake
        try {
          client.buffer = Buffer.concat([client.buffer, data]);
          const requestStr = client.buffer.toString();

          if (requestStr.includes("\r\n\r\n")) {
            const response = handleWebSocketHandshake(requestStr);
            if (response) {
              try {
                client.socket.write(response);
                client.isHandshakeComplete = true;
                client.buffer = Buffer.alloc(0);

                console.log(`[WebSocket] Handshake завершен для ${socketId}`);

                if (this.onConnectionCallback) {
                  try {
                    this.onConnectionCallback(socketId);
                  } catch (callbackError) {
                    console.error(`[WebSocket] Ошибка в onConnectionCallback для ${socketId}:`, callbackError);
                  }
                }
              } catch (writeError) {
                console.error(`[WebSocket] Ошибка при отправке handshake ответа ${socketId}:`, writeError);
                this.handleClientDisconnect(socketId);
              }
            } else {
              console.error(`[WebSocket] Неверный handshake от ${socketId}`);
              try {
                client.socket.end();
              } catch (e) {
                // Игнорируем ошибки при закрытии
              }
              this.clients.delete(socketId);
            }
          }
        } catch (handshakeError) {
          console.error(`[WebSocket] Ошибка при обработке handshake от ${socketId}:`, handshakeError);
          this.handleClientDisconnect(socketId);
        }
      } else {
        // Обработка WebSocket frames
        try {
          client.buffer = Buffer.concat([client.buffer, data]);

          while (client.buffer.length > 0) {
            let frame;
            try {
              frame = parseWebSocketFrame(client.buffer);
            } catch (parseError) {
              console.error(`[WebSocket] Ошибка при парсинге frame от ${socketId}:`, parseError);
              break;
            }

            if (!frame) {
              // Неполный frame, ждем еще данных
              break;
            }

            // Удаляем обработанные данные из буфера
            try {
              const frameLength =
                2 +
                (frame.payloadLength < 126
                  ? 0
                  : frame.payloadLength < 65536
                  ? 2
                  : 8) +
                (frame.masked ? 4 : 0) +
                frame.payloadLength;

              if (frameLength > client.buffer.length || frameLength <= 0) {
                console.error(`[WebSocket] Некорректная длина frame от ${socketId}: ${frameLength}, буфер: ${client.buffer.length}`);
                break;
              }

              client.buffer = client.buffer.slice(frameLength);

              // Обработка frame
              if (frame.opcode === 0x1) {
                // Текстовое сообщение
                try {
                  const message = frame.payload.toString("utf8");
                  console.log(`[WebSocket] Сообщение от ${socketId}:`, message);

                  if (this.onMessageCallback) {
                    try {
                      const parsed = JSON.parse(message);
                      this.onMessageCallback(socketId, parsed);
                    } catch (e) {
                      try {
                        this.onMessageCallback(socketId, message);
                      } catch (callbackError) {
                        console.error(`[WebSocket] Ошибка в onMessageCallback для ${socketId}:`, callbackError);
                      }
                    }
                  }
                } catch (messageError) {
                  console.error(`[WebSocket] Ошибка при обработке сообщения от ${socketId}:`, messageError);
                }
              } else if (frame.opcode === 0x8) {
                // Закрытие соединения
                console.log(`[WebSocket] Клиент ${socketId} запросил закрытие`);
                try {
                  this.sendCloseFrame(socketId);
                } catch (e) {
                  console.error(`[WebSocket] Ошибка при отправке Close frame ${socketId}:`, e);
                }
                this.handleClientDisconnect(socketId);
              } else if (frame.opcode === 0x9) {
                // Ping - отправляем Pong
                try {
                  const client = this.clients.get(socketId);
                  if (client) {
                    client.lastPongTime = Date.now();
                  }
                  this.sendPongFrame(socketId);
                } catch (pingError) {
                  console.error(`[WebSocket] Ошибка при обработке Ping от ${socketId}:`, pingError);
                }
              } else if (frame.opcode === 0xa) {
                // Pong - обновляем время последнего Pong
                try {
                  const client = this.clients.get(socketId);
                  if (client) {
                    client.lastPongTime = Date.now();
                    client.lastPingTime = null; // Сбрасываем время Ping
                  }
                  console.log(`[WebSocket] Получен Pong от ${socketId}`);
                } catch (pongError) {
                  console.error(`[WebSocket] Ошибка при обработке Pong от ${socketId}:`, pongError);
                }
              }
            } catch (frameError) {
              console.error(`[WebSocket] Ошибка при обработке frame от ${socketId}:`, frameError);
              break;
            }
          }
        } catch (frameProcessingError) {
          console.error(`[WebSocket] Ошибка при обработке frames от ${socketId}:`, frameProcessingError);
          // Не отключаем клиента при ошибке обработки frames, возможно это временная проблема
        }
      }
    } catch (error) {
      console.error(`[WebSocket] Критическая ошибка при обработке данных от ${socketId}:`, error);
      // При критической ошибке отключаем клиента
      this.handleClientDisconnect(socketId);
    }
  }

  /**
   * Отправляет сообщение клиенту
   * @param {string} socketId ID сокета
   * @param {Object|string} data Данные для отправки
   */
  send(socketId, data) {
    try {
      const client = this.clients.get(socketId);
      if (!client || !client.isHandshakeComplete) {
        console.warn(
          `[WebSocket] Попытка отправить данные несуществующему клиенту: ${socketId}`
        );
        return;
      }

      if (!client.socket || client.socket.destroyed) {
        console.warn(
          `[WebSocket] Попытка отправить данные на закрытый сокет: ${socketId}`
        );
        return;
      }

      try {
        const message = typeof data === "string" ? data : JSON.stringify(data);
        const frame = createWebSocketFrame(message, 0x1);
        client.socket.write(frame);
      } catch (error) {
        console.error(
          `[WebSocket] Ошибка при отправке данных клиенту ${socketId}:`,
          error
        );
        // Отключаем клиента при ошибке отправки
        this.handleClientDisconnect(socketId);
      }
    } catch (error) {
      console.error(
        `[WebSocket] Критическая ошибка при отправке данных клиенту ${socketId}:`,
        error
      );
    }
  }

  /**
   * Отправляет сообщение всем подключенным клиентам
   * @param {Object|string} data Данные для отправки
   */
  broadcast(data) {
    this.clients.forEach((client, socketId) => {
      if (client.isHandshakeComplete) {
        this.send(socketId, data);
      }
    });
  }

  /**
   * Отправляет Pong frame
   * @param {string} socketId ID сокета
   */
  sendPongFrame(socketId) {
    try {
      const client = this.clients.get(socketId);
      if (!client || !client.isHandshakeComplete) {
        return;
      }

      if (!client.socket || client.socket.destroyed) {
        return;
      }

      try {
        const frame = createWebSocketFrame("", 0xa); // Pong opcode
        client.socket.write(frame);
      } catch (error) {
        console.error(`[WebSocket] Ошибка при отправке Pong frame клиенту ${socketId}:`, error);
      }
    } catch (error) {
      console.error(`[WebSocket] Ошибка в sendPongFrame для ${socketId}:`, error);
    }
  }

  /**
   * Отправляет Close frame
   * @param {string} socketId ID сокета
   */
  sendCloseFrame(socketId) {
    try {
      const client = this.clients.get(socketId);
      if (!client || !client.isHandshakeComplete) {
        return;
      }

      if (!client.socket || client.socket.destroyed) {
        return;
      }

      try {
        const frame = createWebSocketFrame("", 0x8); // Close opcode
        client.socket.write(frame);
      } catch (error) {
        console.error(`[WebSocket] Ошибка при отправке Close frame клиенту ${socketId}:`, error);
      }
    } catch (error) {
      console.error(`[WebSocket] Ошибка в sendCloseFrame для ${socketId}:`, error);
    }
  }

  /**
   * Обрабатывает отключение клиента
   * @param {string} socketId ID сокета
   */
  handleClientDisconnect(socketId) {
    try {
      const client = this.clients.get(socketId);
      if (client) {
        try {
          if (client.socket && !client.socket.destroyed) {
            client.socket.destroy();
          }
        } catch (error) {
          // Игнорируем ошибки при закрытии сокета
          console.warn(`[WebSocket] Ошибка при закрытии сокета ${socketId}:`, error);
        }
        this.clients.delete(socketId);

        if (this.onDisconnectCallback) {
          try {
            this.onDisconnectCallback(socketId);
          } catch (callbackError) {
            console.error(`[WebSocket] Ошибка в onDisconnectCallback для ${socketId}:`, callbackError);
          }
        }
      }
    } catch (error) {
      console.error(`[WebSocket] Ошибка при обработке отключения клиента ${socketId}:`, error);
      // Удаляем клиента из списка даже при ошибке
      try {
        this.clients.delete(socketId);
      } catch (e) {
        // Игнорируем ошибки при удалении
      }
    }
  }

  /**
   * Запускает heartbeat для всех клиентов
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (!this.isRunning) {
        this.stopHeartbeat();
        return;
      }

      const now = Date.now();
      this.clients.forEach((client, socketId) => {
        if (!client.isHandshakeComplete) {
          return;
        }

        // Проверяем таймаут последнего Pong
        if (client.lastPongTime && (now - client.lastPongTime) > this.heartbeatTimeoutMs * 2) {
          console.warn(`[WebSocket] Таймаут heartbeat для клиента ${socketId}, отключаем`);
          this.handleClientDisconnect(socketId);
          return;
        }

        // Отправляем Ping если еще не отправляли или прошло достаточно времени
        if (!client.lastPingTime || (now - client.lastPingTime) > this.heartbeatIntervalMs) {
          this.sendPingFrame(socketId);
          client.lastPingTime = now;
        }
      });
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
  }

  /**
   * Отправляет Ping frame клиенту
   * @param {string} socketId ID сокета
   */
  sendPingFrame(socketId) {
    try {
      const client = this.clients.get(socketId);
      if (!client || !client.isHandshakeComplete) {
        return;
      }

      if (!client.socket || client.socket.destroyed) {
        // Сокет закрыт, удаляем клиента
        this.handleClientDisconnect(socketId);
        return;
      }

      try {
        const frame = createWebSocketFrame("", 0x9); // Ping opcode
        client.socket.write(frame);
        console.log(`[WebSocket] Отправлен Ping клиенту ${socketId}`);
      } catch (error) {
        console.error(`[WebSocket] Ошибка при отправке Ping клиенту ${socketId}:`, error);
        // Отключаем клиента при ошибке отправки
        this.handleClientDisconnect(socketId);
      }
    } catch (error) {
      console.error(`[WebSocket] Ошибка в sendPingFrame для ${socketId}:`, error);
    }
  }

  /**
   * Останавливает WebSocket сервер
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.isRunning && !this.server) {
        resolve();
        return;
      }

      this.isRunning = false;
      this.stopHeartbeat();

      // Закрываем все соединения
      this.clients.forEach((client, socketId) => {
        this.handleClientDisconnect(socketId);
      });
      this.clients.clear();

      // Закрываем сервер
      if (this.server) {
        try {
          this.server.close(() => {
            console.log("[WebSocket] Сервер остановлен");
            this.server = null;
            resolve();
          });

          // Таймаут на случай, если close не вызвал callback
          setTimeout(() => {
            try {
              if (this.server) {
                this.server.close(() => {});
              }
            } catch (e) {
              // Игнорируем ошибки
            }
            this.server = null;
            resolve();
          }, 1000);
        } catch (error) {
          console.error("[WebSocket] Ошибка при остановке сервера:", error);
          this.server = null;
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  /**
   * Получает количество подключенных клиентов (только с завершенным handshake)
   * @returns {number}
   */
  getClientCount() {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.isHandshakeComplete) {
        count++;
      }
    });
    return count;
  }

  /**
   * Получает список ID подключенных клиентов
   * @returns {Array<string>}
   */
  getClientIds() {
    return Array.from(this.clients.keys());
  }
}

export default WebSocketServer;
