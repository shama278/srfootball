import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, Image} from 'react-native';

/**
 * Компонент редактирования информации о команде
 */
const TeamEditor = ({teamLabel, teamName, logo, onNameChange, onLogoSelect, style}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(teamName);

  const handleSave = () => {
    onNameChange(editedName);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(teamName);
    setIsEditing(false);
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{teamLabel}</Text>
      {logo && (
        <Image source={{uri: logo}} style={styles.logoPreview} resizeMode="contain" />
      )}
      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.input}
            value={editedName}
            onChangeText={setEditedName}
            placeholder="Название команды"
            autoFocus
          />
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              activeOpacity={0.7}>
              <Text style={styles.buttonText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              activeOpacity={0.7}>
              <Text style={styles.buttonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.displayContainer}>
          <Text style={styles.teamName}>{teamName}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(true)}
            activeOpacity={0.7}>
            <Text style={styles.editButtonText}>Редактировать</Text>
          </TouchableOpacity>
        </View>
      )}
      {onLogoSelect && (
        <TouchableOpacity
          style={styles.logoButton}
          onPress={onLogoSelect}
          activeOpacity={0.7}>
          <Text style={styles.logoButtonText}>
            {logo ? 'Изменить логотип' : 'Загрузить логотип'}
          </Text>
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
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
  },
  displayContainer: {
    alignItems: 'center',
  },
  teamName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    backgroundColor: '#2196f3',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  editContainer: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#4caf50',
  },
  cancelButton: {
    backgroundColor: '#9e9e9e',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  logoButton: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#ff9800',
    alignItems: 'center',
  },
  logoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default TeamEditor;
