import { Linking } from 'react-native';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';
import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

type Props = {
  onBack?: () => void;
  userId?: string;
};

type WardrobePhoto = {
  id: string;
  name: string;
  category: string;
  color: string | null;
  image_path: string;
  imageUrl: string | null;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

type Analysis = {
  verdict: 'AL' | 'BEKLE' | 'ALMA';
  score: number;
  product: string;
  summary: string;
  reasons: string[];
  outfits: string[];
  warnings?: string[];
};

const C = {
  navy: '#0B1436',
  purple: '#8050B5',
  lilac: '#F0E7FC',
  bg: '#FAF9FC',
  muted: '#77728A',
};

export default function ShoppingDecisionScreen({
  onBack, userId
}: Props) {

  const [notice, setNotice] = useState<{
    type: NoticeType;
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const showNotice = (
    type: NoticeType,
    title: string,
    message: string
  ) => {
    setNotice({ type, title, message });
  };

  const [photo, setPhoto] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [wardrobe, setWardrobe] = useState<WardrobePhoto[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadWardrobe() {
      if (!userId) return;

      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('id,name,category,color,image_path')
        .eq('user_id', userId)
        .limit(60);

      if (error || !data || !active) return;

      const loaded = await Promise.all(
        data.map(async item => {
          const { data: signed } = await supabase.storage
            .from('wardrobe')
            .createSignedUrl(item.image_path, 3600);

          return {
            ...item,
            imageUrl: signed?.signedUrl || null,
          };
        })
      );

      if (active) setWardrobe(loaded);
    }

    loadWardrobe();

    return () => { active = false; };
  }, [userId]);

  async function sendMessage() {
    const question = message.trim();
    if (!question || !result || chatLoading) return;

    const history = messages;
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setMessage('');
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'analyze-shopping',
        {
          body: {
            mode: 'chat',
            message: question,
            previous: result,
            history,
          },
        }
      );

      if (error) throw error;

      if (typeof data?.answer !== 'string' || !data.answer.trim()) {
        throw new Error('AI boş yanıt verdi.');
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: data.answer },
      ]);
    } catch (e: any) {
      showNotice('error', 'Sohbet hatası', e.message || 'Yanıt alınamadı.');
    } finally {
      setChatLoading(false);
    }
  }

  function matchedWardrobe() {
    if (!result) return [];

    const text = [
      result.summary,
      ...result.reasons,
      ...result.outfits,
    ].join(' ').toLocaleLowerCase('tr-TR');

    return wardrobe.filter(item =>
      item.imageUrl &&
      item.name.trim().length >= 3 &&
      text.includes(item.name.toLocaleLowerCase('tr-TR'))
    ).slice(0, 8);
  }

  async function choosePhoto(camera = false) {
    try {
      if (camera) {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          setNotice({
            type: 'info',
            title: 'Kamera izni gerekli',
            message: 'Fotoğraf çekebilmek için PRİZMA uygulamasına kamera izni vermelisin.',
            actionLabel: 'Ayarlara git',
            onAction: () => {
              setNotice(null);
              void Linking.openSettings();
            },
          });
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      };

      const picked = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];

      if (!asset.base64) {
        showNotice('error', 'Fotoğraf okunamadı', 'Lütfen başka bir fotoğraf dene.');
        return;
      }

      setPhoto(asset.uri);
      setBase64(asset.base64);
      setResult(null);
      setMessages([]);
      setMessage('');
    } catch (e: any) {
      showNotice('error', 'Fotoğraf hatası', e.message || 'İşlem başarısız.');
    }
  }

  async function analyze() {
    if (!base64) {
      showNotice('info', 'Fotoğraf gerekli', 'Önce ürün fotoğrafını yükle.');
      return;
    }

    const p = Number(price.replace(',', '.'));
    const b = Number(budget.replace(',', '.'));

    if (!Number.isFinite(p) || p <= 0 ||
        !Number.isFinite(b) || b <= 0) {
      showNotice('info', 'Bilgi eksik', 'Geçerli fiyat ve bütçe gir.');
      return;
    }

    if (!userId) {
      showNotice('error', 'Oturum gerekli', 'Lütfen tekrar giriş yap.');
      return;
    }

    setLoading(true);
    setResult(null);
    setMessages([]);
    setMessage('');

    try {
      const { data: items, error: wardrobeError } = await supabase
        .from('wardrobe_items')
        .select('id,name,category,color,season,notes')
        .eq('user_id', userId)
        .limit(100);

      if (wardrobeError) throw wardrobeError;

      const { data, error } = await supabase.functions.invoke(
        'analyze-shopping',
        {
          body: {
            imageBase64: base64,
            mimeType: 'image/jpeg',
            price: p,
            budget: b,
            note: note.trim(),
            wardrobe: items || [],
          },
        }
      );

      if (error) throw error;

      if (
        !data ||
        !['AL', 'BEKLE', 'ALMA'].includes(data.verdict) ||
        typeof data.score !== 'number' ||
        !Number.isFinite(data.score) ||
        data.score < 0 || data.score > 100 ||
        typeof data.summary !== 'string' ||
        !Array.isArray(data.reasons) ||
        !Array.isArray(data.outfits)
      ) {
        throw new Error('AI yanıtı beklenen formatta değil.');
      }

      setResult(data as Analysis);
    } catch (e: any) {
      showNotice(
        'error',
        'AI analizi tamamlanamadı',
        'Sunucu bağlantısı henüz kurulmamış veya bir hata oluşmuş olabilir. ' +
        (e.message || '')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PrizmaNotice
        visible={Boolean(notice)}
        type={notice?.type || 'info'}
        title={notice?.title || ''}
        message={notice?.message || ''}
        actionLabel={notice?.actionLabel}
        onAction={notice?.onAction}
        onClose={() => setNotice(null)}
      />
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {onBack && (
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Ana sayfaya dön</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.eyebrow}>PRİZMA ✦ SMART SHOPPING</Text>
      <Text style={styles.title}>Almaya değer mi?</Text>
      <Text style={styles.subtitle}>
        Beğendiğin ürünü yükle. PRİZMA, fotoğrafı,
        bütçeni ve gardırobunu birlikte değerlendirsin.
      </Text>

      <TouchableOpacity
        style={styles.upload}
        onPress={() => choosePhoto()}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.uploadIcon}>◇</Text>
            <Text style={styles.uploadTitle}>Ürün fotoğrafı yükle</Text>
            <Text style={styles.small}>Galerinden bir fotoğraf seç</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() => choosePhoto()}
        >
          <Text style={styles.secondaryText}>Galeriden seç</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() => choosePhoto(true)}
        >
          <Text style={styles.secondaryText}>Fotoğraf çek</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Ürünün fiyatı (₺)</Text>
      <TextInput
        style={styles.input}
        placeholder="Örn. 1500"
        keyboardType="decimal-pad"
        value={price}
        onChangeText={v => { setPrice(v); setResult(null); }}
      />

      <Text style={styles.label}>Bu alışveriş için bütçen (₺)</Text>
      <TextInput
        style={styles.input}
        placeholder="Örn. 2000"
        keyboardType="decimal-pad"
        value={budget}
        onChangeText={v => { setBudget(v); setResult(null); }}
      />

      <Text style={styles.label}>Ek bilgi (isteğe bağlı)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Örn. Günlük kombinlerimde kullanmak istiyorum."
        multiline
        value={note}
        onChangeText={v => { setNote(v); setResult(null); }}
      />

      <View style={styles.info}>
        <Text style={styles.infoTitle}>✦ Gardırop bağlantısı</Text>
        <Text style={styles.infoText}>
          PRİZMA, kayıtlı kıyafetlerinin ad, kategori,
          renk ve mevsim bilgilerini karşılaştırmaya
          dahil edecek. Gardırop fotoğrafları bu
          sürümde analize gönderilmiyor.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        disabled={loading}
        onPress={analyze}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>✦ PRİZMA AI İLE ANALİZ ET</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={styles.result}>
          <Text style={styles.resultLabel}>PRİZMA KARARI</Text>
          <Text style={styles.score}>{result.score}/100</Text>
          <Text style={styles.verdict}>{result.verdict}</Text>
          <Text style={styles.summary}>{result.summary}</Text>

          <Text style={styles.resultHeading}>Neden?</Text>
          {result.reasons.map((r, i) => (
            <Text key={i} style={styles.detail}>✦ {r}</Text>
          ))}

          <Text style={styles.resultHeading}>Kombin fikirleri</Text>
          {result.outfits.map((o, i) => (
            <Text key={i} style={styles.detail}>◇ {o}</Text>
          ))}

          {(result.warnings || []).map((w, i) => (
            <Text key={i} style={styles.warning}>Not: {w}</Text>
          ))}

          <Text style={styles.resultHeading}>Gardırobundan parçalar</Text>

          {matchedWardrobe().length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {matchedWardrobe().map(item => (
                <View key={item.id} style={styles.wardrobeCard}>
                  <Image
                    source={{ uri: item.imageUrl! }}
                    style={styles.wardrobeImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.wardrobeName} numberOfLines={2}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.detail}>
              Öneride adı geçen kayıtlı kıyafet bulunamadı.
              Gardırobundaki parçaları AI ile eşleştirmeyi
              geliştirmeye devam edeceğiz.
            </Text>
          )}

          <Text style={styles.resultHeading}>PRİZMA'ya sor ✦</Text>
          <Text style={styles.chatHint}>
            Kombinleri değiştirebilir, farklı seçenekler
            sorabilir veya kararı tartışabilirsin.
          </Text>

          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.chatBubble,
                m.role === 'user'
                  ? styles.userBubble
                  : styles.aiBubble,
              ]}
            >
              <Text style={styles.chatRole}>
                {m.role === 'user' ? 'SEN' : 'PRİZMA ✦'}
              </Text>
              <Text style={styles.chatText}>{m.text}</Text>
            </View>
          ))}

          {chatLoading && (
            <ActivityIndicator
              color={C.purple}
              style={{ marginVertical: 14 }}
            />
          )}

          <TextInput
            style={styles.chatInput}
            placeholder="Örn. Siyah etekle nasıl kombinlerim?"
            placeholderTextColor="#958BA2"
            multiline
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || chatLoading) && { opacity: 0.5 },
            ]}
            disabled={!message.trim() || chatLoading}
            onPress={sendMessage}
          >
            <Text style={styles.buttonText}>PRİZMA'YA GÖNDER ✦</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.footer}>
        PRİZMA ✦ Daha bilinçli alışveriş
      </Text>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 22, paddingBottom: 70 },
  back: { color: C.purple, fontSize: 15, marginBottom: 20 },
  eyebrow: { color: C.purple, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: C.navy, fontSize: 32, fontWeight: '800', marginTop: 12 },
  subtitle: { color: C.muted, fontSize: 14, lineHeight: 23, marginTop: 12, marginBottom: 25 },
  upload: { height: 245, borderRadius: 24, borderWidth: 1.5, borderColor: '#C7B2E8', borderStyle: 'dashed', overflow: 'hidden', backgroundColor: '#F1EBFA' },
  photo: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadIcon: { color: C.purple, fontSize: 48 },
  uploadTitle: { color: C.navy, fontSize: 17, fontWeight: '800', marginTop: 10 },
  small: { color: C.muted, fontSize: 12, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 25 },
  secondary: { flex: 1, padding: 14, backgroundColor: C.lilac, borderRadius: 14, alignItems: 'center' },
  secondaryText: { color: C.purple, fontWeight: '700', fontSize: 13 },
  label: { color: C.navy, fontWeight: '800', fontSize: 15, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E1ED', borderRadius: 16, padding: 16, fontSize: 15, marginBottom: 22, color: C.navy },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  info: { backgroundColor: C.lilac, padding: 18, borderRadius: 18, marginBottom: 20 },
  infoTitle: { color: C.navy, fontWeight: '800', fontSize: 15 },
  infoText: { color: C.muted, lineHeight: 20, fontSize: 12, marginTop: 8 },
  button: { backgroundColor: C.purple, borderRadius: 18, padding: 20, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  result: { backgroundColor: C.lilac, borderRadius: 24, padding: 22, marginTop: 25 },
  resultLabel: { color: C.purple, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  score: { color: '#50277A', fontSize: 49, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  verdict: { color: C.purple, fontSize: 32, fontWeight: '900', textAlign: 'center' },
  summary: { color: C.navy, lineHeight: 24, fontSize: 15, marginTop: 20 },
  resultHeading: { color: C.navy, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  detail: { color: C.navy, fontSize: 14, lineHeight: 23, marginBottom: 8 },
  warning: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 12 },
  wardrobeCard: {
    width: 130,
    marginRight: 12,
    padding: 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  wardrobeImage: {
    width: 112,
    height: 125,
    borderRadius: 10,
  },
  wardrobeName: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  chatHint: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 15,
  },
  chatBubble: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: '#DED0F4',
    marginLeft: 24,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    marginRight: 24,
  },
  chatRole: {
    color: C.purple,
    fontWeight: '900',
    fontSize: 10,
    marginBottom: 7,
  },
  chatText: {
    color: C.navy,
    fontSize: 14,
    lineHeight: 21,
  },
  chatInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9C8EB',
    borderRadius: 15,
    padding: 14,
    fontSize: 14,
    color: C.navy,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 10,
  },
  sendButton: {
    backgroundColor: C.purple,
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  footer: { color: C.muted, textAlign: 'center', fontSize: 12, marginTop: 30 },
});
