import SkinTypeGuide from './SkinTypeGuide';
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { supabase } from './supabase';

type Props = { userId: string };
type Answers = Record<string, string>;

const skinTypes = ['Kuru', 'Yağlı', 'Karma', 'Normal', 'Emin değilim'];
const sensitivities = ['Evet', 'Hayır', 'Emin değilim'];

export default function SkinAnalysisScreen({ userId }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [skinType, setSkinType] = useState('');
  const [sensitivity, setSensitivity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    setLoadError(false);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('answers')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const saved: Answers =
        data?.answers &&
        typeof data.answers === 'object' &&
        !Array.isArray(data.answers)
          ? data.answers as Answers
          : {};

      setAnswers(saved);
      setSkinType(saved.skin_type || '');
      setSensitivity(saved.skin_sensitivity || '');
    } catch {
      setLoadError(true);
      setMessage('Profil yüklenemedi. Tekrar deneyebilirsin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [userId]);

  const save = async () => {
    if (saving || loading || loadError) return;
    setSaving(true);
    setMessage('');

    try {
      // Güncel verileri tekrar okuyarak diğer tercihleri koru.
      const { data, error: readError } = await supabase
        .from('user_profiles')
        .select('answers')
        .eq('user_id', userId)
        .single();

      if (readError) throw readError;

      const current: Answers =
        data?.answers &&
        typeof data.answers === 'object' &&
        !Array.isArray(data.answers)
          ? data.answers as Answers
          : {};

      const updated: Answers = { ...current };

      if (skinType) updated.skin_type = skinType;
      else delete updated.skin_type;

      if (sensitivity) updated.skin_sensitivity = sensitivity;
      else delete updated.skin_sensitivity;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          answers: updated,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      setAnswers(updated);
      setMessage('✓ Cilt profilin kaydedildi!');
    } catch {
      setMessage('Kaydedilemedi. İnternet bağlantını kontrol et.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#9673C2" size="large" />
        <Text style={styles.description}>Cilt profilin yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.eyebrow}>PRİZMA BEAUTY ✦</Text>
      <Text style={styles.title}>Cilt Profilim</Text>
      <Text style={styles.description}>
        Cilt tipini ve hassasiyetini istediğin zaman güncelleyebilirsin.
      </Text>

      {loadError ? (
        <TouchableOpacity style={styles.saveButton} onPress={loadProfile}>
          <Text style={styles.saveText}>Tekrar Dene</Text>
        </TouchableOpacity>
      ) : showGuide ? (
        <View style={styles.card}>
          <SkinTypeGuide />
          <TouchableOpacity
            style={styles.guideButton}
            onPress={() => setShowGuide(false)}
          >
            <Text style={styles.guideButtonText}>Anladım ✦</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.question}>Cilt tipin hangisi?</Text>
            {skinTypes.map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.option, skinType === type && styles.selected]}
                onPress={() => {
                  setSkinType(type === skinType ? '' : type);
                  setMessage('');
                }}
              >
                <Text style={styles.optionText}>
                  {skinType === type ? '✓  ' : '○  '}{type}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.guideButton}
              onPress={() => setShowGuide(true)}
            >
              <Text style={styles.guideButtonText}>
                ✧ Cilt tipimi nasıl öğrenirim?
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.question}>Cildin hassas mı?</Text>
            <Text style={styles.hint}>
              Cildin kolayca kızarıyor, yanıyor veya tahriş oluyor mu?
            </Text>
            {sensitivities.map(value => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.option,
                  sensitivity === value && styles.selected,
                ]}
                onPress={() => {
                  setSensitivity(value === sensitivity ? '' : value);
                  setMessage('');
                }}
              >
                <Text style={styles.optionText}>
                  {sensitivity === value ? '✓  ' : '○  '}
                  {value === 'Evet' ? 'Evet, hassas' :
                   value === 'Hayır' ? 'Hayır, hassas değil' :
                   'Emin değilim'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Değişiklikleri Kaydet ✦</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {!loadError && !showGuide && (
        <View style={styles.card}>
          <Text style={styles.question}>✦ Kişisel Ürün Önerileri</Text>
          <Text style={styles.hint}>
            {skinType && skinType !== 'Emin değilim'
              ? 'Cilt tipin belirlendi. Ürün önerileri, profilin kaydedildikten ve güvenlik kontrolleri tamamlandıktan sonra kullanılabilir.'
              : 'Kişiselleştirilmiş ürün önerileri için önce cilt tipini belirlemelisin. Emin değilsen cilt tipi rehberini inceleyebilirsin.'}
          </Text>
          <Text style={styles.hint}>
            PRİZMA önerileri yapay zekâ tarafından oluşturulabilir ve hata içerebilir.
            Bir ürünün cilt tipine uygun görünmesi, alerji veya tahrişe neden
            olmayacağını garanti etmez. Öneriler tıbbi tanı veya tedavi değildir.
          </Text>
        </View>
      )}

      {!!message && <Text style={styles.message}>{message}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8FF' },
  content: { padding: 20, paddingBottom: 45, gap: 15 },
  center: { padding: 40, alignItems: 'center' },
  eyebrow: {
    color: '#9A78C5', fontSize: 11,
    fontWeight: '800', letterSpacing: 2,
  },
  title: {
    color: '#39235F', fontSize: 28, fontWeight: '800',
  },
  description: {
    color: '#806B9B', fontSize: 14, lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20, borderRadius: 22, gap: 10,
  },
  question: {
    fontSize: 17, fontWeight: '800',
    color: '#39235F', marginBottom: 5,
  },
  hint: {
    color: '#806B9B', fontSize: 12,
    lineHeight: 19, marginBottom: 6,
  },
  option: {
    padding: 15, borderRadius: 14,
    backgroundColor: '#F6F0FF',
    borderWidth: 1, borderColor: 'transparent',
  },
  selected: {
    backgroundColor: '#DDD0FA',
    borderColor: '#8B5CF6',
  },
  optionText: {
    color: '#563D7C', fontSize: 14, fontWeight: '600',
  },
  guideButton: {
    backgroundColor: '#EDE3FF',
    padding: 15, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
  },
  guideButtonText: {
    color: '#6941A5', fontWeight: '700', fontSize: 14,
  },
  guideImage: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 0.75,
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  saveButton: {
    backgroundColor: '#8060AD',
    padding: 17, borderRadius: 17,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '800',
  },
  message: {
    color: '#6941A5', fontSize: 13,
    textAlign: 'center', marginTop: 8,
  },
});
