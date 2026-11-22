import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getRoutineItems, type RoutineItem } from './RoutineStore';
import { PRIZMA } from './prizmaTheme';

type Page = 'Gardırop' | 'PRİZMA AI' | 'Güzellik' | 'Bakım Rutini' | 'Cilt Danışmanı' | 'Stil Stüdyosu';
type Props = { userId: string; displayName?: string; onOpen: (page: Page) => void };
type Outfit = { name: string; description: string; item_ids: string[] };
type Garment = { id: string; name: string; image_path: string | null; imageUrl: string | null };
type Weather = { name: string; temp: number; code: number };
const dayISO = (d: Date) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
const today = () => dayISO(new Date());
const weatherLabel = (code: number) => code === 0 ? 'Açık' : code <= 3 ? 'Parçalı bulutlu' : code <= 48 ? 'Sisli' : code <= 67 ? 'Yağmurlu' : code <= 77 ? 'Karlı' : code <= 82 ? 'Sağanak' : 'Değişken';
const getKey = (userId: string, suffix: string) => 'prizma-v2:' + userId + ':' + suffix;

export default function PrizmaHomeV2({ userId, displayName, onOpen }: Props) {
  const [city, setCity] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [cityEdit, setCityEdit] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [selectedDay, setSelectedDay] = useState(today);
  const [agenda, setAgenda] = useState<Record<string,string>>({});
  const [agendaDraft, setAgendaDraft] = useState('');
  const [agendaEdit, setAgendaEdit] = useState(false);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [outfitBusy, setOutfitBusy] = useState(false);
  const [outfitError, setOutfitError] = useState('');
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const greeting = new Date().getHours() < 11 ? 'Günaydın' : new Date().getHours() < 18 ? 'Merhaba' : 'İyi akşamlar';
  const week = useMemo(() => {
    const d = new Date();
    const offset = (d.getDay()+6)%7;
    d.setDate(d.getDate()-offset);
    return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return x;});
  },[selectedDay]);
  const fetchWeather = useCallback(async (place: string) => {
    if (!place.trim()) return;
    setWeatherBusy(true);
    setWeatherError('');
    try {
      const geoResp = await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(place.trim())+'&count=1&language=tr&format=json');
      if (!geoResp.ok) throw new Error('Şehir bulunamadı.');
      const geo = await geoResp.json();
      const loc = geo?.results?.[0];
      if (typeof loc?.latitude !== 'number' || typeof loc?.longitude !== 'number') throw new Error('Şehir bulunamadı.');
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude='+loc.latitude+'&longitude='+loc.longitude+'&current=temperature_2m,weather_code&timezone=auto');
      if(!response.ok) throw new Error('Hava durumu alınamadı.');
      const data = await response.json();
      setWeather({ name: loc.name, temp: Math.round(data.current.temperature_2m), code: data.current.weather_code });
    } catch(e) {
      setWeather(null);
      setWeatherError(e instanceof Error ? e.message : 'Hava durumu alınamadı.');
    } finally { setWeatherBusy(false); }
  },[]);
  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const [savedCity,savedAgenda] = await Promise.all([
          AsyncStorage.getItem(getKey(userId,'weather-city')),
          AsyncStorage.getItem(getKey(userId,'agenda')),
        ]);
        if (!active) return;
        if (savedCity) { setCity(savedCity); setCityDraft(savedCity); void fetchWeather(savedCity); }
        if (savedAgenda) {
          const raw = JSON.parse(savedAgenda);
          if(raw && typeof raw==='object' && !Array.isArray(raw))setAgenda(raw);
        }
      } catch { /* keep editable empty state */ }
    })();
    return ()=>{active=false;};
  },[userId,fetchWeather]);
  useEffect(()=>{setAgendaDraft(agenda[selectedDay]||'');},[agenda,selectedDay]);
  const saveCity=async()=>{
    const next=cityDraft.trim().slice(0,65);
    setCity(next);setCityEdit(false);
    await AsyncStorage.setItem(getKey(userId,'weather-city'),next);
    await fetchWeather(next);
  };
  const saveAgenda=async()=>{
    const next={...agenda,[selectedDay]:agendaDraft.trim().slice(0,180)};
    setAgenda(next);setAgendaEdit(false);
    await AsyncStorage.setItem(getKey(userId,'agenda'),JSON.stringify(next));
  };
  const refreshRoutine=useCallback(async()=>{
    const [r,c]=await Promise.all([
      getRoutineItems(userId),
      AsyncStorage.getItem(getKey(userId,'routine:'+today())),
    ]);
    setRoutine(r);
    try{setCompleted(c?JSON.parse(c):[]);}catch{setCompleted([]);}
  },[userId]);
  useEffect(()=>{void refreshRoutine();},[refreshRoutine]);
  const toggleStep=async(id:string)=>{
    const next=completed.includes(id)?completed.filter(x=>x!==id):[...completed,id];
    setCompleted(next);
    await AsyncStorage.setItem(getKey(userId,'routine:'+today()),JSON.stringify(next));
  };
  const generateOutfits=useCallback(async(force=false)=>{
    setOutfitBusy(true);setOutfitError('');
    try {
      const {data,error}=await supabase.from('wardrobe_items').select('id,name,image_path').eq('user_id',userId);
      if(error)throw error;
      const rows=(data||[]) as {id:string;name:string;image_path:string|null}[];
      const urls=await Promise.all(rows.map(async g=>{
        if(!g.image_path)return {...g,imageUrl:null};
        const {data:image}=await supabase.storage.from('wardrobe').createSignedUrl(g.image_path,3600);
        return {...g,imageUrl:image?.signedUrl||null};
      }));
      setGarments(urls);
      if(rows.length<2){setOutfits([]);setOutfitError('Öneri için gardırobunda en az iki parça olmalı.');return;}
      const cacheKey=getKey(userId,'outfits:'+today());
      if(!force){
        const cached=await AsyncStorage.getItem(cacheKey);
        if(cached){
          const parsed=JSON.parse(cached);
          if(Array.isArray(parsed)&&parsed.length){setOutfits(parsed);return;}
        }
      }
      const agendaText=agenda[today()]?.trim();
      const context=[agendaText||'Günlük kullanım',weather?weatherLabel(weather.code)+' '+weather.temp+'°C':''].filter(Boolean).join(', ');
      const {data:result,error:invokeError}=await supabase.functions.invoke('generate-outfits',{body:{occasion:context,style:'Günlük, rahat ve özenli üç ayrı stil önerisi'}});
      if(invokeError)throw invokeError;
      if(result?.error)throw new Error(result.error);
      const validIds=new Set(rows.map(x=>x.id));
      const safe=(Array.isArray(result?.outfits)?result.outfits:[]).filter((x:any)=>typeof x?.name==='string'&&typeof x?.description==='string'&&Array.isArray(x?.item_ids)&&x.item_ids.length>=2&&x.item_ids.every((id:any)=>typeof id==='string'&&validIds.has(id))).slice(0,3) as Outfit[];
      if(!safe.length)throw new Error('Gardırobundaki parçalarla henüz kombin oluşturulamadı.');
      setOutfits(safe);
      await AsyncStorage.setItem(cacheKey,JSON.stringify(safe));
    } catch(e){setOutfitError(e instanceof Error?e.message:'Öneriler yüklenemedi.');}
    finally{setOutfitBusy(false);}
  },[userId,agenda,weather]);
  useEffect(()=>{void generateOutfits(false);},[userId]); // cache is reused; avoid repeated paid AI requests
  const saveOutfit=async(outfit:Outfit)=>{
    const {error}=await supabase.from('wardrobe_outfits').insert({user_id:userId,name:outfit.name.slice(0,100),item_ids:outfit.item_ids});
    setOutfitError(error?'Kombin kaydedilemedi: '+error.message:'Kombin gardırobuna kaydedildi.');
  };
  const daily=useMemo(()=>routine.filter(x=>x.category===undefined||x.category==='skin'),[routine]);
  const filterPeriod=(period:'Sabah'|'Akşam')=>daily.filter(x=>x.period===period);
  return <View style={s.page}>
    <Text style={s.greeting}>{greeting}{displayName?', '+displayName:''}!</Text>
    <Text style={s.sub}>Bugün stilin için neler planlıyoruz?</Text>
    <View style={s.topCards}>
      <View style={s.miniCard}>
        <Text style={s.cardHeading}>☁  Hava Durumu</Text>
        {weatherBusy?<ActivityIndicator color={PRIZMA.purple}/>:weather?<><Text style={s.weatherTemp}>{weather.temp}°</Text><Text style={s.muted}>{weatherLabel(weather.code)} · {weather.name}</Text></>:<Text style={s.muted}>{weatherError||'Şehrini ekleyerek hava durumunu gör.'}</Text>}
        {cityEdit?<><TextInput value={cityDraft} onChangeText={setCityDraft} placeholder="Şehir adı" style={s.input} autoCapitalize="words"/><TouchableOpacity onPress={()=>{void saveCity();}} style={s.smallAction}><Text style={s.smallActionText}>Kaydet</Text></TouchableOpacity></>:
        <TouchableOpacity accessibilityRole="button" onPress={()=>setCityEdit(true)}><Text style={s.action}>{city?'Şehri değiştir':'Şehir ekle'} ›</Text></TouchableOpacity>}
      </View>
      <View style={s.miniCard}>
        <Text style={s.cardHeading}>▦  Günlük Planım</Text>
        <Text style={s.muted}>{new Date(selectedDay+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'long'})}</Text>
        <Text style={s.planText} numberOfLines={3}>{agenda[selectedDay]||'Henüz etkinlik eklenmedi.'}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={()=>setAgendaEdit(true)}><Text style={s.action}>{agenda[selectedDay]?'Düzenle':'Plan ekle'} ›</Text></TouchableOpacity>
      </View>
    </View>
    {agendaEdit?<View style={s.editPanel}><Text style={s.cardHeading}>Günlük planını düzenle</Text><TextInput multiline value={agendaDraft} onChangeText={setAgendaDraft} placeholder="Örn. Öğleden sonra arkadaşlarımla kahve" style={[s.input,{minHeight:64}]} maxLength={180}/><View style={s.inlineActions}><TouchableOpacity onPress={()=>setAgendaEdit(false)} style={s.secondaryButton}><Text style={s.action}>Vazgeç</Text></TouchableOpacity><TouchableOpacity onPress={()=>{void saveAgenda();}} style={s.primaryButton}><Text style={s.primaryButtonText}>Kaydet</Text></TouchableOpacity></View></View>:null}
    <View style={s.sectionRow}><Text style={s.sectionTitle}>Bugünün Kombinleri</Text><TouchableOpacity accessibilityRole="button" disabled={outfitBusy} onPress={()=>{void generateOutfits(true);}}><Text style={s.action}>{outfitBusy?'Hazırlanıyor...':'Yenile ↻'}</Text></TouchableOpacity></View>
    {outfitBusy?<View style={s.loading}><ActivityIndicator color={PRIZMA.purple}/><Text style={s.muted}>Gardırobundan kombinler hazırlanıyor...</Text></View>:null}
    {!outfitBusy&&outfits.length===0?<TouchableOpacity style={s.empty} onPress={()=>onOpen('Gardırop')}><Text style={s.emptyText}>{outfitError||'Kişisel kombinlerin burada görünecek.'}</Text><Text style={s.action}>Gardıroba Git ›</Text></TouchableOpacity>:null}
    {outfits.length>0?<View style={s.outfitRow}>{outfits.map((o,i)=><TouchableOpacity key={o.name+i} style={s.outfitCard} accessibilityRole="button" onPress={()=>{void saveOutfit(o);}}>
      <View style={s.lookImage}>{o.item_ids.slice(0,3).map(id=>{const item=garments.find(g=>g.id===id);return item?.imageUrl?<Image key={id} source={{uri:item.imageUrl}} resizeMode="contain" style={s.lookItem}/>:<Text key={id} style={s.lookFallback}>♧</Text>;})}</View>
      <Text style={s.lookTitle} numberOfLines={2}>{o.name}</Text><Text style={s.lookDesc} numberOfLines={2}>{o.description}</Text><Text style={s.action}>Kombini Kaydet ›</Text>
    </TouchableOpacity>)}</View>:null}
    {!!outfits.length&&!!outfitError?<Text style={s.muted}>{outfitError}</Text>:null}
    <View style={s.sectionRow}><Text style={s.sectionTitle}>Haftalık Stil Takvimim</Text></View>
    <View style={s.weekCard}>{week.map(d=>{const key=dayISO(d);const selected=key===selectedDay;return <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{selected}} onPress={()=>setSelectedDay(key)} style={[s.day,selected&&s.selectedDay]}><Text style={[s.dayName,selected&&s.selectedDayText]}>{d.toLocaleDateString('tr-TR',{weekday:'short'})}</Text><Text style={[s.dayNumber,selected&&s.selectedDayText]}>{d.getDate()}</Text>{agenda[key]?<View style={s.dayDot}/>:null}</TouchableOpacity>;})}</View>
    <View style={s.sectionRow}><Text style={s.sectionTitle}>Güzellik Notum</Text></View>
    <TouchableOpacity style={s.tipCard} onPress={()=>onOpen('Cilt Danışmanı')}><Text style={s.tipTitle}>PRİZMA AI Güzellik Danışmanı</Text><Text style={s.muted}>Cilt, saç ve makyaj tercihlerine göre ürün ve bakım önerileri keşfet.</Text><Text style={s.action}>Öneri al ›</Text></TouchableOpacity>
    <View style={s.sectionRow}><Text style={s.sectionTitle}>Günlük Bakım Rutinim</Text><TouchableOpacity onPress={()=>onOpen('Bakım Rutini')}><Text style={s.action}>Tümünü gör ›</Text></TouchableOpacity></View>
    <View style={s.routineBox}>{(['Sabah','Akşam'] as const).map(period=><View key={period} style={s.routineGroup}><Text style={s.periodTitle}>{period==='Sabah'?'☀':'☾'}  {period}</Text>{filterPeriod(period).length===0?<Text style={s.muted}>Henüz bakım adımı yok.</Text>:filterPeriod(period).slice(0,4).map(item=><TouchableOpacity key={item.id} accessibilityRole="checkbox" accessibilityState={{checked:completed.includes(item.id)}} onPress={()=>{void toggleStep(item.id);}} style={s.routineItem}><View style={[s.check,completed.includes(item.id)&&s.checked]}><Text style={s.checkGlyph}>{completed.includes(item.id)?'✓':''}</Text></View><Text style={[s.routineText,completed.includes(item.id)&&s.doneText]} numberOfLines={2}>{item.title}</Text></TouchableOpacity>)}</View>)}</View>
  </View>;
}
const s=StyleSheet.create({
 page:{paddingBottom:38}, greeting:{fontSize:24,fontWeight:'700',color:PRIZMA.ink,marginTop:4},sub:{color:PRIZMA.muted,fontSize:13,marginTop:5,marginBottom:18},
 topCards:{flexDirection:'row',gap:10},miniCard:{flex:1,minHeight:158,padding:13,borderRadius:16,borderWidth:1,borderColor:PRIZMA.border,backgroundColor:PRIZMA.white},
 cardHeading:{fontSize:13,fontWeight:'700',color:PRIZMA.ink,marginBottom:9},muted:{fontSize:11,color:PRIZMA.muted,lineHeight:17},weatherTemp:{fontSize:25,fontWeight:'700',color:PRIZMA.purple,marginBottom:3},planText:{fontSize:12,color:PRIZMA.ink,lineHeight:18,marginTop:7,flex:1},action:{fontSize:11,color:PRIZMA.purple,fontWeight:'700',marginTop:10},
 input:{backgroundColor:PRIZMA.white,borderWidth:1,borderColor:PRIZMA.border,borderRadius:10,paddingHorizontal:9,paddingVertical:8,fontSize:12,color:PRIZMA.ink,marginTop:8},
 smallAction:{minHeight:38,justifyContent:'center'},smallActionText:{color:PRIZMA.purple,fontWeight:'700',fontSize:11},
 editPanel:{borderWidth:1,borderColor:PRIZMA.border,padding:14,borderRadius:14,marginTop:10},inlineActions:{flexDirection:'row',justifyContent:'flex-end',gap:8,marginTop:8},secondaryButton:{minHeight:44,paddingHorizontal:14,justifyContent:'center'},primaryButton:{backgroundColor:PRIZMA.purple,minHeight:44,paddingHorizontal:20,justifyContent:'center',borderRadius:12},primaryButtonText:{color:PRIZMA.white,fontWeight:'700'},
 sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:24,marginBottom:12},sectionTitle:{fontSize:18,fontWeight:'700',color:PRIZMA.ink,flexShrink:1},
 loading:{padding:20,gap:10,alignItems:'center'},empty:{padding:19,borderRadius:16,borderWidth:1,borderColor:PRIZMA.border,alignItems:'center',gap:5},emptyText:{color:PRIZMA.muted,textAlign:'center',fontSize:12},
 outfitRow:{flexDirection:'row',gap:9},outfitCard:{flex:1,padding:7,borderWidth:1,borderColor:PRIZMA.border,borderRadius:14,backgroundColor:PRIZMA.white,minHeight:200},
 lookImage:{height:94,backgroundColor:PRIZMA.purpleLight,borderRadius:9,flexDirection:'row',padding:3},lookItem:{flex:1,height:'100%'},lookFallback:{color:PRIZMA.purple,fontSize:26,flex:1,textAlign:'center',textAlignVertical:'center'},lookTitle:{color:PRIZMA.ink,fontWeight:'700',fontSize:12,marginTop:7},lookDesc:{fontSize:10,color:PRIZMA.muted,lineHeight:14,marginTop:4},
 weekCard:{flexDirection:'row',borderWidth:1,borderColor:PRIZMA.border,borderRadius:15,paddingVertical:11,paddingHorizontal:5},day:{flex:1,minHeight:56,alignItems:'center',justifyContent:'center',gap:6,borderRadius:11},selectedDay:{backgroundColor:PRIZMA.purpleLight},dayName:{fontSize:10,color:PRIZMA.muted},dayNumber:{fontSize:13,color:PRIZMA.ink,fontWeight:'700'},selectedDayText:{color:PRIZMA.purple},dayDot:{height:4,width:4,borderRadius:2,backgroundColor:PRIZMA.purple},
 tipCard:{backgroundColor:PRIZMA.white,borderWidth:1,borderColor:PRIZMA.border,borderRadius:15,padding:16,gap:5},tipTitle:{fontSize:14,color:PRIZMA.purple,fontWeight:'700'},
 routineBox:{borderWidth:1,borderColor:PRIZMA.border,borderRadius:15,padding:15},routineGroup:{paddingVertical:8,gap:8},periodTitle:{fontSize:14,fontWeight:'700',color:PRIZMA.ink,marginBottom:3},routineItem:{flexDirection:'row',alignItems:'center',minHeight:42,gap:11},check:{height:25,width:25,borderWidth:1,borderColor:PRIZMA.purple,borderRadius:7,alignItems:'center',justifyContent:'center'},checked:{backgroundColor:PRIZMA.purple},checkGlyph:{color:PRIZMA.white,fontWeight:'800'},routineText:{color:PRIZMA.ink,fontSize:12,flex:1},doneText:{color:PRIZMA.muted,textDecorationLine:'line-through'},
});
