import React, { useCallback, useEffect, useState } from 'react';

import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

type WardrobeItem = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  color: string | null;
  notes: string | null;
  image_path: string;
  created_at: string;
  favorite: boolean;
  season: string | null;
};

type WardrobeItemWithImage = WardrobeItem & {
  imageUrl: string | null;
};

type Props = {
  userId: string;
};

const C = {
  navy: '#0B1436',
  lavender: '#A78BFA',
  lilac: '#E6DBFF',
  background: '#FAF9FC',
  white: '#FFFFFF',
  muted: '#777B94',
  border: '#ECE7F2',
  pale: '#F2EDFA',
  rose: '#C05D78',
};

const SEASONS = ['Tüm Mevsimler', 'İlkbahar', 'Yaz', 'Sonbahar', 'Kış', 'Dört Mevsim'];

const CATEGORIES = [
  'Tümü',
  'Üst Giyim',
  'Alt Giyim',
  'Elbise',
  'Dış Giyim',
  'Ayakkabı',
  'Çanta',
  'Aksesuar',
  'Diğer',
];

export default function WardrobeScreen({ userId }: Props) {
  const [items, setItems] = useState<WardrobeItemWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Üst Giyim');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [search, setSearch] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState('Tüm Mevsimler');
  const [colorFilter, setColorFilter] = useState('');
  const [season, setSeason] = useState('Dört Mevsim');
  const [detailItem, setDetailItem] = useState<WardrobeItemWithImage | null>(null);
  const [outfits, setOutfits] = useState<{id:string; name:string; item_ids:string[]}[]>([]);
  const [outfitName, setOutfitName] = useState('');
  const [editingOutfitId, setEditingOutfitId] = useState<string | null>(null);
  const [outfitSelected, setOutfitSelected] = useState<string[]>([]);
  const [showOutfitBuilder, setShowOutfitBuilder] = useState(false);
  const [removingBackground, setRemovingBackground] = useState(false);

  const [existingImageUrl, setExistingImageUrl] =
    useState<string | null>(null);

  // KAYITLI KIYAFETLERİ YÜKLE

  const loadItems = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const wardrobeItems = (data || []) as WardrobeItem[];

      const itemsWithImages = await Promise.all(
        wardrobeItems.map(async (item) => {
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

      setItems(itemsWithImages);
      const { data: outfitData, error: outfitError } = await supabase
        .from('wardrobe_outfits').select('id,name,item_ids')
        .eq('user_id', userId).order('created_at', {ascending:false});
      if (outfitError) console.warn('Kombinler yüklenemedi:', outfitError.message);
      else setOutfits((outfitData || []) as {id:string;name:string;item_ids:string[]}[]);
    } catch (error: any) {
      Alert.alert(
        'Gardırop yüklenemedi',
        error?.message || 'Lütfen tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // FORMU SIFIRLA

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setSelectedImage(null);
    setExistingImageUrl(null);
    setName('');
    setCategory('Üst Giyim');
    setColor('');
    setNotes('');
    setSeason('Dört Mevsim');
  };

  // YENİ KIYAFET EKLEMEYİ BAŞLAT

  const startAdding = () => {
    resetForm();
    choosePhoto();
  };

  // DÜZENLEMEYİ BAŞLAT

  const startEditing = (item: WardrobeItemWithImage) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setColor(item.color || '');
    setNotes(item.notes || '');
    setSeason(item.season || 'Dört Mevsim');
    setExistingImageUrl(item.imageUrl);
    setSelectedImage(null);
    setShowForm(true);
  };

  // GALERİDEN SEÇ

  const openGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setSelectedImage(result.assets[0]);
      setShowForm(true);
    } catch (error: any) {
      Alert.alert(
        'Fotoğraf seçilemedi',
        error?.message || 'Lütfen tekrar dene.'
      );
    }
  };

  // KAMERAYLA ÇEK

  const openCamera = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Kamera izni gerekli',
          'Fotoğraf çekmek için kamera izni vermelisin.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setSelectedImage(result.assets[0]);
      setShowForm(true);
    } catch (error: any) {
      Alert.alert(
        'Kamera açılamadı',
        error?.message || 'Lütfen tekrar dene.'
      );
    }
  };

  // FOTOĞRAF KAYNAĞINI SEÇ

  const choosePhoto = () => {
    Alert.alert(
      'Fotoğraf ekle ✦',
      'Fotoğrafını nasıl eklemek istersin?',
      [
        {
          text: '📷 Fotoğraf Çek',
          onPress: () => {
            Alert.alert(
              'Kamera erişimi',
              'PRİZMA, kıyafet fotoğrafı çekebilmen için kameranı kullanacak.',
              [
                {
                  text: 'Vazgeç',
                  style: 'cancel',
                },
                {
                  text: 'Devam Et',
                  onPress: () => {
                    void openCamera();
                  },
                },
              ]
            );
          },
        },
        {
          text: '🖼️ Galeriden Seç',
          onPress: () => {
            Alert.alert(
              'Fotoğraflarına erişim',
              'PRİZMA, seçtiğin kıyafet fotoğrafını gardırobuna kaydeder.',
              [
                {
                  text: 'Vazgeç',
                  style: 'cancel',
                },
                {
                  text: 'Devam Et',
                  onPress: () => {
                    void openGallery();
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
      ]
    );
  };

  // FOTOĞRAFI SUPABASE'E YÜKLE

  const uploadImage = async (
    image: ImagePicker.ImagePickerAsset
  ): Promise<string> => {
    if (!image.base64) {
      throw new Error(
        'Fotoğraf okunamadı. Lütfen yeniden seç.'
      );
    }

    const mimeType = image.mimeType || 'image/jpeg';

    // Desteklenmeyen formatları JPEG olarak yeniden seçmek gerekir.
    if (
      mimeType !== 'image/jpeg' &&
      mimeType !== 'image/png' &&
      mimeType !== 'image/webp'
    ) {
      throw new Error(
        'Bu fotoğraf biçimi desteklenmiyor. JPG, PNG veya WebP seç.'
      );
    }

    const extension =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';

    const fileBytes = decode(image.base64);

    if (fileBytes.byteLength > 10 * 1024 * 1024) {
      throw new Error(
        'Fotoğraf 10 MB sınırını aşıyor.'
      );
    }

    const randomId =
      Math.random().toString(36).substring(2, 12);

    const filePath =
      `${userId}/${Date.now()}-${randomId}.${extension}`;

    const { error } = await supabase.storage
      .from('wardrobe')
      .upload(filePath, fileBytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) throw error;

    return filePath;
  };

  // YENİ KIYAFETİ KAYDET VEYA MEVCUDU GÜNCELLE

  const saveItem = async () => {
    if (saving) return;

    if (!name.trim()) {
      Alert.alert(
        'İsim eksik',
        'Kıyafetine bir isim ver.'
      );
      return;
    }

    if (!editingItem && !selectedImage) {
      Alert.alert(
        'Fotoğraf eksik',
        'Önce bir kıyafet fotoğrafı seç.'
      );
      return;
    }

    setSaving(true);

    let newUploadedPath: string | null = null;
    let databaseSaved = false;

    try {
      // Düzenlemede eski fotoğrafı koru.
      let imagePath = editingItem?.image_path || '';

      // Yeni fotoğraf seçildiyse onu yükle.
      if (selectedImage) {
        imagePath = await uploadImage(selectedImage);
        newUploadedPath = imagePath;
      }

      if (editingItem) {
        // MEVCUT KIYAFETİ GÜNCELLE

        const { error } = await supabase
          .from('wardrobe_items')
          .update({
            name: name.trim(),
            category,
            color: color.trim() || null,
            notes: notes.trim() || null,
            season,
            image_path: imagePath,
          })
          .eq('id', editingItem.id)
          .eq('user_id', userId)
          .select('id')
          .single();

        if (error) throw error;

        databaseSaved = true;

        // Yeni fotoğraf başarıyla kaydedildiyse
        // eski fotoğrafı depodan temizle.
        if (
          newUploadedPath &&
          editingItem.image_path !== newUploadedPath
        ) {
          const { error: cleanupError } =
            await supabase.storage
              .from('wardrobe')
              .remove([editingItem.image_path]);

          if (cleanupError) {
            console.warn(
              'Eski fotoğraf temizlenemedi:',
              cleanupError.message
            );
          }
        }
      } else {
        // YENİ KIYAFET EKLE

        const { error } = await supabase
          .from('wardrobe_items')
          .insert({
            user_id: userId,
            image_path: imagePath,
            name: name.trim(),
            category,
            color: color.trim() || null,
            notes: notes.trim() || null,
            season,
          })
          .select('id')
          .single();

        if (error) throw error;

        databaseSaved = true;
      }

      const wasEditing = Boolean(editingItem);

      resetForm();

      Alert.alert(
        wasEditing
          ? 'Kıyafet güncellendi ✦'
          : 'Kıyafetin eklendi ✦',
        wasEditing
          ? 'Değişikliklerin kaydedildi.'
          : 'Yeni parçan PRİZMA gardırobunda!'
      );

      await loadItems();
    } catch (error: any) {
      // Veritabanına kaydedilemeyen yeni fotoğrafı temizle.
      if (newUploadedPath && !databaseSaved) {
        await supabase.storage
          .from('wardrobe')
          .remove([newUploadedPath]);
      }

      Alert.alert(
        databaseSaved
          ? 'Kıyafet kaydedildi'
          : 'İşlem başarısız',
        databaseSaved
          ? 'Değişiklik kaydedildi ancak liste yenilenemedi.'
          : error?.message || 'Lütfen tekrar dene.'
      );
    } finally {
      setSaving(false);
    }
  };

  // KIYAFETİ SİL

  const deleteItem = (item: WardrobeItem) => {
    Alert.alert(
      'Kıyafeti sil',
      `"${item.name}" gardırobundan silinsin mi?`,
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (deletingId) return;

            setDeletingId(item.id);

            try {
              const { error } = await supabase
                .from('wardrobe_items')
                .delete()
                .eq('id', item.id)
                .eq('user_id', userId)
                .select('id')
                .single();

              if (error) throw error;

              setItems((current) =>
                current.filter(
                  (piece) => piece.id !== item.id
                )
              );

              const { error: storageError } =
                await supabase.storage
                  .from('wardrobe')
                  .remove([item.image_path]);

              if (storageError) {
                Alert.alert(
                  'Kıyafet silindi',
                  'Kayıt silindi ancak fotoğraf depodan temizlenemedi.'
                );
              }
            } catch (error: any) {
              Alert.alert(
                'Silme başarısız',
                error?.message || 'Tekrar dene.'
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const toggleFavorite = async (item: WardrobeItemWithImage) => {
    const next = !item.favorite;
    const { error } = await supabase.from('wardrobe_items')
      .update({ favorite: next }).eq('id', item.id).eq('user_id', userId);
    if (error) return Alert.alert('Favori kaydedilemedi', error.message);
    setItems(current => current.map(x => x.id === item.id ? {...x, favorite:next} : x));
    setDetailItem(current => current?.id === item.id ? {...current, favorite:next} : current);
  };

  const saveOutfit = async () => {
    const chosen = [...new Set(outfitSelected)].filter(id => items.some(item => item.id === id));
    if (!outfitName.trim() || chosen.length < 2) {
      Alert.alert('Eksik bilgi', 'Kombine isim ver ve en az iki kıyafet seç.');
      return;
    }
    const query = editingOutfitId
      ? supabase.from('wardrobe_outfits').update({name: outfitName.trim(), item_ids: chosen})
          .eq('id', editingOutfitId).eq('user_id', userId)
      : supabase.from('wardrobe_outfits').insert({
          user_id: userId, name: outfitName.trim(), item_ids: chosen,
        });
    const {error} = await query;
    if (error) return Alert.alert('Kombin kaydedilemedi', error.message);
    setShowOutfitBuilder(false);
    setEditingOutfitId(null);
    setOutfitName('');
    setOutfitSelected([]);
    await loadItems();
  };

  const closeOutfitBuilder = () => {
    setShowOutfitBuilder(false);
    setEditingOutfitId(null);
    setOutfitName('');
    setOutfitSelected([]);
  };

  const editOutfit = (outfit: {id:string; name:string; item_ids:string[]}) => {
    setEditingOutfitId(outfit.id);
    setOutfitName(outfit.name);
    setOutfitSelected(outfit.item_ids.filter(id => items.some(item => item.id === id)));
    setShowOutfitBuilder(true);
  };

  const boardOrder: Record<string, number> = {
    'Dış Giyim': 0, 'Üst Giyim': 1, 'Elbise': 2,
    'Alt Giyim': 3, 'Ayakkabı': 4, 'Çanta': 5,
    'Aksesuar': 6, 'Diğer': 7,
  };

  const renderBoard = (ids: string[]) => {
    const chosen = ids.map(id => items.find(item => item.id === id))
      .filter((item): item is WardrobeItemWithImage => Boolean(item))
      .sort((a, b) => (boardOrder[a.category] ?? 7) - (boardOrder[b.category] ?? 7));
    if (!chosen.length) {
      return <Text style={styles.itemCategory}>Bu kombinin parçaları artık gardıropta yok.</Text>;
    }
    const main = chosen.filter(item => !['Çanta', 'Aksesuar'].includes(item.category));
    const side = chosen.filter(item => ['Çanta', 'Aksesuar'].includes(item.category));
    const renderPiece = (item: WardrobeItemWithImage, compact = false) => (
      <View key={item.id} style={[styles.boardPiece, compact && styles.boardPieceSmall]}>
        {item.imageUrl
          ? <Image source={{uri:item.imageUrl}} style={[styles.boardImage, compact && styles.boardImageSmall]} resizeMode="contain" />
          : <Text style={styles.boardPlaceholder}>◇</Text>}
        <Text style={styles.boardPieceName} numberOfLines={2}>{item.name}</Text>
      </View>
    );
    return (
      <View style={styles.boardCanvas}>
        <View style={styles.boardMain}>{main.map(item => renderPiece(item))}</View>
        {side.length > 0 && (
          <View style={styles.boardSide}>{side.map(item => renderPiece(item, true))}</View>
        )}
      </View>
    );
  };

  const deleteOutfit = (id:string) => Alert.alert('Kombini sil', 'Bu kombin silinsin mi?', [
    {text:'Vazgeç',style:'cancel'},
    {text:'Sil',style:'destructive',onPress:async()=>{
      const {error}=await supabase.from('wardrobe_outfits').delete().eq('id',id).eq('user_id',userId);
      if(error) Alert.alert('Hata',error.message);
      else setOutfits(current=>current.filter(o=>o.id!==id));
    }}
  ]);

  // Arka plan kaldırma sunucu tarafında çalışır; anahtar uygulamaya eklenmez.
  const removeBackground = async () => {
    if (!selectedImage?.base64) {
      Alert.alert('Fotoğraf seç', 'Önce yeni bir fotoğraf seçmelisin.'); return;
    }
    setRemovingBackground(true);
    try {
      const {data,error} = await supabase.functions.invoke('remove-background', {
        body: { imageBase64:selectedImage.base64, mimeType:selectedImage.mimeType || 'image/jpeg' },
      });
      if(error) throw error;
      if (!data?.imageBase64) throw new Error(data?.error || 'Servis yanıt vermedi.');
      setSelectedImage({
        ...selectedImage,
        uri:`data:image/png;base64,${data.imageBase64}`,
        base64:data.imageBase64,
        mimeType:'image/png',
      });
      Alert.alert('Hazır ✨','Arka plan kaldırıldı. Beğenmezsen fotoğrafı yeniden seçebilirsin.');
    } catch(e:any) {
      Alert.alert('Arka plan kaldırılamadı',
        'Sunucu servisi henüz kurulmamış veya kullanılamıyor olabilir. '+(e?.message || ''));
    } finally { setRemovingBackground(false); }
  };

  const filteredItems = items.filter(item =>
    (activeFilter === 'Tümü' || item.category === activeFilter) &&
    (!favoriteOnly || item.favorite) &&
    (seasonFilter === 'Tüm Mevsimler' || item.season === seasonFilter || item.season === 'Dört Mevsim') &&
    (!colorFilter.trim() || (item.color || '').toLocaleLowerCase('tr-TR').includes(colorFilter.trim().toLocaleLowerCase('tr-TR'))) &&
    (!search.trim() || [item.name,item.category,item.color || '',item.notes || ''].join(' ').toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR')))
  );

  const previewUri =
    selectedImage?.uri || existingImageUrl;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        YOUR DIGITAL CLOSET
      </Text>

      <Text style={styles.title}>
        Gardırobun
      </Text>

      <Text style={styles.description}>
        Tarzını oluşturan her parça, tek bir yerde.
      </Text>

      {/* KOLEKSİYON ÖZETİ */}

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>
            SENİN KOLEKSİYONUN
          </Text>

          <Text style={styles.summaryNumber}>
            {items.length}
          </Text>

          <Text style={styles.summaryDescription}>
            kayıtlı parça
          </Text>
        </View>

        <Text style={styles.summaryIcon}>
          ◇
        </Text>
      </View>

      {/* KIYAFET EKLE */}

      {!showForm && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={startAdding}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>
            + Yeni Kıyafet Ekle
          </Text>
        </TouchableOpacity>
      )}

      {/* EKLEME / DÜZENLEME FORMU */}

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {editingItem
              ? 'Parçanı düzenle ✦'
              : 'Yeni bir parça ✦'}
          </Text>

          <Text style={styles.formSubtitle}>
            {editingItem
              ? 'Kıyafet bilgilerini güncelleyebilirsin.'
              : 'Kıyafetini gardırobuna ekleyelim.'}
          </Text>

          {previewUri && (
            <TouchableOpacity
              onPress={choosePhoto}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />

              <Text style={styles.changePhoto}>
                Fotoğrafı değiştir ↗
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.inputLabel}>
            KIYAFET ADI
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Örn. Beyaz keten gömlek"
            placeholderTextColor={C.muted}
            maxLength={80}
          />

          <Text style={styles.inputLabel}>
            KATEGORİ
          </Text>

          <View style={styles.categoryWrap}>
            {CATEGORIES.filter(
              (item) => item !== 'Tümü'
            ).map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.categoryChip,
                  category === item &&
                    styles.categoryChipActive,
                ]}
                onPress={() => setCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === item &&
                      styles.categoryTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>
            RENK (İSTEĞE BAĞLI)
          </Text>

          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="Örn. Krem"
            placeholderTextColor={C.muted}
            maxLength={40}
          />

          <Text style={styles.inputLabel}>MEVSİM</Text>
          <View style={styles.categoryWrap}>
            {SEASONS.filter(x=>x!=='Tüm Mevsimler').map(x=>(
              <TouchableOpacity key={x} onPress={()=>setSeason(x)} style={[styles.categoryChip,season===x && styles.categoryChipActive]}>
                <Text style={[styles.categoryText,season===x && styles.categoryTextActive]}>{x}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>
            NOTLAR (İSTEĞE BAĞLI)
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.notesInput,
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Örn. Günlük kullanım için"
            placeholderTextColor={C.muted}
            multiline
            maxLength={300}
          />

          {selectedImage && (
            <TouchableOpacity style={styles.outlineButton} disabled={removingBackground || saving} onPress={()=>void removeBackground()}>
              {removingBackground ? <ActivityIndicator color={C.navy}/> : <Text style={styles.outlineText}>✨ Arka Planı Kaldır</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            disabled={saving}
            onPress={saveItem}
          >
            {saving ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={styles.saveButtonText}>
                {editingItem
                  ? 'Değişiklikleri Kaydet →'
                  : 'Gardırobuma Kaydet →'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={resetForm}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>
              Vazgeç
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {detailItem && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{detailItem.name}</Text>
          {detailItem.imageUrl && <Image source={{uri:detailItem.imageUrl}} style={styles.previewImage} resizeMode="contain"/>}
          <Text style={styles.description}>Kategori: {detailItem.category}{'\n'}Renk: {detailItem.color || 'Belirtilmedi'}{'\n'}Mevsim: {detailItem.season || 'Belirtilmedi'}{'\n'}Not: {detailItem.notes || 'Yok'}</Text>
          <TouchableOpacity style={styles.outlineButton} onPress={()=>setDetailItem(null)}><Text style={styles.outlineText}>Kapat</Text></TouchableOpacity>
        </View>
      )}
      {!showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Kombinlerim ✦</Text>
          <Text style={styles.formSubtitle}>Parçalarını bir moda panosunda bir araya getir.</Text>
          {items.length >= 2 && (
            <TouchableOpacity style={styles.addButton} onPress={() => {
              if (showOutfitBuilder) closeOutfitBuilder();
              else { setEditingOutfitId(null); setShowOutfitBuilder(true); }
            }}>
              <Text style={styles.addButtonText}>
                {showOutfitBuilder ? 'Kapat' : '+ Kombin Oluştur'}
              </Text>
            </TouchableOpacity>
          )}
          {items.length < 2 && (
            <Text style={styles.itemCategory}>Yeni kombin oluşturmak için en az iki kıyafet ekle.</Text>
          )}
          {showOutfitBuilder && (
            <View style={styles.builderBox}>
              <TextInput style={styles.input} value={outfitName}
                onChangeText={setOutfitName} placeholder="Kombin adı"
                placeholderTextColor={C.muted} maxLength={100} />
              <Text style={styles.boardHint}>Parçaları fotoğraflarına dokunarak seç:</Text>
              <View style={styles.boardPicker}>
                {items.map(item => {
                  const chosen = outfitSelected.includes(item.id);
                  return (
                    <TouchableOpacity key={item.id}
                      style={[styles.boardPickCard, chosen && styles.boardPickSelected]}
                      onPress={() => setOutfitSelected(current => current.includes(item.id)
                        ? current.filter(id => id !== item.id) : [...current, item.id])}>
                      {item.imageUrl
                        ? <Image source={{uri:item.imageUrl}} style={styles.boardPickImage} resizeMode="contain" />
                        : <Text style={styles.boardPlaceholder}>◇</Text>}
                      <Text style={styles.boardPieceName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.boardCheck}>{chosen ? '✓ Seçildi' : '+ Seç'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={() => void saveOutfit()}>
                <Text style={styles.saveButtonText}>
                  {editingOutfitId ? 'Kombini Güncelle' : 'Kombini Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {outfits.map(outfit => (
            <View key={outfit.id} style={styles.outfitCard}>
              <Text style={styles.boardOutfitTitle}>{outfit.name}</Text>
              {renderBoard(outfit.item_ids)}
              <View style={styles.boardActions}>
                <TouchableOpacity style={styles.boardAction} onPress={() => editOutfit(outfit)}>
                  <Text style={styles.editText}>✎ Düzenle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.boardAction} onPress={() => deleteOutfit(outfit.id)}>
                  <Text style={styles.deleteText}>Kombini Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* YÜKLENİYOR */}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={C.lavender}
          />

          <Text style={styles.loadingText}>
            Gardırobun hazırlanıyor...
          </Text>
        </View>
      ) : items.length === 0 && !showForm ? (
        /* BOŞ GARDIROP */

        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>
            ◇
          </Text>

          <Text style={styles.emptyTitle}>
            Gardırobunu oluşturalım
          </Text>

          <Text style={styles.emptyDescription}>
            İlk kıyafetini ekle, kendi stil
            koleksiyonunu oluşturmaya başla.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={startAdding}
          >
            <Text style={styles.emptyButtonText}>
              İlk Parçamı Ekle +
            </Text>
          </TouchableOpacity>
        </View>
      ) : items.length > 0 ? (
        /* KAYITLI KIYAFETLER */

        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Parçaların
            </Text>

            <TouchableOpacity
              onPress={() => void loadItems()}
            >
              <Text style={styles.refreshText}>
                Yenile ↻
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput style={styles.input} value={search} onChangeText={setSearch}
            placeholder="Kıyafet ara..." placeholderTextColor={C.muted} />
          <TouchableOpacity style={styles.outlineButton} onPress={()=>setFavoriteOnly(!favoriteOnly)}>
            <Text style={styles.outlineText}>{favoriteOnly ? '❤️ Sadece favoriler ✓' : '♡ Sadece favoriler'}</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} value={colorFilter} onChangeText={setColorFilter}
            placeholder="Renge göre filtrele..." placeholderTextColor={C.muted} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {SEASONS.map(x=><TouchableOpacity key={x} onPress={()=>setSeasonFilter(x)}
              style={[styles.filterChip,seasonFilter===x && styles.filterChipActive]}>
              <Text style={[styles.filterText,seasonFilter===x && styles.filterTextActive]}>{x}</Text>
            </TouchableOpacity>)}
          </ScrollView>

          {/* KATEGORİ FİLTRELERİ */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.filterChip,
                  activeFilter === item &&
                    styles.filterChipActive,
                ]}
                onPress={() => setActiveFilter(item)}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === item &&
                      styles.filterTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredItems.length === 0 ? (
            <View style={styles.filterEmpty}>
              <Text style={styles.filterEmptyText}>
                Bu kategoride henüz kıyafet yok.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredItems.map((item) => (
                <View
                  key={item.id}
                  style={styles.itemCard}
                >
                  <View style={styles.itemImageContainer}>
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.itemImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.placeholderIcon}>
                          ◇
                        </Text>

                        <Text style={styles.placeholderText}>
                          Görsel yüklenemedi
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text
                      style={styles.itemName}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>

                    <Text style={styles.itemCategory}>
                      {item.category}
                    </Text>

                    {item.color ? (
                      <Text style={styles.itemColor}>
                        {item.color}
                      </Text>
                    ) : null}

                    <TouchableOpacity onPress={()=>setDetailItem(item)} style={styles.outlineButton}>
                      <Text style={styles.outlineText}>Detayları Gör</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>void toggleFavorite(item)} style={styles.outlineButton}>
                      <Text style={styles.outlineText}>{item.favorite ? '❤️ Favoride' : '♡ Favorile'}</Text>
                    </TouchableOpacity>
                    {/* DÜZENLE VE SİL */}

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => startEditing(item)}
                        disabled={saving || Boolean(deletingId)}
                      >
                        <Text style={styles.editText}>
                          ✎ Düzenle
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteItem(item)}
                        disabled={saving || Boolean(deletingId)}
                      >
                        {deletingId === item.id ? (
                          <ActivityIndicator
                            size="small"
                            color={C.rose}
                          />
                        ) : (
                          <Text style={styles.deleteText}>
                            Sil
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outlineButton: {borderWidth:1,borderColor:C.border,borderRadius:12,padding:12,marginTop:10,alignItems:'center'},
  outlineText: {color:C.navy,fontSize:12,fontWeight:'700'},
  outfitCard: {borderTopWidth:1,borderTopColor:C.border,paddingVertical:18,gap:10},
  boardOutfitTitle: {color:C.navy,fontSize:17,fontWeight:'700'},
  boardCanvas: {backgroundColor:'#F8F5FD',borderRadius:18,padding:10,flexDirection:'row',alignItems:'flex-start',gap:6},
  boardMain: {flex:3,gap:8},
  boardSide: {flex:1.3,gap:8},
  boardPiece: {width:'100%',minHeight:180,backgroundColor:'transparent',borderRadius:14,padding:2,alignItems:'center',justifyContent:'center'},
  boardPieceSmall: {minHeight:115},
  boardImage: {width:'100%',height:165},
  boardImageSmall: {height:100},
  boardPieceName: {color:C.navy,fontSize:11,textAlign:'center',marginTop:5},
  boardPlaceholder: {color:C.lavender,fontSize:28,textAlign:'center'},
  boardHint: {color:C.muted,fontSize:12,marginVertical:12},
  builderBox: {marginBottom:18},
  boardPicker: {flexDirection:'row',flexWrap:'wrap',gap:8},
  boardPickCard: {width:'48%',borderWidth:2,borderColor:C.border,borderRadius:14,padding:8,alignItems:'center'},
  boardPickSelected: {borderColor:C.lavender,backgroundColor:C.pale},
  boardPickImage: {width:'100%',height:96},
  boardCheck: {color:C.navy,fontSize:11,fontWeight:'700',marginTop:5},
  boardActions: {flexDirection:'row',justifyContent:'space-between',paddingTop:6},
  boardAction: {paddingVertical:8,paddingHorizontal:6},
  container: {
    flex: 1,
    paddingBottom: 25,
  },

  eyebrow: {
    color: '#937BC5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.1,
    marginBottom: 14,
  },

  title: {
    color: C.navy,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600',
    marginBottom: 13,
  },

  description: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 25,
  },

  summaryCard: {
    backgroundColor: C.navy,
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  summaryLabel: {
    color: C.lilac,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },

  summaryNumber: {
    color: C.white,
    fontSize: 44,
    fontWeight: '700',
    marginTop: 9,
  },

  summaryDescription: {
    color: '#D1C7E9',
    fontSize: 12,
  },

  summaryIcon: {
    color: C.lilac,
    fontSize: 60,
  },

  addButton: {
    backgroundColor: C.lavender,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 25,
  },

  addButtonText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '700',
  },

  formCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 24,
    padding: 20,
    marginBottom: 25,
  },

  formTitle: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '700',
    marginBottom: 6,
  },

  formSubtitle: {
    color: C.muted,
    fontSize: 12,
    marginBottom: 20,
  },

  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: C.pale,
  },

  changePhoto: {
    color: '#8067AE',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 15,
  },

  inputLabel: {
    color: C.navy,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginTop: 17,
    marginBottom: 9,
  },

  input: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.background,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: C.navy,
  },

  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  categoryChip: {
    backgroundColor: C.pale,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  categoryChipActive: {
    backgroundColor: C.navy,
  },

  categoryText: {
    color: C.navy,
    fontSize: 11,
    fontWeight: '600',
  },

  categoryTextActive: {
    color: C.white,
  },

  saveButton: {
    backgroundColor: C.navy,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 25,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 17,
  },

  cancelButtonText: {
    color: C.muted,
    fontSize: 13,
  },

  loadingContainer: {
    paddingVertical: 45,
    alignItems: 'center',
  },

  loadingText: {
    color: C.muted,
    fontSize: 12,
    marginTop: 15,
  },

  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 27,
    padding: 25,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  emptyIcon: {
    color: C.lavender,
    fontSize: 55,
    marginBottom: 14,
  },

  emptyTitle: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 22,
  },

  emptyButton: {
    backgroundColor: C.navy,
    borderRadius: 25,
    paddingHorizontal: 25,
    paddingVertical: 15,
  },

  emptyButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  sectionTitle: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '700',
  },

  refreshText: {
    color: '#8067AE',
    fontSize: 12,
    fontWeight: '700',
  },

  filterRow: {
    gap: 8,
    paddingBottom: 20,
  },

  filterChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  filterChipActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },

  filterText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  filterTextActive: {
    color: C.white,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  itemCard: {
    width: '48%',
    backgroundColor: C.white,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 5,
  },

  itemImageContainer: {
    width: '100%',
    height: 175,
    backgroundColor: C.pale,
  },

  itemImage: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },

  placeholderIcon: {
    color: C.lavender,
    fontSize: 35,
  },

  placeholderText: {
    color: C.muted,
    fontSize: 10,
    textAlign: 'center',
  },

  itemInfo: {
    padding: 13,
  },

  itemName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },

  itemCategory: {
    color: C.muted,
    fontSize: 11,
  },

  itemColor: {
    color: '#8067AE',
    fontSize: 11,
    marginTop: 5,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },

  editButton: {
    paddingVertical: 4,
    paddingRight: 5,
  },

  editText: {
    color: '#8067AE',
    fontSize: 11,
    fontWeight: '700',
  },

  deleteButton: {
    paddingVertical: 4,
    paddingLeft: 5,
  },

  deleteText: {
    color: C.rose,
    fontSize: 11,
    fontWeight: '700',
  },

  filterEmpty: {
    backgroundColor: C.white,
    padding: 25,
    borderRadius: 18,
    alignItems: 'center',
  },

  filterEmptyText: {
    color: C.muted,
    fontSize: 12,
  },
});