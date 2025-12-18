import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';

/**
 * Компонент выбора периода
 */
const PeriodSelector = ({currentPeriod, onSelectPeriod, style}) => {
  const periods = [
    {id: 1, label: '1-й тайм'},
    {id: 2, label: '2-й тайм'},
    {id: 3, label: 'ОТ'},
    {id: 4, label: 'Доп. время'},
  ];

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Период</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              currentPeriod === period.id && styles.periodButtonActive,
            ]}
            onPress={() => onSelectPeriod(period.id)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.periodButtonText,
                currentPeriod === period.id && styles.periodButtonTextActive,
              ]}>
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  scrollView: {
    flexGrow: 0,
  },
  periodButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#2196f3',
  },
  periodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#ffffff',
  },
});

export default PeriodSelector;
