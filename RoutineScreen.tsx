import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addRoutineItem, getRoutineItems, removeRoutineItem, moveRoutineItem, renameRoutineItem, changeRoutinePhoto, type RoutineItem, type RoutinePeriod, type RoutineCategory } from './RoutineStore';
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
  const [editingImageId,setEditingImageId]=useState<string|null>(null);
  const [editingPhoto,setEditingPhoto]=useState<BeautyPhoto|null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [editingSteps, setEditingSteps] = useState(false);
  const [renameStepId, setRenameStepId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewAdding, setReviewAdding] = useState<string | null>(null);
  const [review, setReview] = useState<{summary:string;suggestions:{title:string;reason:string}[]} | null>(null);
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
  const visibleItems = items.filter(x => x.period === period);
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

  const selectEditedPhoto=async(source:'gallery'|'camera')=>{
    if(busy||photoBusy)return;
    setPhotoBusy(true);setFeedback('');
    try{const result=source==='gallery'?await selectBeautyPhoto():await captureBeautyPhoto();if(result)setEditingPhoto(result);}
    catch(error){setFeedback(error instanceof Error?error.message:'Fotoğraf seçilemedi.');}
    finally{setPhotoBusy(false);}
  };
  const clearEditedImage=async()=>{
    if(!editingImageId||busy||photoBusy)return;
    setBusy(true);
    try{
      const current=items.find(x=>x.id===editingImageId);
      await changeRoutinePhoto(userId,editingImageId,undefined);
      if(current?.imagePath)void deleteBeautyPhoto(current.imagePath).catch(()=>{});
      setEditingImageId(null);setEditingPhoto(null);await refresh();
      setFeedback('Ürün fotoğrafı kaldırıldı.');
    }catch{setFeedback('Fotoğraf kaldırılamadı.');}
    finally{setBusy(false);}
  };
  const saveEditedImage=async()=>{
    if(!editingImageId||!editingPhoto||busy||photoBusy)return;
    setBusy(true);let newPath:string|undefined;
    try{
      const current=items.find(x=>x.id===editingImageId);
      newPath=await uploadBeautyPhoto(userId,editingPhoto);
      await changeRoutinePhoto(userId,editingImageId,newPath);
      if(current?.imagePath&&current.imagePath!==newPath)void deleteBeautyPhoto(current.imagePath).catch(()=>{});
      setEditingImageId(null);setEditingPhoto(null);await refresh();
      setFeedback('Ürün fotoğrafı güncellendi.');
    }catch(error){if(newPath)void deleteBeautyPhoto(newPath).catch(()=>{});setFeedback(error instanceof Error?error.message:'Fotoğraf kaydedilemedi.');}
    finally{setBusy(false);}
  };
  const removeEditedBackground=async()=>{
    if(!editingPhoto||photoBusy||busy)return;
    setPhotoBusy(true);
    try{const result=await removeBeautyBackground(editingPhoto);setEditingPhoto(result);}
    catch(error){setFeedback(error instanceof Error?error.message:'Arka plan kaldırma başarısız.');}
    finally{setPhotoBusy(false);}
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

  const reviewRoutine = async () => {
    if(reviewBusy||busy)return;
    setReviewBusy(true);setFeedback('');setReview(null);
    try{
      const {data,error}=await supabase.functions.invoke('review-routine',{
        body:{category,period,steps:visibleItems.filter(x=>(x.category||'skin')===category).map(x=>x.title)},
      });
      if(error)throw new Error('AI rutin değerlendirmesi alınamadı.');
      if(data?.error)throw new Error(data.error);
      const suggestions=(Array.isArray(data?.suggestions)?data.suggestions:[])
        .filter((x:any)=>x&&typeof x.title==='string'&&typeof x.reason==='string')
        .slice(0,3).map((x:{title:string;reason:string})=>({title:x.title.slice(0,100),reason:x.reason.slice(0,250)}));
      setReview({summary:typeof data?.summary==='string'?data.summary:'Rutinin değerlendirildi.',suggestions});
    }catch(error){
      setFeedback(error instanceof Error?error.message:'Değerlendirme yapılamadı.');
    }finally{setReviewBusy(false);}
  };
  const approveReviewStep = async (suggestion:{title:string;reason:string}) => {
    if(busy||reviewAdding)return;
    setReviewAdding(suggestion.title);
    try{
      if(items.some(x=>x.title===suggestion.title&&x.period===period&&(x.category||'skin')===category)){
        setFeedback('Bu adım zaten rutininde var.');
      }else{
        await addRoutineItem(userId,{title:suggestion.title,period,category,source:'ai-suggestion',note:suggestion.reason});
        await refresh();
        setFeedback('Öneri onayınla rutinine eklendi.');
      }
      setReview(old=>old?{...old,suggestions:old.suggestions.filter(x=>x!==suggestion)}:null);
    }catch{setFeedback('Adım eklenemedi.');}
    finally{setReviewAdding(null);}
  };

  const shiftStep = async(id:string,direction:-1|1) => {
    if(busy)return;
    setBusy(true);
    try { await moveRoutineItem(userId,id,direction);await refresh(); }
    catch{setFeedback('Adım sırası değiştirilemedi.');}
    finally{setBusy(false);}
  };
  const saveStepTitle = async() => {
    if(!renameStepId)return;
    setBusy(true);
    try { await renameRoutineItem(userId,renameStepId,renameDraft);setRenameStepId(null);await refresh(); }
    catch{setFeedback('Adım adı kaydedilemedi.');}
    finally{setBusy(false);}
  };

  const preview = (item:RoutineItem)=>photoUrls[item.id]?
    <Image source={{uri:photoUrls[item.id]}} resizeMode="contain" style={s2.itemPhoto}/>:
    <View style={s2.photoPlaceholder}><Text style={s2.photoGlyph}>▢</Text></View>;
  return <ScrollView style={{flex:1,backgroundColor:'#FFFFFF'}} contentContainerStyle={s2.page} keyboardShouldPersistTaps="handled">
    <Text style={s2.title}>{editingSteps?'Rutini Düzenle':'Bakım Rutinim'}</Text>
    <View style={s2.periodBar}>
      {(['Sabah','Akşam'] as const).map(p=><TouchableOpacity key={p} onPress={()=>{setPeriod(p);setReview(null);}} accessibilityRole="tab" accessibilityState={{selected:period===p}} style={[s2.periodButton,period===p&&s2.periodSelected]}>
        <Text style={[s2.periodLabel,period===p&&s2.periodLabelSelected]}>{p} {p==='Sabah'?'☼':'☾'}</Text>
      </TouchableOpacity>)}
    </View>
    {!editingSteps?<>
      <View style={s2.progressCard}>
        <View style={s2.progressLine}><Text style={s2.progressTitle}>{period} Rutinim</Text><Text style={s2.progressCount}>{completedCount} / {visibleItems.length} tamamlandı</Text></View>
        <View style={s2.progressTrack}><View style={[s2.progressFill,{width:`${completionPercent}%` as `${number}%`}]}/></View>
      </View>
      <View style={s2.stepList}>
        {visibleItems.length===0&&<View style={s2.empty}><Text style={s2.emptyTitle}>Henüz bir bakım adımı eklenmedi.</Text><Text style={s2.muted}>Rutini Düzenle'den ilk ürününü ekle.</Text></View>}
        {visibleItems.map(item=><TouchableOpacity key={item.id} style={s2.stepRow} accessibilityRole="checkbox" accessibilityState={{checked:completedIds.includes(item.id)}} onPress={()=>toggleCompleted(item.id)}>
          <View style={[s2.check,completedIds.includes(item.id)&&s2.checked]}><Text style={s2.checkMark}>{completedIds.includes(item.id)?'✓':''}</Text></View>
          {preview(item)}
          <View style={{flex:1}}><Text style={s2.stepName} numberOfLines={1}>{item.title}</Text><Text style={s2.stepDetail} numberOfLines={2}>{item.note|| (item.source==='ai-suggestion'?'PRİZMA AI önerisi':'Bakım adımı')}</Text></View>
          <Text style={s2.stepMenu}>···</Text>
        </TouchableOpacity>)}
      </View>
      <TouchableOpacity onPress={()=>setEditingSteps(true)} style={s2.primary}><Text style={s2.primaryLabel}>✎  Rutini Düzenle</Text></TouchableOpacity>
      <Text style={s2.disclaimer}>ⓘ PRİZMA AI tarafından oluşturulan rutinlerde hata olabilir. Ürün talimatlarını kontrol et.</Text>
    </>:<>
      <Text style={s2.editDescription}>Adımları düzenle, sırala veya yeni ürün ekle.</Text>
      <View style={s2.stepList}>
        {visibleItems.map((item,index)=><View key={item.id} style={s2.editRow}>
          <View style={s2.sortButtons}>
            <TouchableOpacity disabled={index===0||busy} onPress={()=>{void shiftStep(item.id,-1);}} accessibilityLabel="Yukarı taşı"><Text style={s2.sortArrow}>↑</Text></TouchableOpacity>
            <TouchableOpacity disabled={index===visibleItems.length-1||busy} onPress={()=>{void shiftStep(item.id,1);}} accessibilityLabel="Aşağı taşı"><Text style={s2.sortArrow}>↓</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={()=>{setEditingImageId(item.id);setEditingPhoto(null);}} accessibilityLabel="Ürün fotoğrafını düzenle">{preview(item)}<Text style={s2.photoEditLabel}>Fotoğraf</Text></TouchableOpacity>
          <TouchableOpacity style={{flex:1}} onPress={()=>{setRenameStepId(item.id);setRenameDraft(item.title);}}><Text style={s2.stepName} numberOfLines={2}>{item.title}</Text><Text style={s2.stepDetail}>Adını düzenle ›</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>{void remove(item.id);}} accessibilityLabel="Ürünü kaldır"><Text style={s2.removeIcon}>×</Text></TouchableOpacity>
        </View>)}
      </View>
      {editingImageId&&<View style={s2.editorBox}>
        <Text style={s2.boxTitle}>Ürün Fotoğrafını Düzenle</Text>
        {(editingPhoto?.uri||photoUrls[editingImageId])?<Image source={{uri:editingPhoto?.uri||photoUrls[editingImageId]}} resizeMode="contain" style={s2.editImagePreview}/>:<Text style={s2.muted}>Bu ürün için henüz fotoğraf yok.</Text>}
        <View style={s2.photoActions}><TouchableOpacity style={s2.photoAction} onPress={()=>{void selectEditedPhoto('gallery');}}><Text style={s2.actionLabel}>Galeriden Seç</Text></TouchableOpacity>
          <TouchableOpacity style={s2.photoAction} onPress={()=>{void selectEditedPhoto('camera');}}><Text style={s2.actionLabel}>Kamera</Text></TouchableOpacity>
          {!!editingPhoto&&<TouchableOpacity style={s2.photoAction} disabled={photoBusy} onPress={()=>{void removeEditedBackground();}}><Text style={s2.actionLabel}>Arka Planı Kaldır</Text></TouchableOpacity>}
        </View>
        {!!editingPhoto&&<TouchableOpacity style={s2.secondary} disabled={busy||photoBusy} onPress={()=>{void saveEditedImage();}}><Text style={s2.secondaryLabel}>Fotoğrafı Kaydet</Text></TouchableOpacity>}
        {!!items.find(x=>x.id===editingImageId)?.imagePath&&<TouchableOpacity style={s2.outline} disabled={busy||photoBusy} onPress={()=>{void clearEditedImage();}}><Text style={s2.outlineText}>Fotoğrafı Kaldır</Text></TouchableOpacity>}
        <TouchableOpacity style={s2.cancel} onPress={()=>{setEditingImageId(null);setEditingPhoto(null);}}><Text style={s2.muted}>Vazgeç</Text></TouchableOpacity>
      </View>}
      {renameStepId&&<View style={s2.editorBox}><Text style={s2.boxTitle}>Adımın Adı</Text><TextInput style={s2.input} value={renameDraft} onChangeText={setRenameDraft} maxLength={100}/><TouchableOpacity style={s2.outline} onPress={()=>{void saveStepTitle();}}><Text style={s2.outlineText}>Adı Kaydet</Text></TouchableOpacity><TouchableOpacity onPress={()=>setRenameStepId(null)} style={s2.cancel}><Text style={s2.muted}>Vazgeç</Text></TouchableOpacity></View>}
      <View style={s2.editorBox}>
        <Text style={s2.boxTitle}>+ Ürün Ekle</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={100} style={s2.input} placeholder="Örn. Temizleyici veya nemlendirici" placeholderTextColor="#888"/>
        <View style={s2.categoryRow}>{categories.map(c=><TouchableOpacity onPress={()=>setCategory(c.key)} style={[s2.categoryChip,category===c.key&&s2.categorySelected]} key={c.key}><Text style={[s2.categoryText,category===c.key&&s2.categoryActiveText]}>{c.label}</Text></TouchableOpacity>)}</View>
        {photo&&<Image source={{uri:photo.uri}} resizeMode="contain" style={s2.newPhoto}/>}
        <View style={s2.photoActions}>
          <TouchableOpacity onPress={()=>{void choosePhoto('gallery');}} style={s2.photoAction}><Text style={s2.actionLabel}>▧ Galeri</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>{void choosePhoto('camera');}} style={s2.photoAction}><Text style={s2.actionLabel}>◉ Kamera</Text></TouchableOpacity>
          {!!photo&&<TouchableOpacity onPress={()=>{void makeTransparent();}} style={s2.photoAction}><Text style={s2.actionLabel}>Arka Plan</Text></TouchableOpacity>}
        </View>
        <TouchableOpacity style={s2.secondary} disabled={!title.trim()||busy||photoBusy} onPress={()=>{void add();}}><Text style={s2.secondaryLabel}>{busy?'Ekleniyor...':'+ Ürünü Rutinime Ekle'}</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={s2.outline} onPress={onAIRequest}><Text style={s2.outlineText}>◎  PRİZMA AI Ürün Önerileri</Text></TouchableOpacity>
      <TouchableOpacity style={s2.outline} disabled={reviewBusy} onPress={()=>{void reviewRoutine();}}><Text style={s2.outlineText}>◎  Rutinimi AI ile Değerlendir</Text></TouchableOpacity>
      {review&&<View style={s2.editorBox}><Text style={s2.boxTitle}>PRİZMA AI Önerisi</Text><Text style={s2.muted}>{review.summary}</Text>{review.suggestions.map((step,i)=><View key={i} style={s2.aiSuggestion}><Text style={s2.stepName}>{step.title}</Text><Text style={s2.muted}>{step.reason}</Text><TouchableOpacity style={s2.secondary} onPress={()=>{void approveReviewStep(step);}}><Text style={s2.secondaryLabel}>+ Onayla ve Ekle</Text></TouchableOpacity></View>)}</View>}
      <TouchableOpacity style={s2.primary} onPress={()=>{setEditingSteps(false);setReview(null);}}><Text style={s2.primaryLabel}>Kaydet ve Rutine Dön</Text></TouchableOpacity>
    </>}
    {!!feedback&&<Text accessibilityRole="alert" style={s2.feedback}>{feedback}</Text>}
    <Text style={s2.storageNote}>Rutinler bu cihazda saklanır; uygulamayı silersen kayıtlar kaybolabilir.</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  reviewButton:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:'#69318A',alignItems:'center',justifyContent:'center',marginBottom:13,backgroundColor:'#FFFFFF'},
  reviewButtonText:{fontSize:13,color:'#69318A',fontWeight:'700'},
  reviewCard:{backgroundColor:'#FFFFFF',borderColor:'#D8D6DC',borderWidth:1,borderRadius:16,padding:14,marginBottom:15,gap:8},
  reviewTitle:{color:'#242124',fontSize:14,fontWeight:'700'},
  reviewCopy:{color:'#6E6872',fontSize:12,lineHeight:18},
  suggestionCard:{padding:12,borderRadius:13,backgroundColor:'#FFFFFF',gap:7},
  approveButton:{minHeight:44,paddingHorizontal:9,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#69318A'},
  approveText:{color:'#FFFFFF',fontWeight:'700',fontSize:12},
  reviewFootnote:{fontSize:11,color:'#6E6872',lineHeight:16},

  reorderColumn:{gap:4,alignItems:'center'},
  reorderText:{color:'#69318A',fontSize:21,fontWeight:'700'},
  editStepActions:{gap:5},
  renamePanel:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:16,padding:15,marginTop:12},
  renameCancel:{minHeight:44,alignItems:'center',justifyContent:'center'},
  periodTabs: { flexDirection: 'row', gap: 9, marginBottom: 13 },
  periodTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderColor: '#D8D6DC', borderWidth: 1 },
  periodTabActive: { backgroundColor: '#FFFFFF', borderColor: '#69318A' },
  periodTabText: { color: '#6E6872', fontSize: 14, fontWeight: '700' },
  periodTabTextActive: { color: '#69318A' },
  progressPanel: { padding: 14, backgroundColor: '#FFFFFF', borderColor: '#D8D6DC', borderWidth: 1, borderRadius: 15, marginBottom: 15 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 11 },
  progressLabel: { color: '#242124', fontSize: 13, fontWeight: '700' },
  progressAmount: { color: '#69318A', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 5, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#69318A', borderRadius: 5 },
  listHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editAction: { color: '#69318A', fontSize: 12, fontWeight: '700', minHeight: 40, textAlignVertical: 'center' },
  checkBox: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#69318A', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkBoxDone: { backgroundColor: '#69318A' },
  checkText: { fontSize: 19, color: '#69318A', fontWeight: '700' },
  checkTextDone: { color: '#FFFFFF' },
  itemCompleted: { color: '#6E6872', textDecorationLine: 'line-through' },

  photoLabel: { color: '#30203F', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  photoPreview: { width: '100%', height: 165, borderRadius: 14, backgroundColor: '#FFFFFF', marginBottom: 12 },
  photoButtonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  photoButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  photoButtonText: { color: '#5B3D71', fontSize: 11, fontWeight: '800' },
  backgroundButton: { backgroundColor: PURPLE, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  backgroundButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  itemPhoto: { width: '100%', height: 180, borderRadius: 14, backgroundColor: '#FFFFFF', marginBottom: 14 },
  itemDetails: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  itemInfo: { flex: 1, minWidth: 0 },
  page:{padding:17,paddingBottom:55},eyebrow:{fontSize:10,letterSpacing:2,color:PURPLE,fontWeight:'800',marginBottom:9},
  title:{color:'#271936',fontSize:25,fontWeight:'800',marginBottom:7},desc:{color:'#61556A',fontSize:13,lineHeight:20,marginBottom:19},
  panel:{borderRadius:20,padding:17,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D8D6DC',marginBottom:13},
  panelTitle:{fontSize:16,color:'#281C36',fontWeight:'800',marginBottom:12},row:{flexDirection:'row',gap:9,marginBottom:13},
  chip:{borderRadius:100,backgroundColor:'#FFFFFF',paddingVertical:10,paddingHorizontal:24},chipSelected:{backgroundColor:PURPLE},
  chipText:{color:'#554365',fontWeight:'700'},chipTextSelected:{color:'#FFFFFF'},
  input:{borderWidth:1,borderColor:'#E0D3E8',backgroundColor:'#FFFFFF',borderRadius:13,paddingHorizontal:13,paddingVertical:13,color:'#281C36',marginBottom:12},
  button:{padding:14,borderRadius:13,alignItems:'center',backgroundColor:PURPLE},disabled:{opacity:.5},buttonText:{color:'#FFFFFF',fontWeight:'800'},
  aiCard:{padding:17,borderRadius:19,backgroundColor:'#FFFFFF',marginBottom:12},aiTitle:{fontWeight:'800',color:'#4B2D61',fontSize:16,marginBottom:6},aiText:{color:'#4D3C5A',fontSize:12,lineHeight:19},aiLink:{color:'#673F87',fontWeight:'800',marginTop:10,fontSize:13},
  info:{padding:11,backgroundColor:'#F3E9F7',borderRadius:11,marginBottom:13},infoText:{color:'#615170',fontSize:11,lineHeight:17},
  feedback:{color:PURPLE,marginVertical:9,fontSize:12,fontWeight:'700'},listSection:{marginTop:14},sectionTitle:{color:'#2A1B3A',fontWeight:'800',fontSize:17,marginBottom:10},
  empty:{fontSize:12,color:'#887B91',paddingVertical:12},item:{padding:16,backgroundColor:'#FFFFFF',borderRadius:18,borderWidth:1,borderColor:'#EAE2EF',marginBottom:12},
  number:{width:27,height:27,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'},numberText:{color:PURPLE,fontWeight:'800'},
  itemTitle:{fontWeight:'700',color:'#30203F',fontSize:13},itemCaption:{fontSize:10,color:'#8A7D92',marginTop:3},remove:{color:'#805DA0',fontWeight:'700',fontSize:11},
  footnote:{fontSize:11,color:'#7B7083',lineHeight:17,marginTop:18},
});

const s2=StyleSheet.create({
 photoEditLabel:{fontSize:10,color:'#69318A',textAlign:'center',marginTop:4},editImagePreview:{width:'100%',height:160,backgroundColor:'#FFFFFF'},

 page:{backgroundColor:'#FFFFFF',padding:14,paddingBottom:42,gap:13},title:{fontSize:23,fontWeight:'800',color:'#242124',textAlign:'center',marginVertical:12},
 periodBar:{flexDirection:'row',borderWidth:1,borderColor:'#D8D6DC',borderRadius:17,overflow:'hidden',marginBottom:5},
 periodButton:{flex:1,alignItems:'center',justifyContent:'center',minHeight:49,backgroundColor:'#FFFFFF'},
 periodSelected:{backgroundColor:'#69318A'},periodLabel:{color:'#242124',fontWeight:'700',fontSize:14},periodLabelSelected:{color:'#FFFFFF'},
 progressCard:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:17,padding:15,backgroundColor:'#FFFFFF'},
 progressLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13},progressTitle:{color:'#242124',fontWeight:'700',fontSize:15},progressCount:{color:'#6E6872',fontSize:12},
 progressTrack:{height:9,backgroundColor:'#E7E7E7',borderRadius:5},progressFill:{height:9,borderRadius:5,backgroundColor:'#69318A'},
 stepList:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:17,overflow:'hidden'},stepRow:{minHeight:83,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:11,paddingVertical:9,borderBottomWidth:1,borderColor:'#D8D6DC',backgroundColor:'#FFFFFF'},
 check:{height:27,width:27,borderWidth:2,borderColor:'#9C92A5',borderRadius:14,alignItems:'center',justifyContent:'center'},checked:{borderColor:'#69318A',backgroundColor:'#69318A'},checkMark:{color:'#FFFFFF',fontSize:16,fontWeight:'700'},
 itemPhoto:{height:55,width:55},photoPlaceholder:{width:55,height:55,borderRadius:9,borderWidth:1,borderColor:'#D8D6DC',alignItems:'center',justifyContent:'center'},photoGlyph:{fontSize:24,color:'#69318A'},
 stepName:{fontWeight:'700',fontSize:14,color:'#242124'},stepDetail:{fontSize:11,color:'#6E6872',marginTop:5,lineHeight:16},stepMenu:{fontWeight:'800',fontSize:22,color:'#242124'},
 empty:{minHeight:112,alignItems:'center',justifyContent:'center',gap:9,padding:15},emptyTitle:{color:'#242124',fontSize:14,fontWeight:'700'},muted:{fontSize:12,color:'#6E6872',lineHeight:18},primary:{minHeight:50,backgroundColor:'#69318A',borderRadius:14,alignItems:'center',justifyContent:'center'},primaryLabel:{fontSize:14,fontWeight:'700',color:'#FFFFFF'},
 disclaimer:{fontSize:11,color:'#6E6872',lineHeight:17,paddingVertical:5},
 editDescription:{textAlign:'center',fontSize:12,color:'#6E6872',marginBottom:10},
 editRow:{minHeight:82,flexDirection:'row',alignItems:'center',gap:9,padding:10,borderBottomWidth:1,borderColor:'#D8D6DC'},
 sortButtons:{gap:3},sortArrow:{fontSize:18,color:'#69318A',fontWeight:'700',minWidth:26,textAlign:'center'},removeIcon:{fontSize:28,color:'#B33F54',paddingHorizontal:7},
 editorBox:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:15,padding:14,gap:10},
 boxTitle:{fontSize:15,fontWeight:'700',color:'#242124'},input:{minHeight:45,borderWidth:1,borderColor:'#D8D6DC',borderRadius:11,paddingHorizontal:12,color:'#242124',fontSize:13},
 categoryRow:{flexDirection:'row',gap:8},categoryChip:{flex:1,minHeight:40,borderWidth:1,borderColor:'#D8D6DC',borderRadius:13,alignItems:'center',justifyContent:'center'},categorySelected:{borderColor:'#69318A'},categoryText:{fontSize:12,color:'#6E6872'},categoryActiveText:{color:'#69318A',fontWeight:'700'},
 photoActions:{flexDirection:'row',gap:7,flexWrap:'wrap'},photoAction:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:11,minHeight:44,paddingHorizontal:12,justifyContent:'center'},actionLabel:{fontSize:12,color:'#69318A',fontWeight:'700'},newPhoto:{height:88,width:'100%'},
 secondary:{minHeight:45,backgroundColor:'#69318A',borderRadius:12,alignItems:'center',justifyContent:'center'},secondaryLabel:{fontSize:12,fontWeight:'700',color:'#FFFFFF'},
 outline:{minHeight:47,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#69318A',borderRadius:12,alignItems:'center',justifyContent:'center'},outlineText:{fontSize:12,color:'#69318A',fontWeight:'700'},
 cancel:{minHeight:40,justifyContent:'center',alignItems:'center'},aiSuggestion:{paddingVertical:10,borderTopWidth:1,borderColor:'#D8D6DC',gap:6},
 feedback:{fontSize:12,color:'#69318A'},storageNote:{fontSize:10,color:'#6E6872',textAlign:'center'}
});
