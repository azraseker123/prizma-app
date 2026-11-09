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

type Props = {
  userId: string;
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

export default function OutfitAIScreen({ userId }: Props) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [occasion, setOccasion] = useState('');
  const [style, setStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savingOutfit, setSavingOutfit] = useState<number | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<number[]>([]);

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
                        backgroundColor: '#F8F4FF',
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
                          backgroundColor: '#EDE4FA',
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

                <TouchableOpacity
                  onPress={() => void saveOutfit(index)}
                  disabled={
                    savingOutfit !== null ||
                    savedOutfits.includes(index)
                  }
                  style={{
                    backgroundColor: savedOutfits.includes(index)
                      ? '#E9DDF8'
                      : '#7C3AED',
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
            <ActivityIndicator color="#8B5CF6" />
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
  container: {
    flex: 1,
    backgroundColor: '#FAF8FF',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  eyebrow: {
    color: '#9276C9',
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
    borderColor: '#EDE4FA',
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
    backgroundColor: '#FCFAFF',
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
    backgroundColor: '#7C3AED',
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
    backgroundColor: '#F1EAFC',
    borderRadius: 22,
    padding: 20,
  },
  wardrobeCount: {
    fontSize: 17,
    color: '#7953BB',
    fontWeight: '800',
    marginBottom: 8,
  },
});
