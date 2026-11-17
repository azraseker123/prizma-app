import React, { useCallback, useEffect, useState } from 'react';
import { removeBeautyBackground } from './BeautyPhotoStore';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Modal,
} from 'react-native';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';
import { chooseTryOnPhoto, readTryOnPhoto, saveTryOnPhoto, deleteTryOnPhoto, validateTryOnImage, removeSavedTryOnBackground, prepareTryOnPhoto, type TryOnPhoto } from './TryOnPhotoStore';

type Props = { userId: string; onBack: () => void; recoveredCameraUri?: string | null; onRecoveredCameraHandled?: () => void };
type Notice = { type: NoticeType; title: string; message: string };

export default function TryOnProfileScreen({ userId, onBack, recoveredCameraUri, onRecoveredCameraHandled }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(null);
  const [draft, setDraft] = useState<TryOnPhoto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBg, setConfirmBg] = useState(false);
  const [consent, setConsent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setPhoto(await readTryOnPhoto(userId)); }
    catch (e) { setNotice({ type: 'error', title: 'Fotoğraf yüklenemedi', message: e instanceof Error ? e.message : 'Tekrar deneyebilirsin.' }); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!recoveredCameraUri) return;
    let active = true;
    void prepareTryOnPhoto(recoveredCameraUri).then(result => {
      if (!active) return;
      setDraft(result); setVerified(false); setConsent(false);
      setNotice({ type: 'info', title: 'Kamera fotoğrafın geri geldi', message: 'Çektiğin fotoğrafı yeniden çekmene gerek yok. Uygunluk kontrolüne izin verip kaydedebilirsin.' });
    }).catch(error => {
      if (active) setNotice({ type: 'error', title: 'Fotoğraf geri yüklenemedi', message: error instanceof Error ? error.message : 'Galeriden yüklemeyi deneyebilirsin.' });
    }).finally(() => { if (active) onRecoveredCameraHandled?.(); });
    return () => { active = false; };
  }, [recoveredCameraUri]);

  async function select(camera: boolean) {
    if (busy) return;
    try {
      const chosen = await chooseTryOnPhoto(camera, 'person');
      if (chosen) { setDraft(chosen); setVerified(false); setConsent(false); }
    } catch (e) {
      setNotice({ type: 'error', title: 'Fotoğraf seçilemedi', message: e instanceof Error ? e.message : 'Tekrar dene.' });
    }
  }

  async function save() {
    if (!draft || busy) return;
    if (!consent) { setNotice({ type: 'info', title: 'İzin gerekli', message: 'Fotoğrafın otomatik uygunluk kontrolüne gönderilmesi için önce izin vermelisin.' }); return; }
    setBusy(true);
    try {
      if (!verified) await validateTryOnImage(draft, 'person');
      await saveTryOnPhoto(userId, draft, photo?.path);
      setDraft(null);
      setConsent(false);
      setVerified(false);
      await reload();
      setNotice({ type: 'success', title: 'Fotoğrafın kaydedildi ✦', message: 'Kayıtlı fotoğrafını yeni kıyafet denemelerinde kullanabileceğiz.' });
    } catch (e) {
      setNotice({ type: 'error', title: 'Fotoğraf kaydedilemedi', message: e instanceof Error ? e.message : 'Tekrar dene.' });
    } finally { setBusy(false); }
  }

  async function removeBackground() {
    if (!draft || busy) return;
    if (!consent) { setNotice({ type: 'info', title: 'İzin gerekli', message: 'Fotoğrafın yapay zekâ tarafından incelenmesi için önce izin vermelisin.' }); return; }
    setBusy(true);
    try {
      if (!verified) await validateTryOnImage(draft, 'person');
      const cleaned = await removeBeautyBackground(draft.uri);
      setDraft({ uri: cleaned.uri, base64: cleaned.base64, mimeType: 'image/png' });
      setVerified(true);
      setNotice({ type: 'success', title: 'Arka plan kaldırıldı', message: 'Sonucu kaydetmeden önce inceleyebilirsin. Bu işlem arka plan kaldırma hakkını kullanır.' });
    } catch(e) { setNotice({ type: 'error', title: 'İşlem tamamlanamadı', message: e instanceof Error ? e.message : 'Tekrar deneyebilirsin.' }); }
    finally { setBusy(false); }
  }

  async function cleanSavedPhoto() {
    if (!photo || busy) return;
    setConfirmBg(false);
    setBusy(true);
    try {
      await removeSavedTryOnBackground(userId, photo.path);
      await reload();
      setNotice({ type: 'success', title: 'Arka plan kaldırıldı ✦', message: 'Kayıtlı fotoğrafın güncellendi. Arka plan kaldırma hakkından 1 işlem kullanıldı.' });
    } catch (e) {
      setNotice({ type: 'error', title: 'Arka plan kaldırılamadı', message: e instanceof Error ? e.message : 'Tekrar deneyebilirsin.' });
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
      <Modal transparent animationType="fade" visible={confirmBg} onRequestClose={() => setConfirmBg(false)}>
        <View style={s.overlay}>
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>Arka planı kaldıralım mı?</Text>
            <Text style={s.note}>Fotoğrafın arka planını kaldırmak için Bria AI kullanılır. İşlem 1 hakkını kullanır ve mevcut fotoğrafını yeni görselle değiştirir.</Text>
            <TouchableOpacity style={s.modalPrimary} onPress={() => void cleanSavedPhoto()} disabled={busy}>
              <Text style={s.modalPrimaryText}>Arka planı kaldır</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondary} onPress={() => setConfirmBg(false)} disabled={busy}>
              <Text style={s.modalSecondaryText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
        <Text style={s.subtitle}>Kıyafetli, tek kişilik ve baştan ayağa görünen fotoğrafını kaydet. AI uygunluk kontrolü boydan olmayan veya ilgisiz fotoğrafları reddeder.</Text>

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
        {draft && (
          <TouchableOpacity style={[s.secondary, { marginTop: 13, padding: 14 }]} disabled={busy} onPress={() => setConsent(!consent)}>
            <Text style={s.secondaryText}>{consent ? '☑' : '☐'} Fotoğrafımın AI uygunluk kontrolü için işlenmesine izin veriyorum.</Text>
          </TouchableOpacity>
        )}
        <View style={s.actions}>
          <TouchableOpacity style={s.secondary} disabled={busy || loading} onPress={() => void select(false)}>
            <Text style={s.secondaryText}>Galeriden seç</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondary} disabled={busy || loading} onPress={() => void select(true)}>
            <Text style={s.secondaryText}>Fotoğraf çek</Text>
          </TouchableOpacity>
        </View>
        {draft && (
          <TouchableOpacity style={[s.secondary, { marginTop: 10, padding: 13 }]} disabled={busy || !consent} onPress={() => void removeBackground()}>
            <Text style={s.secondaryText}>{busy ? 'İşleniyor…' : '✦ Arka planı kaldır'}</Text>
          </TouchableOpacity>
        )}
        {draft && (
          <View style={s.actions}>
            <TouchableOpacity style={s.primary} disabled={busy} onPress={() => void save()}>
              <Text style={s.primaryText}>{busy ? 'Kaydediliyor…' : 'Fotoğrafımı kaydet ✦'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} disabled={busy} onPress={() => { setDraft(null); setConsent(false); setVerified(false); }}>
              <Text style={s.secondaryText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        )}
        {photo && !draft && (
          <TouchableOpacity style={[s.secondary, { marginTop: 14, paddingVertical: 14 }]} disabled={busy || loading} onPress={() => setConfirmBg(true)}>
            <Text style={s.secondaryText}>✦ Arka planı kaldır</Text>
          </TouchableOpacity>
        )}
        {photo && !draft && (
          <TouchableOpacity style={s.deleteButton} disabled={busy} onPress={() => setConfirmDelete(true)}>
            <Text style={s.deleteText}>Kayıtlı fotoğrafımı sil</Text>
          </TouchableOpacity>
        )}

        <View style={s.guide}>
          <Text style={s.guideTitle}>✦ Daha iyi sonuç için</Text>
          <Text style={s.guideText}>{['• Başın ve ayakların fotoğrafta bulunsun.', '• Net ışıkta, sade bir arka plan seç.', '• Günlük kıyafetler yeterli.', '• Fotoğrafını istediğin zaman değiştirebilir veya silebilirsin.'].join('\n')}</Text>
        </View>
        <Text style={s.privacy}>🔒 Fotoğrafın hesabına özel saklanır. AI fotoğraf kontrolünde Gemini, arka plan kaldırmada Bria kullanılır. Gerçek sanal denemeden önce ayrıca onay istenir.</Text>
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
  confirmBox: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 20, width: '100%', alignSelf: 'center' },
  modalPrimary: { flexGrow: 0, flexShrink: 0, width: '100%', height: 52, borderRadius: 13, backgroundColor: '#8050B5', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  modalPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  modalSecondary: { flexGrow: 0, flexShrink: 0, width: '100%', height: 48, borderRadius: 13, backgroundColor: '#EEE5F5', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalSecondaryText: { color: '#724D93', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  confirmTitle: { color: '#302048', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  danger: { backgroundColor: '#A3546D', borderRadius: 13, alignItems: 'center', padding: 14, marginTop: 18 },
});
