import PrizmaOutfitEditor, { type OutfitLayout } from './PrizmaOutfitEditor';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';
import { PRIZMA_COLORS as C } from './theme';
import PrizmaConfirm from './PrizmaConfirm';
import OutfitAIScreen from './OutfitAIScreen';
import TryOnPreviewModal from './TryOnPreviewModal';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode, encode } from 'base64-arraybuffer';
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
  onSetupTryOnPhoto?: () => void;
  initialTab?: 'clothes' | 'outfits' | 'ai';
};

type Outfit = {
  id: string;
  name: string;
  item_ids: string[];
  editor_layout?: OutfitLayout;
};



const SEASONS = [
  'Tüm Mevsimler',
  'İlkbahar',
  'Yaz',
  'Sonbahar',
  'Kış',
  'Dört Mevsim',
];

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

export default function WardrobeScreen({ userId, onSetupTryOnPhoto, initialTab = 'clothes' }: Props) {

  const [notice, setNotice] = useState<{
    type: NoticeType;
    title: string;
    message: string;
  } | null>(null);

  const showNotice = (
    type: NoticeType,
    title: string,
    message: string
  ) => {
    setNotice({ type, title, message });
  };


  const [confirmTarget, setConfirmTarget] = useState<
    { type: 'item' | 'outfit'; id: string; name: string } | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [pendingBatch,setPendingBatch]=useState<ImagePicker.ImagePickerAsset[]>([]);
  const [savedPiece,setSavedPiece]=useState<{id:string;name:string;category:string;color:string;season:string;preview:string|null}|null>(null);
  const [items, setItems] = useState<WardrobeItemWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [existingImageUrl, setExistingImageUrl] =
    useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Üst Giyim');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [season, setSeason] = useState('Dört Mevsim');

  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [search, setSearch] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState('Tüm Mevsimler');
  const [colorFilter, setColorFilter] = useState('');
  const [filterSheetVisible,setFilterSheetVisible] = useState(false);

  const [detailItem, setDetailItem] =
    useState<WardrobeItemWithImage | null>(null);
  const [tryOnItem, setTryOnItem] = useState<WardrobeItemWithImage | null>(null);

  const [activeWardrobeTab, setActiveWardrobeTab] = useState<'clothes' | 'outfits' | 'ai'>(initialTab);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [outfitName, setOutfitName] = useState('');
  const [editingOutfitId, setEditingOutfitId] =
    useState<string | null>(null);
  const [outfitSelected, setOutfitSelected] = useState<string[]>([]);
  const [outfitLayout, setOutfitLayout] = useState<OutfitLayout>({});
  const [aiMatchingBusy,setAiMatchingBusy]=useState(false);
  const [aiAlternativeLooks,setAiAlternativeLooks]=useState<{name:string;description:string;item_ids:string[]}[]>([]);
  const [showOutfitBuilder, setShowOutfitBuilder] = useState(false);

  const [removingBackground, setRemovingBackground] = useState(false);
  const [analyzingGarment, setAnalyzingGarment] = useState(false);
  const [analysisFeedback, setAnalysisFeedback] = useState('');
  const analysisSequence = useRef(0);

  // --------------------------------------------------
  // GARDIROBU YÜKLE
  // --------------------------------------------------

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
        .from('wardrobe_outfits')
        .select('id,name,item_ids,editor_layout')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (outfitError) {
        console.warn(
          'Kombinler yüklenemedi:',
          outfitError.message
        );
      } else {
        setOutfits((outfitData || []) as Outfit[]);
      }
    } catch (error: any) {
      showNotice('error',
        'Gardırop yüklenemedi',
        error?.message || 'Lütfen tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const reloadOutfits = useCallback(async () => {
    const { data, error } = await supabase
      .from('wardrobe_outfits')
      .select('id,name,item_ids')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      showNotice('error', 'Kombinler yüklenemedi', error.message);
      return;
    }
    setOutfits((data || []) as Outfit[]);
  }, [userId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const selectWardrobeTab = (nextTab: 'clothes' | 'outfits' | 'ai') => {
    setActiveWardrobeTab(nextTab);
    if (nextTab === 'outfits') void reloadOutfits();
  };

  // --------------------------------------------------
  // FORM İŞLEMLERİ
  // --------------------------------------------------

  const resetForm = () => {
    analysisSequence.current += 1;
    setAnalyzingGarment(false);
    setAnalysisFeedback('');
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

  const startAdding = () => {
    resetForm();
    choosePhoto();
  };

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

  // --------------------------------------------------
  // FOTOĞRAF SEÇİMİ
  // --------------------------------------------------

  const analyzeGarmentPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    const requestId = ++analysisSequence.current;
    setAnalyzingGarment(true);
    setAnalysisFeedback('Fotoğraf AI ile analiz ediliyor...');
    try {
      // Resize to reduce network traffic and AI cost; preserve the original for saving.
      const reduced = await ImageManipulator.manipulateAsync(asset.uri, [{resize:{width:1024}}], {
        compress:0.65,format:ImageManipulator.SaveFormat.JPEG,base64:true,
      });
      if(!reduced.base64)throw new Error('Fotoğraf okunamadı.');
      if(reduced.base64.length>4200000)throw new Error('Fotoğraf AI analizi için çok büyük.');
      const {data,error} = await supabase.functions.invoke('analyze-garment',{
        body:{image:reduced.base64,mimeType:'image/jpeg'},
      });
      if(error)throw new Error('AI kıyafet analizi şu anda kullanılamıyor.');
      if(data?.error)throw new Error(data.error);
      if(requestId!==analysisSequence.current)return;
      if(typeof data?.name==='string'&&data.name.trim())setName(data.name.trim().slice(0,80));
      if(typeof data?.category==='string'&&CATEGORIES.includes(data.category))setCategory(data.category);
      if(typeof data?.color==='string')setColor(data.color.slice(0,40));
      if(typeof data?.season==='string'&&SEASONS.includes(data.season))setSeason(data.season);
      setAnalysisFeedback('AI alanları önerdi. Kaydetmeden önce bilgileri kontrol et ve düzenle.');
    }catch(error){
      if(requestId===analysisSequence.current)setAnalysisFeedback(error instanceof Error?error.message:'AI analiz edemedi. Bilgileri elle girebilirsin.');
    }finally{if(requestId===analysisSequence.current)setAnalyzingGarment(false);}
  };

  const openBulkGallery = async () => {
    try{
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:['images'],allowsEditing:false,quality:0.8,selectionLimit:10,allowsMultipleSelection:true,
      });
      if(result.canceled||!result.assets?.length)return;
      const [first,...rest]=result.assets;
      resetForm();
      setPendingBatch(rest);
      setSelectedImage(first);
      setShowForm(true);
      void analyzeGarmentPhoto(first);
    }catch(error){
      showNotice('error','Fotoğraflar alınamadı',error instanceof Error?error.message:'Tekrar deneyebilirsin.');
    }
  };
  const nextBatchImage = () => {
    const [first,...rest]=pendingBatch;
    setSavedPiece(null);
    if(!first){setPendingBatch([]);return;}
    setPendingBatch(rest);
    resetForm();
    setSelectedImage(first);
    setShowForm(true);
    void analyzeGarmentPhoto(first);
  };
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
      void analyzeGarmentPhoto(result.assets[0]);
    } catch (error: any) {
      showNotice('error', 'Fotoğraf seçilemedi',
        error?.message || 'Lütfen tekrar dene.');
    }
  };

  const openCamera = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showNotice('info', 'Kamera izni gerekli',
          'Fotoğraf çekebilmek için cihaz ayarlarından PRİZMA uygulamasına kamera izni verebilirsin.');
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
      showNotice('error', 'Kamera açılamadı',
        error?.message || 'Lütfen tekrar dene.');
    }
  };

  const choosePhoto = () => {
    setPhotoSheetVisible(true);
  };

  // --------------------------------------------------
  // FOTOĞRAFI SUPABASE'E YÜKLE
  // --------------------------------------------------

  const uploadImage = async (
    image: ImagePicker.ImagePickerAsset
  ): Promise<string> => {
    if (!image.base64) {
      throw new Error(
        'Fotoğraf okunamadı. Lütfen yeniden seç.'
      );
    }

    const mimeType = image.mimeType || 'image/jpeg';

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

  // --------------------------------------------------
  // KIYAFET KAYDET / GÜNCELLE
  // --------------------------------------------------

  const saveItem = async () => {
    if (saving) return;

    if (!name.trim()) {
      showNotice('info',
        'İsim eksik',
        'Kıyafetine bir isim ver.'
      );
      return;
    }

    if (!editingItem && !selectedImage) {
      showNotice('info',
        'Fotoğraf eksik',
        'Önce bir kıyafet fotoğrafı seç.'
      );
      return;
    }

    setSaving(true);

    let newUploadedPath: string | null = null;
    let databaseSaved = false;
    let createdId:string|null=null;

    try {
      let imagePath = editingItem?.image_path || '';

      if (selectedImage) {
        imagePath = await uploadImage(selectedImage);
        newUploadedPath = imagePath;
      }

      if (editingItem) {
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
        const { data: inserted, error } = await supabase
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
        createdId=inserted?.id||null;
      }

      const wasEditing = Boolean(editingItem);
      const snapshot={id:createdId||'',name:name.trim(),category,color:color.trim()||'Belirtilmedi',season,preview:selectedImage?.uri||existingImageUrl};
      resetForm();
      if(!wasEditing&&createdId)setSavedPiece(snapshot);

      showNotice('success',
        wasEditing
          ? 'Kıyafet güncellendi '
          : 'Kıyafetin eklendi ',
        wasEditing
          ? 'Değişikliklerin kaydedildi.'
          : 'Yeni parçan PRİZMA gardırobunda!'
      );

      await loadItems();
    } catch (error: any) {
      if (newUploadedPath && !databaseSaved) {
        await supabase.storage
          .from('wardrobe')
          .remove([newUploadedPath]);
      }

      showNotice('info',
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

  // --------------------------------------------------
  // KIYAFET SİL
  // --------------------------------------------------

  const deleteItem = (item: WardrobeItem) => {
    setConfirmTarget({ type: 'item', id: item.id, name: item.name });
  };

  const confirmDeleteItem = async (item: WardrobeItem) => {
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
                showNotice('info',
                  'Kıyafet silindi',
                  'Kayıt silindi ancak fotoğraf depodan temizlenemedi.'
                );
              }
            } catch (error: any) {
              showNotice('info',
                'Silme başarısız',
                error?.message || 'Tekrar dene.'
              );
            } finally {
              setDeletingId(null);
            }
  };

  // --------------------------------------------------
  // FAVORİLER
  // --------------------------------------------------

  const toggleFavorite = async (
    item: WardrobeItemWithImage
  ) => {
    const next = !item.favorite;

    const { error } = await supabase
      .from('wardrobe_items')
      .update({ favorite: next })
      .eq('id', item.id)
      .eq('user_id', userId);

    if (error) {
      showNotice('info',
        'Favori kaydedilemedi',
        error.message
      );
      return;
    }

    setItems((current) =>
      current.map((x) =>
        x.id === item.id
          ? { ...x, favorite: next }
          : x
      )
    );

    setDetailItem((current) =>
      current?.id === item.id
        ? { ...current, favorite: next }
        : current
    );
  };

  // --------------------------------------------------
  // KOMBİNLER
  // --------------------------------------------------

  const completeOutfitWithAI = async(focus='Stil Editörü') => {
    if(aiMatchingBusy)return;
    if(items.length<2){showNotice('info','Gardırop','AI eşleştirmesi için en az iki parçan olmalı.');return;}
    setAiMatchingBusy(true);
    setAiAlternativeLooks([]);
    try{
      const lockedIds=outfitSelected.filter(id=>outfitLayout[id]?.locked);
      const {data,error}=await supabase.functions.invoke('generate-outfits',{
        body:{
          occasion:'Kullanıcının seçtiği parçalarla, eksik parçaları tamamlayan bir kombin',
          style:focus+'; sabitlenmiş parçaları mutlaka koru.',
          locked_item_ids:lockedIds,
        },
      });
      if(error)throw new Error('AI kombin servisine ulaşılamadı.');
      if(data?.error)throw new Error(String(data.error));
      const validIds=new Set(items.map(x=>x.id));
      const looks=(Array.isArray(data?.outfits)?data.outfits:[])
        .filter((x:any)=>x&&typeof x.name==='string'&&typeof x.description==='string'&&Array.isArray(x.item_ids)
          &&x.item_ids.length>=2&&x.item_ids.every((id:any)=>typeof id==='string'&&validIds.has(id))
          &&lockedIds.every(id=>x.item_ids.includes(id)))
        .slice(0,3) as {name:string;description:string;item_ids:string[]}[];
      if(!looks.length)throw new Error('Bu parçalarla uygun alternatif üretilemedi.');
      setAiAlternativeLooks(looks);
    }catch(error){
      showNotice('error','AI eşleştirmesi',error instanceof Error?error.message:'Öneriler alınamadı.');
    }finally{setAiMatchingBusy(false);}
  };
  const useAlternativeLook = (look:{name:string;description:string;item_ids:string[]})=>{
    const lockedIds=outfitSelected.filter(id=>outfitLayout[id]?.locked);
    const all=[...new Set([...lockedIds,...look.item_ids])];
    setOutfitSelected(all);
    setOutfitName(look.name.slice(0,100));
    setOutfitLayout(current=>Object.fromEntries(Object.entries(current).filter(([id])=>all.includes(id))));
    setAiAlternativeLooks([]);
    showNotice('success','Kombin hazır','Parçalar editöre aktarıldı; yerlerini değiştirip kaydedebilirsin.');
  };

  const saveOutfit = async () => {
    const chosen = [...new Set(outfitSelected)].filter(
      (id) => items.some((item) => item.id === id)
    );

    if (!outfitName.trim() || chosen.length < 2) {
      showNotice('info',
        'Eksik bilgi',
        'Kombine isim ver ve en az iki kıyafet seç.'
      );
      return;
    }

    const query = editingOutfitId
      ? supabase
          .from('wardrobe_outfits')
          .update({
            name: outfitName.trim(),
            item_ids: chosen,
            editor_layout: Object.fromEntries(chosen.map(id => [id,outfitLayout[id]]).filter((entry) => Boolean(entry[1]))),
          })
          .eq('id', editingOutfitId)
          .eq('user_id', userId)
      : supabase
          .from('wardrobe_outfits')
          .insert({
            user_id: userId,
            name: outfitName.trim(),
            item_ids: chosen,
            editor_layout: Object.fromEntries(chosen.map(id => [id,outfitLayout[id]]).filter((entry) => Boolean(entry[1]))),
          });

    const { error } = await query;

    if (error) {
      showNotice('info',
        'Kombin kaydedilemedi',
        error.message
      );
      return;
    }

    setShowOutfitBuilder(false);
    setEditingOutfitId(null);
    setOutfitName('');
    setOutfitSelected([]);
    setOutfitLayout({});

    await loadItems();
  };

  const closeOutfitBuilder = () => {
    setShowOutfitBuilder(false);
    setEditingOutfitId(null);
    setOutfitName('');
    setOutfitSelected([]);
    setOutfitLayout({});
  };

  const editOutfit = (outfit: Outfit) => {
    setEditingOutfitId(outfit.id);
    setOutfitLayout(outfit.editor_layout || {});
    setOutfitName(outfit.name);

    setOutfitSelected(
      outfit.item_ids.filter((id) =>
        items.some((item) => item.id === id)
      )
    );

    setShowOutfitBuilder(true);
  };

  const boardOrder: Record<string, number> = {
    'Dış Giyim': 0,
    'Üst Giyim': 1,
    'Elbise': 2,
    'Alt Giyim': 3,
    'Ayakkabı': 4,
    'Çanta': 5,
    'Aksesuar': 6,
    'Diğer': 7,
  };

  const renderBoard = (ids: string[]) => {
    const chosen = ids
      .map((id) => items.find((item) => item.id === id))
      .filter(
        (item): item is WardrobeItemWithImage =>
          Boolean(item)
      )
      .sort(
        (a, b) =>
          (boardOrder[a.category] ?? 7) -
          (boardOrder[b.category] ?? 7)
      );

    if (!chosen.length) {
      return (
        <Text style={styles.itemCategory}>
          Bu kombinin parçaları artık gardıropta yok.
        </Text>
      );
    }

    const main = chosen.filter(
      (item) =>
        !['Çanta', 'Aksesuar'].includes(item.category)
    );

    const side = chosen.filter(
      (item) =>
        ['Çanta', 'Aksesuar'].includes(item.category)
    );

    const renderPiece = (
      item: WardrobeItemWithImage,
      compact = false
    ) => (
      <View
        key={item.id}
        style={[
          styles.boardPiece,
          compact && styles.boardPieceSmall,
        ]}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={[
              styles.boardImage,
              compact && styles.boardImageSmall,
            ]}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.boardPlaceholder}>◇</Text>
        )}

        <Text
          style={styles.boardPieceName}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </View>
    );

    return (
      <View style={styles.boardCanvas}>
        <View style={styles.boardMain}>
          {main.map((item) => renderPiece(item))}
        </View>

        {side.length > 0 && (
          <View style={styles.boardSide}>
            {side.map((item) => renderPiece(item, true))}
          </View>
        )}
      </View>
    );
  };

  const deleteOutfit = (id: string) => {
    const outfit = outfits.find((o) => o.id === id);
    setConfirmTarget({
      type: 'outfit',
      id,
      name: outfit?.name || 'Bu kombin',
    });
  };

  const confirmDeleteOutfit = async (id: string) => {
            const { error } = await supabase
              .from('wardrobe_outfits')
              .delete()
              .eq('id', id)
              .eq('user_id', userId);

            if (error) {
              showNotice('info', 'Hata', error.message);
            } else {
              setOutfits((current) =>
                current.filter((o) => o.id !== id)
              );
            }
  };

  // --------------------------------------------------
  // ARKA PLAN KALDIRMA
  // --------------------------------------------------

  const removeBackground = async () => {
    if (removingBackground || saving) return;

    if (!selectedImage && !existingImageUrl) {
      showNotice('info', 'Fotoğraf seç',
        'Önce bir kıyafet fotoğrafı seçmelisin.');
      return;
    }

    setRemovingBackground(true);

    try {
      // Fotoğrafı arka plan kaldırmadan önce küçült.
      let sourceUri = selectedImage?.uri;

      if (!sourceUri && editingItem) {
        const { data: signed, error: signedError } =
          await supabase.storage
            .from('wardrobe')
            .createSignedUrl(editingItem.image_path, 120);

        if (signedError || !signed?.signedUrl) {
          throw new Error('Kayıtlı fotoğraf açılamadı.');
        }
        sourceUri = signed.signedUrl;
      }

      if (!sourceUri) {
        throw new Error('Fotoğraf okunamadı.');
      }

      const resized = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const imageBase64 = resized.base64;
      const mimeType = 'image/jpeg';

      if (!imageBase64 || imageBase64.length > 8_000_000) {
        throw new Error('Fotoğraf çok büyük. Daha küçük bir fotoğraf seç.');
      }

      const { data, error } = await supabase.functions.invoke(
        'remove-background',
        { body: { imageBase64, mimeType } }
      );

      if (error) {
        let message = error.message || 'Arka plan kaldırılamadı.';
        // Supabase, HTTP hatalarında asıl mesajı response içinde tutar.
        if (error.context && typeof error.context.json === 'function') {
          try {
            const details = await error.context.json();
            if (typeof details?.error === 'string') message = details.error;
          } catch (_) { /* JSON olmayan hata yanıtı */ }
        }
        throw new Error(message);
      }

      if (!data?.imageBase64) {
        throw new Error(data?.error || 'Servis görsel döndürmedi.');
      }

      const pngUri = `data:image/png;base64,${data.imageBase64}`;
      setSelectedImage({
        ...(selectedImage || {
          uri: pngUri,
          width: 0,
          height: 0,
          type: 'image' as const,
        }),
        uri: pngUri,
        base64: data.imageBase64,
        mimeType: 'image/png',
      });

      showNotice('success', 'Arka plan hazır ',
        'Arka plan kaldırıldı. Değişikliği saklamak için Kaydet butonuna bas.');
    } catch (error: any) {
      showNotice('error', 'Arka plan kaldırılamadı',
        error?.message || 'Lütfen tekrar dene.');
    } finally {
      setRemovingBackground(false);
    }
  };

  // --------------------------------------------------
  // FİLTRELER
  // --------------------------------------------------

  const filteredItems = items.filter(
    (item) =>
      (activeFilter === 'Tümü' ||
        item.category === activeFilter) &&
      (!favoriteOnly || item.favorite) &&
      (seasonFilter === 'Tüm Mevsimler' ||
        item.season === seasonFilter ||
        item.season === 'Dört Mevsim') &&
      (!colorFilter.trim() ||
        (item.color || '')
          .toLocaleLowerCase('tr-TR')
          .includes(
            colorFilter
              .trim()
              .toLocaleLowerCase('tr-TR')
          )) &&
      (!search.trim() ||
        [
          item.name,
          item.category,
          item.color || '',
          item.notes || '',
        ]
          .join(' ')
          .toLocaleLowerCase('tr-TR')
          .includes(
            search.trim().toLocaleLowerCase('tr-TR')
          ))
  );

  const previewUri =
    selectedImage?.uri || existingImageUrl;
      // --------------------------------------------------
  // DETAY EKRANINDAN DÜZENLEMEYE GEÇ
  // --------------------------------------------------

  const editFromDetail = () => {
    if (!detailItem) return;

    const item = detailItem;
    setDetailItem(null);

    // Detay modalının kapanış animasyonunun bitmesini bekle.
    setTimeout(() => {
      startEditing(item);
    }, 350);
  };

  return (
    <View style={styles.container}>
      <TryOnPreviewModal
        visible={tryOnItem !== null}
        item={tryOnItem}
        userId={userId}
        onClose={() => setTryOnItem(null)}
        onSetupPhoto={() => { setTryOnItem(null); if (onSetupTryOnPhoto) onSetupTryOnPhoto(); else showNotice('info', 'Fotoğrafını profilinden ekle ', 'Profil → Sanal Deneme Fotoğrafım bölümünden boydan fotoğraf yükleyebilirsin.'); }}
      />
      <PrizmaNotice
        bottomOffset={80}
        visible={Boolean(notice)}
        type={notice?.type || 'info'}
        title={notice?.title || ''}
        message={notice?.message || ''}
        onClose={() => setNotice(null)}
      />
      <PrizmaConfirm
        visible={Boolean(confirmTarget)}
        title={confirmTarget?.type === 'outfit' ? 'Kombin silinsin mi?' : 'Bu parçayı silelim mi?'}
        message={confirmTarget?.type === 'outfit'
          ? `"${confirmTarget?.name || 'Kombin'}" silinecek.`
          : `"${confirmTarget?.name || 'Kıyafet'}" gardırobundan kaldırılacak.`}
        loading={confirmBusy}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (!confirmTarget || confirmBusy) return;
          const target = confirmTarget;
          setConfirmBusy(true);
          try {
            if (target.type === 'item') {
              const item = items.find((i) => i.id === target.id);
              if (item) await confirmDeleteItem(item);
            } else {
              await confirmDeleteOutfit(target.id);
            }
            setConfirmTarget(null);
          } finally {
            setConfirmBusy(false);
          }
        }}
      />

      <View style={styles.catalogHeading}><Text style={styles.catalogTitle}>Gardırop</Text><Text style={styles.catalogSubtitle}>Tüm kıyafetlerin, kombinlerin ve stilin tek yerde.</Text></View>
      <View style={styles.catalogStats}>
        <Text style={styles.catalogStat}>♧  {items.length} Parça</Text>
        <View style={styles.catalogDivider}/>
        <Text style={styles.catalogStat}>▱  {outfits.length} Kombin</Text>
      </View>
      {/* GARDIROP SEKME NAVIGASYONU */}
      <View style={styles.wardrobeTabRow} accessibilityRole="tablist">
        {([
          ['clothes', 'Parçalar'],
          ['outfits', 'Kombinler'],
        ] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeWardrobeTab === key }}
            onPress={() => selectWardrobeTab(key)}
            style={[
              styles.wardrobeTab,
              activeWardrobeTab === key && styles.wardrobeTabActive,
            ]}
          >
            <Text style={[
              styles.wardrobeTabText,
              activeWardrobeTab === key && styles.wardrobeTabTextActive,
            ]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeWardrobeTab === 'outfits' && (
        <TouchableOpacity style={styles.studioAiButton} accessibilityRole="button" onPress={() => selectWardrobeTab('ai')}>
          <Text style={styles.studioAiButtonText}>◎  PRİZMA AI ile Kombin Oluştur</Text>
          <Text style={styles.studioAiButtonText}>›</Text>
        </TouchableOpacity>
      )}
      {activeWardrobeTab === 'ai' && (
        <TouchableOpacity style={styles.aiBackButton} accessibilityRole="button" onPress={() => selectWardrobeTab('outfits')}>
          <Text style={styles.aiBackText}>‹ Kombinlerime dön</Text>
        </TouchableOpacity>
      )}

      {activeWardrobeTab === 'clothes' && <View style={styles.catalogSearchRow}>
        <View style={styles.catalogSearch}><Text style={styles.catalogSearchSymbol}>⌕</Text><TextInput style={styles.catalogSearchInput} value={search} onChangeText={setSearch} placeholder="Gardırobunda ara..." placeholderTextColor={C.muted}/></View>
        <TouchableOpacity style={styles.catalogFilterButton} onPress={()=>setFilterSheetVisible(true)}><Text style={styles.catalogFilterText}>☷  Filtrele</Text></TouchableOpacity>
      </View>}
      <TouchableOpacity style={styles.floatingAdd} onPress={startAdding} accessibilityRole="button" accessibilityLabel="Yeni parça ekle"><Text style={styles.floatingAddText}>＋</Text></TouchableOpacity>
      {/* ============================================= */}
      {/* KIYAFET EKLEME / DÜZENLEME TAM EKRAN MODALI */}
      {/* ============================================= */}


      <Modal visible={!!savedPiece} animationType="slide" onRequestClose={()=>setSavedPiece(null)}>
        <SafeAreaView style={styles.savedScreen}>
          {savedPiece&&<ScrollView contentContainerStyle={styles.savedContent}>
            <View style={styles.savedHeader}><Text style={styles.savedLogo}>PRİZMA</Text></View>
            <View style={styles.savedResultTitle}><Text style={styles.savedCheck}>✓</Text><Text style={styles.savedTitle}>Kıyafet gardırobuna eklendi.</Text></View>
            {savedPiece.preview?<Image source={{uri:savedPiece.preview}} resizeMode="contain" style={styles.savedPhoto}/>:<View style={styles.savedPhoto}><Text style={styles.savedPhotoMissing}>▢</Text></View>}
            <Text style={styles.savedPieceName}>{savedPiece.name}</Text>
            <View style={styles.savedMetadata}>
              {([['Kategori',savedPiece.category],['Renk',savedPiece.color],['Mevsim',savedPiece.season]] as const).map(([label,value])=>
                <View style={styles.savedMetaCell} key={label}><Text style={styles.savedMetaLabel}>{label}</Text><Text style={styles.savedMetaValue}>{value}</Text></View>)}
            </View>
            <TouchableOpacity style={styles.savedPrimary} onPress={()=>{
              setOutfitSelected([savedPiece.id]);setOutfitName(savedPiece.name+' ile Kombin');setOutfitLayout({});setSavedPiece(null);selectWardrobeTab('outfits');setShowOutfitBuilder(true);
            }}><Text style={styles.savedPrimaryText}>♧  Bu Parçayla Kombin Oluştur</Text></TouchableOpacity>
            {!!pendingBatch.length&&<TouchableOpacity style={styles.savedOutline} onPress={nextBatchImage}><Text style={styles.savedOutlineText}>Sıradaki Parça ({pendingBatch.length} kaldı) ›</Text></TouchableOpacity>}
            <TouchableOpacity style={styles.savedOutline} onPress={()=>{setSavedPiece(null);startAdding();}}><Text style={styles.savedOutlineText}>＋  Yeni Parça Ekle</Text></TouchableOpacity>
            <TouchableOpacity style={styles.savedOutline} onPress={()=>{setSavedPiece(null);selectWardrobeTab('clothes');}}><Text style={styles.savedOutlineText}>▦  Gardıroba Dön</Text></TouchableOpacity>
          </ScrollView>}
        </SafeAreaView>
      </Modal>

      <Modal transparent visible={filterSheetVisible} animationType="slide" onRequestClose={()=>setFilterSheetVisible(false)}>
        <View style={styles.prizmaSheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={()=>setFilterSheetVisible(false)}/>
          <View style={styles.filterSheet}><View style={styles.prizmaSheetHandle}/>
            <View style={styles.filterSheetHeading}><Text style={styles.filterSheetTitle}>Filtrele</Text><TouchableOpacity onPress={()=>setFilterSheetVisible(false)}><Text style={styles.filterClose}>×</Text></TouchableOpacity></View>
            <ScrollView style={{maxHeight:440}} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterGroupTitle}>Kategori</Text>
              <View style={styles.filterChoices}>{CATEGORIES.map(value=><TouchableOpacity key={value} onPress={()=>setActiveFilter(value)} style={[styles.filterOption,activeFilter===value&&styles.filterOptionActive]}><Text style={[styles.filterOptionLabel,activeFilter===value&&styles.filterOptionLabelActive]}>{value}</Text></TouchableOpacity>)}</View>
              <View style={styles.filterSeparator}/>
              <Text style={styles.filterGroupTitle}>Renk</Text>
              <View style={styles.filterChoices}>{(['','Siyah','Beyaz','Bej','Kahverengi','Gri','Mavi','Yeşil','Kırmızı','Mor'] as const).map(value=><TouchableOpacity key={value} onPress={()=>setColorFilter(value)} style={[styles.colorOption,colorFilter===value&&styles.colorOptionActive]}><View style={[styles.colorCircle,{backgroundColor:({'':'#FFFFFF','Siyah':'#222222','Beyaz':'#FFFFFF','Bej':'#DCC5AA','Kahverengi':'#7B553C','Gri':'#B6B6B6','Mavi':'#4266A2','Yeşil':'#78945E','Kırmızı':'#C85E69','Mor':'#775493'} as Record<string,string>)[value]}]}/><Text style={styles.filterColorLabel}>{value||'Tümü'}</Text></TouchableOpacity>)}</View>
              <View style={styles.filterSeparator}/>
              <Text style={styles.filterGroupTitle}>Mevsim</Text>
              <View style={styles.filterChoices}>{SEASONS.filter(x=>x!=='Dört Mevsim').map(value=><TouchableOpacity key={value} onPress={()=>setSeasonFilter(value)} style={[styles.filterOption,seasonFilter===value&&styles.filterOptionActive]}><Text style={[styles.filterOptionLabel,seasonFilter===value&&styles.filterOptionLabelActive]}>{value}</Text></TouchableOpacity>)}</View>
              <View style={styles.filterSeparator}/>
              <TouchableOpacity style={styles.onlyFavorites} onPress={()=>setFavoriteOnly(!favoriteOnly)}><Text style={styles.onlyFavoritesLabel}>{favoriteOnly?'☑':'□'}  Yalnızca favorilerimi göster</Text></TouchableOpacity>
            </ScrollView>
            <View style={styles.filterFooter}>
              <TouchableOpacity style={styles.filterReset} onPress={()=>{setActiveFilter('Tümü');setColorFilter('');setSeasonFilter('Tüm Mevsimler');setFavoriteOnly(false);}}><Text style={styles.filterResetText}>Temizle</Text></TouchableOpacity>
              <TouchableOpacity style={styles.filterApply} onPress={()=>setFilterSheetVisible(false)}><Text style={styles.filterApplyText}>Sonuçları Göster</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={photoSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoSheetVisible(false)}
      >
        <View style={styles.prizmaSheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPhotoSheetVisible(false)}
          />
          <View style={styles.prizmaSheet}>
            <View style={styles.prizmaSheetHandle} />
            <Text style={styles.prizmaSheetSparkle}>▢</Text>
            <Text style={styles.prizmaSheetTitle}>
              Parça Ekle
            </Text>
            <Text style={styles.prizmaSheetSubtitle}>
              Yeni parçanı nasıl eklemek istersin?
            </Text>

            <TouchableOpacity
              style={styles.prizmaSheetOption}
              onPress={() => {
                setPhotoSheetVisible(false);
                setTimeout(() => { void openGallery(); }, 350);
              }}
            >
              <Text style={styles.prizmaSheetOptionIcon}>▧</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.prizmaSheetOptionTitle}>
                  Galeriden Seç
                </Text>
                <Text style={styles.prizmaSheetOptionDetail}>
                  Tek bir kıyafet ekle
                </Text>
              </View>
              <Text style={styles.prizmaSheetArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.prizmaSheetOption}
              onPress={() => {
                setPhotoSheetVisible(false);
                setTimeout(() => { void openCamera(); }, 350);
              }}
            >
              <Text style={styles.prizmaSheetOptionIcon}>◉</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.prizmaSheetOptionTitle}>
                  Kamera
                </Text>
                <Text style={styles.prizmaSheetOptionDetail}>
                  Şimdi fotoğraf çek
                </Text>
              </View>
              <Text style={styles.prizmaSheetArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.prizmaSheetOption} onPress={()=>{setPhotoSheetVisible(false);void openBulkGallery();}}>
              <Text style={styles.prizmaSheetOptionIcon}>▣</Text>
              <View style={{flex:1}}><Text style={styles.prizmaSheetOptionTitle}>Birden Fazla Fotoğraf Seç</Text><Text style={styles.prizmaSheetOptionDetail}>Aynı anda birden çok parça ekle</Text></View>
              <Text style={styles.prizmaSheetArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.prizmaSheetCancel}
              onPress={() => setPhotoSheetVisible(false)}
            >
              <Text style={styles.prizmaSheetCancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (!saving) resetForm();
        }}
      >
        <SafeAreaView style={styles.editorScreen}>
          <KeyboardAvoidingView
            style={styles.editorFlex}
            behavior={
              Platform.OS === 'ios' ? 'padding' : undefined
            }
          >
            {/* ÜST BAŞLIK */}

            <View style={styles.editorHeader}>
              <TouchableOpacity
                onPress={resetForm}
                disabled={saving}
                style={styles.editorBack}
              >
                <Text style={styles.editorBackText}>
                  ‹ Geri
                </Text>
              </TouchableOpacity>

              <Text style={styles.editorHeaderTitle}>
                {editingItem
                  ? 'Kıyafeti Düzenle'
                  : 'Yeni Kıyafet'}
              </Text>

              <View style={styles.editorHeaderSpacer} />
            </View>

            {/* KAYDIRILABİLİR FORM */}

            <ScrollView
              style={styles.editorFlex}
              contentContainerStyle={styles.editorContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formTitle}>
                {editingItem
                  ? 'Parçanı düzenle '
                  : 'Yeni bir parça '}
              </Text>

              <Text style={styles.formSubtitle}>
                {editingItem
                  ? 'Kıyafet bilgilerini güncelleyebilirsin.'
                  : 'Kıyafetini gardırobuna ekleyelim.'}
              </Text>

              {/* FOTOĞRAF */}

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

              {/* ARKA PLAN KALDIRMA - YENİ VE KAYITLI KIYAFETLER */}

              {previewUri && (
                <TouchableOpacity
                  style={styles.outlineButton}
                  disabled={removingBackground || saving}
                  onPress={() => void removeBackground()}
                >
                  {removingBackground ? (
                    <ActivityIndicator color={C.navy} />
                  ) : (
                    <Text style={styles.outlineText}>
                       Arka Planı Kaldır
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {!editingItem && <View style={styles.analysisInfo}>
                {analyzingGarment && <ActivityIndicator color={C.lavender}/>}
                <Text style={styles.analysisInfoText}>{analysisFeedback||'Fotoğraf seçildiğinde AI ad, kategori, renk ve mevsim önerir. Fotoğraf bu amaçla güvenli sunucuya gönderilir.'}</Text>
              </View>}
              {selectedImage && !analyzingGarment && <TouchableOpacity style={styles.aiRetry} onPress={()=>{void analyzeGarmentPhoto(selectedImage);}} accessibilityRole="button">
                <Text style={styles.aiRetryText}>◎  AI ile Yeniden Analiz Et</Text>
              </TouchableOpacity>}

              {/* KIYAFET ADI */}

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

              {/* KATEGORİ */}

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

              {/* RENK */}

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

              {/* MEVSİM */}

              <Text style={styles.inputLabel}>
                MEVSİM
              </Text>

              <View style={styles.categoryWrap}>
                {SEASONS.filter(
                  (item) => item !== 'Tüm Mevsimler'
                ).map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setSeason(item)}
                    style={[
                      styles.categoryChip,
                      season === item &&
                        styles.categoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        season === item &&
                          styles.categoryTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* NOTLAR */}

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

            </ScrollView>

            {/* SABİT ALT BUTONLAR */}

            <View style={styles.editorFooter}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { marginTop: 0 },
                  saving && styles.disabledButton,
                ]}
                disabled={saving}
                onPress={() => void saveItem()}
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ============================================= */}
      {/* KIYAFET DETAYLARI - TAM EKRAN */}
      {/* ============================================= */}

      <Modal
        visible={detailItem !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setDetailItem(null)}
      >
        <SafeAreaView style={styles.detailScreen}>
          {/* DETAY ÜST BAŞLIK */}

          <View style={styles.editorHeader}>
            <TouchableOpacity
              style={styles.editorBack}
              onPress={() => setDetailItem(null)}
            >
              <Text style={styles.editorBackText}>
                ‹ Geri
              </Text>
            </TouchableOpacity>

            <Text style={styles.editorHeaderTitle}>
              Parça Detayları
            </Text>

            <View style={styles.editorHeaderSpacer} />
          </View>

          {detailItem && (
            <>
              {/* DETAY İÇERİĞİ */}

              <ScrollView
                style={styles.editorFlex}
                contentContainerStyle={styles.detailContent}
                showsVerticalScrollIndicator={false}
              >
                {/* BÜYÜK FOTOĞRAF */}

                <View style={styles.detailImageContainer}>
                  {detailItem.imageUrl ? (
                    <Image
                      source={{ uri: detailItem.imageUrl }}
                      style={styles.detailImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.detailImagePlaceholder}>
                      <Text style={styles.detailPlaceholderIcon}>
                        ◇
                      </Text>

                      <Text style={styles.placeholderText}>
                        Görsel yüklenemedi
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.outlineButton, { marginTop: 14, backgroundColor: '#FFFFFF', borderColor: '#DCC7EB' }]}
                  onPress={() => { const chosen = detailItem; setDetailItem(null); setTimeout(() => setTryOnItem(chosen), 360); }}
                >
                  <Text style={[styles.outlineText, { color: '#68419A', fontWeight: '800' }]}>Üzerimde Dene</Text>
                </TouchableOpacity>

                {/* İSİM VE FAVORİ */}

                <View style={styles.detailTitleRow}>
                  <View style={styles.detailTitleArea}>
                    <Text style={styles.detailEyebrow}>
                      GARDIROBUMDAKİ PARÇA
                    </Text>

                    <Text style={styles.detailName}>
                      {detailItem.name}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.detailFavoriteButton}
                    onPress={() =>
                      void toggleFavorite(detailItem)
                    }
                  >
                    <Text style={styles.detailFavoriteText}>
                      {detailItem.favorite ? '♥' : '♡'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* KIYAFET BİLGİLERİ */}

                <View style={styles.detailInfoCard}>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>
                      Kategori
                    </Text>

                    <Text style={styles.detailInfoValue}>
                      {detailItem.category}
                    </Text>
                  </View>

                  <View style={styles.detailDivider} />

                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>
                      Renk
                    </Text>

                    <Text style={styles.detailInfoValue}>
                      {detailItem.color || 'Belirtilmedi'}
                    </Text>
                  </View>

                  <View style={styles.detailDivider} />

                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>
                      Mevsim
                    </Text>

                    <Text style={styles.detailInfoValue}>
                      {detailItem.season || 'Belirtilmedi'}
                    </Text>
                  </View>
                </View>

                {/* NOTLAR */}

                <View style={styles.detailNotesCard}>
                  <Text style={styles.detailNotesTitle}>
                    NOTLAR 
                  </Text>

                  <Text style={styles.detailNotesText}>
                    {detailItem.notes ||
                      'Bu parça için henüz not eklenmemiş.'}
                  </Text>
                </View>
              </ScrollView>

              {/* DETAY EKRANI SABİT ALT BUTON */}

              <View style={styles.editorFooter}>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { marginTop: 0 },
                  ]}
                  onPress={editFromDetail}
                >
                  <Text style={styles.saveButtonText}>
                    ✎ Bu Parçayı Düzenle →
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {activeWardrobeTab === 'outfits' && (
        <>
      {/* ============================================= */}
      {/* KOMBİNLER */}
      {/* ============================================= */}

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          Kombinlerim 
        </Text>

        <Text style={styles.formSubtitle}>
          Parçalarını bir moda panosunda bir araya getir.
        </Text>

        {items.length >= 2 && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (showOutfitBuilder) {
                closeOutfitBuilder();
              } else {
                setEditingOutfitId(null);
                setShowOutfitBuilder(true);
              }
            }}
          >
            <Text style={styles.addButtonText}>
              {showOutfitBuilder
                ? 'Kapat'
                : '+ Kombin Oluştur'}
            </Text>
          </TouchableOpacity>
        )}

        {items.length < 2 && (
          <Text style={styles.itemCategory}>
            Yeni kombin oluşturmak için en az iki kıyafet ekle.
          </Text>
        )}

        {/* KOMBİN OLUŞTURUCU */}

        {showOutfitBuilder && (
          <View style={styles.builderBox}>
            <TextInput
              style={styles.input}
              value={outfitName}
              onChangeText={setOutfitName}
              placeholder="Kombin adı"
              placeholderTextColor={C.muted}
              maxLength={100}
            />

            <Text style={styles.boardHint}>Parça ekle; tuval üzerinde sürükleyerek yerleştir.</Text>

            <View style={styles.boardPicker}>
              {items.map((item) => {
                const chosen = outfitSelected.includes(
                  item.id
                );

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.boardPickCard,
                      chosen && styles.boardPickSelected,
                    ]}
                    onPress={() =>
                      setOutfitSelected((current) =>
                        current.includes(item.id)
                          ? current.filter(
                              (id) => id !== item.id
                            )
                          : [...current, item.id]
                      )
                    }
                  >
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.boardPickImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.boardPlaceholder}>
                        ◇
                      </Text>
                    )}

                    <Text
                      style={styles.boardPieceName}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>

                    <Text style={styles.boardCheck}>
                      {chosen ? '✓ Seçildi' : '+ Seç'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {outfitSelected.length >= 1 && <PrizmaOutfitEditor
              items={outfitSelected.map(id => items.find(item => item.id === id)).filter((item): item is WardrobeItemWithImage => Boolean(item))}
              positions={outfitLayout}
              onChange={setOutfitLayout}
              onAiComplete={(focus)=>{void completeOutfitWithAI(focus);}}
              aiBusy={aiMatchingBusy}
            />}

            {aiAlternativeLooks.length>0&&<View style={styles.aiAlternatives}>
              <Text style={styles.aiAlternativesTitle}>PRİZMA AI ile Tamamla</Text>
              <Text style={styles.aiAlternativesSubtitle}>Sabitlenen parçaların korunarak önerilen alternatifler</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9}}>
                {aiAlternativeLooks.map((look,index)=><TouchableOpacity key={index} style={styles.aiAlternativeCard}
                    onPress={()=>useAlternativeLook(look)}>
                  <View style={styles.aiPreviewThumbs}>{look.item_ids.slice(0,4).map(id=>{const item=items.find(x=>x.id===id);return <View key={id} style={styles.aiPreviewCell}>{item?.imageUrl?<Image source={{uri:item.imageUrl}} style={styles.aiPreviewImage} resizeMode="contain"/>:<Text>▢</Text>}</View>;})}</View>
                  <Text style={styles.aiAlternativeName} numberOfLines={2}>{look.name}</Text>
                  <Text style={styles.aiAlternativeDescription} numberOfLines={3}>{look.description}</Text>
                  <Text style={styles.aiAlternativeButton}>Bu Kombini Kullan ›</Text>
                </TouchableOpacity>)}
              </ScrollView>
            </View>}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => void saveOutfit()}
            >
              <Text style={styles.saveButtonText}>
                {editingOutfitId
                  ? 'Kombini Güncelle'
                  : 'Kombini Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* KAYITLI KOMBİNLER */}

        {!showOutfitBuilder && <View style={styles.outfitCompactGrid}>{outfits.map((outfit) => (
          <View
            key={outfit.id}
            style={styles.outfitCompactCard}
          >
            <Text style={styles.boardOutfitTitle}>
              {outfit.name}
            </Text>

            <View style={styles.outfitCompactPreview}>{outfit.item_ids.slice(0,4).map((id,index)=>{
              const item=items.find(x=>x.id===id);
              return <View key={id+index} style={styles.outfitThumbCell}>{item?.imageUrl?<Image source={{uri:item.imageUrl}} resizeMode="contain" style={styles.outfitThumbImage}/>:<Text style={styles.outfitThumbFallback}>▢</Text>}</View>;
            })}</View>

            <View style={styles.boardActions}>
              <TouchableOpacity
                style={styles.boardAction}
                onPress={() => editOutfit(outfit)}
              >
                <Text style={styles.editText}>
                  ✎ Düzenle
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.boardAction}
                onPress={() => deleteOutfit(outfit.id)}
              >
                <Text style={styles.deleteText}>
                  Kombini Sil
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}</View>}
      </View>

        </>
      )}

      {activeWardrobeTab === 'clothes' && (
        <>
      {/* ============================================= */}
      {/* KIYAFET LİSTESİ */}
      {/* ============================================= */}

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
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>♧</Text>

          <Text style={styles.emptyTitle}>
            Gardırobun henüz boş
          </Text>

          <Text style={styles.emptyDescription}>
            Kıyafetlerini ekleyerek kendi stil koleksiyonunu oluşturmaya başla.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={startAdding}
          >
            <Text style={styles.emptyButtonText}>
              İlk Parçanı Ekle
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* LİSTE BAŞLIĞI */}

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

          {/* FİLTRE SONUÇLARI */}

          {filteredItems.length === 0 ? (
            <View style={styles.filterEmpty}>
              <Text style={styles.filterEmptyText}>
                Aradığın kriterlere uygun kıyafet bulunamadı.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <TouchableOpacity style={styles.itemImageContainer} onPress={()=>setDetailItem(item)} accessibilityRole="button">
                    {item.imageUrl?<Image source={{uri:item.imageUrl}} style={styles.itemImage} resizeMode="contain"/>:
                      <View style={styles.imagePlaceholder}><Text style={styles.placeholderIcon}>♧</Text><Text style={styles.placeholderText}>Görsel ekle</Text></View>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>{void toggleFavorite(item);}} style={styles.catalogFavorite} accessibilityRole="button" accessibilityLabel={item.favorite?'Favorilerden çıkar':'Favorilere ekle'}>
                    <Text style={styles.catalogHeart}>{item.favorite?'♥':'♡'}</Text>
                  </TouchableOpacity>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemCategory} numberOfLines={1}>{item.category} · {item.color||'Renk belirtilmedi'}</Text>
                    <View style={styles.catalogActionRow}>
                      <TouchableOpacity style={styles.catalogSmallAction} onPress={()=>startEditing(item)}><Text style={styles.catalogSmallText}>✎ Düzenle</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.catalogSmallAction} onPress={()=>deleteItem(item)}><Text style={styles.catalogSmallText}>♙ Sil</Text></TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.catalogTryOn} onPress={()=>setTryOnItem(item)}><Text style={styles.catalogTryText}>▢  Üzerimde Dene</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
        </>
      )}

      {activeWardrobeTab === 'ai' && (
        <OutfitAIScreen userId={userId} onSaved={() => { void reloadOutfits(); setActiveWardrobeTab('outfits'); showNotice('success', 'Kombin kaydedildi ', 'AI kombinin Kombinler sekmesine eklendi.'); }} />
      )}
    </View>
  );
}

// ====================================================
// STİLLER
// ====================================================

const styles = StyleSheet.create({
  outfitCompactGrid:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:13},
  outfitCompactCard:{width:'48%',borderWidth:1,borderColor:C.border,borderRadius:16,padding:9,backgroundColor:'#FFFFFF',marginBottom:7},
  outfitCompactPreview:{height:137,width:'100%',flexDirection:'row',flexWrap:'wrap',alignContent:'center',gap:2},
  outfitThumbCell:{width:'48%',height:65,alignItems:'center',justifyContent:'center'},outfitThumbImage:{height:'100%',width:'100%'},outfitThumbFallback:{color:C.muted},
  aiPreviewThumbs:{height:110,flexDirection:'row',flexWrap:'wrap',gap:3,alignContent:'center'},aiPreviewCell:{width:'48%',height:52},aiPreviewImage:{height:'100%',width:'100%'},

  savedScreen:{flex:1,backgroundColor:'#FFFFFF'},
  savedContent:{paddingHorizontal:19,paddingVertical:14,backgroundColor:'#FFFFFF',paddingBottom:40,gap:11},
  savedHeader:{minHeight:58,alignItems:'center',justifyContent:'center'},
  savedLogo:{color:C.lavender,fontFamily:Platform.OS==='ios'?'Georgia':'serif',fontSize:22,letterSpacing:4},
  savedResultTitle:{flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center',marginVertical:14},
  savedCheck:{width:34,height:34,textAlign:'center',textAlignVertical:'center',borderRadius:17,backgroundColor:C.lavender,color:'#FFFFFF',fontSize:21},
  savedTitle:{color:C.navy,fontSize:17,fontFamily:Platform.OS==='ios'?'Georgia':'serif'},
  savedPhoto:{height:295,width:'100%',borderRadius:16,backgroundColor:'#FFFFFF'},
  savedPhotoMissing:{color:C.lavender,fontSize:45,textAlign:'center'},
  savedPieceName:{fontFamily:Platform.OS==='ios'?'Georgia':'serif',color:C.navy,fontSize:26,marginVertical:6},
  savedMetadata:{flexDirection:'row',gap:8,marginBottom:21},
  savedMetaCell:{flex:1,borderWidth:1,borderColor:C.border,borderRadius:14,minHeight:68,padding:9,justifyContent:'center'},
  savedMetaLabel:{fontSize:11,color:C.muted},savedMetaValue:{fontSize:12,color:C.navy,fontWeight:'700',marginTop:6},
  savedPrimary:{minHeight:52,backgroundColor:C.lavender,borderRadius:17,alignItems:'center',justifyContent:'center'},
  savedPrimaryText:{fontSize:14,color:'#FFFFFF',fontWeight:'700'},
  savedOutline:{minHeight:50,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.border,borderRadius:17,alignItems:'center',justifyContent:'center'},
  savedOutlineText:{color:C.lavender,fontSize:14,fontWeight:'700'},

  aiAlternatives:{marginTop:15,gap:8},
  aiAlternativesTitle:{fontSize:17,color:C.navy,fontWeight:'700'},
  aiAlternativesSubtitle:{fontSize:12,color:C.muted},
  aiAlternativeCard:{width:192,minHeight:136,padding:14,borderWidth:1,borderColor:C.border,borderRadius:15,backgroundColor:'#FFFFFF'},
  aiAlternativeName:{fontSize:13,fontWeight:'700',color:C.navy},
  aiAlternativeDescription:{fontSize:11,color:C.muted,marginTop:7,lineHeight:16},
  aiAlternativeButton:{fontSize:12,color:C.lavender,fontWeight:'700',marginTop:9},

  catalogHeading:{alignItems:'center',paddingTop:6,paddingBottom:12},
  catalogTitle:{fontFamily:Platform.OS==='ios'?'Georgia':'serif',fontSize:30,fontWeight:'600',color:C.navy},
  catalogSubtitle:{fontSize:12,color:C.muted,textAlign:'center',marginTop:5},
  catalogStats:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:22,marginBottom:19},
  catalogStat:{fontSize:15,color:C.navy,fontWeight:'700'},
  catalogDivider:{height:25,width:1,backgroundColor:C.border},
  catalogSearchRow:{flexDirection:'row',gap:9,marginBottom:15},
  catalogSearch:{flex:1,minHeight:47,borderWidth:1,borderColor:C.border,borderRadius:25,flexDirection:'row',alignItems:'center',paddingHorizontal:12,backgroundColor:'#FFFFFF'},
  catalogSearchSymbol:{color:C.lavender,fontSize:25,marginRight:8},
  catalogSearchInput:{flex:1,fontSize:13,color:C.navy,paddingVertical:4},
  catalogFilterButton:{minHeight:47,paddingHorizontal:12,borderColor:C.border,borderWidth:1,borderRadius:25,justifyContent:'center'},
  catalogFilterText:{fontSize:12,fontWeight:'700',color:C.lavender},
  floatingAdd:{position:'absolute',bottom:24,right:6,zIndex:35,elevation:12,width:58,height:58,borderRadius:29,backgroundColor:C.lavender,alignItems:'center',justifyContent:'center'},
  floatingAddText:{fontSize:34,color:'#FFFFFF',fontWeight:'300',marginTop:-4},
  catalogFavorite:{position:'absolute',top:9,right:9,width:35,height:35,borderRadius:18,backgroundColor:'#FFFFFF',justifyContent:'center',alignItems:'center',elevation:2},
  catalogHeart:{fontSize:23,color:C.lavender},
  catalogActionRow:{flexDirection:'row',borderTopWidth:1,borderColor:C.border,marginTop:8,paddingTop:8},
  catalogSmallAction:{flex:1,alignItems:'center',justifyContent:'center',minHeight:38},
  catalogSmallText:{color:C.lavender,fontSize:11,fontWeight:'700'},
  catalogTryOn:{marginTop:7,minHeight:39,backgroundColor:C.lavender,borderRadius:12,alignItems:'center',justifyContent:'center'},
  catalogTryText:{fontSize:12,color:'#FFFFFF',fontWeight:'700'},
  filterSheet:{backgroundColor:'#FFFFFF',borderTopLeftRadius:29,borderTopRightRadius:29,padding:19,paddingBottom:30},
  filterSheetHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:11},
  filterSheetTitle:{fontFamily:Platform.OS==='ios'?'Georgia':'serif',fontSize:28,color:C.navy},
  filterClose:{fontSize:28,color:C.navy},
  filterGroupTitle:{fontFamily:Platform.OS==='ios'?'Georgia':'serif',fontSize:19,color:C.navy,marginBottom:13},
  filterChoices:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:12},
  filterOption:{minHeight:39,paddingHorizontal:13,borderRadius:21,borderWidth:1,borderColor:C.border,justifyContent:'center',backgroundColor:'#FFFFFF'},
  filterOptionActive:{backgroundColor:C.lavender,borderColor:C.lavender},
  filterOptionLabel:{fontSize:12,color:C.lavender},filterOptionLabelActive:{color:'#FFFFFF',fontWeight:'700'},
  filterSeparator:{height:1,backgroundColor:C.border,marginVertical:17},
  colorOption:{width:'18%',alignItems:'center',paddingVertical:3,gap:5},
  colorOptionActive:{borderWidth:1,borderColor:C.lavender,borderRadius:11},
  colorCircle:{height:35,width:35,borderRadius:18,borderWidth:1,borderColor:C.border},
  filterColorLabel:{fontSize:10,color:C.navy},
  onlyFavorites:{minHeight:46,justifyContent:'center'},onlyFavoritesLabel:{fontSize:14,color:C.navy},
  filterFooter:{flexDirection:'row',gap:10,paddingTop:15},filterReset:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderColor:C.lavender,borderWidth:1,borderRadius:12},filterResetText:{color:C.lavender,fontWeight:'700'},filterApply:{flex:2,minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:C.lavender,borderRadius:12},filterApplyText:{color:'#FFFFFF',fontWeight:'700'},

  analysisInfo:{flexDirection:'row',alignItems:'center',gap:9,padding:13,borderRadius:14,backgroundColor:'#F3EAF8',marginBottom:13},
  analysisInfoText:{flex:1,fontSize:12,color:'#6E6872',lineHeight:18},
  aiRetry:{borderColor:C.border,borderWidth:1,borderRadius:12,minHeight:44,alignItems:'center',justifyContent:'center',marginBottom:13},
  aiRetryText:{color:C.lavender,fontWeight:'700',fontSize:12},

  studioAiButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: C.lavender, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, minHeight: 48, marginBottom: 15 },
  studioAiButtonText: { color: C.lavender, fontWeight: '700', fontSize: 13 },
  aiBackButton: { minHeight: 44, justifyContent: 'center', marginBottom: 10 },
  aiBackText: { color: C.lavender, fontSize: 13, fontWeight: '700' },

  wardrobeCompactHeading:{flexDirection:'row',alignItems:'center',marginBottom:18},
  wardrobeAddCircle:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:'#69318A'},
  wardrobeAddPlus:{color:'#FFFFFF',fontSize:27,lineHeight:32},
  wardrobeCategoryPreview:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:7,marginBottom:17},
  wardrobeCategoryTile:{width:'31.5%',minHeight:78,borderRadius:13,backgroundColor:'#FFFFFF',padding:8,alignItems:'center',justifyContent:'center'},
  wardrobeCategorySymbol:{fontSize:20,color:'#623078'},
  wardrobeCategoryName:{fontSize:10,fontWeight:'800',color:'#271E3C',marginTop:3},
  wardrobeCategoryCount:{fontSize:10,color:'#85748A',marginTop:2},
  wardrobeCompactIcon: { color: '#6D47AD', fontSize: 29, lineHeight: 34 },
  wardrobeCompactTitle: { color: '#221637', fontSize: 29, fontFamily: Platform.OS==='ios'?'Georgia':'serif', fontWeight: '600', marginBottom: 4 },
  wardrobeCompactDescription: { color: '#645777', fontSize: 12, lineHeight: 18 },
  compactWardrobeTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 },
  compactCount: { color: '#59466D', fontSize: 13, fontWeight: '700' },
  compactAdd: { backgroundColor: '#69318A', paddingHorizontal: 17, paddingVertical: 11, borderRadius: 20 },
  compactAddText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  wardrobeTabRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 12,
  },
  wardrobeTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D8D6DC',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  wardrobeTabActive: {
    backgroundColor: '#69318A',
    borderColor: '#69318A',
  },
  wardrobeTabText: {
    color: '#31254C',
    fontSize: 12,
    fontWeight: '700',
  },
  wardrobeTabTextActive: {
    color: '#FFFFFF',
  },
  prizmaSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11,20,54,0.45)',
  },
  prizmaSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 35,
  },
  prizmaSheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#D6C4E3',
    alignSelf: 'center',
    marginBottom: 20,
  },
  prizmaSheetSparkle: {
    color: '#7956B6',
    fontSize: 34,
    marginBottom: 8,
  },
  prizmaSheetTitle: {
    color: '#0B1436',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  prizmaSheetSubtitle: {
    color: '#77718B',
    fontSize: 14,
    marginBottom: 24,
  },
  prizmaSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  prizmaSheetOptionIcon: {
    color: '#7049B0',
    fontSize: 27,
    width: 44,
  },
  prizmaSheetOptionTitle: {
    color: '#0B1436',
    fontWeight: '800',
    fontSize: 16,
  },
  prizmaSheetOptionDetail: {
    color: '#77718B',
    fontSize: 12,
    marginTop: 4,
  },
  prizmaSheetArrow: {
    color: '#7049B0',
    fontSize: 27,
  },
  prizmaSheetCancel: {
    padding: 15,
    alignItems: 'center',
    marginTop: 5,
  },
  prizmaSheetCancelText: {
    color: '#7049B0',
    fontWeight: '700',
    fontSize: 15,
  },

  // GENEL

  container: {
    flex: 1,
    paddingBottom: 25,
  },

  eyebrow: {
    color: '#7852AF',
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

  // KOLEKSİYON ÖZETİ

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

  // BUTONLAR

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

  outlineButton: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    alignItems: 'center',
  },

  outlineText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '700',
  },

  saveButton: {
    backgroundColor: C.navy,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 25,
  },

  saveButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.6,
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 17,
  },

  cancelButtonText: {
    color: C.muted,
    fontSize: 13,
  },

  // TAM EKRAN DÜZENLEME

  editorScreen: {
    flex: 1,
    backgroundColor: C.background,
  },

  editorFlex: {
    flex: 1,
  },

  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  editorBack: {
    minWidth: 62,
    paddingVertical: 6,
  },

  editorBackText: {
    color: '#7049B0',
    fontSize: 15,
    fontWeight: '700',
  },

  editorHeaderTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '700',
  },

  editorHeaderSpacer: {
    minWidth: 62,
  },

  editorContent: {
    padding: 20,
    paddingBottom: 35,
  },

  editorFooter: {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },

  // FORM

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
    color: '#7049B0',
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

  // DETAY EKRANI

  detailScreen: {
    flex: 1,
    backgroundColor: C.background,
  },

  detailContent: {
    padding: 20,
    paddingBottom: 40,
  },

  detailImageContainer: {
    width: '100%',
    height: 340,
    backgroundColor: C.white,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },

  detailImage: {
    width: '100%',
    height: '100%',
  },

  detailImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailPlaceholderIcon: {
    color: C.lavender,
    fontSize: 65,
    marginBottom: 10,
  },

  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },

  detailTitleArea: {
    flex: 1,
  },

  detailEyebrow: {
    color: '#7852AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 9,
  },

  detailName: {
    color: C.navy,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
  },

  detailFavoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailFavoriteText: {
    color: C.rose,
    fontSize: 28,
  },

  detailInfoCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 18,
  },

  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    gap: 12,
  },

  detailInfoLabel: {
    color: C.muted,
    fontSize: 13,
  },

  detailInfoValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },

  detailDivider: {
    height: 1,
    backgroundColor: C.border,
  },

  detailNotesCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },

  detailNotesTitle: {
    color: '#7852AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginBottom: 12,
  },

  detailNotesText: {
    color: C.navy,
    fontSize: 13,
    lineHeight: 22,
  },

  // KOMBİNLER

  outfitCard: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 18,
    gap: 10,
  },

  boardOutfitTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '700',
  },

  boardCanvas: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },

  boardMain: {
    flex: 3,
    gap: 8,
  },

  boardSide: {
    flex: 1.3,
    gap: 8,
  },

  boardPiece: {
    width: '100%',
    minHeight: 180,
    backgroundColor: 'transparent',
    borderRadius: 14,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  boardPieceSmall: {
    minHeight: 115,
  },

  boardImage: {
    width: '100%',
    height: 165,
  },

  boardImageSmall: {
    height: 100,
  },

  boardPieceName: {
    color: C.navy,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 5,
  },

  boardPlaceholder: {
    color: C.lavender,
    fontSize: 28,
    textAlign: 'center',
  },

  boardHint: {
    color: C.muted,
    fontSize: 12,
    marginVertical: 12,
  },

  builderBox: {
    marginBottom: 18,
  },

  boardPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  boardPickCard: {
    width: '48%',
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: 14,
    padding: 8,
    alignItems: 'center',
  },

  boardPickSelected: {
    borderColor: C.lavender,
    backgroundColor: C.pale,
  },

  boardPickImage: {
    width: '100%',
    height: 96,
  },

  boardCheck: {
    color: C.navy,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },

  boardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
  },

  boardAction: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },

  // YÜKLEME VE BOŞ DURUM

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
    borderRadius: 18,
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
    backgroundColor: C.lavender,
    borderRadius: 25,
    paddingHorizontal: 25,
    paddingVertical: 15,
  },

  emptyButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
  },

  // LİSTE VE FİLTRELER

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
    color: '#7049B0',
    fontSize: 12,
    fontWeight: '700',
  },

  filterRow: {
    gap: 8,
    paddingBottom: 20,
    paddingTop: 14,
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

  filterEmpty: {
    backgroundColor: C.white,
    padding: 25,
    borderRadius: 18,
    alignItems: 'center',
  },

  filterEmptyText: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
  },

  // KIYAFET KARTLARI

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },

  itemCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },

  itemImageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#FFFFFF',
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
    padding: 9,
  },

  itemName: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 5,
  },

  itemCategory: {
    color: C.muted,
    fontSize: 11,
  },

  itemColor: {
    color: '#7049B0',
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
    color: '#7049B0',
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
});