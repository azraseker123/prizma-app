import { Linking } from 'react-native';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';
import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

type ShoppingCategory = 'clothing' | 'skin' | 'hair' | 'makeup';
type QuestionKey = 'need' | 'frequency' | 'fit' | 'similar' | 'affordability';
type Questionnaire = Partial<Record<QuestionKey, string>>;
const questionKeys: QuestionKey[] = ['need', 'frequency', 'fit', 'similar', 'affordability'];
const questions: { key: QuestionKey; label: (category: ShoppingCategory) => string; choices: { label: string; value: string }[] }[] = [
  { key: 'need', label: () => 'Bu ürüne ne kadar ihtiyacın var?', choices: [
    { label: 'Gerçekten ihtiyacım var', value: 'high' },
    { label: 'İşime yarayabilir', value: 'medium' },
    { label: 'Daha çok hoşuma gitti', value: 'low' },
  ] },
  { key: 'frequency', label: () => 'Ne sıklıkla kullanırsın?', choices: [
    { label: 'Çok sık', value: 'often' }, { label: 'Ara sıra', value: 'sometimes' },
    { label: 'Nadiren', value: 'rarely' }, { label: 'Henüz bilmiyorum', value: 'unknown' },
  ] },
  { key: 'fit', label: category => category === 'clothing'
    ? 'Gardırobunla uyumu nasıl?' : 'Mevcut güzellik ürünlerinle ve kullanım alışkanlıklarınla uyumu nasıl?', choices: [
    { label: 'Uyumlu', value: 'good' }, { label: 'Kısmen uyumlu', value: 'partial' },
    { label: 'Uyumsuz', value: 'poor' }, { label: 'Emin değilim', value: 'unknown' },
  ] },
  { key: 'similar', label: category => category === 'clothing'
    ? 'Zaten benzer bir kıyafetin var mı?' : 'Zaten aynı işlevi gören bir ürünün var mı?', choices: [
    { label: 'Evet, var', value: 'yes' }, { label: 'Hayır, yok', value: 'no' },
    { label: 'Emin değilim', value: 'unknown' },
  ] },
  { key: 'affordability', label: () => 'Fiyat bütçene uygun mu?', choices: [
    { label: 'Rahatlıkla karşılarım', value: 'comfortable' },
    { label: 'Bütçemi zorlar', value: 'stretch' },
    { label: 'Şu an karşılayamam', value: 'cannot' },
  ] },
];
const categoryOptions: { value: ShoppingCategory; label: string }[] = [
  {value:'clothing',label:'Giyim'}, {value:'skin',label:'Cilt'}, {value:'hair',label:'Saç'}, {value:'makeup',label:'Makyaj'}
];
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
  category?: ShoppingCategory;
  score: number;
  product: string;
  summary: string;
  reasons: string[];
  outfits: string[];
  warnings?: string[];
  knownFacts?: string[];
  toVerify?: string[];
  sections?: {
    signatureFit: string;
    wardrobeFit: string;
    similarItems: string;
    needAnalysis: string;
    priceAnalysis: string;
    usagePotential: string;
    alternativeDecision: string;
  };
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
  const [category, setCategory] = useState<ShoppingCategory>('clothing');
  const [price, setPrice] = useState('');
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [answers, setAnswers] = useState<Questionnaire>({});
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
            category: result.category || category,
            history,
            answers,
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
      console.error('PRIZMA AI chat error:', e);
      showNotice(
        'error',
        'PRİZMA şu anda yanıt veremiyor',
        'Mesajını göndermeyi tekrar deneyebilirsin.'
      );
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
    if (!questionKeys.every(key => Boolean(answers[key]))) {
      showNotice('info', '5 kısa soru', 'Daha doğru değerlendirebilmek için önce beş soruyu cevapla.');
      return;
    }

    setLoading(true);
    setResult(null);
    setMessages([]);
    setMessage('');

    try {
      let items: unknown[] = [];
      if (category === 'clothing') {
        const { data, error: wardrobeError } = await supabase
          .from('wardrobe_items')
          .select('id,name,category,color,season,notes')
          .eq('user_id', userId)
          .limit(100);
        if (wardrobeError) throw wardrobeError;
        items = data || [];
      }

      const { data, error } = await supabase.functions.invoke(
        'analyze-shopping',
        {
          body: {
            imageBase64: base64,
            mimeType: 'image/jpeg',
            price: p,
            budget: b,
            note: note.trim(),
            category,
            answers,
            wardrobe: category === 'clothing' ? items || [] : [],
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

      setResult({ ...(data as Analysis), category });
    } catch (e: any) {
      console.error('PRIZMA AI analysis error:', e);
      showNotice(
        'error',
        'Analiz şu anda tamamlanamadı',
        'Fotoğrafın ve girdiğin bilgiler yerinde duruyor. Biraz sonra yeniden deneyebilirsin.'
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
        Kıyafet, cilt, saç veya makyaj ürünü seç. PRİZMA,
        ürünü kendi kategorisine göre değerlendirsin.
      </Text>

      <Text style={styles.label}>Hangi ürün grubunu değerlendiriyoruz?</Text>
      <View style={styles.categoryRow}>
        {categoryOptions.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[styles.categoryChip, category === option.value && styles.categoryActive]}
            onPress={() => { setCategory(option.value); setAnswers({}); setResult(null); setMessages([]); }}
            disabled={loading}
          >
            <Text style={[styles.categoryText, category === option.value && styles.categoryTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
        placeholder={category === 'clothing' ? "Örn. Günlük kombinlerimde kullanmak istiyorum." : "Örn. Nasıl kullanacağım, elimde benzeri var mı?"}
        multiline
        value={note}
        onChangeText={v => { setNote(v); setResult(null); }}
      />

      <View style={styles.questionsSection}>
        <Text style={styles.questionsTitle}>✦ Satın Almadan Önce 5 Kısa Soru</Text>
        <Text style={styles.questionsCaption}>Yanıtların değerlendirmeye eklenir. Emin değilsen bunu belirtebilirsin.</Text>
        {questions.map((question, index) => (
          <View key={question.key} style={styles.questionCard}>
            <Text style={styles.questionTitle}>{index + 1}. {question.label(category)}</Text>
            <View style={styles.answerRow}>
              {question.choices.map(choice => (
                <TouchableOpacity
                  key={choice.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: answers[question.key] === choice.value }}
                  style={[styles.answerChip, answers[question.key] === choice.value && styles.answerChipSelected]}
                  onPress={() => {
                    setAnswers(current => ({ ...current, [question.key]: choice.value }));
                    setResult(null);
                    setMessages([]);
                  }}
                  disabled={loading}
                >
                  <Text style={[styles.answerText, answers[question.key] === choice.value && styles.answerTextSelected]}>{choice.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>{category === 'clothing' ? '✦ Gardırop bağlantısı' : '✦ Güzellik Koleksiyonum bağlantısı'}</Text>
        <Text style={styles.infoText}>
          {category === 'clothing'
            ? 'PRİZMA, kayıtlı kıyafetlerinin metin bilgilerini karşılaştırmaya dahil eder. Gardırop fotoğrafları gönderilmez.'
            : 'PRİZMA, güzellik koleksiyonundaki ilgili ürünlerin adlarını ve markalarını karşılaştırır. İçerikler bilinmiyorsa tahmin etmez.'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, (loading || !questionKeys.every(key => !!answers[key])) && { opacity: 0.6 }]}
        disabled={loading || !questionKeys.every(key => !!answers[key])}
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
          <View style={styles.evidencePanel}>
            <Text style={styles.evidenceTitle}>✓ Bildiklerimiz</Text>
            {result.knownFacts?.length ? result.knownFacts.map((fact, i) => (
              <Text key={'fact-' + i} style={styles.evidenceText}>• {fact}</Text>
            )) : <Text style={styles.evidenceText}>Fotoğrafta görülenler ve girdiğin fiyat/bütçe bilgileri dışında doğrulanmış ürün bilgisi yok.</Text>}
            <Text style={[styles.evidenceTitle, styles.verifyTitle]}>? Doğrulanması gerekenler</Text>
            {result.toVerify?.length ? result.toVerify.map((fact, i) => (
              <Text key={'verify-' + i} style={styles.evidenceText}>• {fact}</Text>
            )) : <Text style={styles.evidenceText}>Ürünün tam adı, formülü ve varsa SPF değeri gibi özellikler ambalajdan veya resmi ürün bilgisinden kontrol edilmeli.</Text>}
          </View>

          {result.sections && (
            <View style={styles.analysisSections}>
              <Text style={styles.resultHeading}>
                ✦ Detaylı Ürün Değerlendirmesi
              </Text>
              {([
                ['✦', category === 'clothing' ? 'PRİZMA İmzan ile Uyumu' : 'İhtiyaçlarınla Uyumu', result.sections.signatureFit],
                ['◈', category === 'clothing' ? 'Dolap Uyumu' : 'Ürün Uygunluğu', result.sections.wardrobeFit],
                ['◇', category === 'clothing' ? 'Benzer Ürün Kontrolü' : 'Koleksiyonunda Benzeri Var mı?', result.sections.similarItems],
                ['◎', 'İhtiyaç Analizi', result.sections.needAnalysis],
                ['₺', 'Fiyat Değerlendirmesi', result.sections.priceAnalysis],
                ['◷', 'Kullanım Potansiyeli', result.sections.usagePotential],
                ['⚖', 'Alternatif Karar', result.sections.alternativeDecision],
              ] as [string, string, string][]).map(([symbol, title, description]) => (
                <View key={title} style={styles.analysisCard}>
                  <Text style={styles.analysisCardTitle}>
                    {symbol}  {title}
                  </Text>
                  <Text style={styles.analysisCardText}>
                    {description}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.resultHeading}>Neden?</Text>
          {result.reasons.map((r, i) => (
            <Text key={i} style={styles.detail}>✦ {r}</Text>
          ))}

          {category === 'clothing' && result.outfits.length > 0 && (
            <>
              <Text style={styles.resultHeading}>Kombin fikirleri</Text>
              {result.outfits.map((o, i) => (
                <Text key={i} style={styles.detail}>◇ {o}</Text>
              ))}
            </>
          )}

          {(result.warnings || []).map((w, i) => (
            <Text key={i} style={styles.warning}>Not: {w}</Text>
          ))}

          {category === 'clothing' && (
          <>
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
          </>
          )}

          <Text style={styles.resultHeading}>PRİZMA'ya sor ✦</Text>
          <Text style={styles.chatHint}>
            {category === 'clothing'
              ? 'Kombinleri değiştirebilir, farklı seçenekler sorabilir veya kararı tartışabilirsin.'
              : 'İçerik, kullanım, alternatif ürünler veya fiyat konusunda sorular sorabilirsin.'}
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
            placeholder={category === 'clothing' ? "Örn. Siyah etekle nasıl kombinlerim?" : "Örn. Bu ürünün avantajları neler?"}
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
  questionsSection: { marginBottom: 22 },
  questionsTitle: { color: C.navy, fontWeight: '800', fontSize: 17, marginBottom: 7 },
  questionsCaption: { color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 12 },
  questionCard: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#E8DDF5', marginBottom: 10 },
  questionTitle: { color: C.navy, fontSize: 13, fontWeight: '800', marginBottom: 12 },
  answerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  answerChip: { backgroundColor: C.lilac, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11 },
  answerChipSelected: { backgroundColor: C.purple },
  answerText: { color: '#645778', fontSize: 11, fontWeight: '700' },
  answerTextSelected: { color: '#FFFFFF' },
  evidencePanel: { backgroundColor: '#FFFFFF', borderColor: '#E8DDF5', borderWidth: 1, borderRadius: 17, padding: 16, marginTop: 18 },
  evidenceTitle: { color: C.purple, fontSize: 14, fontWeight: '800', marginBottom: 7 },
  verifyTitle: { marginTop: 13 },
  evidenceText: { color: C.navy, fontSize: 12, lineHeight: 20, marginBottom: 4 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  categoryChip: { backgroundColor: '#F0E7FC', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 13 },
  categoryActive: { backgroundColor: '#8050B5' },
  categoryText: { color: '#655578', fontWeight: '700', fontSize: 12 },
  categoryTextActive: { color: '#FFFFFF' },
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
  analysisSections: {
    marginTop: 10,
  },
  analysisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E8DDF5',
  },
  analysisCardTitle: {
    color: C.purple,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  analysisCardText: {
    color: C.navy,
    fontSize: 13,
    lineHeight: 21,
  },
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
