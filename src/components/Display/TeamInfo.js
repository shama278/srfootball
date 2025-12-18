import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';

/**
 * Компонент отображения информации о команде (название и логотип)
 */
const TeamInfo = ({team, style, showLogo = true}) => {
  return (
    <View style={[styles.container, style]}>
      {showLogo && team.logo && (
        <Image source={{uri: team.logo}} style={styles.logo} resizeMode="contain" />
      )}
      <Text style={styles.teamName} numberOfLines={2}>
        {team.name || 'Команда'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  teamName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
    maxWidth: 300,
  },
});

export default TeamInfo;
