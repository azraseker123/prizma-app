import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from './supabase';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';

type Preference = 'liked' | 'disliked';
const outfitKey = (ids: string[]) => [...new Set(ids)].sort().join(':');

type Props = {
  userId: string;
  onSaved?: () => void;
};

type WardrobeItem = {
  id: string;
  name: string;
  category: string;
  color: string | null;
  season: string | null;
  image_path: string | null;
  imageUrl?: string | null;
};

export default function OutfitAIScreen({ userId, onSaved }: Props) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [occasion, setOccasion] = useState('');
  const [style, setStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savingOutfit, setSavingOutfit] = useState<number | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Record<string, Preference>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  const [outfits, setOutfits] = useState<{
    name: string;
    description: string;
    item_ids: string[];
  }[]>([]);
  const [notice, setNotice] = useState<{
    type: NoticeType;
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    const loadWardrobe = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('id,name,category,color,season,image_path')
        .eq('user_id', userId);

      if (!active) return;

      if (error) {
        setNotice({
          type: 'error',
          title: 'Gardırop yüklenemedi',
          message: error.message,
        });
      } else {
        const wardrobeItems = (data || []) as WardrobeItem[];

        const itemsWithImages = await Promise.all(
          wardrobeItems.map(async (item) => {
            if (!item.image_path) {
              return { ...item, imageUrl: null };
            }

            const { data: imageData, error: imageError } =
              await supabase.storage
                .from('wardrobe')
                .createSignedUrl(item.image_path, 3600);

            return {
              ...item,
              imageUrl: imageError
                ? null
                : imageData?.signedUrl || null,
            };
          })
        );

        if (!active) return;
        setItems(itemsWithImages);
      }

      setLoading(false);
    };

    void loadWardrobe();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;
    setFeedback({});
    const loadFeedback = async () => {
      const { data, error } = await supabase
        .from('outfit_feedback')
        .select('outfit_key,sentiment')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(250);
      if (!active) return;
      if (error) {
        console.warn('PRIZMA preference load:', error.message);
        return;
      }
      const next: Record<string, Preference> = {};
      (data || []).forEach(row => {
        if (typeof row.outfit_key === 'string' &&
          (row.sentiment === 'liked' || row.sentiment === 'disliked')) {
          next[row.outfit_key] = row.sentiment;
        }
      });
      setFeedback(next);
    };
    void loadFeedback();
    return () => { active = false; };
  }, [userId]);

  async function rateOutfit(index: number, sentiment: Preference) {
    const outfit = outfits[index];
    if (!outfit || feedbackLoading !== null || !userId) return;
    const key = outfitKey(outfit.item_ids);
    const previous = feedback[key];
    setFeedbackLoading(key);
    try {
      if (previous === sentiment) {
        const { error } = await supabase
          .from('outfit_feedback')
          .delete()
          .eq('user_id', userId)
          .eq('outfit_key', key);
        if (error) throw error;
        setFeedback(current => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      } else {
        const { error } = await supabase
          .from('outfit_feedback')
          .upsert({
            user_id: userId,
            outfit_key: key,
            item_ids: [...new Set(outfit.item_ids)],
            sentiment,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,outfit_key' });
        if (error) throw error;
        setFeedback(current => ({ ...current, [key]: sentiment }));
      }
    } catch (error) {
      setNotice({
        type: 'error',
        title: 'Tercihin kaydedilemedi',
        message: error instanceof Error ? error.message : 'Lütfen tekrar dene.',
      });
    } finally {
      setFeedbackLoading(null);
    }
  }

  async function saveOutfit(index: number) {
    const outfit = outfits[index];
    if (!outfit || !userId || savingOutfit !== null ||
        savedOutfits.includes(index)) return;

    setSavingOutfit(index);

    try {
      const { error } = await supabase
        .from('wardrobe_outfits')
        .insert({
          user_id: userId,
          name: outfit.name.trim(),
          item_ids: outfit.item_ids,
        });

      if (error) throw error;

      setSavedOutfits(previous => [...previous, index]);
      onSaved?.();
      setNotice({
        type: 'success',
        title: 'Kombin kaydedildi ♡',
        message: 'Kombinin gardırobuna eklendi!',
      });
    } catch (error) {
      setNotice({
        type: 'error',
        title: 'Kombin kaydedilemedi',
        message: error instanceof Error
          ? error.message
          : 'Bir hata oluştu.',
      });
    } finally {
      setSavingOutfit(null);
    }
  }

  async function generateOutfits() {
    if (!occasion.trim() || generating || loading || items.length < 2) return;

    setGenerating(true);
    setOutfits([]);
    setSavedOutfits([]);

    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-outfits',
        { body: { occasion: occasion.trim(), style: style.trim() } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const validIds = new Set(items.map(item => item.id));
      const suggestions = Array.isArray(data?.outfits)
        ? data.outfits.filter((outfit: any) =>
            typeof outfit?.name === 'string' &&
            typeof outfit?.description === 'string' &&
            Array.isArray(outfit?.item_ids) &&
            outfit.item_ids.length >= 2 &&
            outfit.item_ids.every(
              (id: unknown) => typeof id === 'string' && validIds.has(id)
            )
          ).slice(0, 3)
        : [];

      setOutfits(suggestions);

      if (!suggestions.length) {
        setNotice({
          type: 'info',
          title: 'Kombin bulunamadı',
          message: 'Gardırobundaki parçalarla uygun kombin oluşturulamadı.',
        });
      }
    } catch (error) {
      setNotice({
        type: 'error',
        title: 'AI kombin oluşturulamadı',
        message: error instanceof Error ? error.message : 'Bir hata oluştu.',
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>YOUR PERSONAL STYLIST</Text>
        <Text style={styles.title}>PRİZMA AI ✦</Text>
        <Text style={styles.subtitle}>
          Kendi gardırobundan sana özel kombinler oluştur.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>✦ Bugün ne giyiyoruz?</Text>
          <Text style={styles.cardDescription}>
            Planını ve istediğin tarzı anlat. PRİZMA
            gardırobundaki parçaları değerlendirsin.
          </Text>

          <Text style={styles.label}>Nereye gidiyorsun?</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn. Arkadaşlarımla kafeye"
            placeholderTextColor="#9B91AD"
            value={occasion}
            onChangeText={setOccasion}
          />

          <Text style={styles.label}>Nasıl görünmek istiyorsun?</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Örn. Şık ama rahat, koyu tonlarda..."
            placeholderTextColor="#9B91AD"
            multiline
            value={style}
            onChangeText={setStyle}
          />

          <TouchableOpacity
            style={[
              styles.disabledButton,
              { opacity: !occasion.trim() || loading || generating || items.length < 2 ? 0.5 : 1 },
            ]}
            disabled={!occasion.trim() || loading || generating || items.length < 2}
            onPress={() => void generateOutfits()}
          >
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                ✦ Kombinlerimi Oluştur
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helper}>
            PRİZMA kombinlerini gardırobundaki gerçek parçalarla oluşturur.
          </Text>
        </View>

        {outfits.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.cardTitle}>
              Senin için kombinler ✦
            </Text>

            {outfits.map((outfit, index) => (
              <View key={index} style={styles.card}>
                <Text style={{
                  fontSize: 17,
                  fontWeight: '800',
                  color: '#39235F',
                  marginBottom: 10,
                }}>
                  {index + 1}. {outfit.name}
                </Text>

                <Text style={styles.cardDescription}>
                  {outfit.description}
                </Text>

                {outfit.item_ids.map(id => {
                  const item = items.find(piece => piece.id === id);
                  if (!item) return null;

                  return (
                    <View
                      key={id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#F8F3FA',
                        borderRadius: 15,
                        padding: 10,
                        marginBottom: 10,
                      }}
                    >
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={{
                            width: 78,
                            height: 90,
                            borderRadius: 12,
                            backgroundColor: '#FFFFFF',
                          }}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={{
                          width: 78,
                          height: 90,
                          borderRadius: 12,
                          backgroundColor: '#EBDEF2',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 27 }}>♡</Text>
                        </View>
                      )}

                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={{
                          color: '#39235F',
                          fontWeight: '700',
                          fontSize: 14,
                        }}>
                          {item.name}
                        </Text>
                        <Text style={{
                          color: '#8B78A5',
                          fontSize: 12,
                          marginTop: 5,
                        }}>
                          {item.color || item.category}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.preferenceRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Bu kombini beğendim"
                    accessibilityState={{ selected: feedback[outfitKey(outfit.item_ids)] === 'liked' }}
                    disabled={feedbackLoading !== null}
                    onPress={() => void rateOutfit(index, 'liked')}
                    style={[
                      styles.preferenceButton,
                      feedback[outfitKey(outfit.item_ids)] === 'liked' && styles.preferenceActive,
                    ]}
                  >
                    <Text style={[
                      styles.preferenceText,
                      feedback[outfitKey(outfit.item_ids)] === 'liked' && styles.preferenceActiveText,
                    ]}>♡  Beğendim</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Bu kombin bana göre değil"
                    accessibilityState={{ selected: feedback[outfitKey(outfit.item_ids)] === 'disliked' }}
                    disabled={feedbackLoading !== null}
                    onPress={() => void rateOutfit(index, 'disliked')}
                    style={[
                      styles.preferenceButton,
                      feedback[outfitKey(outfit.item_ids)] === 'disliked' && styles.preferenceDisliked,
                    ]}
                  >
                    <Text style={[
                      styles.preferenceText,
                      feedback[outfitKey(outfit.item_ids)] === 'disliked' && styles.preferenceActiveText,
                    ]}>✕  Bana göre değil</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.preferenceHint}>PRİZMA bu seçimleri sonraki kombin önerilerinde dikkate alır.</Text>
                <TouchableOpacity
                  onPress={() => void saveOutfit(index)}
                  disabled={
                    savingOutfit !== null ||
                    savedOutfits.includes(index)
                  }
                  style={{
                    backgroundColor: savedOutfits.includes(index)
                      ? '#E4D3EC'
                      : '#79539A',
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                    marginTop: 8,
                    opacity: savingOutfit !== null ? 0.65 : 1,
                  }}
                >
                  {savingOutfit === index ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{
                      color: savedOutfits.includes(index)
                        ? '#654398'
                        : '#FFFFFF',
                      fontWeight: '800',
                      fontSize: 14,
                    }}>
                      {savedOutfits.includes(index)
                        ? '✓ Kaydedildi'
                        : '♡ Kombini Kaydet'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.wardrobeCard}>
          <Text style={styles.cardTitle}>Gardırobun ♡</Text>

          {loading ? (
            <ActivityIndicator color="#9272B5" />
          ) : (
            <>
              <Text style={styles.wardrobeCount}>
                {items.length} kıyafetin hazır
              </Text>
              <Text style={styles.cardDescription}>
                PRİZMA kombin önerilerini yalnızca
                gardırobunda kayıtlı parçalarla oluşturacak.
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      <PrizmaNotice
        visible={notice !== null}
        type={notice?.type || 'info'}
        title={notice?.title || ''}
        message={notice?.message || ''}
        onClose={() => setNotice(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  preferenceRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  preferenceButton: { flex: 1, backgroundColor: '#F3EEF7', borderRadius: 12, borderWidth: 1, borderColor: '#E5D9EB', paddingHorizontal: 8, paddingVertical: 12, alignItems: 'center' },
  preferenceActive: { backgroundColor: '#7851A1', borderColor: '#7851A1' },
  preferenceDisliked: { backgroundColor: '#514661', borderColor: '#514661' },
  preferenceText: { color: '#6F5C81', fontSize: 12, fontWeight: '700' },
  preferenceActiveText: { color: '#FFFFFF' },
  preferenceHint: { marginTop: 8, marginBottom: 3, fontSize: 11, lineHeight: 16, color: '#847890' },
  container: {
    flex: 1,
    backgroundColor: '#FAF7FC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  eyebrow: {
    color: '#8667AB',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: '#21163B',
    marginTop: 8,
  },
  subtitle: {
    color: '#756B86',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EBDEF2',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#281B46',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  cardDescription: {
    color: '#786D89',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 18,
  },
  label: {
    color: '#392B54',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 9,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E8DDF8',
    backgroundColor: '#FFFCFF',
    borderRadius: 15,
    padding: 14,
    color: '#281B46',
    fontSize: 14,
    marginBottom: 18,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  disabledButton: {
    backgroundColor: '#79539A',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  helper: {
    color: '#9488A6',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
  wardrobeCard: {
    backgroundColor: '#F0E5F6',
    borderRadius: 22,
    padding: 20,
  },
  wardrobeCount: {
    fontSize: 17,
    color: '#79579D',
    fontWeight: '800',
    marginBottom: 8,
  },
});
