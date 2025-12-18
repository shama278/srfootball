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

  const selectFromGallery = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('Пользователь отменил выбор изображения');
      } else if (response.errorCode) {
        Alert.alert('Ошибка', 'Не удалось загрузить изображение');
        console.error('Ошибка ImagePicker:', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        const uri = response.assets[0].uri;
        onLogoSelected(uri);
      }
    });
  };

  const selectFromCamera = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('Пользователь отменил съемку');
      } else if (response.errorCode) {
        Alert.alert('Ошибка', 'Не удалось сделать фото');
        console.error('Ошибка Camera:', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        const uri = response.assets[0].uri;
        onLogoSelected(uri);
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
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginVertical: 10,
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
