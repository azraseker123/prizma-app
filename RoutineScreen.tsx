import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addRoutineItem, getRoutineItems, removeRoutineItem, type RoutineItem, type RoutinePeriod, type RoutineCategory } from './RoutineStore';
import { selectBeautyPhoto, captureBeautyPhoto, removeBeautyBackground, uploadBeautyPhoto, getBeautyPhotoUrl, deleteBeautyPhoto, type BeautyPhoto } from './BeautyPhotoStore';

type Props = { userId: string; onAIRequest: () => void };
const PURPLE = '#69318A';
const categories: { key: RoutineCategory; label: string }[] = [{key:'skin',label:'Cilt'},{key:'hair',label:'Saç'},{key:'makeup',label:'Makyaj'}];

export default function RoutineScreen({ userId, onAIRequest }: Props) {
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [period, setPeriod] = useState<RoutinePeriod>('Sabah');
  const [category, setCategory] = useState<RoutineCategory>('skin');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [photo, setPhoto] = useState<BeautyPhoto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [editingSteps, setEditingSteps] = useState(false);
  const date = new Date();
  const todayKey = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
  const progressKey = 'prizma-routine-progress:' + userId + ':' + todayKey;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(progressKey).then(saved => {
      if (active) setCompletedIds(saved ? JSON.parse(saved) as string[] : []);
    }).catch(() => { if (active) setCompletedIds([]); });
    return () => { active = false; };
  }, [progressKey]);
  const toggleCompleted = (id: string) => {
    const next = completedIds.includes(id) ? completedIds.filter(x => x !== id) : [...completedIds, id];
    setCompletedIds(next);
    void AsyncStorage.setItem(progressKey, JSON.stringify(next)).catch(() => setFeedback('İlerleme kaydedilemedi.'));
  };
  const visibleItems = items.filter(x => x.period === period && (x.category || 'skin') === category);
  const completedCount = visibleItems.filter(x => completedIds.includes(x.id)).length;
  const completionPercent = visibleItems.length ? Math.round(completedCount / visibleItems.length * 100) : 0;

  const refresh = useCallback(async () => {
    try {
      const loaded = await getRoutineItems(userId);
      setItems(loaded);
      const urls: Record<string, string> = {};
      await Promise.all(loaded.filter(item => item.imagePath).map(async item => {
        try {
          const url = await getBeautyPhotoUrl(item.imagePath!);
          if (url) urls[item.id] = url;
        } catch { /* An image can be missing; keep the routine step visible. */ }
      }));
      setPhotoUrls(urls);
    } catch { setFeedback('Rutinler şu anda okunamadı.'); }
  }, [userId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const choosePhoto = async (source: 'gallery' | 'camera') => {
    if (busy || photoBusy) return;
    setPhotoBusy(true);
    setFeedback('');
    try {
      const selected = source === 'gallery' ? await selectBeautyPhoto() : await captureBeautyPhoto();
      if (selected) setPhoto(selected);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Fotoğraf alınamadı.');
    } finally { setPhotoBusy(false); }
  };

  const clearPhoto = () => {
    if (!busy && !photoBusy) setPhoto(null);
  };

  const makeTransparent = async () => {
    if (!photo || busy || photoBusy) return;
    setPhotoBusy(true);
    setFeedback('');
    try {
      const result = await removeBeautyBackground(photo);
      setPhoto(result);
      setFeedback('✓ Arka plan kaldırıldı. Kaydet ile saklayabilirsin.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Arka plan kaldırılamadı.');
    } finally { setPhotoBusy(false); }
  };

  const add = async () => {
    if (!title.trim() || busy || photoBusy) return;
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      if (photo) uploadedPath = await uploadBeautyPhoto(userId, photo);
      await addRoutineItem(userId, { title, period, category, source: 'manual', imagePath: uploadedPath || undefined });
      setTitle('');
      setPhoto(null);
      await refresh();
      setFeedback('Rutin adımı eklendi ');
    } catch (error) {
      if (uploadedPath) void deleteBeautyPhoto(uploadedPath).catch(() => {});
      setFeedback(error instanceof Error ? error.message : 'Kaydedilemedi. Tekrar dene.');
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const removed = items.find(item => item.id === id);
      await removeRoutineItem(userId, id);
      if (removed?.imagePath) void deleteBeautyPhoto(removed.imagePath).catch(() => {});
      await refresh();
      setFeedback('Adım kaldırıldı.');
    } catch { setFeedback('Adım kaldırılamadı.'); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>PRİZMA BEAUTY STUDIO</Text>
      <Text style={s.title}>Bakım Rutinim </Text>
      <Text style={s.desc}>Cilt, saç ve makyaj ürünlerini sabah ve akşam rutinlerine ekle.</Text>
      <View style={s.periodTabs} accessibilityRole="tablist">
        {(['Sabah', 'Akşam'] as const).map(p => (
          <TouchableOpacity key={p} accessibilityRole="tab" accessibilityState={{selected:period===p}}
            onPress={() => setPeriod(p)}
            style={[s.periodTab, period===p && s.periodTabActive]}>
            <Text style={[s.periodTabText,period===p&&s.periodTabTextActive]}>{p === 'Sabah' ? '☀ ' : '☾ '}{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.progressPanel}>
        <View style={s.progressHeading}>
          <Text style={s.progressLabel}>Günlük ilerleme</Text>
          <Text style={s.progressAmount}>{completedCount} / {visibleItems.length} adım</Text>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill,{width: `${completionPercent}%` as `${number}%`}]}/>
        </View>
      </View>
      <View style={s.row}>
        {categories.map(c => (
          <TouchableOpacity key={c.key} accessibilityRole="button" onPress={() => setCategory(c.key)} style={[s.chip, category === c.key && s.chipSelected]}>
            <Text style={[s.chipText, category === c.key && s.chipTextSelected]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.panel}>
        <Text style={s.panelTitle}>{categories.find(c => c.key === category)?.label} Rutinine Ürün Ekle</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={100} style={s.input} placeholder="Örn. Saç kremi, maskara veya nemlendirici" placeholderTextColor="#90849B" />
        <Text style={s.photoLabel}>Ürün fotoğrafı (isteğe bağlı)</Text>
        {photo && <Image source={{ uri: photo.uri }} style={s.photoPreview} resizeMode="contain" />}
        <View style={s.photoButtonRow}>
          <TouchableOpacity onPress={() => void choosePhoto('gallery')} disabled={busy || photoBusy} style={s.photoButton}>
            <Text style={s.photoButtonText}>▧ Galeriden Seç</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void choosePhoto('camera')} disabled={busy || photoBusy} style={s.photoButton}>
            <Text style={s.photoButtonText}>📷 Fotoğraf Çek</Text>
          </TouchableOpacity>
        </View>
        {!!photo && (
          <View style={s.photoButtonRow}>
            <TouchableOpacity onPress={() => void makeTransparent()} disabled={busy || photoBusy} style={s.backgroundButton}>
              <Text style={s.backgroundButtonText}> Arka Planı Kaldır</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearPhoto} disabled={busy || photoBusy} style={s.photoButton}>
              <Text style={s.photoButtonText}>Fotoğrafı Kaldır</Text>
            </TouchableOpacity>
          </View>
        )}
        {photoBusy && <ActivityIndicator color={PURPLE} />}
        <TouchableOpacity style={[s.button, (!title.trim() || busy || photoBusy) && s.disabled]} onPress={() => void add()} disabled={!title.trim() || busy || photoBusy}>
          {busy ? <ActivityIndicator color="white"/> : <Text style={s.buttonText}>+ Rutinime Ekle</Text>}
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onAIRequest} style={s.aiCard}>
        <Text style={s.aiTitle}> AI ile Ürün Önerisi Al</Text>
        <Text style={s.aiText}>Cilt, saç ve makyaj için ürün önerisi al, incele ve onaylayarak rutinine ekle.</Text>
        <Text style={s.aiLink}>Önerileri keşfet →</Text>
      </TouchableOpacity>
      <View style={s.info}><Text style={s.infoText}>ⓘ AI hata yapabilir. Ürün talimatları ve içeriklerini doğrula; yeni aktifleri kullanmadan önce uyumluluğunu kontrol et.</Text></View>
      {!!feedback && <Text accessibilityRole="alert" style={s.feedback}>{feedback}</Text>}
      <View style={s.listSection}>
        <View style={s.listHeadingRow}>
          <Text style={s.sectionTitle}>{period === 'Sabah' ? '☀' : '☾'}  {period} Rutinim</Text>
          <TouchableOpacity onPress={()=>setEditingSteps(!editingSteps)} accessibilityRole="button">
            <Text style={s.editAction}>{editingSteps?'Bitti':'Düzenle'}</Text>
          </TouchableOpacity>
        </View>
        {visibleItems.length === 0 && <Text style={s.empty}>Bu kategoride henüz bir adım eklenmedi.</Text>}
        {visibleItems.map((item,index)=>(
          <View key={item.id} style={s.item}>
            {photoUrls[item.id] && <Image source={{uri:photoUrls[item.id]}} resizeMode="contain" style={s.itemPhoto} accessibilityLabel={item.title+' ürün fotoğrafı'}/>}
            <View style={s.itemDetails}>
              <TouchableOpacity
                onPress={()=>toggleCompleted(item.id)}
                style={[s.checkBox,completedIds.includes(item.id)&&s.checkBoxDone]}
                accessibilityRole="checkbox"
                accessibilityState={{checked:completedIds.includes(item.id)}}
                accessibilityLabel={item.title+' tamamlandı'}
              >
                <Text style={[s.checkText,completedIds.includes(item.id)&&s.checkTextDone]}>{completedIds.includes(item.id)?'✓':''}</Text>
              </TouchableOpacity>
              <View style={s.itemInfo}>
                <Text style={[s.itemTitle,completedIds.includes(item.id)&&s.itemCompleted]}>{item.title}</Text>
                <Text style={s.itemCaption}>{item.source === 'manual'?'Sen ekledin':'AI önerisi • senin onayınla eklendi'}</Text>
              </View>
              {editingSteps && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={item.title+' adımını kaldır'} onPress={()=>{void remove(item.id);}}>
                  <Text style={s.remove}>Kaldır</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
      <Text style={s.footnote}>Bu sürümde rutinler bu cihazda hesabına özel saklanır; başka cihaza otomatik aktarılmaz. Uygulamayı silersen bu kayıtlar kaybolabilir.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  periodTabs: { flexDirection: 'row', gap: 9, marginBottom: 13 },
  periodTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderColor: '#D8D6DC', borderWidth: 1 },
  periodTabActive: { backgroundColor: '#F3EAF8', borderColor: '#69318A' },
  periodTabText: { color: '#6E6872', fontSize: 14, fontWeight: '700' },
  periodTabTextActive: { color: '#69318A' },
  progressPanel: { padding: 14, backgroundColor: '#FFFFFF', borderColor: '#D8D6DC', borderWidth: 1, borderRadius: 15, marginBottom: 15 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 11 },
  progressLabel: { color: '#242124', fontSize: 13, fontWeight: '700' },
  progressAmount: { color: '#69318A', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 5, backgroundColor: '#F3EAF8', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#69318A', borderRadius: 5 },
  listHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editAction: { color: '#69318A', fontSize: 12, fontWeight: '700', minHeight: 40, textAlignVertical: 'center' },
  checkBox: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#69318A', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkBoxDone: { backgroundColor: '#69318A' },
  checkText: { fontSize: 19, color: '#69318A', fontWeight: '700' },
  checkTextDone: { color: '#FFFFFF' },
  itemCompleted: { color: '#6E6872', textDecorationLine: 'line-through' },

  photoLabel: { color: '#30203F', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  photoPreview: { width: '100%', height: 165, borderRadius: 14, backgroundColor: '#F3E9F7', marginBottom: 12 },
  photoButtonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  photoButton: { backgroundColor: '#EFE2F5', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  photoButtonText: { color: '#5B3D71', fontSize: 11, fontWeight: '800' },
  backgroundButton: { backgroundColor: PURPLE, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  backgroundButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  itemPhoto: { width: '100%', height: 180, borderRadius: 14, backgroundColor: '#F3E9F7', marginBottom: 14 },
  itemDetails: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  itemInfo: { flex: 1, minWidth: 0 },
  page:{padding:17,paddingBottom:55},eyebrow:{fontSize:10,letterSpacing:2,color:PURPLE,fontWeight:'800',marginBottom:9},
  title:{color:'#271936',fontSize:25,fontWeight:'800',marginBottom:7},desc:{color:'#61556A',fontSize:13,lineHeight:20,marginBottom:19},
  panel:{borderRadius:20,padding:17,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D8D6DC',marginBottom:13},
  panelTitle:{fontSize:16,color:'#281C36',fontWeight:'800',marginBottom:12},row:{flexDirection:'row',gap:9,marginBottom:13},
  chip:{borderRadius:100,backgroundColor:'#EFE2F5',paddingVertical:10,paddingHorizontal:24},chipSelected:{backgroundColor:PURPLE},
  chipText:{color:'#554365',fontWeight:'700'},chipTextSelected:{color:'#FFFFFF'},
  input:{borderWidth:1,borderColor:'#E0D3E8',backgroundColor:'#FFFFFF',borderRadius:13,paddingHorizontal:13,paddingVertical:13,color:'#281C36',marginBottom:12},
  button:{padding:14,borderRadius:13,alignItems:'center',backgroundColor:PURPLE},disabled:{opacity:.5},buttonText:{color:'#FFFFFF',fontWeight:'800'},
  aiCard:{padding:17,borderRadius:19,backgroundColor:'#E0CBEF',marginBottom:12},aiTitle:{fontWeight:'800',color:'#4B2D61',fontSize:16,marginBottom:6},aiText:{color:'#4D3C5A',fontSize:12,lineHeight:19},aiLink:{color:'#673F87',fontWeight:'800',marginTop:10,fontSize:13},
  info:{padding:11,backgroundColor:'#F3E9F7',borderRadius:11,marginBottom:13},infoText:{color:'#615170',fontSize:11,lineHeight:17},
  feedback:{color:PURPLE,marginVertical:9,fontSize:12,fontWeight:'700'},listSection:{marginTop:14},sectionTitle:{color:'#2A1B3A',fontWeight:'800',fontSize:17,marginBottom:10},
  empty:{fontSize:12,color:'#887B91',paddingVertical:12},item:{padding:16,backgroundColor:'#FFFFFF',borderRadius:18,borderWidth:1,borderColor:'#EAE2EF',marginBottom:12},
  number:{width:27,height:27,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#E6D5EF'},numberText:{color:PURPLE,fontWeight:'800'},
  itemTitle:{fontWeight:'700',color:'#30203F',fontSize:13},itemCaption:{fontSize:10,color:'#8A7D92',marginTop:3},remove:{color:'#805DA0',fontWeight:'700',fontSize:11},
  footnote:{fontSize:11,color:'#7B7083',lineHeight:17,marginTop:18},
});
