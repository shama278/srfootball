import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

/**
 * Компонент управления счетом команды
 */
const ScoreControl = ({teamName, score, onIncrement, onDecrement, style}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.teamName}>{teamName}</Text>
      <View style={styles.scoreContainer}>
        <TouchableOpacity
          style={[styles.button, styles.decrementButton]}
          onPress={onDecrement}
          activeOpacity={0.7}>
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.score}>{score}</Text>
        <TouchableOpacity
          style={[styles.button, styles.incrementButton]}
          onPress={onIncrement}
          activeOpacity={0.7}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
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
  },
  teamName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  decrementButton: {
    backgroundColor: '#f44336',
  },
  incrementButton: {
    backgroundColor: '#4caf50',
  },
  buttonText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  score: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 80,
    textAlign: 'center',
  },
});

export default ScoreControl;
