import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';
import { chooseTryOnPhoto, readTryOnPhoto, validateTryOnImage, type TryOnPhoto } from './TryOnPhotoStore';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';

type WardrobeChoice={id:string;name:string;category:string;image_path:string;imageUrl:string|null};
type Props={userId:string;onBack:()=>void;onManagePhoto:()=>void};

export default function HomeTryOnScreen({userId,onBack,onManagePhoto}:Props){
 const [person,setPerson]=useState<{path:string;url:string}|null>(null);
 const [garment,setGarment]=useState<{name:string;uri:string;source:'camera'|'gallery'|'wardrobe'}|null>(null);
 const [wardrobe,setWardrobe]=useState<WardrobeChoice[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadingWardrobe,setLoadingWardrobe]=useState(false);
 const [showWardrobe,setShowWardrobe]=useState(false);
 const [busy,setBusy]=useState(false);
 const [consent,setConsent]=useState(false);
 const [notice,setNotice]=useState<{type:NoticeType;title:string;message:string}|null>(null);

 const reload=useCallback(async()=>{
  setLoading(true);
  try{setPerson(await readTryOnPhoto(userId));}
  catch(e){setNotice({type:'error',title:'Fotoğraf yüklenemedi',message:e instanceof Error?e.message:'Tekrar dene.'});}
  finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void reload();},[reload]);

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
   await validateTryOnImage(picked,'garment');
   setGarment({uri:picked.uri,name:camera?'Yeni çektiğim kıyafet':'Galeriden seçtiğim kıyafet',source:camera?'camera':'gallery'});
   setShowWardrobe(false);
  }catch(e){setNotice({type:'error',title:'Fotoğraf işlenemedi',message:e instanceof Error?e.message:'Lütfen yeniden dene.'});}
  finally{setBusy(false);}
 }

 function chooseWardrobe(choice:WardrobeChoice){
  if(!choice.imageUrl){setNotice({type:'error',title:'Fotoğraf bulunamadı',message:'Bu gardırop parçasının fotoğrafı açılamıyor.'});return;}
  setGarment({uri:choice.imageUrl,name:choice.name,source:'wardrobe'});
  setShowWardrobe(false);
 }

 return <View style={s.root}>
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
    <Text style={s.small}>Yeni fotoğraflar Gemini AI tarafından kontrol edilir. Kontrol için günde en fazla 10 istek yapılabilir; kontrol sonucu hatalı olabilir.</Text>
    <View style={s.buttonRow}>
     <TouchableOpacity style={s.secondary} disabled={busy} onPress={()=>void chooseGarment(true)}><Text style={s.secondaryText}>📷 Fotoğraf çek</Text></TouchableOpacity>
     <TouchableOpacity style={s.secondary} disabled={busy} onPress={()=>void chooseGarment(false)}><Text style={s.secondaryText}>▧ Galeriden seç</Text></TouchableOpacity>
    </View>
    <TouchableOpacity style={s.wardrobeButton} disabled={busy} onPress={()=>void loadWardrobe()}><Text style={s.wardrobeText}>◇ Gardırobumdan seç</Text></TouchableOpacity>
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
    <View style={s.disabledButton}><Text style={s.disabledText}>✦ AI ile Üzerimde Dene · Yakında</Text></View>
    <Text style={s.small}>Şu an iki fotoğrafı hazırlıyoruz; henüz yeni görüntü oluşturulmuyor veya sanal deneme hakkı kullanılmıyor. Gerçek sanal denemeye geçmeden önce ayrı izin ve Premium hak kontrolü eklenecek.</Text>
   </View>
  </ScrollView>
 </View>;
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FAF9FC'},content:{padding:20,paddingBottom:90},
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
