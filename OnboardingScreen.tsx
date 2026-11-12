import SkinTypeGuide from './SkinTypeGuide';
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Modal, SafeAreaView, Image, ImageBackground,
} from 'react-native';

export type OnboardingAnswers = Record<string, string>;

type Props = {
  onComplete: (answers: OnboardingAnswers) => void;
  initialAnswers?: OnboardingAnswers;
  editing?: boolean;
  onCancel?: () => void;
  saving?: boolean;
};

type Option = {
  name: string;
  subtitle: string;
  emoji: string;
  colors: string[];
};

type Question = {
  id: string;
  title: string;
  subtitle: string;
  multi: boolean;
  options: Option[];
};

const item = (
  name: string,
  subtitle: string,
  emoji: string,
  colors: string[],
): Option => ({ name, subtitle, emoji, colors });

const questions: Question[] = [
  {
    id: 'style',
    title: 'Tarzını Seç ✦',
    subtitle: 'Sana en yakın stiller hangileri?',
    multi: true,
    options: [
      item('Minimal', 'Sade ve zamansız', '🤍', ['#F1E8DD', '#D6C6B4', '#A99C8D']),
      item('Romantik', 'Zarif ve yumuşak', '🎀', ['#F6DCE8', '#E9B8CB', '#C996B1']),
      item('Klasik', 'Şık ve zamansız', '👜', ['#D7D0C7', '#77716E', '#25232A']),
      item('Modern', 'Güncel ve dinamik', '🕶️', ['#D7D7D7', '#92929B', '#34343B']),
      item('Bohem', 'Doğal ve özgür', '🌾', ['#E8D6B9', '#BC916C', '#8D6549']),
      item('Sportif', 'Rahat ve enerjik', '👟', ['#E5E6E9', '#BABEC6', '#7E8490']),
    ],
  },
  {
    id: 'colors',
    title: 'Renk Paletini Seç ✦',
    subtitle: 'Kullanmayı sevdiğin renk gruplarını seç.',
    multi: true,
    options: [
      item('Soft & Pastel', 'Pudra, pembe, lila', '🌷', ['#EACBD3', '#DDB5CB', '#C9B9E5', '#F5E9DE']),
      item('Nötr & Doğal', 'Krem, bej, taş', '☕', ['#F1E8DB', '#DCCBB8', '#B8A493', '#8C7969']),
      item('Kahve & Sıcak', 'Karamel, bronz', '🍫', ['#C8A17F', '#A67652', '#79503B', '#3C271F']),
      item('Klasik Tonlar', 'Siyah, beyaz, gri', '🖤', ['#F5F3F0', '#B9B7B7', '#77777C', '#24232A']),
      item('Canlı & Enerjik', 'Kırmızı, bordo', '🍒', ['#B41F3C', '#812E4C', '#D57E94', '#F2C3C8']),
      item('Serin & Modern', 'Mavi, lacivert', '🫧', ['#D3E1F1', '#9FB5D1', '#617C9F', '#263E66']),
    ],
  },
  {
    id: 'clothing',
    title: 'Giyimde Önceliğin ✦',
    subtitle: 'Kombinlerinde en çok neye önem verirsin?',
    multi: false,
    options: [
      item('Rahatlık', 'Konfor öncelikli', '☁️', ['#E7DFD5', '#BFB4A9']),
      item('Şıklık', 'Özenli kombinler', '✦', ['#D4C5D9', '#9376A5']),
      item('İkisi de', 'Dengeli seçimler', '⚖️', ['#E3D5E8', '#C7B7A8']),
      item('Duruma göre', 'Esnek tercihler', '✨', ['#D5D5E6', '#B9C9CE']),
    ],
  },
  {
    id: 'skin_type',
    title: 'Cilt Tipini Seç ✦',
    subtitle: 'Cildinin genel yapısına en yakın olanı seç.',
    multi: false,
    options: [
      item('Kuru', 'Gerginlik ve kuruluk', '💧', ['#F1D8C9', '#E5BCA9']),
      item('Yağlı', 'Parlama eğilimi', '✨', ['#E7C5AE', '#D9A68E']),
      item('Karma', 'Bölgelere göre değişir', '◐', ['#E6C7BA', '#CDA6A0']),
      item('Normal', 'Dengeli görünüm', '🌿', ['#EAD4C6', '#D6B8A8']),
    ],
  },
  {
    id: 'skin_undertone',
    title: 'Cilt Alt Tonun ✦',
    subtitle: 'Ten renginden bağımsız olarak alt tonunu seç. Emin değilsen atlayabilirsin.',
    multi: false,
    options: [
      item('Sıcak', 'Altın, sarı veya şeftali yansımalar', '☀️', ['#E9BC87', '#CE9567']),
      item('Soğuk', 'Pembe veya mavimsi yansımalar', '❄️', ['#E3B8C7', '#BD92AD']),
      item('Nötr', 'Sıcak ve soğuk tonlar dengeli', '◐', ['#D9B8A9', '#BEA7A6']),
      item('Zeytin', 'Yeşilimsi veya grileşen yansımalar', '🫒', ['#B6AA84', '#8B916B']),
      item('Emin değilim', 'Daha sonra belirleyebilirim', '❔', ['#DDD3E6', '#B9ACCB']),
    ],
  },
  {
    id: 'hair_color',
    title: 'Saç Rengin ✦',
    subtitle: 'Şu anki saç rengini seç. Sonradan değiştirebilirsin.',
    multi: false,
    options: [
      item('Siyah', 'Siyah tonları', '🖤', ['#222026', '#41404B']),
      item('Koyu kahverengi', 'Koyu kahve tonları', '🍫', ['#3C2C2D', '#644638']),
      item('Açık kahverengi', 'Açık kahve tonları', '☕', ['#8C624A', '#BA9473']),
      item('Kumral', 'Kumral tonları', '🌰', ['#987653', '#C5A47C']),
      item('Sarı', 'Sarı tonları', '🌾', ['#D1B07A', '#E8D39C']),
      item('Kızıl / Bakır', 'Kızıl ve bakır tonları', '🍁', ['#A24D37', '#C9784D']),
      item('Diğer', 'Farklı veya çok renkli', '🎨', ['#B49ACD', '#E5BDD6']),
    ],
  },
  {
    id: 'eye_color',
    title: 'Göz Rengin ✦',
    subtitle: 'Makyaj renk önerilerini kişiselleştirmemize yardımcı olur.',
    multi: false,
    options: [
      item('Koyu kahverengi', 'Koyu kahverengi gözler', '🤎', ['#34231D', '#5C3D31']),
      item('Açık kahverengi', 'Açık kahverengi gözler', '☕', ['#795037', '#A6764B']),
      item('Ela', 'Ela gözler', '🍂', ['#8A7746', '#B39C61']),
      item('Yeşil', 'Yeşil gözler', '🍃', ['#5A7352', '#90A47C']),
      item('Mavi', 'Mavi gözler', '🫧', ['#648EB4', '#B2D3E6']),
      item('Gri', 'Gri gözler', '🌫️', ['#848A96', '#C2C5CC']),
      item('Diğer', 'Farklı veya birden fazla renk', '✦', ['#B6A5C4', '#DAD0E4']),
    ],
  },
  {
    id: 'hair_type',
    title: 'Saç Tipini Seç ✦',
    subtitle: 'Saçının doğal yapısını tanımlayanları seç.',
    multi: true,
    options: [
      item('Düz', 'Belirgin dalga yok', '〰️', ['#AA806A', '#5B3A30']),
      item('Dalgalı', 'Hafif veya belirgin dalga', '🌊', ['#B38B70', '#654435']),
      item('Kıvırcık', 'Belirgin bukleler', '➰', ['#8D614D', '#3D2A26']),
      item('Çok kıvırcık', 'Sık ve küçük bukleler', '🌀', ['#654535', '#30231E']),
      item('İnce telli', 'İnce saç telleri', '🪶', ['#D9B99D', '#AC876F']),
      item('Kalın telli', 'Kalın saç telleri', '🌰', ['#9C6B53', '#54372B']),
    ],
  },
  {
    id: 'hair_condition',
    title: 'Saçının Durumu ✦',
    subtitle: 'Saçının mevcut durumunu tanımlayanları seç.',
    multi: true,
    options: [
      item('Sağlıklı', 'Belirgin bir sorun yaşamıyorum', '✦', ['#E7D8CA', '#C7B3A0']),
      item('Kuru', 'Nemini çabuk kaybediyor', '☁️', ['#E6D3C5', '#CBAE9C']),
      item('Yıpranmış', 'Sertleşme veya kırılma var', '🌾', ['#D6B7A0', '#A98370']),
      item('Kırılmaya yatkın', 'Uçları kolayca kırılıyor', '🪶', ['#E5CCB6', '#BDA18A']),
      item('Elektriklenen', 'Kolayca kabarıyor', '〰️', ['#D9C3B4', '#AD9082']),
      item('İşlem görmüş', 'Boya, açıcı veya ısı işlemi gördü', '🎨', ['#D9C4CC', '#B18F9F']),
    ],
  },
  {
    id: 'makeup',
    title: 'Makyaj Tarzını Seç ✦',
    subtitle: 'Sana hitap eden makyaj stillerini seç.',
    multi: true,
    options: [
      item('Doğal', 'Hafif ve fresh', '🌸', ['#EBC9BE', '#D7A9A3']),
      item('Soft Glam', 'Yumuşak ve ışıltılı', '✨', ['#E6B8B6', '#BB898D']),
      item('Glam', 'Belirgin ve iddialı', '💄', ['#C88C96', '#823B57']),
      item('Yaratıcı', 'Renkli ve özgün', '🎨', ['#C6A5E6', '#E9A6CD']),
      item('K-Beauty', 'Aydınlık ve soft', '🫧', ['#F2D2DC', '#E7A8BF']),
      item('Mat & Net', 'Mat ve belirgin', '🪞', ['#D2AD9D', '#9F7C74']),
    ],
  },
  {
    id: 'goal',
    title: 'PRİZMA Sana Nasıl Yardımcı Olsun? ✦',
    subtitle: 'En çok ilgilendiğin alanları seç.',
    multi: true,
    options: [
      item('Kombin', 'Günlük stil', '👗', ['#E9D9E9', '#C7AFD5']),
      item('Cilt bakımı', 'Bakım rutini', '🧴', ['#E8D3CD', '#D5AFA9']),
      item('Makyaj', 'Görünüm fikirleri', '💄', ['#EECEDB', '#D8A1B8']),
      item('Saç bakımı', 'Saç önerileri', '🪮', ['#DCC9B8', '#BCA08A']),
      item('Hepsinde', 'Her alanda', '✦', ['#D7C4ED', '#A78ACB']),
    ],
  },
];

const styleImages: Record<string, any> = {
  Minimal: require('./assets/onboarding/minimal.jpg'),
  Romantik: require('./assets/onboarding/romantik.jpg'),
  Klasik: require('./assets/onboarding/klasik.jpg'),
  Modern: require('./assets/onboarding/modern.jpg'),
  Bohem: require('./assets/onboarding/bohem.jpg'),
  Sportif: require('./assets/onboarding/sportif.jpg'),
};

const beautyImages: Record<string, Record<string, any>> = {
  colors: {
    'Soft & Pastel': require('./assets/onboarding/colors-soft-pastel.jpg'),
    'Nötr & Doğal': require('./assets/onboarding/colors-notr-dogal.jpg'),
    'Kahve & Sıcak': require('./assets/onboarding/colors-kahve-sicak.jpg'),
    'Klasik Tonlar': require('./assets/onboarding/colors-klasik-tonlar.jpg'),
    'Canlı & Enerjik': require('./assets/onboarding/colors-canli-enerjik.jpg'),
    'Serin & Modern': require('./assets/onboarding/colors-serin-modern.jpg'),
  },
  skin: {
    'Kuru': require('./assets/onboarding/skin-kuru.jpg'),
    'Yağlı': require('./assets/onboarding/skin-yagli.jpg'),
    'Karma': require('./assets/onboarding/skin-karma.jpg'),
    'Normal': require('./assets/onboarding/skin-normal.jpg'),
  },
  hair: {
    'Düz': require('./assets/onboarding/hair-duz.jpg'),
    'Dalgalı': require('./assets/onboarding/hair-dalgali.jpg'),
    'Kıvırcık': require('./assets/onboarding/hair-kivircik.jpg'),
    'Çok kıvırcık': require('./assets/onboarding/hair-cok-kivircik.jpg'),
    'İnce telli': require('./assets/onboarding/hair-ince-telli.jpg'),
    'Kalın telli': require('./assets/onboarding/hair-kalin-telli.jpg'),
  },
  makeup: {
    'Doğal': require('./assets/onboarding/makeup-dogal.jpg'),
    'Soft Glam': require('./assets/onboarding/makeup-soft-glam.jpg'),
    'Glam': require('./assets/onboarding/makeup-glam.jpg'),
    'Yaratıcı': require('./assets/onboarding/makeup-yaratici.jpg'),
    'K-Beauty': require('./assets/onboarding/makeup-k-beauty.jpg'),
    'Mat & Net': require('./assets/onboarding/makeup-mat-net.jpg'),
  },
};

const MULTI_IDS = ['style', 'colors', 'hair_type', 'hair_condition', 'makeup', 'goal'];

export default function OnboardingScreen({
  onComplete,
  initialAnswers = {},
  editing = false,
  onCancel,
  saving = false,
}: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(
    () => ({ ...initialAnswers })
  );
  const [guideOpen, setGuideOpen] = useState(false);
  const [undertoneGuideOpen, setUndertoneGuideOpen] = useState(false);

  const question = questions[step];
  const stored = answers[question.id];

  const selected: string[] = question.multi
    ? (() => {
        try {
          const parsed = JSON.parse(stored || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return stored ? [stored] : [];
        }
      })()
    : stored ? [stored] : [];

  const toggle = (name: string) => {
    if (!question.multi) {
      setAnswers(prev => ({ ...prev, [question.id]: name }));
      return;
    }

    let updated = selected.includes(name)
      ? selected.filter(value => value !== name)
      : [...selected, name];

    if (question.id === 'hair_condition') {
      if (name === 'Sağlıklı' && updated.includes('Sağlıklı')) {
        updated = ['Sağlıklı'];
      } else if (name !== 'Sağlıklı') {
        updated = updated.filter(value => value !== 'Sağlıklı');
      }
    }

    if (question.id === 'goal') {
      if (name === 'Hepsinde' && updated.includes('Hepsinde')) {
        updated = ['Hepsinde'];
      } else if (name !== 'Hepsinde') {
        updated = updated.filter(value => value !== 'Hepsinde');
      }
    }

    setAnswers(prev => ({
      ...prev,
      [question.id]: JSON.stringify(updated),
    }));
  };

  const next = (updatedAnswers = answers) => {
    if (step === questions.length - 1) {
      onComplete(updatedAnswers);
    } else {
      setStep(prev => prev + 1);
    }
  };

  const skip = () => {
    if (editing) {
      next();
      return;
    }
    const updated = { ...answers };
    delete updated[question.id];
    if (question.id === 'skin_type') {
      delete updated.skin_sensitivity;
    }
    setAnswers(updated);
    next(updated);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>

<TouchableOpacity
          onPress={() => {
            if (step > 0) setStep(step - 1);
            else if (editing) onCancel?.();
          }}
          style={styles.topAction}
        >
          <Text style={styles.topActionText}>
            {step > 0 ? '‹' : '✦'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.progress}>
          {step + 1} / {questions.length}
        </Text>

        {(!editing || step < questions.length - 1) ? (
          <TouchableOpacity
            onPress={skip}
            style={styles.topAction}
            disabled={saving}
          >
            <Text style={styles.skipText}>Atla</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.topAction} />
        )}

      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${((step + 1) / questions.length) * 100}%` },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>PRİZMA</Text>
        <Text style={styles.title}>{question.title}</Text>
        <Text style={styles.subtitle}>{question.subtitle}</Text>

        {question.multi && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              ▢  Birden fazla seçenek seçebilirsin.
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {question.options.map(option => {
            const active = selected.includes(option.name);

            return (
              <TouchableOpacity
                key={option.name}
                activeOpacity={0.85}
                onPress={() => toggle(option.name)}
                style={[
                  styles.card,
                  active && styles.cardSelected,
                ]}
              >
                <View style={styles.visual}>
                  {question.id === 'style' ? (
                    <ImageBackground
                      source={styleImages[option.name]}
                      style={styles.visualBackdrop}
                      resizeMode="cover"
                    />
                  ) : beautyImages[
                    question.id === 'skin_type' ? 'skin'
                    : question.id === 'hair_type' ? 'hair'
                    : question.id
                  ]?.[option.name] ? (
                    <ImageBackground
                      source={beautyImages[
                        question.id === 'skin_type' ? 'skin'
                        : question.id === 'hair_type' ? 'hair'
                        : question.id
                      ][option.name]}
                      style={styles.visualBackdrop}
                      resizeMode="cover"
                    />
                  ) : (
                    <>
                      <View style={styles.visualBackdrop}>
                        {option.colors.map((color, index) => (
                          <View
                            key={index}
                            style={[
                              styles.colorStripe,
                              { backgroundColor: color },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={styles.emoji}>{option.emoji}</Text>
                    </>
                  )}

                  <View
                    style={[
                      styles.check,
                      active && styles.checkSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.checkText,
                        active && styles.checkTextSelected,
                      ]}
                    >
                      {active ? '✓' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>
                    {option.name}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {option.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {question.id === 'skin_type' && (
          <View style={styles.sensitivityBox}>
            <Text style={styles.sensitivityTitle}>
              Cildin hassas mı?
            </Text>
            <Text style={styles.sensitivityDescription}>
              Cildin kolayca kızarıyor, yanıyor veya tahriş oluyor mu?
            </Text>
            <View style={styles.sensitivityChoices}>
              {[
                ['Evet', 'Hassas'],
                ['Hayır', 'Hassas değil'],
                ['Emin değilim', 'Emin değilim'],
              ].map(([value, label]) => {
                const active = answers.skin_sensitivity === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.sensitivityChoice,
                      active && styles.sensitivityChoiceActive,
                    ]}
                    onPress={() => setAnswers(prev => ({
                      ...prev,
                      skin_sensitivity:
                        prev.skin_sensitivity === value ? '' : value,
                    }))}
                  >
                    <Text style={[
                      styles.sensitivityChoiceText,
                      active && styles.sensitivityChoiceTextActive,
                    ]}>
                      {active ? '✓  ' : ''}{label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {question.id === 'skin_type' && (
          <>
            <TouchableOpacity
              style={styles.guideLink}
              onPress={() => setGuideOpen(true)}
            >
              <Text style={styles.guideLinkText}>
                ⓘ  Cilt tipimi nasıl öğrenirim?  ›
              </Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              Emin değilsen bu soruyu atlayabilirsin.
              Daha sonra Cilt Profilim bölümünden tamamlayabilirsin.
            </Text>
          </>
        )}

        {question.id === 'skin_undertone' && (
          <TouchableOpacity
            style={styles.guideLink}
            onPress={() => setUndertoneGuideOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Cilt alt tonumu nasıl öğrenirim?"
          >
            <Text style={styles.guideLinkText}>
              ⓘ  Cilt alt tonumu nasıl öğrenirim?  ›
            </Text>
          </TouchableOpacity>
        )}

        {question.id === 'makeup' && (
          <Text style={styles.note}>
            Makyaj yapmıyorsan bu soruyu atlayabilirsin.
          </Text>
        )}

        {question.multi && selected.length > 0 && (
          <View style={styles.count}>
            <Text style={styles.countText}>
              ✓  {selected.length} seçenek seçildi
            </Text>
          </View>
        )}

        {editing && step < questions.length - 1 && (
          <TouchableOpacity
            style={[styles.editSaveButton, saving && { opacity: 0.5 }]}
            onPress={() => onComplete(answers)}
            disabled={saving}
          >
            <Text style={styles.editSaveText}>
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet ✓'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.next, saving && { opacity: 0.5 }]}
          onPress={() => next()}
          disabled={saving}
        >
          <Text style={styles.nextText}>
            {step === questions.length - 1
              ? editing
                ? 'Değişiklikleri Kaydet ✓'
                : 'PRİZMA’ya Başla ✦'
              : 'Devam Et ✦'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={undertoneGuideOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUndertoneGuideOpen(false)}
      >
        <SafeAreaView style={styles.guideScreen}>
          <ScrollView contentContainerStyle={styles.guideContent}>
            <TouchableOpacity
              style={styles.close}
              onPress={() => setUndertoneGuideOpen(false)}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Alt Tonumu Nasıl Öğrenirim? ✦</Text>
            <Text style={styles.subtitle}>
              Doğal gün ışığında, makyajsızken yüzüne yakın sıcak (şeftali, altın)
              ve soğuk (pembe, mavi) renkli kumaşları sırayla tutup karşılaştır.
              Hangi renklerin daha dengeli göründüğüne bak. Tek bir yöntem kesin
              sonuç vermez; bilek damarlarının rengi tek başına güvenilir değildir.
            </Text>
            <Text style={styles.subtitle}>
              Sıcak ve soğuk renkler benzer derecede uyumluysa nötr olabilirsin.
              Teninde yeşilimsi ya da grileşen yansımalar varsa zeytin alt ton
              düşünülebilir. Işık, kamera ve ekran renkleri yanıltabilir.
            </Text>
            <Text style={styles.note}>
              Emin değilsen “Emin değilim” seçeneğini seç. Bu bilgi kozmetik
              renk önerilerine yardımcı olur; kesin bir analiz değildir.
            </Text>
            <TouchableOpacity
              style={styles.next}
              onPress={() => setUndertoneGuideOpen(false)}
            >
              <Text style={styles.nextText}>Anladım ✦</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={guideOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGuideOpen(false)}
      >
        <SafeAreaView style={styles.guideScreen}>
          <ScrollView contentContainerStyle={styles.guideContent}>
            <TouchableOpacity
              style={styles.close}
              onPress={() => setGuideOpen(false)}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <SkinTypeGuide />

            <TouchableOpacity
              style={styles.next}
              onPress={() => setGuideOpen(false)}
            >
              <Text style={styles.nextText}>Anladım ✦</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  editSaveButton: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#A78BFA',
    backgroundColor: '#F3EDFA',
    alignItems: 'center',
  },
  editSaveText: {
    color: '#684A91',
    fontSize: 15,
    fontWeight: '700',
  },

  sensitivityBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EADFED',
  },
  sensitivityTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#382344',
  },
  sensitivityDescription: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: '#74647C',
  },
  sensitivityChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 15,
    gap: 8,
  },
  sensitivityChoice: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#F7F1F8',
    borderWidth: 1,
    borderColor: '#E8DDED',
  },
  sensitivityChoiceActive: {
    backgroundColor: '#EAD9F1',
    borderColor: '#9866B2',
  },
  sensitivityChoiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#65516F',
  },
  sensitivityChoiceTextActive: {
    color: '#6E3E87',
  },
  guideImage: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 0.75,
    alignSelf: 'center',
    resizeMode: 'contain',
  },

  safe: { flex: 1, backgroundColor: '#FAF6FC' },
  top: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 12,
  },
  topAction: { minWidth: 48, paddingVertical: 5 },
  topActionText: { fontSize: 30, color: '#382344' },
  progress: { fontSize: 15, fontWeight: '700', color: '#382344' },
  skipText: { fontSize: 15, color: '#382344', textAlign: 'right' },
  track: {
    height: 6, marginHorizontal: 24, marginTop: 12,
    borderRadius: 10, backgroundColor: '#E8D8ED',
    overflow: 'hidden',
  },
  fill: {
    height: '100%', borderRadius: 10, backgroundColor: '#9A6CB5',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 55 },
  brand: {
    textAlign: 'center', fontSize: 11,
    letterSpacing: 4, fontWeight: '800', color: '#9A6CB5',
  },
  title: {
    marginTop: 12, fontSize: 29, fontWeight: '800',
    textAlign: 'center', color: '#30203D',
  },
  subtitle: {
    marginTop: 10, fontSize: 14, lineHeight: 21,
    textAlign: 'center', color: '#675A70',
  },
  hint: {
    alignSelf: 'center', marginTop: 18, marginBottom: 22,
    paddingHorizontal: 17, paddingVertical: 10,
    backgroundColor: '#F0E3F4', borderRadius: 30,
  },
  hintText: { color: '#543B64', fontSize: 12, fontWeight: '600' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', marginTop: 18,
  },
  card: {
    width: '48.5%', backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#EDE4EF',
    borderRadius: 19, marginBottom: 13,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#9A6CB5', backgroundColor: '#F8EFFB',
  },
  visual: {
    height: 126, margin: 6, borderRadius: 14,
    overflow: 'hidden', justifyContent: 'center',
    alignItems: 'center',
  },
  visualBackdrop: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  colorStripe: { flex: 1 },
  emoji: {
    fontSize: 45, textAlign: 'center',
  },
  check: {
    position: 'absolute', right: 8, top: 8,
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: '#60476D',
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: '#9866B2', borderColor: '#9866B2',
  },
  checkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  checkTextSelected: { color: '#FFFFFF' },
  cardBody: {
    paddingHorizontal: 8, paddingBottom: 13,
    paddingTop: 7, alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16, fontWeight: '800',
    color: '#35233F', textAlign: 'center',
  },
  cardSubtitle: {
    marginTop: 5, fontSize: 11, lineHeight: 16,
    color: '#74647C', textAlign: 'center',
  },
  count: {
    alignSelf: 'center', backgroundColor: '#EEE0F2',
    borderRadius: 20, paddingVertical: 9,
    paddingHorizontal: 17, marginTop: 12,
  },
  countText: { color: '#654477', fontWeight: '700', fontSize: 12 },
  next: {
    marginTop: 23, backgroundColor: '#9665AF',
    borderRadius: 28, paddingVertical: 18,
    alignItems: 'center',
  },
  nextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  guideLink: {
    marginTop: 12, alignItems: 'center',
    paddingVertical: 14, backgroundColor: '#F0E3F4',
    borderRadius: 25,
  },
  guideLinkText: {
    color: '#654477', fontWeight: '700', fontSize: 13,
  },
  note: {
    marginTop: 12, textAlign: 'center',
    color: '#87758E', fontSize: 12, lineHeight: 19,
  },
  guideScreen: { flex: 1, backgroundColor: '#FAF6FC' },
  guideContent: { padding: 22, paddingBottom: 50 },
  close: { alignSelf: 'flex-end', padding: 10 },
  closeText: { fontSize: 22, color: '#382344' },
  guideTitle: {
    marginTop: 10, fontSize: 27, fontWeight: '800',
    color: '#30203D', textAlign: 'center',
  },
  guideSubtitle: {
    marginTop: 12, fontSize: 14,
    textAlign: 'center', color: '#74647C',
  },
  guideSteps: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 28, marginBottom: 22,
  },
  guideStep: {
    width: '48%', backgroundColor: '#FFFFFF',
    borderRadius: 18, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#EDE4EF',
  },
  stepIcon: { fontSize: 32 },
  stepTitle: {
    marginTop: 12, fontWeight: '800',
    color: '#382344', fontSize: 16,
  },
  stepText: {
    marginTop: 7, color: '#74647C',
    fontSize: 12, lineHeight: 19, textAlign: 'center',
  },
  guideRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 15,
    marginBottom: 10, gap: 12,
  },
  guideDot: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: '#E8D5ED',
  },
  guideRowTitle: {
    fontSize: 15, fontWeight: '800', color: '#382344',
  },
  guideRowText: {
    marginTop: 4, fontSize: 12, lineHeight: 18,
    color: '#74647C',
  },
  guideDisclaimer: {
    marginTop: 13, fontSize: 12, lineHeight: 19,
    color: '#87758E', textAlign: 'center',
  },
});
