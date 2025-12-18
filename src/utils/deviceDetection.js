import { Platform } from "react-native";

/**
 * Определяет, является ли устройство Android TV
 * @returns {Promise<boolean>} true если устройство Android TV
 */
export const isAndroidTV = async () => {
  try {
    if (Platform.OS !== "android") {
      return false;
    }

    // В React Native проверка Android TV через Platform.isTV
    // Это свойство доступно в React Native для Android TV
    // В обычных версиях React Native это свойство может отсутствовать
    if (typeof Platform.isTV === "boolean") {
      return Platform.isTV === true;
    }

    // Если Platform.isTV недоступен, возвращаем false
    // Пользователь может выбрать режим вручную через ModeSelectorScreen
    return false;
  } catch (error) {
    console.error("Ошибка при определении типа устройства:", error);
    return false;
  }
};

/**
 * Определяет, является ли устройство планшетом
 * @returns {Promise<boolean>} true если устройство планшет
 */
export const isTablet = async () => {
  try {
    // На Android можно проверить через размер экрана или другие характеристики
    // Для простоты считаем, что если это не TV, то это планшет или телефон
    const tv = await isAndroidTV();
    return !tv;
  } catch (error) {
    console.error("Ошибка при определении типа устройства:", error);
    return false;
  }
};

/**
 * Получает рекомендуемый режим работы приложения
 * @returns {Promise<'controller'|'display'|null>} Режим работы или null если не определен
 */
export const getRecommendedMode = async () => {
  try {
    const tv = await isAndroidTV();
    if (tv) {
      return "display";
    }
    return "controller";
  } catch (error) {
    console.error("Ошибка при определении режима работы:", error);
    return null;
  }
};

/**
 * Режимы работы приложения
 */
export const APP_MODES = {
  CONTROLLER: "controller",
  DISPLAY: "display",
};
