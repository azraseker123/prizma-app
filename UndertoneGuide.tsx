import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const steps = [
  { number: '01', icon: '☀', title: 'Gün ışığına geç', description: 'Bileğinin iç kısmına doğal ışıkta bak.' },
  { number: '02', icon: '⌕', title: 'Damarları incele', description: 'Damarların mavi, mor ya da yeşil görünümünü gözlemle.' },
  { number: '03', icon: '✧', title: 'Karşılaştır', description: 'Renkleri bir ipucu olarak değerlendir.' },
];

const tones = [
  { title: 'Soğuk Alt Ton', cue: 'Mavi / mor damarlar', detail: 'Damarlar daha mavi veya mor görünüyorsa soğuk alt ton ihtimali olabilir.', color: '#8580BE', icon: '❄' },
  { title: 'Sıcak Alt Ton', cue: 'Yeşilimsi damarlar', detail: 'Damarlar daha yeşilimsi görünüyorsa sıcak alt ton ihtimali olabilir.', color: '#729482', icon: '☀' },
  { title: 'Nötr Alt Ton', cue: 'Mavi + yeşil görünüm', detail: 'İki renk arasında belirgin fark göremiyorsan nötr alt ton düşünülebilir.', color: '#9590A3', icon: '◐' },
  { title: 'Zeytin Alt Ton', cue: 'Teninde zeytinimsi yansıma', detail: 'Zeytin alt ton yalnızca damar rengiyle anlaşılmaz; tenindeki yeşilimsi yansımaları da değerlendir.', color: '#8C9672', icon: '✦' },
];

export default function UndertoneGuide() {
  return (
    <View style={s.container}>
      <Text style={s.brand}>PRİZMA ✦ SKIN GUIDE</Text>
      <Text style={s.heading}>Cilt Alt Tonunu Keşfet</Text>
      <Text style={s.subtitle}>Bileğindeki damarların rengine bakarak başlayabilirsin.</Text>

      <View style={s.steps}>
        {steps.map(step => (
          <View style={s.step} key={step.number}>
            <Text style={s.stepNumber}>{step.number}</Text>
            <Text style={s.stepIcon}>{step.icon}</Text>
            <Text style={s.stepTitle}>{step.title}</Text>
            <Text style={s.stepDescription}>{step.description}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>✦ Damar Rengine Göre İpuçları ✦</Text>
      <View style={s.grid}>
        {tones.map(tone => (
          <View key={tone.title} style={s.toneCard}>
            <View style={[s.veinIllustration, { backgroundColor: tone.color + '18' }]}>
              <View style={[s.veinLine, { backgroundColor: tone.color, transform: [{ rotate: '20deg' }] }]} />
              <View style={[s.veinLine, s.veinBranch, { backgroundColor: tone.color, transform: [{ rotate: '-24deg' }] }]} />
              <View style={[s.veinLine, s.veinSmall, { backgroundColor: tone.color, transform: [{ rotate: '42deg' }] }]} />
            </View>
            <Text style={s.toneTitle}>{tone.icon}  {tone.title}</Text>
            <Text style={s.cue}>{tone.cue}</Text>
            <Text style={s.toneDescription}>{tone.detail}</Text>
          </View>
        ))}
      </View>

      <View style={s.note}>
        <Text style={s.noteTitle}>♡ Küçük bir hatırlatma</Text>
        <Text style={s.noteText}>Damar rengi tek başına alt tonunu kesin belirlemez. Işık ve ten rengi damarların görünümünü değiştirebilir. Kararsızsan “Emin değilim” seçmen yeterli.</Text>
      </View>
      <Text style={s.footer}>Bu rehber yalnızca kozmetik renk seçimleri için genel ipuçları verir.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', paddingVertical: 18, paddingHorizontal: 12, backgroundColor: '#FBF5FA', borderRadius: 22 },
  brand: { textAlign: 'center', fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#A77E9F' },
  heading: { marginTop: 9, fontSize: 25, fontWeight: '800', color: '#4B2946', textAlign: 'center' },
  subtitle: { marginTop: 7, fontSize: 12, lineHeight: 18, color: '#8D6588', textAlign: 'center' },
  steps: { flexDirection: 'row', gap: 7, marginTop: 22 },
  step: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 15, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: '#F0E3ED' },
  stepNumber: { fontSize: 12, fontWeight: '800', color: '#B68BA9' },
  stepIcon: { fontSize: 23, color: '#A77E9F', marginVertical: 6 },
  stepTitle: { fontSize: 12, fontWeight: '800', color: '#4B2946', textAlign: 'center' },
  stepDescription: { marginTop: 6, fontSize: 10, lineHeight: 15, textAlign: 'center', color: '#806B7D' },
  sectionTitle: { marginTop: 25, marginBottom: 13, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#4B2946' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toneCard: { width: '48%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 17, padding: 12, borderWidth: 1, borderColor: '#F0E3ED' },
  veinIllustration: { width: '100%', height: 70, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 11 },
  veinLine: { width: 5, height: 65, borderRadius: 9, opacity: 0.8 },
  veinBranch: { position: 'absolute', width: 4, height: 55, left: '39%', top: 15, opacity: 0.65 },
  veinSmall: { position: 'absolute', width: 3, height: 41, left: '58%', top: 9, opacity: 0.5 },
  toneTitle: { fontSize: 13, fontWeight: '800', color: '#4B2946' },
  cue: { marginTop: 5, fontSize: 11, fontWeight: '700', color: '#976C92' },
  toneDescription: { marginTop: 7, fontSize: 11, lineHeight: 17, color: '#806B7D' },
  note: { backgroundColor: '#F1E2ED', borderRadius: 16, padding: 15, marginTop: 18 },
  noteTitle: { fontSize: 14, fontWeight: '800', color: '#4B2946' },
  noteText: { marginTop: 6, fontSize: 12, lineHeight: 19, color: '#6C5368' },
  footer: { marginTop: 16, textAlign: 'center', color: '#8D6588', fontSize: 11, lineHeight: 17 },
});
