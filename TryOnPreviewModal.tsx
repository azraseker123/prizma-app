import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { readTryOnPhoto } from './TryOnPhotoStore';

type Props = {
  visible: boolean;
  userId: string;
  item: { id: string; name: string; category: string; imageUrl: string | null } | null;
  onClose: () => void;
  onSetupPhoto: () => void;
};

export default function TryOnPreviewModal({ visible, userId, item, onClose, onSetupPhoto }: Props) {
  const [person, setPerson] = useState<{ path: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !item) return;
    let cancelled = false;
    setPerson(null);
    setError(null);
    setLoading(true);
    readTryOnPhoto(userId).then((value) => {
      if (!cancelled) setPerson(value);
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Fotoğraf açılamadı.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [visible, userId, item?.id]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Text style={s.back}>‹ Gardıroba dön</Text></TouchableOpacity>
          <Text style={s.headerTitle}>Sanal Deneme </Text>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.eyebrow}>PRİZMA FITTING ROOM</Text>
          <Text style={s.title}>Üzerimde Dene</Text>
          <Text style={s.subtitle}>Gardırobundaki kıyafet ile kayıtlı boydan fotoğrafın hazır olduğunda sanal deneme oluşturabileceksin.</Text>
          <View style={s.images}>
            <View style={s.pictureCard}>
              <Text style={s.pictureLabel}>BENİM FOTOĞRAFIM</Text>
              <View style={s.pictureWrap}>
                {loading ? <ActivityIndicator color="#8559B6" /> :
                  person ? <Image source={{ uri: person.url }} style={s.picture} resizeMode="contain" /> :
                  <Text style={s.placeholder}>{error ? 'Fotoğraf açılamadı.' : 'Henüz fotoğrafın yok'}</Text>}
              </View>
            </View>
            <View style={s.pictureCard}>
              <Text style={s.pictureLabel}>SEÇTİĞİM KIYAFET</Text>
              <View style={s.pictureWrap}>
                {item?.imageUrl
                  ? <Image source={{ uri: item.imageUrl }} style={s.picture} resizeMode="contain" />
                  : <Text style={s.placeholder}>Kıyafet görseli bulunamadı</Text>}
              </View>
            </View>
          </View>
          <Text style={s.itemName}>{item?.name || 'Kıyafet'}</Text>
          <Text style={s.itemCategory}>{item?.category || ''}</Text>
          {error ? <Text style={s.warning}>{error}</Text> : null}
          {!person && !loading && (
            <TouchableOpacity style={s.setupButton} onPress={onSetupPhoto}>
              <Text style={s.primaryText}>Boydan fotoğrafımı ekle →</Text>
            </TouchableOpacity>
          )}
          <View style={s.nextPanel}>
            <Text style={s.nextTitle}> Sonraki adım: AI sanal deneme</Text>
            <Text style={s.nextText}>Bu ekran şu anda fotoğraf ve kıyafet seçimini test ediyor. Gerçek görsel üretimi henüz açık değil; bu ekranda herhangi bir AI hakkı harcanmaz veya ücretli istek gönderilmez.</Text>
          </View>
          <View style={[s.disabledButton]}>
            <Text style={s.disabledText}>AI ile Üzerimde Dene · Yakında</Text>
          </View>
          <Text style={s.note}>AI sanal deneme fotoğrafını bir dış hizmete göndererek işler; bu aşama etkinleştirilmeden önce bilgilendirme ve onay akışını ekleyeceğiz. Görüntüler gerçek beden/kalıp uyumunu garanti etmez.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF9FC' },
  header: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomColor: '#EFE6F4', borderBottomWidth: 1 },
  back: { color: '#8050B5', fontSize: 13, fontWeight: '800' },
  headerTitle: { color: '#271B3E', fontSize: 15, fontWeight: '800', marginTop: 8 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 50 },
  eyebrow: { fontSize: 10, color: '#9A79B2', letterSpacing: 1.4, fontWeight: '800' },
  title: { fontSize: 27, color: '#25193A', fontWeight: '800', marginTop: 5 },
  subtitle: { fontSize: 13, color: '#756A86', lineHeight: 20, marginTop: 9, marginBottom: 22 },
  images: { flexDirection: 'row', gap: 10 },
  pictureCard: { flex: 1, backgroundColor: '#F1EAF8', borderWidth: 1, borderColor: '#E6D8F0', borderRadius: 17, padding: 9 },
  pictureLabel: { textAlign: 'center', fontSize: 10, color: '#71518D', fontWeight: '800', marginBottom: 10 },
  pictureWrap: { height: 235, alignItems: 'center', justifyContent: 'center' },
  picture: { height: '100%', width: '100%' },
  placeholder: { textAlign: 'center', fontSize: 12, color: '#887998', lineHeight: 18 },
  itemName: { textAlign: 'center', marginTop: 17, fontSize: 17, fontWeight: '800', color: '#302342' },
  itemCategory: { textAlign: 'center', fontSize: 12, color: '#83758F', marginTop: 4 },
  warning: { color: '#A34C60', fontSize: 12, marginTop: 12, textAlign: 'center' },
  setupButton: { backgroundColor: '#8050B5', borderRadius: 14, marginTop: 21, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  nextPanel: { backgroundColor: '#FFFFFF', borderRadius: 16, borderColor: '#E7DDF0', borderWidth: 1, padding: 16, marginTop: 22 },
  nextTitle: { color: '#443058', fontWeight: '800', fontSize: 14 },
  nextText: { color: '#776984', fontSize: 12, lineHeight: 19, marginTop: 6 },
  disabledButton: { backgroundColor: '#E6E2EC', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 13 },
  disabledText: { color: '#8C8096', fontWeight: '800', fontSize: 13 },
  note: { color: '#8A7F95', fontSize: 11, lineHeight: 18, marginTop: 16 },
});
