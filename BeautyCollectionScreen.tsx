import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from './supabase';
import { addRoutineItem, getRoutineItems, type RoutinePeriod } from './RoutineStore';
import { selectBeautyPhoto, captureBeautyPhoto, removeBeautyBackground, uploadBeautyPhoto, getBeautyPhotoUrl, deleteBeautyPhoto, type BeautyPhoto } from './BeautyPhotoStore';

type Category = 'skin' | 'hair' | 'makeup';
type Status = 'want' | 'considering';
type Source = 'manual' | 'ai';

type Product = {
  id: string;
  user_id: string;
  category: Category;
  product_name: string;
  brand: string;
  status: Status;
  source: Source;
  notes: string;
  created_at: string;
  image_path?: string | null;
};

type Props = {
  userId: string;
};

const categories: { key: Category; label: string }[] = [
  { key: 'skin', label: 'Cilt' },
  { key: 'hair', label: 'Saç' },
  { key: 'makeup', label: 'Makyaj' },
];

export default function BeautyCollectionScreen({ userId }: Props) {
  const [category, setCategory] = useState<Category>('skin');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('considering');
  const [message, setMessage] = useState('');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<BeautyPhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [routinePeriod, setRoutinePeriod] = useState<RoutinePeriod>('Sabah');
  const [routineBusy, setRoutineBusy] = useState<string | null>(null);
  const [routineSaved, setRoutineSaved] = useState<string[]>([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('beauty_collection')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Beauty collection load:', error);
      setMessage('Koleksiyon yüklenemedi. Tekrar deneyebilirsin.');
    } else {
      const rows = (data || []) as Product[];
      setProducts(rows);
      const urls: Record<string, string> = {};
      await Promise.all(rows.filter(p => p.image_path).map(async product => {
        const url = await getBeautyPhotoUrl(product.image_path!);
        if (url) urls[product.id] = url;
      }));
      setPhotoUrls(urls);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setBrand('');
    setNotes('');
    setStatus('considering');
    setSelectedPhoto(null);
    setRemovePhoto(false);
    setFormOpen(false);
  };

  const startEdit = (product: Product) => {
    setCategory(product.category);
    setEditing(product);
    setName(product.product_name);
    setBrand(product.brand);
    setNotes(product.notes);
    setStatus(product.status);
    setSelectedPhoto(null);
    setRemovePhoto(false);
    setFormOpen(true);
  };

  const chooseBeautyPhoto = async () => {
    if (saving || photoBusy) return;
    setPhotoBusy(true);
    try {
      const photo = await selectBeautyPhoto();
      if (photo) { setSelectedPhoto(photo); setRemovePhoto(false); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fotoğraf seçilemedi.');
    } finally { setPhotoBusy(false); }
  };

  const takeBeautyPhoto = async () => {
    if (saving || photoBusy) return;
    setPhotoBusy(true);
    setMessage('');
    try {
      const photo = await captureBeautyPhoto();
      if (photo) { setSelectedPhoto(photo); setRemovePhoto(false); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fotoğraf çekilemedi.');
    } finally { setPhotoBusy(false); }
  };

  const applyBackgroundRemoval = async () => {
    if (photoBusy || saving) return;
    const source = selectedPhoto || (editing && !removePhoto ? photoUrls[editing.id] : null);
    if (!source) return;
    setPhotoBusy(true);
    setMessage('');
    try {
      const photo = await removeBeautyBackground(source);
      setSelectedPhoto(photo);
      setRemovePhoto(false);
      setMessage('✓ Arka plan kaldırıldı. Kaydet ile saklayabilirsin.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Arka plan kaldırılamadı.');
    } finally { setPhotoBusy(false); }
  };

  const saveProduct = async () => {
    const cleanName = name.trim();
    if (!cleanName) { setMessage('Lütfen ürünün adını yaz.'); return; }
    if (cleanName.length > 200) { setMessage('Ürün adı en fazla 200 karakter olabilir.'); return; }
    if (saving || photoBusy) return;
    setSaving(true);
    setMessage('');
    let uploadedPath: string | null = null;
    try {
      if (selectedPhoto) uploadedPath = await uploadBeautyPhoto(userId, selectedPhoto);
      const oldPath = editing?.image_path || null;
      const newPath = uploadedPath || (removePhoto ? null : oldPath);
      const values = {
        category,
        product_name: cleanName,
        brand: brand.trim(),
        notes: notes.trim(),
        status,
        image_path: newPath,
      };
      const response = editing
        ? await supabase.from('beauty_collection').update(values)
            .eq('id', editing.id).eq('user_id', userId)
        : await supabase.from('beauty_collection').insert({
            ...values, user_id: userId, source: 'manual' as Source,
          });
      if (response.error) throw response.error;
      // Uploaded content is never deleted before the database points to the new image.
      if (oldPath && oldPath !== newPath) {
        void deleteBeautyPhoto(oldPath).catch(() => {});
      }
      resetForm();
      await loadProducts();
    } catch (error) {
      if (uploadedPath) void deleteBeautyPhoto(uploadedPath).catch(() => {});
      setMessage(error instanceof Error ? error.message : 'Ürün kaydedilemedi.');
    } finally { setSaving(false); }
  };

  const deleteProduct = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete || deleting) return;

    setDeleting(true);
    const { error } = await supabase
      .from('beauty_collection')
      .delete()
      .eq('id', productToDelete.id)
      .eq('user_id', userId);

    setDeleting(false);

    if (error) {
      console.error('Beauty collection delete:', error);
      setMessage('Ürün silinemedi. Lütfen tekrar dene.');
      setProductToDelete(null);
      return;
    }

    if (productToDelete.image_path) {
      void deleteBeautyPhoto(productToDelete.image_path).catch(() => {});
    }
    setProductToDelete(null);
    await loadProducts();
  };

  const addCollectionToRoutine = async (product: Product) => {
    const key = product.id + ':' + routinePeriod;
    if (routineBusy || routineSaved.includes(key)) return;
    setRoutineBusy(key);
    setMessage('');
    try {
      const existing = await getRoutineItems(userId);
      const label = (product.brand ? product.brand + ' — ' : '') + product.product_name;
      const duplicate = existing.some(item =>
        item.title === label && item.period === routinePeriod && (item.category || 'skin') === product.category
      );
      if (duplicate) {
        setRoutineSaved(old => [...old, key]);
        setMessage('Bu ürün seçtiğin rutinde zaten var.');
        return;
      }
      await addRoutineItem(userId, {
        title: label,
        category: product.category,
        period: routinePeriod,
        source: 'manual',
        note: product.notes || undefined,
      });
      setRoutineSaved(old => [...old, key]);
      setMessage('✓ ' + product.product_name + ' ' + routinePeriod.toLowerCase() + ' rutinine eklendi.');
    } catch {
      setMessage('Ürün rutine eklenemedi. Tekrar deneyebilirsin.');
    } finally { setRoutineBusy(null); }
  };

  const visible = products.filter(p => p.category === category);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>PRİZMA BEAUTY ✦</Text>
      <Text style={styles.title}>Bakım Koleksiyonum</Text>
      <Text style={styles.description}>
        Almak istediğin, düşündüğün ve PRİZMA'nın önerdiği
        güzellik ürünleri bir arada.
      </Text>

      <View style={styles.tabs}>
        {categories.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.tab,
              category === item.key && styles.activeTab,
            ]}
            onPress={() => {
              if (formOpen) resetForm();
              setCategory(item.key);
            }}
          >
            <Text style={[
              styles.tabText,
              category === item.key && styles.activeTabText,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.routinePeriodRow}>
        {(['Sabah', 'Akşam'] as const).map(p => (
          <TouchableOpacity key={p} style={[styles.routinePeriodChip, routinePeriod === p && styles.routinePeriodActive]} onPress={() => setRoutinePeriod(p)}>
            <Text style={[styles.routinePeriodLabel, routinePeriod === p && styles.routinePeriodLabelActive]}>{p} Rutinim</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!formOpen && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          <Text style={styles.addButtonText}>＋ Yeni Ürün Ekle</Text>
        </TouchableOpacity>
      )}

      {formOpen && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {editing ? 'Ürünü Düzenle' : 'Yeni Ürün ✦'}
          </Text>

          <Text style={styles.label}>Ürün adı *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Örn. Nemlendirici krem"
            maxLength={200}
          />

          <Text style={styles.label}>Marka (isteğe bağlı)</Text>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="Marka adı"
          />

          <Text style={styles.label}>Ürün fotoğrafı (isteğe bağlı)</Text>
          {(selectedPhoto?.uri || (editing && !removePhoto ? photoUrls[editing.id] : null)) ? (
            <Image source={{ uri: selectedPhoto?.uri || photoUrls[editing!.id] }} style={styles.photoPreview} resizeMode="contain" />
          ) : (
            <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderText}>Fotoğraf seçilmedi</Text></View>
          )}
          <View style={styles.photoActionRow}>
            <TouchableOpacity style={styles.photoButton} disabled={photoBusy || saving} onPress={() => void chooseBeautyPhoto()}>
              <Text style={styles.photoButtonText}>{photoBusy ? 'İşleniyor...' : '▧ Galeriden Seç'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} disabled={photoBusy || saving} onPress={() => void takeBeautyPhoto()}>
              <Text style={styles.photoButtonText}>{photoBusy ? 'İşleniyor...' : '📷 Fotoğraf Çek'}</Text>
            </TouchableOpacity>
          </View>
          {(selectedPhoto || (editing && editing.image_path && !removePhoto)) && (
            <View style={styles.photoActionRow}>
              <TouchableOpacity style={styles.backgroundButton} disabled={photoBusy || saving} onPress={() => void applyBackgroundRemoval()}>
                <Text style={styles.backgroundButtonText}>✦ Arka Planı Kaldır</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.removePhotoButton} disabled={photoBusy || saving} onPress={() => { setSelectedPhoto(null); setRemovePhoto(true); }}>
                <Text style={styles.removePhotoText}>Fotoğrafı Kaldır</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Alışveriş durumun</Text>
          <View style={styles.statusRow}>
            {([
              { key: 'want' as Status, label: 'Almak istiyorum' },
              { key: 'considering' as Status, label: 'Almayı düşünüyorum' },
            ]).map(item => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.statusOption,
                  status === item.key && styles.selectedStatus,
                ]}
                onPress={() => setStatus(item.key)}
              >
                <Text style={styles.statusText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notların (isteğe bağlı)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Bu ürünü neden kaydetmek istiyorsun?"
            multiline
          />

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => { void saveProduct(); }}
            disabled={saving || photoBusy}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.addButtonText}>Kaydet ✦</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={resetForm}>
            <Text style={styles.cancelText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#9673C2" size="large" />
      ) : visible.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={styles.cardTitle}>Henüz ürün eklemedin</Text>
          <Text style={styles.description}>
            Beğendiğin ürünleri burada biriktirebilirsin.
          </Text>
        </View>
      ) : (
        visible.map(product => (
          <View key={product.id} style={styles.card}>
            {photoUrls[product.id] && <Image source={{ uri: photoUrls[product.id] }} style={styles.productPhoto} resizeMode="contain" />}
            <Text style={styles.productName}>
              {product.product_name}
            </Text>

            {!!product.brand && (
              <Text style={styles.description}>{product.brand}</Text>
            )}

            <Text style={styles.tag}>
              {product.status === 'want'
                ? '♡ Almak istiyorum'
                : '✧ Almayı düşünüyorum'}
            </Text>

            <Text style={styles.source}>
              {product.source === 'ai'
                ? '✦ PRİZMA önerisi'
                : 'Kendim ekledim'}
            </Text>

            {!!product.notes && (
              <Text style={styles.description}>{product.notes}</Text>
            )}

            <TouchableOpacity style={styles.routineAddButton} disabled={!!routineBusy || routineSaved.includes(product.id + ':' + routinePeriod)} onPress={() => void addCollectionToRoutine(product)}>
              <Text style={styles.routineAddText}>{routineSaved.includes(product.id + ':' + routinePeriod) ? '✓ Rutinime Eklendi' : routineBusy === product.id + ':' + routinePeriod ? 'Ekleniyor...' : '+ ' + routinePeriod + ' Rutinime Ekle'}</Text>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => startEdit(product)}>
                <Text style={styles.actionText}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteProduct(product)}>
                <Text style={styles.deleteText}>Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {!!message && <Text style={styles.description}>{message}</Text>}

      <Modal
        visible={productToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setProductToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalSymbol}>✦</Text>
            <Text style={styles.modalTitle}>
              Ürünü koleksiyonundan kaldır?
            </Text>
            <Text style={styles.modalDescription}>
              {productToDelete?.product_name} koleksiyonundan silinecek.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                disabled={deleting}
                onPress={() => setProductToDelete(null)}
              >
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDelete}
                disabled={deleting}
                onPress={() => { void confirmDelete(); }}
              >
                {deleting
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.modalDeleteText}>Evet, Sil</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  productPhoto: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#F6F0F9', marginBottom: 13 },
  photoPreview: { width: '100%', height: 180, backgroundColor: '#F6F0F9', borderRadius: 14, marginBottom: 10 },
  photoPlaceholder: { backgroundColor: '#F6F0F9', height: 88, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginBottom: 9 },
  photoPlaceholderText: { color: '#857A91', fontSize: 12 },
  photoButton: { backgroundColor: '#EFE2F5', padding: 12, borderRadius: 13, alignItems: 'center', marginBottom: 9 },
  photoButtonText: { color: '#5C3C78', fontWeight: '800', fontSize: 12 },
  photoActionRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 6 },
  backgroundButton: { backgroundColor: '#79569A', borderRadius: 11, padding: 10 },
  backgroundButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  removePhotoButton: { borderRadius: 11, padding: 10, borderWidth: 1, borderColor: '#DDCFEB' },
  removePhotoText: { color: '#624D74', fontSize: 11, fontWeight: '800' },
  photoTip: { color: '#857A91', fontSize: 10, lineHeight: 15, marginBottom: 13 },
  routinePeriodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 13 },
  routinePeriodChip: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F0E8F7', borderRadius: 14 },
  routinePeriodActive: { backgroundColor: '#79569A' },
  routinePeriodLabel: { color: '#554365', fontSize: 12, fontWeight: '700' },
  routinePeriodLabelActive: { color: '#FFFFFF' },
  routineAddButton: { backgroundColor: '#79569A', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, marginTop: 12 },
  routineAddText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '800', fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 16, 40, 0.55)',
    justifyContent: 'center',
    padding: 25,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 25,
    alignItems: 'center',
  },
  modalSymbol: {
    color: '#9673C2',
    fontSize: 35,
    marginBottom: 12,
  },
  modalTitle: {
    color: '#39235F',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalDescription: {
    color: '#806B9B',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 25,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalCancel: {
    flex: 1,
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#F2EDFA',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#563D7C',
    fontWeight: '800',
  },
  modalDelete: {
    flex: 1,
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#8060AD',
    alignItems: 'center',
  },
  modalDeleteText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  container: { flex: 1, backgroundColor: '#FAF8FF' },
  content: { padding: 20, paddingBottom: 45, gap: 15 },
  eyebrow: {
    color: '#9A78C5', fontSize: 11,
    fontWeight: '800', letterSpacing: 2,
  },
  title: { color: '#39235F', fontSize: 27, fontWeight: '800' },
  description: { color: '#806B9B', fontSize: 13, lineHeight: 21 },
  tabs: { flexDirection: 'row', gap: 7 },
  tab: {
    flex: 1, backgroundColor: '#FFFFFF',
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center',
  },
  activeTab: { backgroundColor: '#DDD0FA' },
  tabText: { color: '#806B9B', fontWeight: '700' },
  activeTabText: { color: '#563D7C' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 18, gap: 10,
  },
  cardTitle: { color: '#39235F', fontSize: 17, fontWeight: '800' },
  addButton: {
    backgroundColor: '#8060AD', padding: 16,
    borderRadius: 16, alignItems: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '800' },
  label: { color: '#563D7C', fontWeight: '700', fontSize: 13 },
  input: {
    backgroundColor: '#F6F0FF', borderRadius: 12,
    padding: 13, color: '#39235F',
  },
  notesInput: { minHeight: 85, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusOption: {
    flex: 1, padding: 12, borderRadius: 12,
    backgroundColor: '#F6F0FF', alignItems: 'center',
  },
  selectedStatus: { backgroundColor: '#DDD0FA' },
  statusText: {
    color: '#563D7C', fontSize: 12,
    fontWeight: '700', textAlign: 'center',
  },
  cancelText: {
    textAlign: 'center', color: '#806B9B',
    padding: 10, fontWeight: '700',
  },
  emptyIcon: { fontSize: 36, color: '#9673C2' },
  productName: { color: '#39235F', fontSize: 17, fontWeight: '800' },
  tag: { color: '#6941A5', fontSize: 12, fontWeight: '700' },
  source: { color: '#9A78C5', fontSize: 12 },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end',
    gap: 25, marginTop: 8,
  },
  actionText: { color: '#6941A5', fontWeight: '800' },
  deleteText: { color: '#C05B73', fontWeight: '800' },
});
