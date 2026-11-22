import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';
import { PRIZMA as P } from './prizmaTheme';

type ViewName = 'main' | 'signature' | 'privacy';
type Props = {
  userId: string;
  email: string;
  onEdit: () => void;
  onLogout: () => void;
  editing: boolean;
};

const readable = (value?: string) => value?.trim() || 'Henüz belirtilmedi';
const sections = [
  { key: 'style', icon: '♧', title: 'Stilim' },
  { key: 'colors', icon: '◐', title: 'Renk Paletim' },
  { key: 'skin_type', icon: '◯', title: 'Cilt Profilim' },
  { key: 'hair_type', icon: '〰', title: 'Saç Profilim' },
] as const;

export default function PrizmaProfileScreen({ userId, email, onEdit, onLogout, editing }: Props) {
  const [page, setPage] = useState<ViewName>('main');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('user_profiles').select('answers').eq('user_id', userId).maybeSingle();
      const profile = data?.answers;
      if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
        setAnswers(profile as Record<string, string>);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload, editing]);
  const row = (title: string, detail: string, action: () => void, icon = '›') => (
    <TouchableOpacity key={title} style={s.menuRow} onPress={action} accessibilityRole="button">
      <View style={s.menuCopy}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowDetail}>{detail}</Text>
      </View>
      <Text style={s.chevron}>{icon}</Text>
    </TouchableOpacity>
  );

  if (page === 'signature') {
    return (
      <View style={s.page}>
        <TouchableOpacity accessibilityRole="button" onPress={() => setPage('main')} style={s.back}><Text style={s.backText}>‹ Profil</Text></TouchableOpacity>
        <Text style={s.heading}>PRİZMA İmzam</Text>
        <Text style={s.subtitle}>Sana özel stil ve güzellik kimliğin.</Text>
        <View style={s.signature}>
          <Text style={s.signatureIcon}>◎</Text>
          <Text style={s.signatureTitle}>PRİZMA İmzam</Text>
          <Text style={s.signatureDesc}>Tercihlerini tek bir yerden keşfet ve düzenle.</Text>
        </View>
        <Text style={s.sectionTitle}>Profil Özeti</Text>
        <View style={s.grid}>
          {sections.map((item) => (
            <View style={s.gridCard} key={item.key}>
              <Text style={s.gridIcon}>{item.icon}</Text>
              <Text style={s.gridTitle}>{item.title}</Text>
              <Text style={s.gridValue} numberOfLines={2}>{readable(answers[item.key])}</Text>
            </View>
          ))}
        </View>
        <View style={s.infoBox}>
          <Text style={s.sectionTitle}>PRİZMA AI Özeti</Text>
          <Text style={s.paragraph}>PRİZMA, izin verdiğin tercihleri kullanarak önerilerini kişiselleştirmeyi hedefler. Yeni öğrenilen bilgiler yalnızca onayınla kaydedilecek.</Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.sectionTitle}>Hedeflerim ve Tercihlerim</Text>
          <Text style={s.paragraph}>Stil ve güzellik tercihlerini dilediğin zaman düzenleyebilirsin.</Text>
          <TouchableOpacity style={s.primaryButton} onPress={onEdit} disabled={editing}>
            <Text style={s.primaryText}>{editing ? 'Açılıyor...' : 'Tercihlerimi Düzenle'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (page === 'privacy') {
    return (
      <View style={s.page}>
        <TouchableOpacity accessibilityRole="button" onPress={() => setPage('main')} style={s.back}><Text style={s.backText}>‹ Profil</Text></TouchableOpacity>
        <Text style={s.heading}>Gizlilik ve Veri Yönetimi</Text>
        <Text style={s.subtitle}>Verilerinin nasıl kullanıldığını şeffaf biçimde gör.</Text>
        <View style={s.infoBox}>
          <Text style={s.sectionTitle}>AI Öğrenme İzinleri</Text>
          <Text style={s.paragraph}>Tercihlerinden otomatik öğrenme ve sohbetlerini kişiselleştirmede kullanma şu anda etkin değil. Bu özellikler izin yönetimi ve veri silme mekanizmaları tamamlandığında açılacak.</Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.sectionTitle}>Kayıtlı Stil Tercihleri</Text>
          <Text style={s.paragraph}>Profil bilgilerini görmek ve değiştirmek için PRİZMA İmzam bölümünü kullan.</Text>
          <TouchableOpacity style={s.outlineButton} onPress={() => setPage('signature')}><Text style={s.outlineText}>PRİZMA İmzamı Aç</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.page}>
      <Text style={s.heading}>Profilim</Text>
      <View style={s.identity}>
        <View style={s.avatar}><Text style={s.avatarText}>◯</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>Hesabım</Text>
          <Text style={s.email} numberOfLines={2}>{email}</Text>
        </View>
      </View>
      {row('PRİZMA İmzam', 'Stil, renk, cilt ve saç profilim', () => { void reload(); setPage('signature'); }, '›')}
      <Text style={s.groupLabel}>HESAP VE AYARLAR</Text>
      {row('Hesap Bilgilerim', 'Profil tercihlerini düzenle', onEdit)}
      {row('Gizlilik ve Veri Yönetimi', 'AI öğrenme ve kişisel bilgiler', () => setPage('privacy'))}
      {row('Bildirimler', 'Bildirim tercihleri', () => setPage('privacy'))}
      {row('Uygulama Ayarları', 'Erişilebilirlik ve görünüm', () => setPage('privacy'))}
      <View style={s.infoBox}><Text style={s.paragraph}>Premium üyelik seçenekleri ve uygulama ayarları geliştirme sürecinde netleştirilecek.</Text></View>
      <TouchableOpacity style={s.logout} onPress={onLogout} accessibilityRole="button"><Text style={s.logoutText}>Çıkış Yap</Text></TouchableOpacity>
      {loading && <ActivityIndicator color={P.purple}/>}
    </View>
  );
}
const s = StyleSheet.create({
  page: { paddingBottom: 36, gap: 10 },
  heading: { fontSize: 24, fontWeight: '700', color: P.ink, marginBottom: 2 },
  subtitle: { color: P.muted, fontSize: 13, marginBottom: 8, lineHeight: 20 },
  identity: { backgroundColor: P.white, borderColor: P.border, borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: P.purpleLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: P.purple, fontSize: 30 },
  name: { fontSize: 16, fontWeight: '700', color: P.ink },
  email: { color: P.muted, fontSize: 12, marginTop: 4 },
  groupLabel: { color: P.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 18, marginBottom: 4 },
  menuRow: { minHeight: 62, borderWidth: 1, borderColor: P.border, borderRadius: 14, backgroundColor: P.white, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  menuCopy: { flex: 1 },
  rowTitle: { color: P.ink, fontSize: 14, fontWeight: '600' },
  rowDetail: { color: P.muted, fontSize: 12, marginTop: 4 },
  chevron: { color: P.purple, fontSize: 25, marginLeft: 10 },
  back: { minHeight: 48, justifyContent: 'center' },
  backText: { color: P.purple, fontSize: 14, fontWeight: '700' },
  signature: { alignItems: 'center', padding: 18, backgroundColor: P.purpleLight, borderRadius: 18, borderWidth: 1, borderColor: P.border, marginBottom: 10 },
  signatureIcon: { fontSize: 30, color: P.purple },
  signatureTitle: { fontSize: 18, color: P.purpleDark, fontWeight: '700', marginTop: 6 },
  signatureDesc: { color: P.muted, fontSize: 12, marginTop: 5, textAlign: 'center' },
  sectionTitle: { color: P.ink, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  gridCard: { width: '48%', minHeight: 112, padding: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.white, borderRadius: 14 },
  gridIcon: { color: P.purple, fontSize: 21, marginBottom: 7 },
  gridTitle: { fontSize: 13, fontWeight: '700', color: P.ink },
  gridValue: { color: P.muted, fontSize: 12, marginTop: 5 },
  infoBox: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, padding: 16, marginBottom: 6 },
  paragraph: { color: P.muted, fontSize: 13, lineHeight: 20 },
  primaryButton: { marginTop: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: P.purple },
  primaryText: { color: P.white, fontWeight: '700', fontSize: 14 },
  outlineButton: { marginTop: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: P.purple },
  outlineText: { color: P.purple, fontWeight: '700', fontSize: 14 },
  logout: { minHeight: 48, borderWidth: 1, borderColor: P.border, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  logoutText: { color: P.danger, fontSize: 14, fontWeight: '700' },
});
