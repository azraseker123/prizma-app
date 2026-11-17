import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';
import { chooseTryOnPhoto, readTryOnPhoto, validateTryOnImage, prepareTryOnPhoto, type TryOnPhoto } from './TryOnPhotoStore';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';

type WardrobeChoice={id:string;name:string;category:string;image_path:string;imageUrl:string|null};
type Props={userId:string;onBack:()=>void;onManagePhoto:()=>void;recoveredCameraUri?:string|null;onRecoveredCameraHandled?:()=>void};

export default function HomeTryOnScreen({userId,onBack,onManagePhoto,recoveredCameraUri,onRecoveredCameraHandled}:Props){
 const [person,setPerson]=useState<{path:string;url:string}|null>(null);
 const [garment,setGarment]=useState<{name:string;uri:string;source:'camera'|'gallery'|'wardrobe';itemId?:string;base64?:string}|null>(null);
 const [wardrobe,setWardrobe]=useState<WardrobeChoice[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadingWardrobe,setLoadingWardrobe]=useState(false);
 const [showWardrobe,setShowWardrobe]=useState(false);
 const [busy,setBusy]=useState(false);
 const [consent,setConsent]=useState(false);
 const [pendingGarment,setPendingGarment]=useState<TryOnPhoto|null>(null);
 const [premium,setPremium]=useState<{active:boolean;remaining:number;monthlyLimit:number;testAccess:boolean;providerReady:boolean}|null>(null);
 const [tryOnConsent,setTryOnConsent]=useState(false);
 const [ownsPhoto,setOwnsPhoto]=useState(false);
 const [tryOnJob,setTryOnJob]=useState<string|null>(null);
 const [tryOnStatus,setTryOnStatus]=useState<'idle'|'starting'|'processing'|'completed'|'failed'>('idle');
 const [resultUrl,setResultUrl]=useState<string|null>(null);
 const [myLooks,setMyLooks]=useState<Array<{id:string;createdAt:string;url:string}>>([]);
 const [looksLoading,setLooksLoading]=useState(false);
 const [usageItems,setUsageItems]=useState<Array<{id:string;reference:string;createdAt:string;updatedAt:string;status:string;creditUsed:boolean;resultDeleted:boolean}>>([]);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [historyOpen,setHistoryOpen]=useState(false);
 const [supportIsAdmin,setSupportIsAdmin]=useState(false);
 const [supportOpen,setSupportOpen]=useState(false);
 const [supportRecords,setSupportRecords]=useState<Array<{id:string;userId:string;status:string;createdAt:string;updatedAt:string;providerJobExists:boolean;resultRetained:boolean;history:Array<{type:string;time:string;creditEffect:string;historicalSnapshot:boolean}>}>>([]);
 const [supportLoading,setSupportLoading]=useState(false);
 const [selectedLook,setSelectedLook]=useState<{id:string;createdAt:string;url:string}|null>(null);
 const [deleteTarget,setDeleteTarget]=useState<string|null>(null);
 const [deleting,setDeleting]=useState(false);
 const [notice,setNotice]=useState<{type:NoticeType;title:string;message:string}|null>(null);

 const reload=useCallback(async()=>{
  setLoading(true);
  try{setPerson(await readTryOnPhoto(userId));}
  catch(e){setNotice({type:'error',title:'Fotoğraf yüklenemedi',message:e instanceof Error?e.message:'Tekrar dene.'});}
  finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void reload();},[reload]);
 const loadMyLooks=useCallback(async()=>{
  setLooksLoading(true);
  try{
   const {data,error}=await supabase.functions.invoke('virtual-tryon',{body:{action:'gallery'}});
   if(error||data?.error)throw new Error(data?.error||error?.message||'Denemelerin yüklenemedi.');
   setMyLooks(Array.isArray(data?.items)?data.items:[]);
  }catch(e){setNotice({type:'error',title:'Denemelerim açılamadı',message:e instanceof Error?e.message:'Tekrar deneyebilirsin.'});}
  finally{setLooksLoading(false);}
 },[]);
 useEffect(()=>{void loadMyLooks();},[userId,loadMyLooks]);
 const loadUsageHistory=useCallback(async()=>{
  setHistoryLoading(true);
  try{
   const {data,error}=await supabase.functions.invoke('virtual-tryon',{body:{action:'history'}});
   if(error||data?.error)throw new Error(data?.error||error?.message||'Geçmiş yüklenemedi.');
   setUsageItems(Array.isArray(data?.items)?data.items:[]);
  }catch(e){setNotice({type:'error',title:'Kullanım geçmişi açılamadı',message:e instanceof Error?e.message:'Tekrar deneyebilirsin.'});}
  finally{setHistoryLoading(false);}
 },[]);
 const loadSupportRecords=useCallback(async()=>{
  setSupportLoading(true);
  try{
   const {data,error}=await supabase.functions.invoke('virtual-tryon',{body:{action:'admin-history'}});
   if(error||data?.error){
    const description=data?.error||error?.message||'Yönetici kayıtları yüklenemedi.';
    if(description.includes('yetkisi gerekli')){setSupportIsAdmin(false);return;}
    throw new Error(description);
   }
   setSupportIsAdmin(true);setSupportRecords(Array.isArray(data?.items)?data.items:[]);
  }catch(e){setNotice({type:'error',title:'Yönetici kayıtları açılamadı',message:e instanceof Error?e.message:'Tekrar deneyebilirsin.'});}
  finally{setSupportLoading(false);}
 },[]);
 useEffect(()=>{void loadUsageHistory();},[userId,loadUsageHistory]);
 // Administrative access is checked server-side; UI doesn't grant any privileges.
 useEffect(()=>{void loadSupportRecords();},[userId,loadSupportRecords]);
 async function removeLook(){
  if(!deleteTarget||deleting)return;
  setDeleting(true);
  try{
   const {data,error}=await supabase.functions.invoke('virtual-tryon',{body:{action:'delete',jobId:deleteTarget}});
   if(error||data?.error||data?.deleted!==true)throw new Error(data?.error||error?.message||'Silinemedi.');
   if(tryOnJob===deleteTarget)setResultUrl(null);
   setMyLooks(list=>list.filter(x=>x.id!==deleteTarget));
   setSelectedLook(v=>v?.id===deleteTarget?null:v);
   setDeleteTarget(null);
   setNotice({type:'success',title:'Deneme silindi',message:'Görselin koleksiyonundan kaldırıldı.'});
   void loadUsageHistory();
  }catch(e){setNotice({type:'error',title:'Deneme silinemedi',message:e instanceof Error?e.message:'Tekrar dene.'});}
  finally{setDeleting(false);}
 }
 const refreshTryOnAccess=useCallback(async()=>{
   const {data,error}=await supabase.functions.invoke('virtual-tryon',{body:{action:'eligibility'}});
   if(error||data?.error){setNotice({type:'error',title:'Sanal deneme doğrulanamadı',message:data?.error||error?.message||'Tekrar deneyebilirsin.'});return;}
   setPremium({active:data.active===true,remaining:typeof data.remaining==='number'?data.remaining:0,monthlyLimit:typeof data.monthlyLimit==='number'?data.monthlyLimit:15,testAccess:data.testAccess===true,providerReady:data.providerReady===true});
 },[]);
 useEffect(()=>{void refreshTryOnAccess();},[userId,refreshTryOnAccess]);
 useEffect(()=>{
  if(!tryOnJob||tryOnStatus!=='processing')return;
  let active=true;
  let attempts=0;
  const poll=async()=>{
   if(!active||attempts>=45)return;
   attempts++;
   const {data,error}=await supabase.functions.invoke('virtual-tryon',{body:{action:'status',jobId:tryOnJob}});
   if(!active)return;
   if(error||data?.error){if(attempts===45)setNotice({type:'info',title:'Sonuç kontrolü sürüyor',message:'İşlem numarası korunuyor. Sonucu yeniden kontrol edebilirsin.'});return;}
   if(data?.status==='completed'&&typeof data?.url==='string'){setResultUrl(data.url);setTryOnStatus('completed');void loadMyLooks();void loadUsageHistory();setPremium(v=>v?{...v,remaining:Math.max(0,v.remaining-1)}:v);}
   else if(data?.status==='failed'){setTryOnStatus('failed');setNotice({type:'error',title:'Sanal deneme tamamlanamadı',message:data.error||'Başarısız işlem hakkından düşmez.'});}
  };
  const interval=setInterval(()=>void poll(),4000);
  void poll();
  return()=>{active=false;clearInterval(interval);};
 },[tryOnJob,tryOnStatus,loadMyLooks,loadUsageHistory]);
 useEffect(()=>{
  if(!recoveredCameraUri)return;
  let cancelled=false;
  prepareTryOnPhoto(recoveredCameraUri).then(photo=>{if(!cancelled){setPendingGarment(photo);setNotice({type:'info',title:'Kamera fotoğrafın geri alındı',message:'Çektiğin fotoğraf hazır. AI kontrol iznini açıp Fotoğrafı Kontrol Et seçeneğine basabilirsin.'});}})
  .catch(e=>{if(!cancelled)setNotice({type:'error',title:'Kamera fotoğrafı açılamadı',message:e instanceof Error?e.message:'Galeriden seçebilirsin.'});})
  .finally(()=>{if(!cancelled)onRecoveredCameraHandled?.();});
  return()=>{cancelled=true};
 },[recoveredCameraUri]);

 async function loadWardrobe(){
  setShowWardrobe(true);
  setLoadingWardrobe(true);
  try{
   const {data,error}=await supabase.from('wardrobe_items').select('id,name,category,image_path')
     .eq('user_id',userId).order('created_at',{ascending:false}).limit(80);
   if(error)throw error;
   const rows=(data||[]) as Omit<WardrobeChoice,'imageUrl'>[];
   const out=await Promise.all(rows.map(async row=>{
    const {data:image,error:imgErr}=await supabase.storage.from('wardrobe').createSignedUrl(row.image_path,3600);
    return {...row,imageUrl:imgErr?null:(image?.signedUrl||null)};
   }));
   setWardrobe(out);
  }catch(e){setNotice({type:'error',title:'Gardırop açılamadı',message:e instanceof Error?e.message:'Tekrar deneyebilirsin.'});}
  finally{setLoadingWardrobe(false);}
 }

 async function chooseGarment(camera:boolean){
  if(busy)return;
  if(!consent){setNotice({type:'info',title:'AI kontrol izni',message:'Fotoğrafın uygunluğunu doğrulayabilmemiz için aşağıdaki AI görsel kontrolü iznini açmalısın.'});return;}
  setBusy(true);
  try{
   const picked=await chooseTryOnPhoto(camera);
   if(!picked)return;
   setPendingGarment(picked);
   await validateTryOnImage(picked,'garment');
   setGarment({uri:picked.uri,base64:picked.base64,name:camera?'Yeni çektiğim kıyafet':'Galeriden seçtiğim kıyafet',source:camera?'camera':'gallery'});
   setPendingGarment(null);
   setShowWardrobe(false);
  }catch(e){setNotice({type:'error',title:'Fotoğraf işlenemedi',message:e instanceof Error?e.message:'Lütfen yeniden dene.'});}
  finally{setBusy(false);}
 }

 async function verifyRecoveredPhoto(){
  if(!pendingGarment||busy)return;
  if(!consent){setNotice({type:'info',title:'AI kontrol izni',message:'Fotoğraf kontrolü için izin vermelisin.'});return;}
  setBusy(true);
  try{await validateTryOnImage(pendingGarment,'garment');setGarment({uri:pendingGarment.uri,base64:pendingGarment.base64,name:'Çektiğim kıyafet',source:'camera'});setPendingGarment(null);}
  catch(e){setNotice({type:'error',title:'Fotoğraf kontrolü tamamlanamadı',message:e instanceof Error?e.message:'Aynı fotoğrafı yeniden deneyebilirsin.'});}
  finally{setBusy(false);}
 }

 async function startTryOn(){
  if(!person||!garment||busy)return;
  if(!tryOnConsent||!ownsPhoto){setNotice({type:'info',title:'Onay gerekli',message:'Fotoğrafını sanal denemede kullanmak için izin kutularını işaretlemelisin.'});return;}
  if(!premium?.active||premium.remaining<=0){setNotice({type:'info',title:'Kullanım hakkı gerekli',message:'Sanal deneme için aktif Premium veya test erişimi gerekli.'});return;}
  if(!premium.providerReady){setNotice({type:'info',title:'AI bağlantısı eksik',message:'Sanal deneme API anahtarı henüz sunucuya tanımlanmadı.'});return;}
  setBusy(true);setTryOnStatus('starting');setResultUrl(null);
  try{
   const {data,error}=await supabase.functions.invoke('virtual-tryon',{body:{action:'start',consent:true,ownsPersonPhoto:true,...(garment.itemId?{wardrobeItemId:garment.itemId}:{garmentBase64:garment.base64})}});
   if(error||data?.error)throw new Error(data?.error||error?.message||'Sanal deneme başlatılamadı.');
   if(!data?.jobId)throw new Error('Sanal deneme işlem numarası alınamadı.');
   setTryOnJob(data.jobId);setTryOnStatus('processing');
  }catch(e){setTryOnStatus('failed');setNotice({type:'error',title:'Sanal deneme başlatılamadı',message:e instanceof Error?e.message:'Tekrar deneyebilirsin.'});}
  finally{setBusy(false);}
 }

 function chooseWardrobe(choice:WardrobeChoice){
  if(!choice.imageUrl){setNotice({type:'error',title:'Fotoğraf bulunamadı',message:'Bu gardırop parçasının fotoğrafı açılamıyor.'});return;}
  setGarment({uri:choice.imageUrl,name:choice.name,source:'wardrobe',itemId:choice.id});
  setShowWardrobe(false);
 }

 return <View style={s.root}>
  <Modal visible={!!selectedLook} transparent animationType="fade" onRequestClose={()=>{if(!deleting){setDeleteTarget(null);setSelectedLook(null);}}}>
   <View style={s.lookModalOverlay}>
    {deleteTarget?
     <View style={s.confirmLookCard}>
      <Text style={s.resultTitle}>Bu denemeyi silelim mi?</Text>
      <Text style={s.small}>Oluşturulan görsel koleksiyonundan kaldırılır. Kullandığın sanal deneme hakkı geri yüklenmez.</Text>
      <View style={s.confirmButtons}>
       <TouchableOpacity disabled={deleting} style={s.confirmCancel} onPress={()=>setDeleteTarget(null)}><Text style={s.confirmCancelText}>Vazgeç</Text></TouchableOpacity>
       <TouchableOpacity disabled={deleting} style={s.confirmDelete} onPress={()=>void removeLook()}><Text style={s.confirmDeleteText}>{deleting?'Siliniyor…':'Evet, sil'}</Text></TouchableOpacity>
      </View>
     </View>:
     <View style={s.lookModalCard}>
      <View style={s.cardHeading}><Text style={s.cardTitle}>✦ Denemem</Text><TouchableOpacity onPress={()=>setSelectedLook(null)}><Text style={s.link}>Kapat ✕</Text></TouchableOpacity></View>
      {selectedLook&&<Image source={{uri:selectedLook.url}} resizeMode="contain" style={s.lookLarge}/>}
      <Text style={s.small}>AI ile oluşturulmuş bir görseldir.</Text>
      <TouchableOpacity style={s.removeLookButton} onPress={()=>setDeleteTarget(selectedLook?.id||null)}><Text style={s.removeLookText}>Denemeyi sil</Text></TouchableOpacity>
     </View>}
   </View>
  </Modal>
  <PrizmaNotice visible={!!notice} type={notice?.type||'info'} title={notice?.title||''} message={notice?.message||''} onClose={()=>setNotice(null)}/>
  <ScrollView contentContainerStyle={s.content}>
   <TouchableOpacity onPress={onBack}><Text style={s.back}>‹ Ana sayfaya dön</Text></TouchableOpacity>
   <Text style={s.eyebrow}>PRİZMA ✦ FITTING ROOM</Text>
   <Text style={s.title}>Sanal Deneme</Text>
   <Text style={s.description}>Kendi fotoğrafını kullan. Gardırobundan kıyafet seçebilir veya mağazada gördüğün bir kıyafetin fotoğrafını o anda çekebilirsin.</Text>
   <View style={s.card}>
    <View style={s.cardHeading}><Text style={s.cardTitle}>01 · Benim fotoğrafım</Text><TouchableOpacity onPress={onManagePhoto}><Text style={s.link}>Değiştir ›</Text></TouchableOpacity></View>
    {loading?<ActivityIndicator color="#8050B5"/>:person?
     <Image source={{uri:person.url}} style={s.personPhoto} resizeMode="contain"/>:
     <TouchableOpacity style={s.emptyPerson} onPress={onManagePhoto}><Text style={s.emptyIcon}>◇</Text><Text style={s.emptyText}>Boydan fotoğrafını ekle →</Text></TouchableOpacity>}
    <Text style={s.small}>Tek kişi, baştan ayağa göründüğün kıyafetli bir fotoğraf. AI uygunluk kontrolü yapılır.</Text>
    <TouchableOpacity style={s.textAction} onPress={onManagePhoto}><Text style={s.link}>{person?'Fotoğrafımı düzenle / Arka planı kaldır':'Fotoğrafımı yükle'}</Text></TouchableOpacity>
   </View>
   <View style={s.card}>
    <Text style={s.cardTitle}>02 · Denemek istediğim kıyafet</Text>
    {garment?<View style={s.chosen}><Image source={{uri:garment.uri}} style={s.garmentImage} resizeMode="contain"/><Text style={s.chosenName}>{garment.name}</Text></View>:
     <View style={s.emptyGarment}><Text style={s.emptyIcon}>✦</Text><Text style={s.emptyText}>Henüz kıyafet seçilmedi</Text></View>}
    <TouchableOpacity onPress={()=>setConsent(!consent)} style={s.consent}>
     <Text style={s.consentText}>{consent?'☑':'☐'} Yeni fotoğrafımı AI uygunluk kontrolüne göndermeyi kabul ediyorum.</Text>
    </TouchableOpacity>
    <Text style={s.small}>Yeni fotoğraflar Gemini AI tarafından kontrol edilir. Kontrol için 24 saat içinde en fazla 15 istek yapılabilir; kontrol sonucu hatalı olabilir.</Text>
    <View style={s.buttonRow}>
     <TouchableOpacity style={s.secondary} disabled={busy} onPress={()=>void chooseGarment(true)}><Text style={s.secondaryText}>📷 Fotoğraf çek</Text></TouchableOpacity>
     <TouchableOpacity style={s.secondary} disabled={busy} onPress={()=>void chooseGarment(false)}><Text style={s.secondaryText}>▧ Galeriden seç</Text></TouchableOpacity>
    </View>
    <TouchableOpacity style={s.wardrobeButton} disabled={busy} onPress={()=>void loadWardrobe()}><Text style={s.wardrobeText}>◇ Gardırobumdan seç</Text></TouchableOpacity>
    {pendingGarment&&<View style={s.pendingCard}>
      <Image source={{uri:pendingGarment.uri}} style={s.pendingPhoto} resizeMode="contain"/>
      <Text style={s.small}>Fotoğrafın hazır ancak henüz doğrulanmadı; yeniden çekmen gerekmiyor.</Text>
      <TouchableOpacity style={s.wardrobeButton} disabled={busy} onPress={()=>void verifyRecoveredPhoto()}><Text style={s.wardrobeText}>✦ Fotoğrafı kontrol et</Text></TouchableOpacity>
    </View>}
    {busy&&<ActivityIndicator style={{marginTop:12}} color="#8050B5"/>}
    {showWardrobe&&<View style={s.wardrobeList}>
     <View style={s.cardHeading}><Text style={s.cardTitle}>Gardırobumdaki parçalar</Text><TouchableOpacity onPress={()=>setShowWardrobe(false)}><Text style={s.link}>Kapat</Text></TouchableOpacity></View>
     {loadingWardrobe?<ActivityIndicator color="#8050B5"/>:wardrobe.length===0?<Text style={s.small}>Gardırobunda kayıtlı kıyafet bulunamadı. Yukarıdaki seçenekleri kullanabilirsin.</Text>:
      wardrobe.map(choice=><TouchableOpacity key={choice.id} style={s.wardrobeRow} onPress={()=>chooseWardrobe(choice)}>
       {choice.imageUrl?<Image source={{uri:choice.imageUrl}} style={s.thumbnail}/>:<View style={s.thumbnail}/>}
       <View style={{flex:1}}><Text style={s.wardrobeName}>{choice.name}</Text><Text style={s.small}>{choice.category}</Text></View><Text style={s.link}>Seç ›</Text>
      </TouchableOpacity>)}
    </View>}
   </View>
   <View style={s.preview}>
    <Text style={s.cardTitle}>03 · Önizleme</Text>
    <View style={s.previewRow}>
     <View style={s.previewBox}>{person?<Image source={{uri:person.url}} style={s.previewImage} resizeMode="contain"/>:<Text style={s.small}>Benim fotoğrafım</Text>}</View>
     <View style={s.previewBox}>{garment?<Image source={{uri:garment.uri}} style={s.previewImage} resizeMode="contain"/>:<Text style={s.small}>Kıyafet fotoğrafı</Text>}</View>
    </View>
    {resultUrl?<View style={s.resultCard}><Text style={s.resultTitle}>✦ Sanal deneme hazır</Text><Image source={{uri:resultUrl}} style={s.resultImage} resizeMode="contain"/><Text style={s.small}>Bu bir AI görselleştirmesidir; gerçek kalıp veya beden uyumunu garanti etmez.</Text></View>:null}
    <TouchableOpacity onPress={()=>setOwnsPhoto(!ownsPhoto)} style={s.consent}><Text style={s.consentText}>{ownsPhoto?'☑':'☐'} Bu fotoğraf bana ait veya fotoğraftaki kişinin kullanım izni var.</Text></TouchableOpacity>
    <TouchableOpacity onPress={()=>setTryOnConsent(!tryOnConsent)} style={s.consent}><Text style={s.consentText}>{tryOnConsent?'☑':'☐'} Fotoğraflarımın kıyafet denemesi için harici AI hizmetinde işlenmesini kabul ediyorum.</Text></TouchableOpacity>
    <TouchableOpacity style={[s.primaryTryon,(!premium?.active||!premium.providerReady||!person||!garment||tryOnStatus==='starting'||tryOnStatus==='processing')&&s.disabledButton]} disabled={!person||!garment||!premium?.active||!premium.providerReady||premium.remaining<=0||busy||tryOnStatus==='starting'||tryOnStatus==='processing'} onPress={()=>void startTryOn()}><Text style={s.primaryTryonText}>{tryOnStatus==='starting'||tryOnStatus==='processing'?'✦ Sanal deneme hazırlanıyor…':premium?.active?(premium.providerReady?'✦ AI ile Üzerimde Dene':'✦ AI bağlantısı hazırlanıyor'):'✦ Sanal Deneme · Premium'}</Text></TouchableOpacity>
    {tryOnStatus==='processing'&&<ActivityIndicator style={{marginTop:12}} color="#8050B5"/>}
    <Text style={s.small}>{premium?.active?`${premium.testAccess?'Geliştirme testi':'Premium'} · Kalan deneme: ${premium.remaining} / ${premium.monthlyLimit}${premium.providerReady?'':' · API anahtarı eksik'}`:'Gerçek sanal deneme Premium üyelikte kullanılabilir. Test yetkisi ödeme gerektirmez.'}</Text>
    <TouchableOpacity style={s.wardrobeButton} onPress={()=>void refreshTryOnAccess()}><Text style={s.wardrobeText}>↻ Erişimi yeniden kontrol et</Text></TouchableOpacity>
    {tryOnJob&&tryOnStatus==='processing'&&<TouchableOpacity style={s.wardrobeButton} onPress={()=>{setTryOnStatus('idle');setTimeout(()=>setTryOnStatus('processing'),0);}}><Text style={s.wardrobeText}>↻ Sonucu yeniden kontrol et</Text></TouchableOpacity>}
   </View>
   <View style={s.looksCard}>
    <View style={s.cardHeading}>
     <Text style={s.cardTitle}>✦ Kullanım Geçmişim</Text>
     <TouchableOpacity onPress={()=>{setHistoryOpen(!historyOpen);if(!historyOpen)void loadUsageHistory();}}><Text style={s.link}>{historyOpen?'Gizle':'Görüntüle ›'}</Text></TouchableOpacity>
    </View>
    <Text style={s.small}>Her sanal denemenin işlem kaydını görebilirsin. Görseli silmek hakkını geri yüklemez.</Text>
    {historyOpen&&<View>
     <TouchableOpacity onPress={()=>void loadUsageHistory()} disabled={historyLoading} style={s.wardrobeButton}><Text style={s.wardrobeText}>↻ Geçmişi yenile</Text></TouchableOpacity>
     {historyLoading?<ActivityIndicator color="#8050B5" style={{marginTop:12}}/>:usageItems.length===0?
      <Text style={s.small}>Henüz kullanım kaydı bulunmuyor.</Text>:
      usageItems.map(x=><View key={x.id} style={s.usageRow}>
       <View style={{flex:1}}>
        <Text style={s.usageMain}>{new Date(x.createdAt).toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'})}</Text>
        <Text style={s.usageMeta}>İşlem #{x.reference} · {x.resultDeleted?'Görsel silindi':x.status==='completed'?'Tamamlandı':x.status==='failed'?'Başarısız':x.status==='submitted'||x.status==='processing'||x.status==='reserved'?'İşlem sürüyor':x.status}</Text>
       </View>
       <Text style={[s.usageCredit,x.creditUsed?s.usageCreditSpent:s.usageCreditReturned]}>{x.creditUsed?'1 hak':'0 hak'}</Text>
      </View>)}
     <Text style={s.small}>Başarısız işlemlerde hak kullanılmaz. İşlemi başlatılan ve henüz sonuçlanmayan denemeler geçici olarak kullanım sınırına dahil edilir.</Text>
    </View>}
   </View>
   {supportIsAdmin&&<View style={s.looksCard}>
    <View style={s.cardHeading}><Text style={s.cardTitle}>✦ Yönetici İşlem Geçmişi</Text>
     <TouchableOpacity onPress={()=>{setSupportOpen(!supportOpen);if(!supportOpen)void loadSupportRecords();}}><Text style={s.link}>{supportOpen?'Gizle':'Görüntüle ›'}</Text></TouchableOpacity>
    </View>
    {supportOpen&&<View>
     <TouchableOpacity disabled={supportLoading} style={s.wardrobeButton} onPress={()=>void loadSupportRecords()}><Text style={s.wardrobeText}>↻ Kayıtları yenile</Text></TouchableOpacity>
     {supportLoading?<ActivityIndicator color="#8050B5"/>:
      supportRecords.map(x=><View key={x.id} style={s.usageRow}>
       <View style={{flex:1}}>
        <Text style={s.usageMain}>#{x.id.slice(0,8).toUpperCase()} · {x.status}</Text>
        <Text style={s.usageMeta}>Hesap: {x.userId.slice(0,8)}… · {new Date(x.createdAt).toLocaleString('tr-TR')}</Text>
        {x.history.map((h,i)=><Text key={i} style={s.usageMeta}>{new Date(h.time).toLocaleString('tr-TR')}: {h.historicalSnapshot?'Eski kaydın durumu':h.type} · {h.creditEffect==='released'?'Hak iade':h.creditEffect==='reserved'?'Hak ayrıldı':'Hak korundu'}</Text>)}
       </View>
      </View>)}
    </View>}
   </View>
   <View style={s.looksCard}>
    <View style={s.cardHeading}><Text style={s.cardTitle}>✦ Denemelerim</Text><TouchableOpacity disabled={looksLoading} onPress={()=>void loadMyLooks()}><Text style={s.link}>Yenile ↻</Text></TouchableOpacity></View>
    <Text style={s.small}>Oluşturduğun kıyafet denemeleri burada saklanır. Tekrar görüntülemek için AI hakkı harcamazsın.</Text>
    {looksLoading?<ActivityIndicator style={{marginTop:20}} color="#8050B5"/>:myLooks.length===0?
     <View style={s.looksEmpty}><Text style={s.emptyIcon}>✦</Text><Text style={s.emptyText}>Henüz kayıtlı denemen yok</Text></View>:
     <View style={s.lookGrid}>{myLooks.map(item=><TouchableOpacity key={item.id} style={s.lookTile} onPress={()=>setSelectedLook(item)}>
      <Image style={s.lookThumb} source={{uri:item.url}} resizeMode="cover"/>
      <Text style={s.lookDate}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
     </TouchableOpacity>)}</View>}
   </View>
  </ScrollView>
 </View>;
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FAF9FC'},content:{padding:20,paddingBottom:90},
 usageRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#ECE4F0'},
 usageMain:{color:'#382748',fontSize:12,fontWeight:'800'},
 usageMeta:{color:'#80718F',fontSize:11,marginTop:4},
 usageCredit:{fontSize:12,fontWeight:'800'},
 usageCreditSpent:{color:'#7F4BA0'},
 usageCreditReturned:{color:'#447E65'},
 looksCard:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E8DFF0',borderRadius:19,padding:16,marginTop:16},
 looksEmpty:{height:120,alignItems:'center',justifyContent:'center',backgroundColor:'#F7F3FA',borderRadius:12,marginTop:12},
 lookGrid:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:15},
 lookTile:{width:'31%',backgroundColor:'#F7F3FA',borderRadius:10,overflow:'hidden',paddingBottom:6},
 lookThumb:{width:'100%',height:142},lookDate:{fontSize:10,color:'#705D83',textAlign:'center',marginTop:5},
 lookModalOverlay:{flex:1,backgroundColor:'rgba(20,12,32,0.65)',justifyContent:'center',padding:20},
 lookModalCard:{backgroundColor:'#FFF',borderRadius:20,padding:17,maxHeight:'90%'},
 lookLarge:{height:440,width:'100%',backgroundColor:'#F7F3FA',borderRadius:12},
 removeLookButton:{borderWidth:1,borderColor:'#E2B7C3',borderRadius:11,paddingVertical:13,alignItems:'center',marginTop:14},
 removeLookText:{color:'#9F3C5E',fontWeight:'800',fontSize:13},
 confirmLookCard:{backgroundColor:'#FFF',borderRadius:20,padding:20},
 confirmButtons:{flexDirection:'row',gap:10,marginTop:20},
 confirmCancel:{flex:1,paddingVertical:13,alignItems:'center',backgroundColor:'#EDE7F3',borderRadius:11},
 confirmCancelText:{color:'#5D4772',fontWeight:'800'},
 confirmDelete:{flex:1,paddingVertical:13,alignItems:'center',backgroundColor:'#A04768',borderRadius:11},
 confirmDeleteText:{color:'#FFF',fontWeight:'800'},
 primaryTryon:{backgroundColor:'#8050B5',borderRadius:14,paddingVertical:16,alignItems:'center',marginTop:14},
 primaryTryonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},
 resultCard:{padding:10,backgroundColor:'#F4EDF8',borderRadius:14,marginBottom:12},
 resultTitle:{color:'#372447',fontSize:15,fontWeight:'800',marginBottom:12},
 resultImage:{width:'100%',height:370},
 pendingCard:{padding:12,marginTop:14,backgroundColor:'#F5EFF8',borderRadius:14},
 pendingPhoto:{height:180,width:'100%'},
 back:{color:'#8050B5',fontWeight:'800',fontSize:13,marginBottom:22},
 eyebrow:{color:'#9575B0',fontSize:10,fontWeight:'800',letterSpacing:1.5},
 title:{fontSize:28,fontWeight:'800',color:'#25193A',marginTop:6},
 description:{color:'#6C607C',fontSize:13,lineHeight:21,marginTop:8,marginBottom:16},
 card:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E8DFF0',borderRadius:20,padding:16,marginBottom:15},
 cardHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:11},
 cardTitle:{color:'#352346',fontSize:15,fontWeight:'800',marginBottom:8},
 link:{color:'#754BA3',fontSize:12,fontWeight:'800'},
 personPhoto:{width:'100%',height:260,backgroundColor:'#F2EEF7',borderRadius:14},
 emptyPerson:{minHeight:160,backgroundColor:'#F1EAF7',borderRadius:14,alignItems:'center',justifyContent:'center'},
 emptyIcon:{fontSize:35,color:'#855DB2'},emptyText:{color:'#76618A',fontSize:13,marginTop:7,fontWeight:'700'},
 small:{fontSize:11,color:'#81728E',lineHeight:18,marginTop:8},
 textAction:{marginTop:10},chosen:{alignItems:'center',backgroundColor:'#F7F3FA',borderRadius:14,padding:10},
 garmentImage:{height:150,width:'100%'},chosenName:{color:'#49385D',fontSize:12,fontWeight:'700',marginTop:8},
 emptyGarment:{height:110,backgroundColor:'#F7F3FA',borderRadius:14,alignItems:'center',justifyContent:'center'},
 consent:{backgroundColor:'#F8F4FC',borderRadius:12,padding:12,marginTop:12},
 consentText:{color:'#503B65',fontSize:12,fontWeight:'700',lineHeight:20},
 buttonRow:{flexDirection:'row',gap:9,marginTop:14},
 secondary:{flex:1,backgroundColor:'#EDE4F5',borderRadius:12,alignItems:'center',paddingVertical:14},
 secondaryText:{color:'#6F4798',fontWeight:'800',fontSize:12},
 wardrobeButton:{borderColor:'#DCC8EB',borderWidth:1,borderRadius:12,paddingVertical:13,alignItems:'center',marginTop:10},
 wardrobeText:{color:'#70489A',fontWeight:'800',fontSize:12},
 wardrobeList:{marginTop:18,borderTopWidth:1,borderColor:'#EEE5F4',paddingTop:15},
 wardrobeRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9,borderBottomWidth:1,borderColor:'#F0EBF5'},
 thumbnail:{width:50,height:64,borderRadius:7,backgroundColor:'#F1EAF6'},
 wardrobeName:{fontWeight:'800',color:'#352647',fontSize:12},
 preview:{padding:16,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E8DFF0',borderRadius:19},
 previewRow:{flexDirection:'row',gap:10,marginVertical:12},
 previewBox:{flex:1,height:200,borderRadius:13,backgroundColor:'#F4EDF8',alignItems:'center',justifyContent:'center'},
 previewImage:{width:'100%',height:'100%'},
 disabledButton:{backgroundColor:'#E8E2EE',borderRadius:12,alignItems:'center',padding:15,marginTop:8},
 disabledText:{color:'#82768D',fontWeight:'800',fontSize:12},
});
