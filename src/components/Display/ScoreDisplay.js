import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';

/**
 * Компонент отображения счета команды
 */
const ScoreDisplay = ({score, teamName, logo, style, textStyle}) => {
  return (
    <View style={[styles.container, style]}>
      {logo && (
        <Image source={{uri: logo}} style={styles.logo} resizeMode="contain" />
      )}
      <Text style={[styles.score, textStyle]}>{score}</Text>
      {teamName && <Text style={[styles.teamName, textStyle]}>{teamName}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    borderRadius: 60,
  },
  score: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
  },
  teamName: {
    fontSize: 32,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
});

export default ScoreDisplay;
