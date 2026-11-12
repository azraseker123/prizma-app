import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const steps = [
  { number: '01', icon: '✧', title: 'Temizle', description: 'Yüzünü nazik bir temizleyiciyle yıka.' },
  { number: '02', icon: '◷', title: 'Bekle', description: 'Ürün sürmeden yaklaşık 30 dakika bekle.' },
  { number: '03', icon: '⌕', title: 'Gözlemle', description: 'Cildinin nasıl hissettiğini incele.' },
];

const types = [
  { icon: '♧', title: 'Kuru Cilt', description: 'Gerginlik, kuruluk ve pullanma görülebilir.' },
  { icon: '✦', title: 'Yağlı Cilt', description: 'Parlama ve belirgin gözenekler görülebilir.' },
  { icon: '◐', title: 'Karma Cilt', description: 'T bölgesi yağlı, yanaklar daha kuru olabilir.' },
  { icon: '♡', title: 'Normal Cilt', description: 'Genellikle dengeli, belirgin kuruluk veya yağlanma yoktur.' },
];

export default function SkinTypeGuide() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>PRİZMA ✦ SKIN GUIDE</Text>
      <Text style={styles.heading}>Cilt Tipini Keşfet</Text>
      <Text style={styles.subtitle}>3 basit adımda cildini daha iyi tanı.</Text>

      <View style={styles.steps}>
        {steps.map(step => (
          <View key={step.number} style={styles.step}>
            <Text style={styles.stepNumber}>{step.number}</Text>
            <Text style={styles.stepIcon}>{step.icon}</Text>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>✦ Cilt Tipleri ✦</Text>

      <View style={styles.grid}>
        {types.map(type => (
          <View key={type.title} style={styles.typeCard}>
            <Text style={styles.typeIcon}>{type.icon}</Text>
            <Text style={styles.typeTitle}>{type.title}</Text>
            <Text style={styles.typeDescription}>{type.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>♡ Hassasiyet</Text>
        <Text style={styles.noteText}>
          Ayrı bir cilt tipi değildir. Her cilt tipinde görülebilir.
          Cildin kolayca kızarıyor, yanıyor veya tahriş oluyorsa hassas olabilir.
        </Text>
      </View>

      <Text style={styles.footer}>
        Bu rehber genel bir fikir verir. Cilt tipin zamanla değişebilir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: '#FBF5FA',
    borderRadius: 22,
  },
  brand: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#A77E9F',
  },
  heading: {
    marginTop: 9,
    fontSize: 25,
    fontWeight: '800',
    color: '#4B2946',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 7,
    fontSize: 12,
    color: '#8D6588',
    textAlign: 'center',
  },
  steps: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 22,
  },
  step: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0E3ED',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B68BA9',
  },
  stepIcon: {
    fontSize: 25,
    color: '#A77E9F',
    marginVertical: 6,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B2946',
  },
  stepDescription: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: '#806B7D',
  },
  sectionTitle: {
    marginTop: 25,
    marginBottom: 13,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '800',
    color: '#4B2946',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 13,
    borderWidth: 1,
    borderColor: '#F0E3ED',
  },
  typeIcon: {
    fontSize: 25,
    color: '#B68BA9',
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B2946',
    marginTop: 8,
  },
  typeDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: '#806B7D',
    marginTop: 7,
  },
  note: {
    backgroundColor: '#F1E2ED',
    borderRadius: 16,
    padding: 15,
    marginTop: 18,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B2946',
  },
  noteText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 19,
    color: '#6C5368',
  },
  footer: {
    marginTop: 16,
    textAlign: 'center',
    color: '#8D6588',
    fontSize: 11,
    lineHeight: 17,
  },
});
