import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getRoutineItems, type RoutineItem } from './RoutineStore';
import { PRIZMA } from './prizmaTheme';

type Page = 'Gardırop' | 'PRİZMA AI' | 'Güzellik' | 'Bakım Rutini' | 'Cilt Danışmanı' | 'Stil Stüdyosu' | 'Sanal Deneme';
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
  const [hydrated, setHydrated] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [selectedDay, setSelectedDay] = useState(today);
  const [agenda, setAgenda] = useState<Record<string,string>>({});
  const [agendaDraft, setAgendaDraft] = useState('');
  const [agendaEdit, setAgendaEdit] = useState(false);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [outfitIndex,setOutfitIndex] = useState(0);
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
    // Free Open-Meteo API is limited to noncommercial use.
    // Commercial builds require a licensed provider before sending requests.
    if (!__DEV__) {
      setWeather(null);
      setWeatherError('Ticari hava durumu lisansı doğrulanana kadar bu özellik kullanılamıyor.');
      return;
    }
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
        if (savedCity) { setCity(savedCity); setCityDraft(savedCity); await fetchWeather(savedCity); }
        if (savedAgenda) {
          const raw = JSON.parse(savedAgenda);
          if(raw && typeof raw==='object' && !Array.isArray(raw))setAgenda(raw);
        }
      } catch { /* keep editable empty state */ }
      finally { if(active)setHydrated(true); }
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
      AsyncStorage.getItem('prizma-routine-progress:' + userId + ':' + today()),
    ]);
    setRoutine(r);
    try{setCompleted(c?JSON.parse(c):[]);}catch{setCompleted([]);}
  },[userId]);
  useEffect(()=>{void refreshRoutine();},[refreshRoutine]);
  const toggleStep=async(id:string)=>{
    const next=completed.includes(id)?completed.filter(x=>x!==id):[...completed,id];
    setCompleted(next);
    await AsyncStorage.setItem('prizma-routine-progress:' + userId + ':' + today(),JSON.stringify(next));
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
  useEffect(()=>{if(hydrated)void generateOutfits(false);},[hydrated,userId]); // wait for saved agenda/weather to load
  const saveOutfit=async(outfit:Outfit)=>{
    const {error}=await supabase.from('wardrobe_outfits').insert({user_id:userId,name:outfit.name.slice(0,100),item_ids:outfit.item_ids});
    setOutfitError(error?'Kombin kaydedilemedi: '+error.message:'Kombin gardırobuna kaydedildi.');
  };
  const daily=useMemo(()=>routine.filter(x=>x.category===undefined||x.category==='skin'),[routine]);
  const filterPeriod=(period:'Sabah'|'Akşam')=>daily.filter(x=>x.period===period);
  const focus = outfits.length ? outfits[outfitIndex % outfits.length] : null;
  const currentSteps = routine.filter(x => x.period === 'Sabah' || x.period === 'Akşam');
  const doneCount = currentSteps.filter(x => completed.includes(x.id)).length;
  const currentPlan = agenda[selectedDay] || 'Günlük Planım';
  const photoPieces = focus?.item_ids.map(id=>garments.find(g=>g.id===id)).filter((x):x is Garment=>Boolean(x)) || [];
  return <View style={s.page}>
    <Text style={s.greeting}>{greeting}{displayName?', '+displayName:''}!</Text>
    <Text style={s.sub}>Stilini ve güzelliğini birlikte planlayalım.</Text>
    <View style={s.briefBar}>
      <TouchableOpacity style={s.briefSection} accessibilityRole="button" onPress={()=>setAgendaEdit(!agendaEdit)}>
        <Text style={s.briefSymbol}>▦</Text>
        <Text style={s.briefText} numberOfLines={1}>{currentPlan}</Text>
        <Text style={s.briefChevron}>⌄</Text>
      </TouchableOpacity>
      <View style={s.briefDivider}/>
      <TouchableOpacity style={s.briefSection} accessibilityRole="button" onPress={()=>setCityEdit(!cityEdit)}>
        {weatherBusy?<ActivityIndicator size="small" color={PRIZMA.purple}/>:<Text style={s.briefSymbol}>☁</Text>}
        <Text style={s.briefText} numberOfLines={1}>{weather?weather.name+' '+weather.temp+'°C':city?city:'Hava durumu'}</Text>
      </TouchableOpacity>
    </View>
    {cityEdit&&<View style={s.inlineEditor}>
       <TextInput style={s.inlineInput} placeholder="Şehir (ör. İstanbul)" value={cityDraft} onChangeText={setCityDraft}/>
       <TouchableOpacity style={s.inlineSave} onPress={()=>{void saveCity();}}><Text style={s.inlineSaveText}>Kaydet</Text></TouchableOpacity>
    </View>}
    {agendaEdit&&<View style={s.inlineEditor}>
       <TextInput style={s.inlineInput} placeholder="Bugünkü planım" value={agendaDraft} onChangeText={setAgendaDraft}/>
       <TouchableOpacity style={s.inlineSave} onPress={()=>{void saveAgenda();}}><Text style={s.inlineSaveText}>Kaydet</Text></TouchableOpacity>
    </View>}
    <View style={s.hero}>
      <View style={s.heroHeading}>
        <Text style={s.heroTitle}>Günün Kombini</Text>
        <View style={s.heroControls}>
          <Text style={s.heroCount}>{focus?(outfitIndex+1)+'/'+outfits.length:'0/0'}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={()=>focus?void saveOutfit(focus):onOpen('Gardırop')}>
            <Text style={s.heroHeart}>♡</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={s.heroCaption}>Günlük planına uygun, senin için seçilen kombin.</Text>
      {outfitBusy&&!outfits.length?<View style={s.heroPending}><ActivityIndicator color={PRIZMA.purple}/><Text style={s.muted}>Kombinlerin hazırlanıyor...</Text></View>:
        focus?<View style={s.heroLook}>
          {photoPieces.slice(0,6).map((item,i)=><View key={item.id}
              style={[s.collageItem,{left:((i%3)*31)+4+'%',top:(Math.floor(i/3)*50)+4+'%',width:'30%',height:'45%'}]}>
            {item.imageUrl?<Image source={{uri:item.imageUrl}} resizeMode="contain" style={s.collageImage}/>:
            <View style={s.collagePlaceholder}><Text style={s.collagePlaceholderText}>{item.name}</Text></View>}
          </View>)}
        </View>:<TouchableOpacity style={s.heroPending} onPress={()=>onOpen('Gardırop')}><Text style={s.muted}>{outfitError||'Kombinlerini görmek için gardırobuna parça ekle.'}</Text><Text style={s.heroLink}>Gardırobuma git ›</Text></TouchableOpacity>}
      {focus&&<><View style={s.dots}>{outfits.map((o,i)=><TouchableOpacity key={o.name+i} accessibilityLabel={(i+1)+'. kombini göster'} onPress={()=>setOutfitIndex(i)} style={[s.dot,outfitIndex===i&&s.dotOn]}/>)}</View>
        <Text style={s.focusLabel} numberOfLines={1}>{focus.name} · {focus.description}</Text>
        <View style={s.carouselArrows}>
          <TouchableOpacity accessibilityRole="button" style={s.navArrow} onPress={()=>setOutfitIndex((outfitIndex+outfits.length-1)%outfits.length)}><Text style={s.navArrowText}>‹ Önceki</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={s.navArrow} onPress={()=>setOutfitIndex((outfitIndex+1)%outfits.length)}><Text style={s.navArrowText}>Sonraki ›</Text></TouchableOpacity>
        </View></>}
      <TouchableOpacity style={s.tryOnButton} accessibilityRole="button" onPress={()=>onOpen('Sanal Deneme')}>
        <Text style={s.tryOnText}>▢   Üzerimde Dene</Text>
      </TouchableOpacity>
    </View>
    <View style={s.quickRow}>
      <TouchableOpacity style={s.quickCard} accessibilityRole="button" onPress={()=>onOpen('Bakım Rutini')}>
        <Text style={s.quickIcon}>▤</Text><Text style={s.quickTitle}>Bugünkü Rutinim  ›</Text>
        <Text style={s.quickInfo}>{doneCount}/{currentSteps.length} adım tamamlandı</Text>
        <View style={s.quickTrack}><View style={[s.quickFill,{width:(currentSteps.length?doneCount/currentSteps.length*100:0)+'%'}]}/></View>
      </TouchableOpacity>
      <TouchableOpacity style={s.quickCard} accessibilityRole="button" onPress={()=>onOpen('Güzellik')}>
        <Text style={s.quickIcon}>▱</Text><Text style={s.quickTitle}>Güzellik Danışmanı  ›</Text>
        <Text style={s.quickInfo}>Bugün neye ihtiyacın var?</Text>
        <View style={s.categoryRow}><Text style={s.categoryChip}>Cilt</Text><Text style={s.categoryChip}>Saç</Text><Text style={s.categoryChip}>Makyaj</Text></View>
      </TouchableOpacity>
    </View>
    <View style={s.dayFooter}><TouchableOpacity onPress={()=>{void generateOutfits(true);}}><Text style={s.footerLink}>↻  Kombinleri Yenile</Text></TouchableOpacity>
    <TouchableOpacity onPress={()=>onOpen('Stil Stüdyosu')}><Text style={s.footerLink}>Stil Editörü  ›</Text></TouchableOpacity></View>
    <View style={s.weekSummary}><Text style={s.sectionTitle}>Haftalık Planım</Text><View style={s.weekCard}>{week.map(d=>{const key=dayISO(d);const selected=key===selectedDay;return <TouchableOpacity key={key} onPress={()=>setSelectedDay(key)} style={[s.day,selected&&s.selectedDay]}><Text style={[s.dayName,selected&&s.selectedDayText]}>{d.toLocaleDateString('tr-TR',{weekday:'short'})}</Text><Text style={[s.dayNumber,selected&&s.selectedDayText]}>{d.getDate()}</Text></TouchableOpacity>;})}</View></View>
  </View>;
}
const s=StyleSheet.create({
 briefBar:{flexDirection:'row',alignItems:'center',minHeight:55,borderColor:PRIZMA.border,borderWidth:1,borderRadius:20,backgroundColor:'#FFFFFF',paddingHorizontal:10,marginBottom:19},
 briefSection:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,minHeight:46},briefDivider:{height:27,width:1,backgroundColor:PRIZMA.border},briefSymbol:{fontSize:21,color:PRIZMA.purple},briefText:{fontSize:12,color:PRIZMA.ink,fontWeight:'600',flexShrink:1},briefChevron:{fontSize:19,color:PRIZMA.purple},
 inlineEditor:{flexDirection:'row',gap:8,marginBottom:12},inlineInput:{flex:1,minHeight:44,borderWidth:1,borderColor:PRIZMA.border,borderRadius:12,paddingHorizontal:10,color:PRIZMA.ink},inlineSave:{minHeight:44,borderRadius:12,backgroundColor:PRIZMA.purple,justifyContent:'center',paddingHorizontal:12},inlineSaveText:{color:'#FFFFFF',fontWeight:'700'},
 hero:{borderWidth:1,borderColor:PRIZMA.border,borderRadius:21,backgroundColor:'#FFFFFF',padding:14},heroHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},heroTitle:{fontSize:21,color:PRIZMA.ink,fontWeight:'800'},heroControls:{flexDirection:'row',alignItems:'center',gap:14},heroCount:{color:PRIZMA.purple,fontWeight:'700',fontSize:14},heroHeart:{fontSize:30,color:PRIZMA.purple},heroCaption:{fontSize:12,color:PRIZMA.muted,marginTop:3},heroLook:{height:245,marginTop:9,position:'relative',backgroundColor:'#FFFFFF'},
 collageItem:{position:'absolute',alignItems:'center',justifyContent:'center'},collageImage:{width:'100%',height:'100%'},collagePlaceholder:{borderWidth:1,borderColor:PRIZMA.border,borderRadius:9,padding:5,justifyContent:'center',height:'100%'},collagePlaceholderText:{fontSize:10,color:PRIZMA.muted,textAlign:'center'},heroPending:{minHeight:235,alignItems:'center',justifyContent:'center',gap:12,padding:16},heroLink:{color:PRIZMA.purple,fontWeight:'700'},
 dots:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:2},dot:{height:8,width:8,backgroundColor:'#D8D6DC',borderRadius:4},dotOn:{backgroundColor:PRIZMA.purple},focusLabel:{fontSize:11,color:PRIZMA.muted,textAlign:'center',marginTop:7},carouselArrows:{flexDirection:'row',justifyContent:'space-between',marginTop:5},navArrow:{minHeight:35,justifyContent:'center'},navArrowText:{fontSize:11,color:PRIZMA.purple},tryOnButton:{backgroundColor:PRIZMA.purple,borderRadius:14,minHeight:49,alignItems:'center',justifyContent:'center',marginTop:8},tryOnText:{fontSize:15,color:'#FFFFFF',fontWeight:'700'},
 quickRow:{flexDirection:'row',gap:9,marginTop:14},quickCard:{flex:1,borderWidth:1,borderColor:PRIZMA.border,borderRadius:18,padding:12,backgroundColor:'#FFFFFF',minHeight:155},quickIcon:{fontSize:25,color:PRIZMA.purple},quickTitle:{fontSize:15,fontWeight:'700',color:PRIZMA.ink,marginTop:9},quickInfo:{fontSize:11,color:PRIZMA.muted,marginTop:8},quickTrack:{height:7,borderRadius:5,backgroundColor:'#E7E7E7',marginTop:13,overflow:'hidden'},quickFill:{height:'100%',borderRadius:5,backgroundColor:PRIZMA.purple},categoryRow:{flexDirection:'row',gap:3,marginTop:12},categoryChip:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:PRIZMA.border,borderRadius:20,paddingHorizontal:5,paddingVertical:5,fontSize:10,color:PRIZMA.purple},dayFooter:{flexDirection:'row',justifyContent:'space-between',marginTop:13},footerLink:{fontSize:12,fontWeight:'700',color:PRIZMA.purple},weekSummary:{marginTop:24},

 page:{paddingBottom:38,backgroundColor:'#FFFFFF'}, greeting:{fontSize:24,fontWeight:'700',color:PRIZMA.ink,marginTop:4},sub:{color:PRIZMA.muted,fontSize:13,marginTop:5,marginBottom:18},
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
