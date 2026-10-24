import React, { useState } from 'react';
import {
  SafeAreaView, StatusBar, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';

type Tab = 'Ana Sayfa' | 'Gardırop' | 'PRİZMA AI' | 'Güzellik' | 'Profil';
const tabs: { name: Tab; icon: string }[] = [
  { name: 'Ana Sayfa', icon: '⌂' },
  { name: 'Gardırop', icon: '◇' },
  { name: 'PRİZMA AI', icon: '✦' },
  { name: 'Güzellik', icon: '♡' },
  { name: 'Profil', icon: '○' },
];
const C = {
  background: '#FAF7F4', paper: '#FFFFFF', ink: '#302A32', muted: '#857D84',
  blush: '#F5E5E9', lavender: '#EEE7F8', cream: '#F4EDE4', line: '#EDE5E7',
  accent: '#8B6C96', dark: '#4D3A54',
};

function ActionCard({ symbol, title, description, background, onPress }: {
  symbol: string; title: string; description: string; background: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.actionCard, { backgroundColor: background }]}>
      <Text style={styles.actionSymbol}>{symbol}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
      <Text style={styles.cardArrow}>↗</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Ana Sayfa');
  const [notice, setNotice] = useState('');
  const open = (target: Tab) => { setNotice(''); setTab(target); };
  const demo = () => setNotice('Bu özellik sonraki geliştirme günlerinde eklenecek.');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>PRİZMA <Text style={styles.star}>✦</Text></Text>
          <Text style={styles.tagline}>STYLE • BEAUTY • YOU</Text>
        </View>
        <TouchableOpacity onPress={() => open('Profil')} style={styles.avatar} accessibilityLabel="Profil sekmesini aç">
          <Text style={styles.avatarText}>P</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'Ana Sayfa' ? (
          <>
            <Text style={styles.eyebrow}>SENİN STİL ALANIN</Text>
            <Text style={styles.heroTitle}>Kendini keşfet,{'\n'}<Text style={styles.heroItalic}>tarzını yansıt.</Text></Text>
            <Text style={styles.heroSubtitle}>Gardırobun, güzellik rutinin ve akıllı alışveriş asistanın tek bir yerde.</Text>
            <TouchableOpacity activeOpacity={0.85} style={styles.aiBanner} onPress={() => open('PRİZMA AI')}>
              <Text style={styles.aiSparkle}>✧  PRİZMA AI</Text>
              <Text style={styles.aiTitle}>Bugün ne giymeliyim?</Text>
              <Text style={styles.aiDescription}>Kişisel stil asistanını keşfet</Text>
              <Text style={styles.aiArrow}>→</Text>
            </TouchableOpacity>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Senin dünyan</Text>
              <Text style={styles.sectionHint}>KEŞFET</Text>
            </View>
            <View style={styles.cardsGrid}>
              <ActionCard symbol="♧" title="Gardırobum" description="Parçalarını bir araya getir" background={C.cream} onPress={() => open('Gardırop')} />
              <ActionCard symbol="✧" title="Akıllı alışveriş" description="Almadan önce birlikte düşün" background={C.blush} onPress={() => open('PRİZMA AI')} />
              <ActionCard symbol="♡" title="Güzellik" description="Sana özel bakım alanı" background={C.lavender} onPress={() => open('Güzellik')} />
              <ActionCard symbol="◈" title="Stil DNA'm" description="Tarzını daha iyi tanı" background="#F1ECEA" onPress={() => open('Profil')} />
            </View>
            <View style={styles.tipBox}>
              <Text style={styles.tipLabel}>✦  KÜÇÜK BİR NOT</Text>
              <Text style={styles.tipText}>En iyi stil, kendini iyi hissettiğin stildir.</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>PRİZMA • SENİN ALANIN</Text>
            <Text style={styles.pageTitle}>{tab}</Text>
            <View style={[styles.placeholder, { backgroundColor: tab === 'PRİZMA AI' ? C.lavender : C.blush }]}>
              <Text style={styles.placeholderIcon}>{tab === 'PRİZMA AI' ? '✦' : tab === 'Güzellik' ? '♡' : tab === 'Gardırop' ? '◇' : '◈'}</Text>
              <Text style={styles.placeholderTitle}>{tab === 'PRİZMA AI' ? 'Stil asistanın burada olacak' : tab === 'Gardırop' ? 'Gardırobun burada şekillenecek' : tab === 'Güzellik' ? 'Güzellik alanın hazırlanıyor' : 'Stil profilin burada olacak'}</Text>
              <Text style={styles.placeholderText}>Bu ekran şu anda tasarım önizlemesi. Gerçek özellikleri sonraki günlerde adım adım ekleyeceğiz.</Text>
              <TouchableOpacity style={styles.placeholderButton} onPress={demo}>
                <Text style={styles.placeholderButtonText}>Yakında ✦</Text>
              </TouchableOpacity>
              {!!notice && <Text style={styles.notice}>{notice}</Text>}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map(item => (
          <TouchableOpacity key={item.name} style={styles.tabItem} onPress={() => open(item.name)} accessibilityRole="tab" accessibilityState={{ selected: tab === item.name }}>
            <View style={[styles.tabIconWrap, tab === item.name && styles.activeIconWrap]}>
              <Text style={[styles.tabIcon, tab === item.name && styles.activeTab]}>{item.icon}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.tabText, tab === item.name && styles.activeTab]}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background, paddingTop: Platform.OS === 'android' ? 4 : 0 },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  wordmark: { color: C.ink, fontSize: 26, fontWeight: '700', letterSpacing: 4 },
  star: { color: C.accent, fontSize: 19 },
  tagline: { color: C.muted, fontSize: 9, letterSpacing: 2.4, marginTop: 3 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.blush, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: C.dark, fontWeight: '700', fontSize: 17 },
  content: { paddingHorizontal: 24, paddingTop: 27, paddingBottom: 30 },
  eyebrow: { color: C.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2.2, marginBottom: 12 },
  heroTitle: { color: C.ink, fontSize: 33, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', lineHeight: 43 },
  heroItalic: { color: C.accent, fontStyle: 'italic' },
  heroSubtitle: { color: C.muted, fontSize: 13, lineHeight: 21, marginTop: 12, marginBottom: 25 },
  aiBanner: { backgroundColor: C.lavender, borderRadius: 24, padding: 22, minHeight: 150, marginBottom: 30 },
  aiSparkle: { color: C.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.7 },
  aiTitle: { color: C.ink, fontSize: 22, fontWeight: '600', marginTop: 14 },
  aiDescription: { color: C.muted, fontSize: 12, marginTop: 6 },
  aiArrow: { color: C.dark, fontSize: 23, position: 'absolute', right: 22, bottom: 18 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: C.ink, fontSize: 21, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  sectionHint: { color: C.accent, fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  actionCard: { width: '48%', minHeight: 160, borderRadius: 20, padding: 17 },
  actionSymbol: { fontSize: 27, color: C.dark, marginBottom: 12 },
  actionTitle: { color: C.ink, fontWeight: '700', fontSize: 15 },
  actionDescription: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 5, paddingRight: 5 },
  cardArrow: { color: C.dark, position: 'absolute', right: 15, top: 15, fontSize: 17 },
  tipBox: { borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 19, marginTop: 24 },
  tipLabel: { color: C.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 },
  tipText: { color: C.ink, fontSize: 13, marginTop: 9 },
  pageTitle: { color: C.ink, fontSize: 34, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 24 },
  placeholder: { borderRadius: 26, padding: 27, alignItems: 'center', justifyContent: 'center', minHeight: 330 },
  placeholderIcon: { color: C.accent, fontSize: 48, marginBottom: 15 },
  placeholderTitle: { color: C.ink, fontSize: 22, textAlign: 'center', fontWeight: '600' },
  placeholderText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 21, marginTop: 13 },
  placeholderButton: { backgroundColor: C.dark, borderRadius: 24, paddingHorizontal: 25, paddingVertical: 12, marginTop: 24 },
  placeholderButtonText: { color: C.paper, fontSize: 12, fontWeight: '700' },
  notice: { color: C.dark, textAlign: 'center', fontSize: 12, marginTop: 15 },
  tabBar: { backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 16 : 10, paddingHorizontal: 7 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIconWrap: { width: 36, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  activeIconWrap: { backgroundColor: C.lavender },
  tabIcon: { fontSize: 22, color: C.muted },
  tabText: { fontSize: 9, color: C.muted, marginTop: 3 },
  activeTab: { color: C.dark, fontWeight: '700' },
});
