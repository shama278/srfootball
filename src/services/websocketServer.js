import TcpSocket from "react-native-tcp-socket";
import { getLocalIPAddress, getDefaultWebSocketPort } from "./networkUtils";
import logger from "./logger";

// Полифилл для Buffer в React Native
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

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
    this.clients = new Map(); // Map<socketId, {socket, isHandshakeComplete, buffer}>
    this.onConnectionCallback = null;
    this.onMessageCallback = null;
    this.onDisconnectCallback = null;
    this.isRunning = false;
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
          const socketId = `${socket.remoteAddress}:${socket.remotePort}`;

          // Инициализация клиента
          this.clients.set(socketId, {
            socket,
            isHandshakeComplete: false,
            buffer: Buffer.alloc(0),
          });

          logger.log(`[WebSocket] Новое подключение: ${socketId}`);

          socket.on("data", (data) => {
            try {
              this.handleClientData(socketId, data);
            } catch (error) {
              const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
              logger.error(`[WebSocket] Ошибка при обработке данных от ${socketId}:`, errorMsg);
              // Не закрываем соединение при ошибке обработки данных, просто логируем
            }
          });

          socket.on("error", (error) => {
            try {
              const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
              logger.error(`[WebSocket] Ошибка сокета ${socketId}:`, errorMsg);
              this.handleClientDisconnect(socketId);
            } catch (err) {
              // Защита от ошибок в обработчике ошибок
              logger.error(`[WebSocket] Критическая ошибка в обработчике ошибок ${socketId}:`, err);
            }
          });

          socket.on("close", () => {
            try {
              logger.log(`[WebSocket] Клиент отключен: ${socketId}`);
              this.handleClientDisconnect(socketId);
            } catch (error) {
              // Защита от ошибок в обработчике закрытия
              logger.error(`[WebSocket] Ошибка при обработке закрытия ${socketId}:`, error);
            }
          });
        });

        this.server.listen({ port: this.port, host: "0.0.0.0" }, async () => {
          this.isRunning = true;
          const ipAddress = await getLocalIPAddress();
          logger.log(
            `[WebSocket] Сервер запущен на ${ipAddress}:${this.port}`
          );
          resolve(ipAddress || "0.0.0.0");
        });

        this.server.on("error", (error) => {
          logger.error("[WebSocket] Ошибка сервера:", error);
          this.isRunning = false;
          reject(error);
        });
      } catch (error) {
        logger.error("[WebSocket] Ошибка при запуске сервера:", error);
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
    const client = this.clients.get(socketId);
    if (!client) {
      return;
    }

    if (!client.isHandshakeComplete) {
      // Обработка handshake
      client.buffer = Buffer.concat([client.buffer, data]);
      const requestStr = client.buffer.toString();

      if (requestStr.includes("\r\n\r\n")) {
        const response = handleWebSocketHandshake(requestStr);
        if (response) {
          try {
            // Проверяем состояние сокета перед отправкой ответа
            if (client.socket.destroyed || !client.socket.writable) {
              logger.error(`[WebSocket] Сокет ${socketId} недоступен для записи при handshake`);
              this.handleClientDisconnect(socketId);
              return;
            }

            client.socket.write(response);
            client.isHandshakeComplete = true;
            client.buffer = Buffer.alloc(0);

            logger.log(`[WebSocket] Handshake завершен для ${socketId}`);

            if (this.onConnectionCallback) {
              try {
                this.onConnectionCallback(socketId);
              } catch (error) {
                logger.error(`[WebSocket] Ошибка в onConnectionCallback для ${socketId}:`, error);
              }
            }
          } catch (error) {
            const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
            logger.error(`[WebSocket] Ошибка при отправке handshake ответа ${socketId}:`, errorMsg);
            this.handleClientDisconnect(socketId);
          }
        } else {
          logger.error(`[WebSocket] Неверный handshake от ${socketId}`);
          try {
            client.socket.end();
          } catch (error) {
            // Игнорируем ошибки при закрытии
          }
          this.clients.delete(socketId);
        }
      }
    } else {
      // Обработка WebSocket frames
      client.buffer = Buffer.concat([client.buffer, data]);

      while (client.buffer.length > 0) {
        const frame = parseWebSocketFrame(client.buffer);

        if (!frame) {
          // Неполный frame, ждем еще данных
          break;
        }

        // Удаляем обработанные данные из буфера
        const frameLength =
          2 +
          (frame.payloadLength < 126
            ? 0
            : frame.payloadLength < 65536
            ? 2
            : 8) +
          (frame.masked ? 4 : 0) +
          frame.payloadLength;
        client.buffer = client.buffer.slice(frameLength);

        // Обработка frame
        if (frame.opcode === 0x1) {
          // Текстовое сообщение
          const message = frame.payload.toString("utf8");
          logger.log(`[WebSocket] Сообщение от ${socketId}:`, message);

          if (this.onMessageCallback) {
            try {
              const parsed = JSON.parse(message);
              this.onMessageCallback(socketId, parsed);
            } catch (e) {
              this.onMessageCallback(socketId, message);
            }
          }
        } else if (frame.opcode === 0x8) {
          // Закрытие соединения
          logger.log(`[WebSocket] Клиент ${socketId} запросил закрытие`);
          this.sendCloseFrame(socketId);
          this.handleClientDisconnect(socketId);
        } else if (frame.opcode === 0x9) {
          // Ping
          this.sendPongFrame(socketId);
        }
      }
    }
  }

  /**
   * Отправляет сообщение клиенту
   * @param {string} socketId ID сокета
   * @param {Object|string} data Данные для отправки
   */
  send(socketId, data) {
    const client = this.clients.get(socketId);
    if (!client || !client.isHandshakeComplete) {
      logger.warn(
        `[WebSocket] Попытка отправить данные несуществующему клиенту: ${socketId}`
      );
      return;
    }

    // Проверяем состояние сокета перед отправкой
    if (client.socket.destroyed || !client.socket.writable) {
      logger.warn(`[WebSocket] Сокет ${socketId} недоступен для записи`);
      this.handleClientDisconnect(socketId);
      return;
    }

    try {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      const frame = createWebSocketFrame(message, 0x1);
      const written = client.socket.write(frame);

      // Если буфер переполнен, обрабатываем это
      if (!written) {
        logger.warn(`[WebSocket] Буфер сокета ${socketId} переполнен, данные будут отправлены позже`);
      }
    } catch (error) {
      const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
      logger.error(
        `[WebSocket] Ошибка при отправке данных клиенту ${socketId}:`,
        errorMsg
      );
      // При ошибке отправки отключаем клиента
      this.handleClientDisconnect(socketId);
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
    const client = this.clients.get(socketId);
    if (!client || !client.isHandshakeComplete) {
      return;
    }

    // Проверяем состояние сокета перед отправкой
    if (client.socket.destroyed || !client.socket.writable) {
      logger.warn(`[WebSocket] Сокет ${socketId} недоступен для отправки Pong`);
      this.handleClientDisconnect(socketId);
      return;
    }

    try {
      const frame = createWebSocketFrame("", 0xa); // Pong opcode
      client.socket.write(frame);
    } catch (error) {
      const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
      logger.error(`[WebSocket] Ошибка при отправке Pong ${socketId}:`, errorMsg);
      this.handleClientDisconnect(socketId);
    }
  }

  /**
   * Отправляет Close frame
   * @param {string} socketId ID сокета
   */
  sendCloseFrame(socketId) {
    const client = this.clients.get(socketId);
    if (!client || !client.isHandshakeComplete) {
      return;
    }

    // Проверяем состояние сокета перед отправкой
    if (client.socket.destroyed || !client.socket.writable) {
      logger.warn(`[WebSocket] Сокет ${socketId} недоступен для отправки Close frame`);
      return;
    }

    try {
      const frame = createWebSocketFrame("", 0x8); // Close opcode
      client.socket.write(frame);
    } catch (error) {
      const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
      logger.error(`[WebSocket] Ошибка при отправке Close frame ${socketId}:`, errorMsg);
      // Не вызываем handleClientDisconnect здесь, так как это уже процесс закрытия
    }
  }

  /**
   * Обрабатывает отключение клиента
   * @param {string} socketId ID сокета
   */
  handleClientDisconnect(socketId) {
    const client = this.clients.get(socketId);
    if (client) {
      try {
        client.socket.destroy();
      } catch (error) {
        // Игнорируем ошибки при закрытии
      }
      this.clients.delete(socketId);

      if (this.onDisconnectCallback) {
        this.onDisconnectCallback(socketId);
      }
    }
  }

  /**
   * Останавливает WebSocket сервер
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    // Закрываем все соединения
    this.clients.forEach((client, socketId) => {
      this.handleClientDisconnect(socketId);
    });

    // Закрываем сервер
    if (this.server) {
      try {
        this.server.close(() => {
          logger.log("[WebSocket] Сервер остановлен");
        });
      } catch (error) {
        logger.error("[WebSocket] Ошибка при остановке сервера:", error);
      }
    }

    this.isRunning = false;
    this.clients.clear();
  }

  /**
   * Получает количество подключенных клиентов
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
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
