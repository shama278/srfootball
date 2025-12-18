import NetInfo from '@react-native-community/netinfo';
import {Platform} from 'react-native';
import logger from './logger';

/**
 * Получает IP адрес устройства в текущей сети
 * @returns {Promise<string|null>} IP адрес или null если не удалось определить
 */
export const getLocalIPAddress = async () => {
  try {
    const state = await NetInfo.fetch();

    // Не блокируем получение IP даже если NetInfo считает что нет подключения
    // Это важно для работы при раздаче Wi-Fi с телефона
    // if (!state.isConnected) {
    //   return null;
    // }

    // Для Android можно получить IP из details
    if (Platform.OS === 'android' && state.details) {
      // В режиме Hotspot обычно IP адрес планшета 192.168.43.1
      // Но можно попробовать получить реальный IP
      if (state.type === 'wifi' && state.details.ipAddress) {
        const ip = state.details.ipAddress;
        // Проверяем что это валидный IP адрес
        if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
          return ip;
        }
      }

      // Пробуем получить IP из wifi.details
      if (state.details.wifi && state.details.wifi.ipAddress) {
        const ip = state.details.wifi.ipAddress;
        if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
          return ip;
        }
      }
    }

    // Для iOS и других случаев
    if (state.type === 'wifi' && state.details) {
      // В некоторых версиях NetInfo может быть ipAddress
      if (state.details.ipAddress) {
        const ip = state.details.ipAddress;
        if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
          return ip;
        }
      }
    }

    // Если не удалось получить IP из NetInfo, но тип сети wifi,
    // возвращаем стандартный для Hotspot (может быть неверным, но лучше чем null)
    // В режиме WiFi Hotspot на Android IP обычно 192.168.43.1
    // Но также могут быть другие диапазоны: 192.168.137.x, 192.168.1.x и т.д.
    if (state.type === 'wifi') {
      // Не возвращаем фиксированный IP, так как он может быть неверным
      // Лучше вернуть null и позволить пользователю ввести IP вручную
      logger.log('[NetworkUtils] Не удалось определить IP адрес из NetInfo, но тип сети wifi');
      return null;
    }

    return null;
  } catch (error) {
    logger.error('Ошибка при получении IP адреса:', error);
    return null;
  }
};

/**
 * Проверяет, находится ли устройство в режиме WiFi Hotspot
 * @returns {Promise<boolean>} true если устройство в режиме Hotspot
 */
export const isHotspotMode = async () => {
  try {
    const state = await NetInfo.fetch();

    if (Platform.OS === 'android' && state.details) {
      // В режиме Hotspot тип обычно 'wifi', но можно проверить дополнительные параметры
      // На Android в режиме Hotspot IP адрес обычно 192.168.43.1
      const ip = await getLocalIPAddress();
      if (ip === '192.168.43.1' || ip?.startsWith('192.168.43.')) {
        return true;
      }

      // Альтернативная проверка через SSID или другие параметры
      if (state.type === 'wifi' && state.details.ssid) {
        // Если SSID не определен или устройство является точкой доступа
        // В некоторых случаях можно определить по отсутствию SSID
        return false; // По умолчанию считаем, что это не Hotspot
      }
    }

    return false;
  } catch (error) {
    logger.error('Ошибка при проверке режима Hotspot:', error);
    return false;
  }
};

/**
 * Получает информацию о текущем сетевом подключении
 * @returns {Promise<Object>} Объект с информацией о сети
 */
export const getNetworkInfo = async () => {
  try {
    const state = await NetInfo.fetch();
    const ipAddress = await getLocalIPAddress();
    const isHotspot = await isHotspotMode();

    return {
      isConnected: state.isConnected,
      type: state.type,
      ipAddress,
      isHotspot,
      details: state.details || {},
    };
  } catch (error) {
    logger.error('Ошибка при получении информации о сети:', error);
    return {
      isConnected: false,
      type: 'unknown',
      ipAddress: null,
      isHotspot: false,
      details: {},
    };
  }
};

/**
 * Подписывается на изменения сетевого состояния
 * @param {Function} callback Функция обратного вызова при изменении состояния
 * @returns {Function} Функция для отписки
 */
export const subscribeToNetworkChanges = (callback) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    getNetworkInfo().then((networkInfo) => {
      callback(networkInfo);
    });
  });

  return unsubscribe;
};

/**
 * Получает рекомендуемый порт для WebSocket сервера
 * @returns {number} Номер порта
 */
export const getDefaultWebSocketPort = () => {
  return 8080; // Порт для WebSocket соединений (как указано в требованиях)
};

/**
 * Проверяет, является ли строка валидным IPv4 адресом
 * @param {string} ip IP адрес для проверки
 * @returns {boolean} true если это валидный IPv4 адрес
 */
export const isValidIPv4 = (ip) => {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) {
    return false;
  }
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

/**
 * Вычисляет broadcast адрес для заданного IP адреса
 * Использует стандартные маски подсети для популярных диапазонов
 * @param {string} ip IP адрес
 * @returns {string|null} Broadcast адрес или null если не удалось вычислить
 */
export const getBroadcastAddress = (ip) => {
  if (!ip || !isValidIPv4(ip)) {
    return null;
  }

  const parts = ip.split('.').map(part => parseInt(part, 10));
  const firstOctet = parts[0];

  // Определяем маску подсети на основе первого октета
  // 192.168.x.x -> 255.255.255.0 (класс C)
  // 10.x.x.x -> 255.0.0.0 (класс A) или 255.255.255.0 (обычно)
  // 172.16-31.x.x -> 255.255.0.0 (класс B) или 255.255.255.0
  // Для большинства домашних сетей используется /24 (255.255.255.0)

  if (firstOctet === 192 && parts[1] === 168) {
    // 192.168.x.x - обычно /24
    return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
  } else if (firstOctet === 10) {
    // 10.x.x.x - обычно /24 для домашних сетей
    return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
  } else if (firstOctet === 172 && parts[1] >= 16 && parts[1] <= 31) {
    // 172.16-31.x.x - обычно /24
    return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
  } else {
    // Для других случаев используем /24 по умолчанию
    return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
  }
};
