import { addRoutineItem, type RoutinePeriod } from './RoutineStore';
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { supabase } from './supabase';

type Props = { userId: string; initialCategory?: 'skin' | 'hair' | 'makeup' };

type Product = {
  name: string;
  brand: string;
  reason: string;
  caution: string;
};

type Advice = {
  introduction: string;
  products: Product[];
  disclaimer: string;
};

export default function BeautyAdviceScreen({ userId, initialCategory = 'skin' }: Props) {
  const [category, setCategory] = useState<'skin' | 'hair' | 'makeup'>(initialCategory);
  const [concern, setConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [routinePeriod, setRoutinePeriod] = useState<RoutinePeriod>('Akşam');
  const [routineSaved, setRoutineSaved] = useState<string[]>([]);

  const analyze = async () => {
    if (loading) return;

    if (!concern.trim()) {
      setMessage('Önce neye ihtiyacın olduğunu yaz.');
      return;
    }

    setLoading(true);
    setMessage('');
    setAdvice(null);
    setSaved([]);
    setRoutineSaved([]);

    try {
      const { data, error } = await supabase.functions.invoke(
        'beauty-advisor',
        { body: { category, concern: concern.trim() } }
      );

      if (error) {
        const response = (error as any).context;
        let serverMessage = '';

        if (response && typeof response.json === 'function') {
          try {
            const details = await response.json();
            serverMessage = details?.error || '';
          } catch {}
        }

        throw new Error(serverMessage || 'AI önerileri alınamadı.');
      }

      if (
        !data ||
        typeof data.introduction !== 'string' ||
        !Array.isArray(data.products)
      ) {
        throw new Error('Beklenmeyen bir AI yanıtı alındı.');
      }

      setAdvice(data as Advice);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Bir sorun oluştu. Tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveProduct = async (product: Product, index: number) => {
    const key = String(index);
    if (saving !== null || saved.includes(key)) return;

    setSaving(key);
    setMessage('');

    try {
      const { error } = await supabase.from('beauty_collection').insert({
        user_id: userId,
        category,
        product_name: product.name,
        brand: product.brand,
        status: 'considering',
        source: 'ai',
        notes: product.reason,
      });

      if (error) throw error;

      setSaved((previous) => [...previous, key]);
      setMessage('✓ Ürün Bakım Koleksiyonum bölümüne kaydedildi.');
    } catch {
      setMessage('Ürün kaydedilemedi. Tekrar deneyebilirsin.');
    } finally {
      setSaving(null);
    }
  };

  const saveToRoutine = async (product: Product, index: number) => {
    const key = `${index}:${routinePeriod}`;
    if (saving !== null || routineSaved.includes(key)) return;
    setSaving(key);
    setMessage('');
    try {
      await addRoutineItem(userId, {
        title: `${product.brand ? `${product.brand} — ` : ''}${product.name}`,
        period: routinePeriod,
        category,
        source: 'ai-suggestion',
        note: product.caution,
      });
      setRoutineSaved(previous => [...previous, key]);
      setMessage(`✓ Ürün ${routinePeriod.toLowerCase()} rutinine eklendi. Kullanım talimatlarını doğrula.`);
    } catch { setMessage('Rutine eklenemedi. Tekrar dene.'); }
    finally { setSaving(null); }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>THE BEAUTY ADVISOR</Text>
      <Text style={styles.title}>PRİZMA Cilt Danışmanı ✦</Text>

      <Text style={styles.description}>
        Cilt profilini dikkate alarak ürünler hakkında
        kişiselleştirilmiş öneriler al.
      </Text>

      <View style={styles.categoryRow}>
        {([
          ['skin', 'Cilt'],
          ['hair', 'Saç'],
          ['makeup', 'Makyaj'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.categoryButton,
              category === value && styles.categorySelected,
            ]}
            onPress={() => {
              setCategory(value);
              setAdvice(null);
              setMessage('');
              setSaved([]);
            }}
          >
            <Text style={[
              styles.categoryText,
              category === value && styles.categoryTextSelected,
            ]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Neye ihtiyacın var?</Text>

      <TextInput
        style={styles.input}
        multiline
        maxLength={300}
        placeholder="Örneğin: Günlük kullanım için hafif bir nemlendirici arıyorum."
        placeholderTextColor="#9A91A4"
        value={concern}
        onChangeText={setConcern}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        onPress={analyze}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Önerilerimi Oluştur ✦</Text>
        )}
      </TouchableOpacity>

      {!!message && <Text style={styles.message}>{message}</Text>}

      {advice && (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>Sana özel öneriler ✦</Text>
          <Text style={styles.description}>{advice.introduction}</Text>

          {advice.products.map((product, index) => (
            <View key={`${product.brand}-${product.name}-${index}`} style={styles.card}>
              <Text style={styles.brand}>{product.brand}</Text>
              <Text style={styles.productName}>{product.name}</Text>

              <Text style={styles.cardLabel}>Neden önerildi?</Text>
              <Text style={styles.cardText}>{product.reason}</Text>

              <Text style={styles.cardLabel}>Dikkat etmen gerekenler</Text>
              <Text style={styles.cardText}>{product.caution}</Text>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  saved.includes(String(index)) && styles.savedButton,
                ]}
                onPress={() => saveProduct(product, index)}
                disabled={saving !== null || saved.includes(String(index))}
              >
                <Text style={styles.saveButtonText}>
                  {saved.includes(String(index))
                    ? '✓ Koleksiyonuma Kaydedildi'
                    : saving === String(index)
                      ? 'Kaydediliyor...'
                      : '+ Bakım Koleksiyonuma Kaydet'}
                </Text>
              </TouchableOpacity>
              <View style={styles.periodRow}>
                {(['Sabah', 'Akşam'] as const).map(p => (
                  <TouchableOpacity key={p} onPress={() => setRoutinePeriod(p)} style={[styles.periodChip, routinePeriod === p && styles.periodChipSelected]}>
                    <Text style={[styles.periodText, routinePeriod === p && styles.periodTextSelected]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.routineButton} disabled={saving !== null || routineSaved.includes(`${index}:${routinePeriod}`)} onPress={() => void saveToRoutine(product, index)}>
                <Text style={styles.routineButtonText}>{routineSaved.includes(`${index}:${routinePeriod}`) ? '✓ Rutinime Eklendi' : '+ Rutinime Ekle'}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {advice.products.length === 0 && (
            <Text style={styles.description}>
              Bu ihtiyaç için güvenle adlandırabileceğim bir ürün bulunamadı.
            </Text>
          )}

          <Text style={styles.disclaimer}>
            {advice.disclaimer ||
              'AI hata yapabilir. Ürün içeriklerini ambalajdan doğrula.'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  categoryRow: {
    flexDirection: 'row', gap: 8, marginBottom: 22,
  },
  categoryButton: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#F5EFF8', alignItems: 'center',
  },
  categorySelected: {
    backgroundColor: '#805C9F',
  },
  categoryText: {
    color: '#6F6479', fontWeight: '700', fontSize: 14,
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 45 },
  eyebrow: {
    fontSize: 11, letterSpacing: 2,
    color: '#805C9F', fontWeight: '700', marginBottom: 9,
  },
  title: {
    fontSize: 26, fontWeight: '800',
    color: '#352943', marginBottom: 12,
  },
  description: {
    fontSize: 14, lineHeight: 22,
    color: '#6F6479', marginBottom: 18,
  },
  label: {
    fontSize: 14, fontWeight: '700',
    color: '#352943', marginBottom: 9,
  },
  input: {
    minHeight: 105, borderWidth: 1,
    borderColor: '#E5D8EA', borderRadius: 16,
    padding: 14, textAlignVertical: 'top',
    color: '#352943', fontSize: 14,
    backgroundColor: '#FFFFFF', marginBottom: 14,
  },
  button: {
    backgroundColor: '#805C9F',
    borderRadius: 15, padding: 16, alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  message: {
    color: '#73549A', fontSize: 13,
    lineHeight: 20, marginTop: 14,
  },
  results: { marginTop: 26 },
  sectionTitle: {
    fontSize: 20, fontWeight: '800',
    color: '#352943', marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18, padding: 18,
    marginBottom: 14, borderWidth: 1,
    borderColor: '#F0E5F5',
  },
  brand: {
    fontSize: 12, color: '#805C9F',
    fontWeight: '700', marginBottom: 5,
  },
  productName: {
    fontSize: 18, fontWeight: '800',
    color: '#352943', marginBottom: 14,
  },
  cardLabel: {
    fontSize: 13, fontWeight: '700',
    color: '#493957', marginBottom: 5,
  },
  cardText: {
    fontSize: 13, lineHeight: 20,
    color: '#6F6479', marginBottom: 13,
  },
  saveButton: {
    backgroundColor: '#805C9F',
    borderRadius: 12, padding: 13,
    alignItems: 'center', marginTop: 4,
  },
  savedButton: { backgroundColor: '#9A8BA9' },
  saveButtonText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '700',
  },
  periodRow: { flexDirection: 'row', gap: 7, marginTop: 11, marginBottom: 8 },
  periodChip: { borderRadius: 100, backgroundColor: '#F0E6F6', paddingVertical: 7, paddingHorizontal: 15 },
  periodChipSelected: { backgroundColor: '#79559A' },
  periodText: { color: '#5F4C6F', fontWeight: '700', fontSize: 12 },
  periodTextSelected: { color: '#FFFFFF' },
  routineButton: { borderWidth: 1, borderColor: '#AF8AC6', borderRadius: 12, padding: 12, alignItems: 'center' },
  routineButtonText: { color: '#785397', fontSize: 13, fontWeight: '800' },
  disclaimer: {
    fontSize: 12, lineHeight: 19,
    color: '#82778C', marginTop: 12,
  },
});
