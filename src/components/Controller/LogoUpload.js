import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';

/**
 * Компонент загрузки логотипа команды
 */
const LogoUpload = ({teamLabel, currentLogo, onLogoSelected, style}) => {
  const showImagePicker = () => {
    Alert.alert(
      'Выберите логотип',
      'Откуда вы хотите загрузить логотип?',
      [
        {
          text: 'Галерея',
          onPress: () => selectFromGallery(),
        },
        {
          text: 'Камера',
          onPress: () => selectFromCamera(),
        },
        {
          text: 'Отмена',
          style: 'cancel',
        },
      ],
      {cancelable: true}
    );
  };

  // Конвертирует изображение в base64 для передачи через WebSocket
  const convertImageToBase64 = async (uri) => {
    try {
      // Используем fetch для чтения файла
      const response = await fetch(uri);
      const blob = await response.blob();

      // Конвертируем blob в base64 используя встроенный API React Native
      return new Promise((resolve, reject) => {
        // В React Native используем встроенный способ конвертации
        if (typeof global !== 'undefined' && global.FileReader) {
          const reader = new global.FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            // Убираем префикс data:image/...;base64, если есть
            const base64 = base64data.includes(',') ? base64data.split(',')[1] : base64data;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        } else {
          // Альтернативный способ через ArrayBuffer
          blob.arrayBuffer().then((buffer) => {
            // Конвертируем ArrayBuffer в base64
            const bytes = new Uint8Array(buffer);
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
            resolve(result);
          }).catch(reject);
        }
      });
    } catch (error) {
      console.error('[LogoUpload] Ошибка при конвертации изображения в base64:', error);
      // В случае ошибки возвращаем null, чтобы использовать логотип по умолчанию
      return null;
    }
  };

  const selectFromGallery = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
      includeBase64: true, // Включаем base64 в ответ
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel) {
      } else if (response.errorCode) {
        Alert.alert('Ошибка', 'Не удалось загрузить изображение');
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        // Используем base64 если доступен, иначе конвертируем URI
        if (asset.base64) {
          // Формируем data URI для локального отображения и base64 для передачи
          const dataUri = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
          onLogoSelected(dataUri);
        } else if (asset.uri) {
          // Если base64 недоступен, конвертируем URI в base64
          try {
            const base64 = await convertImageToBase64(asset.uri);
            const dataUri = `data:${asset.type || 'image/jpeg'};base64,${base64}`;
            onLogoSelected(dataUri);
          } catch (error) {
            console.error('[LogoUpload] Ошибка при конвертации:', error);
            // В случае ошибки используем оригинальный URI
            onLogoSelected(asset.uri);
          }
        }
      }
    });
  };

  const selectFromCamera = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
      includeBase64: true, // Включаем base64 в ответ
    };

    launchCamera(options, async (response) => {
      if (response.didCancel) {
      } else if (response.errorCode) {
        Alert.alert('Ошибка', 'Не удалось сделать фото');
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        // Используем base64 если доступен, иначе конвертируем URI
        if (asset.base64) {
          // Формируем data URI для локального отображения и base64 для передачи
          const dataUri = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
          onLogoSelected(dataUri);
        } else if (asset.uri) {
          // Если base64 недоступен, конвертируем URI в base64
          try {
            const base64 = await convertImageToBase64(asset.uri);
            const dataUri = `data:${asset.type || 'image/jpeg'};base64,${base64}`;
            onLogoSelected(dataUri);
          } catch (error) {
            console.error('[LogoUpload] Ошибка при конвертации:', error);
            // В случае ошибки используем оригинальный URI
            onLogoSelected(asset.uri);
          }
        }
      }
    });
  };

  const removeLogo = () => {
    Alert.alert(
      'Удалить логотип',
      'Вы уверены, что хотите удалить логотип?',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => onLogoSelected(null),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{teamLabel}</Text>
      {currentLogo ? (
        <View style={styles.logoContainer}>
          <Image source={{uri: currentLogo}} style={styles.logo} resizeMode="contain" />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.changeButton]}
              onPress={showImagePicker}
              activeOpacity={0.7}>
              <Text style={styles.buttonText}>Изменить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.removeButton]}
              onPress={removeLogo}
              activeOpacity={0.7}>
              <Text style={styles.buttonText}>Удалить</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={showImagePicker}
          activeOpacity={0.7}>
          <Text style={styles.uploadButtonText}>Загрузить логотип</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  logoContainer: {
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 15,
    borderRadius: 75,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  changeButton: {
    backgroundColor: '#2196f3',
  },
  removeButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  uploadButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    backgroundColor: '#ff9800',
    width: '100%',
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default LogoUpload;
