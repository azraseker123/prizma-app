import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Modal,
} from 'react-native';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';
import { chooseTryOnPhoto, readTryOnPhoto, saveTryOnPhoto, deleteTryOnPhoto, type TryOnPhoto } from './TryOnPhotoStore';

type Props = { userId: string; onBack: () => void };
type Notice = { type: NoticeType; title: string; message: string };

export default function TryOnProfileScreen({ userId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(null);
  const [draft, setDraft] = useState<TryOnPhoto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setPhoto(await readTryOnPhoto(userId)); }
    catch (e) { setNotice({ type: 'error', title: 'Fotoğraf yüklenemedi', message: e instanceof Error ? e.message : 'Tekrar deneyebilirsin.' }); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  async function select(camera: boolean) {
    if (busy) return;
    try {
      const chosen = await chooseTryOnPhoto(camera);
      if (chosen) setDraft(chosen);
    } catch (e) {
      setNotice({ type: 'error', title: 'Fotoğraf seçilemedi', message: e instanceof Error ? e.message : 'Tekrar dene.' });
    }
  }

  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    try {
      await saveTryOnPhoto(userId, draft, photo?.path);
      setDraft(null);
      await reload();
      setNotice({ type: 'success', title: 'Fotoğrafın kaydedildi ✦', message: 'Kayıtlı fotoğrafını yeni kıyafet denemelerinde kullanabileceğiz.' });
    } catch (e) {
      setNotice({ type: 'error', title: 'Fotoğraf kaydedilemedi', message: e instanceof Error ? e.message : 'Tekrar dene.' });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!photo || busy) return;
    setBusy(true);
    setConfirmDelete(false);
    try {
      await deleteTryOnPhoto(userId, photo.path);
      setPhoto(null);
      setDraft(null);
      setNotice({ type: 'success', title: 'Fotoğraf silindi', message: 'Kayıtlı deneme fotoğrafın kaldırıldı.' });
    } catch (e) {
      setNotice({ type: 'error', title: 'Silinemedi', message: e instanceof Error ? e.message : 'Tekrar deneyebilirsin.' });
    } finally { setBusy(false); }
  }

  return (
    <View style={s.root}>
      <PrizmaNotice
        visible={!!notice} type={notice?.type || 'info'}
        title={notice?.title || ''} message={notice?.message || ''}
        onClose={() => setNotice(null)}
      />
      <Modal transparent animationType="fade" visible={confirmDelete} onRequestClose={() => setConfirmDelete(false)}>
        <View style={s.overlay}>
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>Fotoğrafını silelim mi?</Text>
            <Text style={s.note}>Kaydettiğin boydan fotoğraf silinecek. Sonradan yeniden yükleyebilirsin.</Text>
            <TouchableOpacity style={s.danger} onPress={() => void remove()} disabled={busy}>
              <Text style={s.primaryText}>Fotoğrafı sil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} onPress={() => setConfirmDelete(false)}>
              <Text style={s.secondaryText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={s.content}>
        <TouchableOpacity onPress={onBack} style={s.back}><Text style={s.backText}>‹ Profilime dön</Text></TouchableOpacity>
        <Text style={s.brand}>PRİZMA ✦ VIRTUAL TRY-ON</Text>
        <Text style={s.title}>Deneme Fotoğrafım</Text>
        <Text style={s.subtitle}>Kendi boydan fotoğrafını bir kez kaydet. Daha sonra gardırobundaki kıyafetleri bu fotoğrafta deneyebileceksin.</Text>

        <View style={s.photoFrame}>
          {loading ? <ActivityIndicator size="large" color="#8050B5" /> :
           draft || photo ? (
            <Image style={s.photo} resizeMode="contain" source={{ uri: draft?.uri || photo?.url }} />
           ) : (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>◇</Text>
              <Text style={s.emptyTitle}>Henüz fotoğraf yüklemedin</Text>
              <Text style={s.note}>Tam boy ve kıyafetli bir fotoğraf seçebilirsin.</Text>
            </View>
           )}
        </View>

        {draft && <Text style={s.draftBadge}>Önizleme · Fotoğraf henüz kaydedilmedi</Text>}
        <View style={s.actions}>
          <TouchableOpacity style={s.secondary} disabled={busy || loading} onPress={() => void select(false)}>
            <Text style={s.secondaryText}>Galeriden seç</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondary} disabled={busy || loading} onPress={() => void select(true)}>
            <Text style={s.secondaryText}>Fotoğraf çek</Text>
          </TouchableOpacity>
        </View>
        {draft && (
          <View style={s.actions}>
            <TouchableOpacity style={s.primary} disabled={busy} onPress={() => void save()}>
              <Text style={s.primaryText}>{busy ? 'Kaydediliyor…' : 'Fotoğrafımı kaydet ✦'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} disabled={busy} onPress={() => setDraft(null)}>
              <Text style={s.secondaryText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        )}
        {photo && !draft && (
          <TouchableOpacity style={s.deleteButton} disabled={busy} onPress={() => setConfirmDelete(true)}>
            <Text style={s.deleteText}>Kayıtlı fotoğrafımı sil</Text>
          </TouchableOpacity>
        )}

        <View style={s.guide}>
          <Text style={s.guideTitle}>✦ Daha iyi sonuç için</Text>
          <Text style={s.guideText}>• Ayakta, baştan ayağa göründüğün bir fotoğraf kullan.\n• İyi aydınlatılmış, sade bir arka plan seç.\n• Rahat, günlük kıyafetlerle çekilmiş bir fotoğraf yeterli.\n• Fotoğrafını istediğin zaman değiştirebilir veya silebilirsin.</Text>
        </View>
        <Text style={s.privacy}>🔒 Fotoğrafın herkese açık değildir. Hesabına bağlı özel depolamada saklanır. Sanal deneme özelliği daha sonra eklenecek; AI işlemine göndermeden önce ayrıca bilgilendirileceksin. Sonuçlar gerçek beden uyumunu garanti etmez.</Text>
        <Text style={s.dev}>Bu ekran avatar fotoğrafı kayıt altyapısının test sürümüdür. Premium üyelik doğrulaması henüz bağlanmadı.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF9FC' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 50 },
  back: { marginBottom: 22 }, backText: { color: '#8050B5', fontWeight: '700', fontSize: 14 },
  brand: { color: '#9B7CB4', fontSize: 11, letterSpacing: 1.6, fontWeight: '800' },
  title: { fontSize: 27, color: '#211A40', fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#6D647E', fontSize: 13, lineHeight: 21, marginTop: 9, marginBottom: 20 },
  photoFrame: { backgroundColor: '#F1EBF7', borderColor: '#E6D9EE', borderWidth: 1, borderRadius: 22, minHeight: 340, height: 410, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photo: { height: '100%', width: '100%' },
  empty: { alignItems: 'center', padding: 18 },
  emptyIcon: { fontSize: 46, color: '#8050B5' },
  emptyTitle: { color: '#33264E', fontWeight: '800', fontSize: 16, marginTop: 12 },
  note: { color: '#796E88', lineHeight: 19, fontSize: 12, textAlign: 'center', marginTop: 6 },
  draftBadge: { marginTop: 10, color: '#77559A', fontWeight: '700', textAlign: 'center', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  secondary: { flex: 1, paddingVertical: 13, paddingHorizontal: 8, backgroundColor: '#EEE5F5', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#724D93', fontWeight: '800', fontSize: 13 },
  primary: { flex: 1.5, backgroundColor: '#8050B5', paddingVertical: 13, paddingHorizontal: 8, borderRadius: 13, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  deleteButton: { marginTop: 15, padding: 10, alignItems: 'center' },
  deleteText: { color: '#A3546D', fontWeight: '700', fontSize: 13 },
  guide: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E1F1', padding: 18, borderRadius: 18, marginTop: 24 },
  guideTitle: { color: '#3D3056', fontWeight: '800', fontSize: 16, marginBottom: 7 },
  guideText: { color: '#726681', fontSize: 12, lineHeight: 22 },
  privacy: { color: '#766A83', lineHeight: 19, marginTop: 18, fontSize: 11 },
  dev: { color: '#9E91AD', lineHeight: 18, marginTop: 10, fontSize: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(13,9,28,0.6)', justifyContent: 'center', padding: 22 },
  confirmBox: { backgroundColor: 'white', padding: 20, borderRadius: 20 },
  confirmTitle: { color: '#302048', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  danger: { backgroundColor: '#A3546D', borderRadius: 13, alignItems: 'center', padding: 14, marginTop: 18 },
});
