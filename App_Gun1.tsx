import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Tab = 'Ana Sayfa' | 'Gardırop' | 'PRİZMA AI' | 'Güzellik' | 'Profil';
const tabs: { name: Tab; icon: string }[] = [
  { name: 'Ana Sayfa', icon: '⌂' },
  { name: 'Gardırop', icon: '♧' },
  { name: 'PRİZMA AI', icon: '✦' },
  { name: 'Güzellik', icon: '♡' },
  { name: 'Profil', icon: '◯' },
];
const C = { bg: '#FAF8F6', ink: '#343039', muted: '#817B83', pink: '#F4DDE5', lilac: '#E7DDF5', cream: '#F4EDE6', white: '#FFFFFF', line: '#ECE5E9' };

function Tile({ icon, title, subtitle, tint, onPress }: { icon: string; title: string; subtitle: string; tint: string; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.tile, { backgroundColor: tint }]}>
    <Text style={styles.tileIcon}>{icon}</Text><Text style={styles.tileTitle}>{title}</Text><Text style={styles.tileSub}>{subtitle}</Text>
  </TouchableOpacity>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Ana Sayfa');
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
    <View style={styles.top}><Text style={styles.brand}>PRİZMA <Text style={styles.sparkle}>✦</Text></Text><Text style={styles.topRight}>SOFT LUXURY AI</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      {tab === 'Ana Sayfa' ? <>
        <View style={styles.hero}><Text style={styles.eyebrow}>SENİN STİLİN, SENİN DÜNYAN</Text><Text style={styles.heroTitle}>Bugün nasıl parlamak istersin?</Text><Text style={styles.body}>Gardırobunu keşfet, güzellik rutinini düzenle ve alışveriş kararlarını daha bilinçli ver.</Text><TouchableOpacity style={styles.heroButton} onPress={() => setTab('PRİZMA AI')}><Text style={styles.heroButtonText}>✦  PRİZMA AI'ya sor  →</Text></TouchableOpacity></View>
        <Text style={styles.section}>Senin alanın</Text>
        <View style={styles.grid}>
          <Tile icon="♧" title="Gardırobum" subtitle="Kombinlerini keşfet" tint={C.cream} onPress={() => setTab('Gardırop')} />
          <Tile icon="✧" title="Akıllı alışveriş" subtitle="Ürünleri değerlendir" tint={C.pink} onPress={() => setTab('PRİZMA AI')} />
          <Tile icon="♡" title="Güzellik" subtitle="Cilt, saç ve makyaj" tint={C.lilac} onPress={() => setTab('Güzellik')} />
          <Tile icon="◈" title="Stil DNA" subtitle="Sana özel profil" tint="#F2E8EB" onPress={() => setTab('Profil')} />
        </View>
        <View style={styles.note}><Text style={styles.noteTitle}>✦  PRİZMA'ya hoş geldin</Text><Text style={styles.body}>Bu ilk sürüm bir tasarım prototipidir. Kişisel analiz ve kayıt özelliklerini sonraki günlerde ekleyeceğiz.</Text></View>
      </> : <>
        <Text style={styles.eyebrow}>PRİZMA / {tab.toUpperCase()}</Text><Text style={styles.pageTitle}>{tab}</Text>
        <View style={styles.placeholder}><Text style={styles.placeholderIcon}>{tabs.find(t => t.name === tab)?.icon}</Text><Text style={styles.placeholderTitle}>{tab === 'PRİZMA AI' ? 'Kişisel asistanın yakında burada' : `${tab} alanın hazırlanıyor`}</Text><Text style={styles.bodyCenter}>Bu bölümün tasarım temelini oluşturduk. Gerçek özellikleri geliştirme planımıza göre adım adım ekleyeceğiz.</Text></View>
        <TouchableOpacity style={styles.backButton} onPress={() => setTab('Ana Sayfa')}><Text style={styles.backText}>← Ana sayfaya dön</Text></TouchableOpacity>
      </>}
    </ScrollView>
    <View style={styles.nav}>{tabs.map(item => <TouchableOpacity key={item.name} onPress={() => setTab(item.name)} style={styles.navItem}><Text style={[styles.navIcon, tab === item.name && styles.navActive]}>{item.icon}</Text><Text numberOfLines={1} style={[styles.navLabel, tab === item.name && styles.navActive]}>{item.name}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingTop: StatusBar.currentHeight ?? 0 },
  top: { paddingHorizontal: 23, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  brand: { fontSize: 25, fontWeight: '700', letterSpacing: 3, color: C.ink }, sparkle: { color: '#A68BCB' }, topRight: { fontSize: 9, letterSpacing: 1.6, color: C.muted },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 30 }, hero: { backgroundColor: C.pink, padding: 25, borderRadius: 25 },
  eyebrow: { color: '#94788B', fontSize: 10, fontWeight: '700', letterSpacing: 1.8, marginBottom: 12 },
  heroTitle: { color: C.ink, fontSize: 32, lineHeight: 39, fontFamily: 'serif', marginBottom: 12 },
  body: { color: C.muted, fontSize: 13, lineHeight: 21 },
  heroButton: { backgroundColor: C.white, alignSelf: 'flex-start', marginTop: 22, paddingVertical: 13, paddingHorizontal: 17, borderRadius: 14 },
  heroButtonText: { color: '#735B90', fontSize: 13, fontWeight: '700' },
  section: { fontFamily: 'serif', fontSize: 25, color: C.ink, marginTop: 27, marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  tile: { width: '48%', minHeight: 150, borderRadius: 20, padding: 17, justifyContent: 'flex-end' },
  tileIcon: { fontSize: 27, color: '#846E90', marginBottom: 14 }, tileTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginBottom: 5 }, tileSub: { color: C.muted, fontSize: 11 },
  note: { marginTop: 23, backgroundColor: C.white, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  noteTitle: { fontSize: 15, fontWeight: '700', color: '#8E70A8', marginBottom: 9 },
  pageTitle: { fontFamily: 'serif', fontSize: 34, color: C.ink, marginBottom: 20 },
  placeholder: { minHeight: 310, backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 26, justifyContent: 'center', alignItems: 'center' },
  placeholderIcon: { fontSize: 44, color: '#A68BCB', marginBottom: 18 }, placeholderTitle: { color: C.ink, fontSize: 20, fontFamily: 'serif', textAlign: 'center', marginBottom: 12 },
  bodyCenter: { color: C.muted, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  backButton: { alignSelf: 'center', marginTop: 24, padding: 12 }, backText: { color: '#866B9C', fontWeight: '600' },
  nav: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 4 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 }, navIcon: { fontSize: 22, color: '#B4AEB5' }, navLabel: { fontSize: 9, color: '#AAA2AC' }, navActive: { color: '#9270B1', fontWeight: '700' }
});
