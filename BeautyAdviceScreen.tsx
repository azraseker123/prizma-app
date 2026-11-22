import LicensedProductImage from './LicensedProductImage';
import { addRoutineItem, removeRoutineItem, type RoutinePeriod } from './RoutineStore';
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, StyleSheet, Image, Linking, Modal, Keyboard,
} from 'react-native';
import { supabase } from './supabase';

type Props = { userId: string; initialCategory?: 'skin' | 'hair' | 'makeup' };

type Product = {
  name: string;
  brand: string;
  reason: string;
  caution: string;
};

type Advice = {
  introduction: string;
  products: Product[];
  disclaimer: string;
};

export default function BeautyAdviceScreen({ userId, initialCategory = 'skin' }: Props) {
  const [category, setCategory] = useState<'skin' | 'hair' | 'makeup'>(initialCategory);
  const [budget,setBudget]=useState<'Tümü'|'500 TL altı'|'500–1000 TL'|'1000 TL üzeri'>('Tümü');
  const [expandedRecommendation,setExpandedRecommendation]=useState<number|null>(null);
  const [concern, setConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [routinePeriod, setRoutinePeriod] = useState<RoutinePeriod>('Akşam');
  const [routineSaved, setRoutineSaved] = useState<string[]>([]);
  const [routinePicker,setRoutinePicker]=useState<number|null>(null);
  const [licensedPhotos,setLicensedPhotos]=useState<Record<number,{url:string;source:string;license:string}>>({});
  const searchGeneration=useRef(0);
  useEffect(()=>{
    const current=++searchGeneration.current;
    setLicensedPhotos({});
    if(!advice?.products?.length)return;
    const lookup=async()=>{
      const products=advice.products.slice(0,4);
      await Promise.all(products.map(async (product,index)=>{
        try{
          if(!product.brand?.trim()||!product.name?.trim())return;
          const {data,error}=await supabase.functions.invoke('lookup-beauty-image',{body:{name:product.name,brand:product.brand}});
          if(error||!Array.isArray(data?.candidates)||!data.candidates.length)return;
          const image=data.candidates[0];
          if(typeof image?.image!=='string'||!/^https:\/\/images\.openbeautyfacts\.org\//.test(image.image))return;
          if(typeof image?.source_page!=='string'||!image.source_page.startsWith('https://world.openbeautyfacts.org/product/'))return;
          if(searchGeneration.current===current)setLicensedPhotos(old=>({...old,[index]:{url:image.image,source:image.source_page,license:image.license_name||'Open Beauty Facts CC BY-SA'}}));
        }catch{}
      }));
    };void lookup();
    return ()=>{searchGeneration.current++;};
  },[advice]);

  const analyze = async () => {
    if (loading) return;

    if (!concern.trim()) {
      setMessage('Önce neye ihtiyacın olduğunu yaz.');
      return;
    }

    setLoading(true);
    setMessage('');
    setAdvice(null);
    setSaved([]);
    setRoutineSaved([]);

    try {
      const { data, error } = await supabase.functions.invoke(
        'beauty-advisor',
        { body: { category, concern: [concern.trim(),budget!=='Tümü'?'Bütçem: '+budget:''].filter(Boolean).join('. ') } }
      );

      if (error) {
        const response = (error as any).context;
        let serverMessage = '';

        if (response && typeof response.json === 'function') {
          try {
            const details = await response.json();
            serverMessage = details?.error || '';
          } catch {}
        }

        throw new Error(serverMessage || 'AI önerileri alınamadı.');
      }

      if (
        !data ||
        typeof data.introduction !== 'string' ||
        !Array.isArray(data.products)
      ) {
        throw new Error('Beklenmeyen bir AI yanıtı alındı.');
      }

      setAdvice(data as Advice);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Bir sorun oluştu. Tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveProduct = async (product: Product, index: number) => {
    const key = String(index);
    if (saving !== null || saved.includes(key)) return;

    setSaving(key);
    setMessage('');

    try {
      const { error } = await supabase.from('beauty_collection').insert({
        user_id: userId,
        category,
        product_name: product.name,
        brand: product.brand,
        status: 'considering',
        source: 'ai',
        notes: product.reason,
      });

      if (error) throw error;

      setSaved((previous) => [...previous, key]);
      setMessage('✓ Ürün Bakım Koleksiyonum bölümüne kaydedildi.');
    } catch {
      setMessage('Ürün kaydedilemedi. Tekrar deneyebilirsin.');
    } finally {
      setSaving(null);
    }
  };

  const saveToRoutine=async(product:Product,index:number,chosen:RoutinePeriod|'Her İkisi')=>{
    if(saving!==null)return;
    const periods:RoutinePeriod[]=chosen==='Her İkisi'?['Sabah','Akşam']:[chosen];
    const missing=periods.filter(p=>!routineSaved.includes(index+':'+p));
    if(!missing.length){setRoutinePicker(null);return;}
    setSaving(String(index));setMessage('');
    const created:string[]=[];
    try{
      for(const period of missing){
        const result=await addRoutineItem(userId,{title:(product.brand?product.brand+' — ':'')+product.name,
          period,category,source:'ai-suggestion',note:product.caution});
        created.push(result.id);
      }
      setRoutineSaved(old=>[...old,...missing.map(p=>index+':'+p)]);
      setRoutinePicker(null);setMessage('✓ Ürün seçtiğin rutinine eklendi.');
    }catch{
      for(const id of created)await removeRoutineItem(userId,id).catch(()=>{});
      setMessage('Rutine eklenemedi. Tekrar deneyebilirsin.');
    }finally{setSaving(null);}
  };

  const needs = category==='skin'?
    ['Nemlendirme','Sivilce & Komedon','Güneş Koruması','Hassasiyet','Cilt Bariyeri','Leke Görünümü']:
    category==='hair'?['Nemlendirme','Saç Derisi','Yıpranma','Bukle Belirginliği','Hacim','Isı Koruması']:
    ['Günlük Makyaj','Ten Ürünleri','Dudak','Göz Makyajı','Kalıcılık','Doğal Görünüm'];
  return <><ScrollView style={{backgroundColor:'#FFFFFF'}} contentContainerStyle={v.content} keyboardShouldPersistTaps="handled">
    <Text style={v.title}>Güzellik Danışmanı</Text>
    <Text style={v.subtitle}>Cilt, saç ve makyaj ihtiyaçların için sana özel öneriler.</Text>
    <View style={v.categoryGrid}>
      {([['skin','▤','Cilt Bakımı'],['hair','〰','Saç Bakımı'],['makeup','▰','Makyaj']] as const).map(([key,icon,label])=>
      <TouchableOpacity key={key} style={[v.categoryTile,category===key&&v.categoryTileActive]} onPress={()=>{setCategory(key);setConcern('');setAdvice(null);}} accessibilityRole="tab" accessibilityState={{selected:category===key}}>
       <Text style={v.categoryIcon}>{icon}</Text><Text style={[v.categoryLabel,category===key&&v.categoryLabelActive]}>{label}</Text>
      </TouchableOpacity>)}
    </View>
    <View style={v.profileCard}>
      <Text style={v.profileIcon}>◯</Text>
      <View style={{flex:1}}><Text style={v.profileTitle}>Güzellik Profilin</Text><Text style={v.profileDescription}>İhtiyaçlarına göre rehberli öneriler keşfet.</Text></View>
    </View>
    {!advice&&<>
      <Text style={v.sectionTitle}>Bugün neye ihtiyacın var?</Text>
      <Text style={v.smallCaption}>Bir konu seç veya kendi ihtiyacını anlat.</Text>
      <View style={v.needWrap}>{needs.map(need=><TouchableOpacity key={need} style={[v.needChip,concern===need&&v.needChipSelected]} onPress={()=>setConcern(need)}>
        <Text style={[v.needText,concern===need&&v.needTextSelected]}>{need}</Text>
      </TouchableOpacity>)}</View>
      <Text style={v.sectionTitle}>Bütçe Tercihin</Text>
      <View style={v.needWrap}>{(['Tümü','500 TL altı','500–1000 TL','1000 TL üzeri'] as const).map(value=><TouchableOpacity key={value} onPress={()=>setBudget(value)} style={[v.needChip,budget===value&&v.needChipSelected]}><Text style={[v.needText,budget===value&&v.needTextSelected]}>{value}</Text></TouchableOpacity>)}</View>
      <TextInput value={concern} onChangeText={setConcern} multiline maxLength={300} style={v.input} placeholder="İhtiyacını biraz daha anlatabilirsin..." placeholderTextColor="#8B858E"/>
      <TouchableOpacity onPress={()=>{void analyze();}} disabled={loading||!concern.trim()} style={v.primary}>{loading?<ActivityIndicator color="#FFFFFF"/>:<Text style={v.primaryText}>PRİZMA AI ile Önerilerimi Bul</Text>}</TouchableOpacity>
    </>}
    {!!message&&<Text style={v.feedback}>{message}</Text>}
    {advice&&<View>
      <View style={v.resultHeading}><Text style={v.sectionTitle}>Bugün Sana Önerilerim</Text><TouchableOpacity onPress={()=>{setAdvice(null);}}><Text style={v.link}>Yeni Arama ›</Text></TouchableOpacity></View>
      <Text style={v.smallCaption} numberOfLines={3}>{advice.introduction.split(/Bu bir tıbbi|Satın almadan önce|İçerik listesini/i)[0].trim()}</Text>
      {advice.products.map((p,i)=><View key={p.name+i} style={v.productCard}>
        <View style={v.productLine}><View style={v.compactProductImage}>{licensedPhotos[i]?<TouchableOpacity onPress={()=>{void Linking.openURL(licensedPhotos[i].source);}}><Image source={{uri:licensedPhotos[i].url}} style={v.licensedImage} resizeMode="contain"/><Text style={v.photoCredit}>Kaynak: Open Beauty Facts</Text></TouchableOpacity>:<LicensedProductImage alt={p.name} height={90}/>}</View>
          <View style={{flex:2}}><Text style={v.productBrand}>{p.brand}</Text><Text style={v.productName}>{p.name}</Text><Text style={v.productReason} numberOfLines={3}>{p.reason}</Text></View>
        </View>
        <View style={v.productActions}>
          <TouchableOpacity style={v.outline} disabled={saving!==null||saved.includes(String(i))} onPress={()=>{void saveProduct(p,i);}}><Text style={v.outlineText}>{saved.includes(String(i))?'✓ Koleksiyonda':'Koleksiyona Ekle'}</Text></TouchableOpacity>
          <TouchableOpacity style={v.fill} disabled={saving!==null} onPress={()=>setRoutinePicker(i)}><Text style={v.fillText}>Rutine Ekle</Text></TouchableOpacity>
        </View>

        <TouchableOpacity onPress={()=>setExpandedRecommendation(expandedRecommendation===i?null:i)} style={v.accordion}><Text style={v.accordionText}>Neden önerildi? {expandedRecommendation===i?'⌃':'⌄'}</Text></TouchableOpacity>
        {expandedRecommendation===i&&<View style={v.expanded}><Text style={v.productReason}>{p.reason}</Text><Text style={v.caution}>Dikkat: {p.caution}</Text></View>}
      </View>)}
      <Text style={v.disclaimer}>ⓘ AI hata yapabilir. Ürün içeriklerini, kullanım talimatlarını ve kişisel uyumluluğunu kontrol et.</Text>
    </View>}
  </ScrollView>
  <Modal visible={routinePicker!==null} transparent animationType="slide" onRequestClose={()=>setRoutinePicker(null)}><View style={v.sheetOverlay}><View style={v.sheet}>
  <Text style={v.sheetTitle}>Hangi rutinine ekleyelim?</Text>
  <Text style={v.smallCaption}>Ürünün kullanım talimatlarını kontrol et.</Text>
  {(['Sabah','Akşam','Her İkisi'] as const).map(period=><TouchableOpacity key={period} style={v.sheetOption} disabled={saving!==null} onPress={()=>{const index=routinePicker;if(index!==null&&advice?.products[index])void saveToRoutine(advice.products[index],index,period);}}><Text style={v.sheetOptionLabel}>{period}</Text><Text style={v.sheetOptionArrow}>›</Text></TouchableOpacity>)}
  <TouchableOpacity style={v.sheetCancel} onPress={()=>setRoutinePicker(null)}><Text style={v.sheetCancelText}>Vazgeç</Text></TouchableOpacity>
  </View></View></Modal></>;
}

const styles = StyleSheet.create({
  categoryRow: {
    flexDirection: 'row', gap: 8, marginBottom: 22,
  },
  categoryButton: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#FFFFFF', alignItems: 'center',
  },
  categorySelected: {
    backgroundColor: '#805C9F',
  },
  categoryText: {
    color: '#6F6479', fontWeight: '700', fontSize: 14,
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 45 },
  eyebrow: {
    fontSize: 11, letterSpacing: 2,
    color: '#805C9F', fontWeight: '700', marginBottom: 9,
  },
  title: {
    fontSize: 26, fontWeight: '800',
    color: '#352943', marginBottom: 12,
  },
  description: {
    fontSize: 14, lineHeight: 22,
    color: '#6F6479', marginBottom: 18,
  },
  label: {
    fontSize: 14, fontWeight: '700',
    color: '#352943', marginBottom: 9,
  },
  input: {
    minHeight: 105, borderWidth: 1,
    borderColor: '#D8D6DC', borderRadius: 16,
    padding: 14, textAlignVertical: 'top',
    color: '#352943', fontSize: 14,
    backgroundColor: '#FFFFFF', marginBottom: 14,
  },
  button: {
    backgroundColor: '#805C9F',
    borderRadius: 15, padding: 16, alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  message: {
    color: '#73549A', fontSize: 13,
    lineHeight: 20, marginTop: 14,
  },
  results: { marginTop: 26 },
  sectionTitle: {
    fontSize: 20, fontWeight: '800',
    color: '#352943', marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18, padding: 18,
    marginBottom: 14, borderWidth: 1,
    borderColor: '#F3EAF8',
  },
  brand: {
    fontSize: 12, color: '#805C9F',
    fontWeight: '700', marginBottom: 5,
  },
  productName: {
    fontSize: 18, fontWeight: '800',
    color: '#352943', marginBottom: 14,
  },
  cardLabel: {
    fontSize: 13, fontWeight: '700',
    color: '#493957', marginBottom: 5,
  },
  cardText: {
    fontSize: 13, lineHeight: 20,
    color: '#6F6479', marginBottom: 13,
  },
  saveButton: {
    backgroundColor: '#805C9F',
    borderRadius: 12, padding: 13,
    alignItems: 'center', marginTop: 4,
  },
  savedButton: { backgroundColor: '#9A8BA9' },
  saveButtonText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '700',
  },
  periodRow: { flexDirection: 'row', gap: 7, marginTop: 11, marginBottom: 8 },
  periodChip: { borderRadius: 100, backgroundColor: '#F0E6F6', paddingVertical: 7, paddingHorizontal: 15 },
  periodChipSelected: { backgroundColor: '#79559A' },
  periodText: { color: '#5F4C6F', fontWeight: '700', fontSize: 12 },
  periodTextSelected: { color: '#FFFFFF' },
  routineButton: { borderWidth: 1, borderColor: '#AF8AC6', borderRadius: 12, padding: 12, alignItems: 'center' },
  routineButtonText: { color: '#785397', fontSize: 13, fontWeight: '800' },
  disclaimer: {
    fontSize: 12, lineHeight: 19,
    color: '#82778C', marginTop: 12,
  },
});

const v=StyleSheet.create({
 compactProductImage:{height:115,width:120,alignItems:'center',justifyContent:'center'},licensedImage:{width:112,height:92},photoCredit:{fontSize:8,color:'#6E6872',textAlign:'center',marginTop:3},
 sheetOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(36,33,36,.35)'},sheet:{backgroundColor:'#FFFFFF',borderTopLeftRadius:22,borderTopRightRadius:22,padding:20,paddingBottom:32},sheetTitle:{fontSize:18,fontWeight:'700',color:'#242124',marginBottom:9},sheetOption:{minHeight:50,borderWidth:1,borderColor:'#D8D6DC',borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:15,marginTop:9},sheetOptionLabel:{fontSize:14,color:'#69318A',fontWeight:'700'},sheetOptionArrow:{fontSize:23,color:'#69318A'},sheetCancel:{minHeight:48,alignItems:'center',justifyContent:'center'},sheetCancelText:{fontSize:13,color:'#6E6872'},

 content:{paddingHorizontal:15,paddingBottom:45,backgroundColor:'#FFFFFF'},
 title:{fontSize:23,fontWeight:'800',color:'#242124',textAlign:'center',marginTop:11},
 subtitle:{textAlign:'center',fontSize:13,color:'#6E6872',lineHeight:20,marginTop:8,marginBottom:18},
 categoryGrid:{flexDirection:'row',gap:9},
 categoryTile:{flex:1,borderWidth:1,borderColor:'#D8D6DC',borderRadius:16,minHeight:105,justifyContent:'center',alignItems:'center',gap:8,backgroundColor:'#FFFFFF'},
 categoryTileActive:{borderColor:'#69318A'},
 categoryIcon:{fontSize:31,color:'#69318A'},categoryLabel:{fontSize:12,color:'#242124'},categoryLabelActive:{fontWeight:'700',color:'#69318A'},
 profileCard:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:11,marginTop:16,minHeight:87},
 profileIcon:{fontSize:30,color:'#69318A'},profileTitle:{color:'#242124',fontWeight:'700',fontSize:15},profileDescription:{fontSize:12,color:'#6E6872',marginTop:6},
 sectionTitle:{fontSize:17,fontWeight:'700',color:'#242124',marginTop:20,marginBottom:9},smallCaption:{fontSize:12,color:'#6E6872',marginBottom:10,lineHeight:18},
 needWrap:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:14},needChip:{borderRadius:19,borderWidth:1,borderColor:'#D8D6DC',paddingHorizontal:13,minHeight:40,justifyContent:'center'},needChipSelected:{backgroundColor:'#69318A',borderColor:'#69318A'},
 needText:{fontSize:12,color:'#69318A'},needTextSelected:{fontWeight:'700',color:'#FFFFFF'},input:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:14,padding:12,minHeight:68,marginTop:6,fontSize:13,color:'#242124'},
 primary:{minHeight:52,backgroundColor:'#69318A',borderRadius:15,alignItems:'center',justifyContent:'center',marginTop:15},primaryText:{fontSize:14,color:'#FFFFFF',fontWeight:'700'},feedback:{fontSize:12,color:'#69318A',marginTop:10},
 resultHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},link:{color:'#69318A',fontSize:12,fontWeight:'700'},
 productCard:{borderWidth:1,borderColor:'#D8D6DC',borderRadius:16,padding:12,marginTop:12},
 productLine:{flexDirection:'row',alignItems:'center',gap:12},productBrand:{fontSize:12,color:'#6E6872'},productName:{fontSize:15,color:'#242124',fontWeight:'700',marginTop:4},productReason:{fontSize:12,color:'#6E6872',lineHeight:18,marginTop:6},
 productActions:{flexDirection:'row',gap:8,marginTop:13},outline:{flex:1,minHeight:44,borderWidth:1,borderColor:'#69318A',borderRadius:12,alignItems:'center',justifyContent:'center'},outlineText:{color:'#69318A',fontWeight:'700',fontSize:12},
 fill:{flex:1,minHeight:44,backgroundColor:'#69318A',borderRadius:12,alignItems:'center',justifyContent:'center'},fillText:{color:'#FFFFFF',fontSize:12,fontWeight:'700'},
 periodRow:{flexDirection:'row',gap:8,marginTop:8},periodButton:{borderWidth:1,borderColor:'#D8D6DC',minHeight:37,borderRadius:11,paddingHorizontal:15,justifyContent:'center'},periodButtonSelected:{borderColor:'#69318A'},periodText:{fontSize:11,color:'#69318A'},
 accordion:{marginTop:12,minHeight:45,borderWidth:1,borderColor:'#D8D6DC',borderRadius:11,justifyContent:'center',paddingHorizontal:11},accordionText:{color:'#242124',fontWeight:'700',fontSize:12},expanded:{padding:12},caution:{fontSize:11,color:'#6E6872',marginTop:8},
 disclaimer:{fontSize:11,color:'#6E6872',lineHeight:17,marginTop:16}
});
