import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';
import { PRIZMA_COLORS as C } from './theme';

export type PrizmaPage =
  | 'Ana Sayfa' | 'Gardırop' | 'Stil Stüdyosu' | 'Kombin Oluştur' | 'PRİZMA AI' | 'Sanal Deneme'
  | 'Güzellik' | 'Cilt Danışmanı' | 'Bakım Rutini' | 'Bakım Koleksiyonum'
  | 'Cilt Analizi' | 'Alışveriş' | 'Profil' | 'Deneme Fotoğrafım';

type Go = (page: PrizmaPage) => void;
type Item = { id:string; name:string; category:string; image_path:string; url:string|null };
type Common = { userId:string; onOpen:Go; onSoon:()=>void };
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

function useWardrobePreview(userId:string) {
 const [items,setItems]=useState<Item[]>([]);
 const [count,setCount]=useState<number|null>(null);
 const [busy,setBusy]=useState(true);
 const load=useCallback(async()=>{
  setBusy(true);
  try {
   const {data,error,count:all}=await supabase.from('wardrobe_items')
     .select('id,name,category,image_path',{count:'exact'}).eq('user_id',userId)
     .order('created_at',{ascending:false}).limit(10);
   if(error)throw error;
   setCount(all??0);
   const previews=await Promise.all((data??[]).map(async entry=>{
    const {data:photo}=await supabase.storage.from('wardrobe').createSignedUrl(entry.image_path,1800);
    return {...entry,url:photo?.signedUrl??null} as Item;
   }));
   setItems(previews);
  }catch {setCount(null);setItems([]);}
  finally{setBusy(false);}
 },[userId]);
 useEffect(()=>{void load();},[load]);
 return {items,count,busy,reload:load};
}

function Headline({eyebrow,title,subtitle}:{eyebrow?:string;title:string;subtitle?:string}) {
 return <View style={ui.heading}>
  {eyebrow?<Text style={ui.eyebrow}>{eyebrow}</Text>:null}
  <Text style={ui.title}>{title}</Text>
  {subtitle?<Text style={ui.subtitle}>{subtitle}</Text>:null}
 </View>;
}
function Section({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}) {
 return <View style={ui.sectionHeading}><Text style={ui.sectionTitle}>{title}</Text>{action?<TouchableOpacity accessibilityRole="button" onPress={onAction}><Text style={ui.sectionAction}>{action}  ›</Text></TouchableOpacity>:null}</View>;
}
function IconTile({icon,label,onPress}:{icon:string;label:string;onPress:()=>void}) {
 return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={ui.iconTile}>
  <Text style={ui.tileIcon}>{icon}</Text><Text style={ui.tileLabel}>{label}</Text>
 </TouchableOpacity>;
}
function TextRow({symbol,title,description,onPress}:{symbol:string;title:string;description?:string;onPress:()=>void}) {
 return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={ui.textRow}>
  <View style={ui.rowIcon}><Text style={ui.rowIconText}>{symbol}</Text></View>
  <View style={{flex:1}}><Text style={ui.rowTitle}>{title}</Text>{description?<Text style={ui.rowDescription}>{description}</Text>:null}</View>
  <Text style={ui.chevron}>›</Text>
 </TouchableOpacity>;
}
function Garment({item,width=95}:{item:Item;width?:number}) {
 return <View style={{width}}>
  <View style={ui.photoBox}>{item.url?<Image source={{uri:item.url}} style={ui.photo} resizeMode="contain"/>:<Text style={ui.fallbackGarment}>▤</Text>}</View>
  <Text numberOfLines={1} style={ui.photoLabel}>{item.name}</Text>
 </View>;
}
function EmptyGarment({label}:{label:string}) {
 return <View style={ui.emptyGarment}><Text style={ui.emptyIcon}>♧</Text><Text style={ui.emptyText}>{label}</Text></View>;
}

export function PrizmaHome({userId,onOpen,onSoon,displayName}:{displayName?:string}&Common){
 const {items,count,busy}=useWardrobePreview(userId);
 const today=new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long'});
 const hour=new Date().getHours();
 const salutation=hour<11?'Günaydın':hour<18?'Merhaba':'İyi akşamlar';
 return <View style={ui.page}>
  <View style={ui.homeGreeting}>
   <View style={{flex:1}}><Text style={ui.homeWelcome}>{salutation}{displayName?', '+displayName:''}</Text>
    <Text style={ui.homeWelcomeSubtitle}>Bugün stiline nasıl yön vermek istersin?</Text></View>
   <Text style={ui.homeDate}>{today}</Text>
  </View>
  <View style={ui.homeAgenda}>
   <View style={ui.agendaCalendar}><Text style={ui.agendaDay}>{new Date().getDate()}</Text><Text style={ui.agendaMonth}>{new Date().toLocaleDateString('tr-TR',{month:'short'}).toLocaleUpperCase('tr-TR')}</Text></View>
   <View style={{flex:1}}><Text style={ui.agendaTitle}>Bugün senin günün</Text><Text style={ui.agendaSubtitle}>Stil önerilerini keşfet, gardırobunu düzenle.</Text></View>
  </View>
  <Section title="Bugün ne yapmak istersin?"/>
  <View style={ui.homeActionGrid}>
   <TouchableOpacity style={ui.homeActionPrimary} onPress={()=>onOpen('Kombin Oluştur')} accessibilityRole="button">
    <Text style={ui.homeActionOverline}>GARDIROBUNDAN</Text>
    <Text style={ui.homeActionPrimaryTitle}>Kombin oluştur</Text>
    <Text style={ui.homeActionPrimaryArrow}>→</Text>
   </TouchableOpacity>
   <TouchableOpacity style={ui.homeActionSecondary} onPress={()=>onOpen('Sanal Deneme')} accessibilityRole="button">
    <Text style={ui.homeActionOverline}>KIYAFETİNİ GÖR</Text>
    <Text style={ui.homeActionSecondaryTitle}>Sanal deneme</Text>
    <Text style={ui.homeActionSecondaryArrow}>→</Text>
   </TouchableOpacity>
  </View>
  <View style={ui.homeTextActions}>
   <TouchableOpacity style={ui.homeTextAction} onPress={()=>onOpen('Gardırop')} accessibilityRole="button"><Text style={ui.homeTextActionLabel}>Gardırobum  ›</Text></TouchableOpacity>
   <TouchableOpacity style={ui.homeTextAction} onPress={()=>onOpen('Güzellik')} accessibilityRole="button"><Text style={ui.homeTextActionLabel}>Güzellik & bakım  ›</Text></TouchableOpacity>
  </View>
  <Section title="Bugün senin için" action="Gardırobuma git" onAction={()=>onOpen('Gardırop')}/>
  <TouchableOpacity style={ui.todaySuggestion} onPress={()=>onOpen('Gardırop')}>
   <View style={ui.suggestionImages}>
    {busy?<ActivityIndicator color={C.lavender}/>:items.length?items.slice(0,3).map(item=>
     <View key={item.id} style={ui.suggestionImage}>{item.url?<Image source={{uri:item.url}} style={ui.photo} resizeMode="contain"/>:<Text style={ui.fallbackGarment}>▤</Text>}</View>
    ):<View style={ui.suggestionPlaceholder}><Text style={ui.suggestionPlaceholderIcon}>♧</Text></View>}
   </View>
   <View style={{flex:1}}><Text style={ui.todaySuggestionTitle}>{items.length?'Parçalarınla yeni bir görünüm oluştur':'İlk kıyafetini ekle'}</Text>
    <Text style={ui.todaySuggestionSub}>{items.length?count+' parçalık gardırobundan kombin oluştur':'Kişisel stil koleksiyonunu oluşturmaya başla'}</Text></View>
   <Text style={ui.todayArrow}>→</Text>
  </TouchableOpacity>
  <Section title="Kişisel asistanın"/>
  <TouchableOpacity style={ui.homeChatRow} onPress={()=>onOpen('PRİZMA AI')} accessibilityRole="button">
   <Text style={ui.homeChatIcon}>•••</Text>
   <View style={{flex:1}}><Text style={ui.homeChatTitle}>PRİZMA AI'ya sor</Text><Text style={ui.homeChatSubtitle}>Stil, bakım ve alışveriş sorularında yanında.</Text></View>
   <Text style={ui.homeChatArrow}>→</Text>
  </TouchableOpacity>
  <TouchableOpacity style={ui.homeStudioLink} onPress={()=>onOpen('Stil Stüdyosu')}>
   <Text style={ui.homeStudioLinkText}>Stil Stüdyosu'nu keşfet</Text><Text style={ui.homeStudioLinkText}>›</Text>
  </TouchableOpacity>
 </View>;
}

export function PrizmaStudio({userId,onOpen,onSoon}:Common){
 const {items,count,busy,reload}=useWardrobePreview(userId);
 return <View style={ui.page}>
  <Headline title="Stil Stüdyosu" subtitle="Gardırobunu yönet, kendi kombinlerini oluştur ve üzerinde dene."/>
  <View style={ui.stats}>
   <View style={{flex:1}}><Text style={ui.statCaption}>GARDIROBUNDA</Text><Text style={ui.statBig}>{count===null?'—':count} <Text style={ui.statUnit}>parça</Text></Text></View>
   <View style={ui.statsDivider}/>
   <TouchableOpacity onPress={()=>onOpen('Gardırop')} style={{flex:1,paddingLeft:15}}><Text style={ui.statCaption}>DİJİTAL DOLABIN</Text><Text style={ui.statLink}>Parçaları keşfet  ›</Text></TouchableOpacity>
  </View>
  <Section title="Öne çıkan parçaların" action="Tümünü gör" onAction={()=>onOpen('Gardırop')}/>
  {busy?<ActivityIndicator color={C.lavender}/>:items.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9,paddingBottom:8}}>{items.map(x=><TouchableOpacity key={x.id} onPress={()=>onOpen('Gardırop')}><Garment item={x}/></TouchableOpacity>)}</ScrollView>:<TouchableOpacity onPress={()=>onOpen('Gardırop')}><EmptyGarment label="Gardırobun boş. İlk parçanı ekle →"/></TouchableOpacity>}
  <TouchableOpacity style={ui.primaryCTA} onPress={()=>onOpen('Kombin Oluştur')}><Text style={ui.primaryCTAText}>Kombin oluştur</Text><Text style={ui.primaryCTAText}>→</Text></TouchableOpacity>
  <TouchableOpacity style={ui.studioFeature} onPress={()=>onOpen('Sanal Deneme')}>
   <View style={ui.studioFeatureIcon}><Text style={{fontSize:31,color:C.navy}}>▣</Text></View>
   <View style={{flex:1}}><Text style={ui.rowTitle}>Sanal Deneme</Text><Text style={ui.rowDescription}>Kendi fotoğrafında kıyafetleri gör</Text></View>
   <Text style={ui.chevron}>›</Text>
  </TouchableOpacity>
  <Section title="Stil araçların"/>
  <TextRow symbol="▤" title="Kombin önerileri" description="Gardırobundaki parçalarla yeni fikirler" onPress={()=>onOpen('Kombin Oluştur')}/>
  <TextRow symbol="▢" title="Alışveriş kararı" description="Bir ürün almadan önce değerlendir" onPress={()=>onOpen('Alışveriş')}/>
  <TextRow symbol="◉" title="PRİZMA AI sohbet" description="Moda ve güzellik üzerine konuş" onPress={()=>onOpen('PRİZMA AI')}/>
  <View style={ui.plannedRow}><Text style={ui.plannedTitle}>Valiz AI ve Stil Takvimi</Text><Text style={ui.plannedTag}>YAKINDA</Text></View>
  <Text style={ui.footnote}>Yeni özellikler hazır olduğunda buradan ulaşabileceksin.</Text>
 </View>;
}

export function PrizmaBeauty({onOpen,onBeautyCategory}:{onOpen:Go;onBeautyCategory:(v:'skin'|'hair'|'makeup')=>void}){
 const [category,setCategory]=useState<'Cilt'|'Saç'|'Makyaj'|'Bakım'>('Cilt');
 const selection=category==='Cilt'?'skin':category==='Saç'?'hair':'makeup';
 const details={
   Cilt:{title:'Cildine özel bakım',sub:'Cilt tipini keşfet, ürünlerini ve günlük bakımını düzenle.',cta:'Cildim için ürün önerisi al'},
   Saç:{title:'Saç bakımını keşfet',sub:'Saç ihtiyaçlarına uygun önerileri ve kullandığın ürünleri keşfet.',cta:'Saçım için ürün önerisi al'},
   Makyaj:{title:'Makyajını kişiselleştir',sub:'Tarzına uygun ürünleri ve makyaj tercihlerini bir arada tut.',cta:'Makyaj ürünü önerisi al'},
   Bakım:{title:'Rutinin, senin ritmin',sub:'Sabah ve akşam bakım adımlarını kolayca yönet.',cta:'Rutinimi görüntüle'},
 }[category];
 const openAdvice=()=>{
  onBeautyCategory(selection==='skin'?'skin':selection==='hair'?'hair':'makeup');
  onOpen('Cilt Danışmanı');
 };
 return <View style={ui.page}>
  <Headline title="Güzellik" subtitle="Cilt, saç ve bakım dünyan bir arada."/>
  <View style={ui.chips}>
   {(['Cilt','Saç','Makyaj','Bakım'] as const).map(v=>
    <TouchableOpacity key={v} onPress={()=>setCategory(v)} accessibilityRole="tab"
     accessibilityState={{selected:category===v}} style={[ui.chip,category===v&&ui.chipActive]}>
     <Text style={[ui.chipLabel,category===v&&ui.chipLabelActive]}>{v}</Text>
    </TouchableOpacity>)}
  </View>
  <View style={ui.beautyFocus}>
   <View style={ui.beautyFocusTop}>
    <View style={ui.beautyFocusIllustration}>
     <Text style={ui.beautyFocusIcon}>{category==='Cilt'?'◉':category==='Saç'?'≈':category==='Makyaj'?'◌':'☼'}</Text>
    </View>
    <View style={{flex:1}}>
     <Text style={ui.beautyFocusEyebrow}>{category.toLocaleUpperCase('tr-TR')} · PRİZMA</Text>
     <Text style={ui.beautyFocusTitle}>{details.title}</Text>
     <Text style={ui.beautyFocusDescription}>{details.sub}</Text>
    </View>
   </View>
   <TouchableOpacity style={ui.beautyFocusButton} onPress={()=>category==='Bakım'?onOpen('Bakım Rutini'):openAdvice()}>
    <Text style={ui.beautyFocusButtonText}>{details.cta}</Text><Text style={ui.beautyFocusButtonArrow}>→</Text>
   </TouchableOpacity>
  </View>
  <Section title="Hemen ulaş"/>
  <View style={ui.beautyQuickGrid}>
   <TouchableOpacity style={ui.beautyQuick} onPress={()=>onOpen('Bakım Rutini')}>
    <Text style={ui.beautyQuickTitle}>Rutinlerim</Text><Text style={ui.beautyQuickSub}>Sabah & akşam</Text>
   </TouchableOpacity>
   <TouchableOpacity style={ui.beautyQuick} onPress={openAdvice}>
    <Text style={ui.beautyQuickTitle}>AI ürün önerisi</Text><Text style={ui.beautyQuickSub}>Cilt, saç, makyaj</Text>
   </TouchableOpacity>
  </View>
  <Section title="Bakım alanım"/>
  <TextRow symbol="☼" title="Bakım rutinim" description="Ürünlerini sabah ve akşam düzenle" onPress={()=>onOpen('Bakım Rutini')}/>
  <TextRow symbol="▤" title="Ürün koleksiyonum" description="Kaydettiğin güzellik ürünleri" onPress={()=>onOpen('Bakım Koleksiyonum')}/>
  <TextRow symbol="◉" title="Cilt analizi" description="Cilt tipini tanı, önerileri incele" onPress={()=>onOpen('Cilt Analizi')}/>
  <Text style={ui.footnote}>AI önerilerini kullanmadan önce ürün talimatlarını kontrol et.</Text>
 </View>;
}

export function PrizmaProfile({email,onOpen,onEdit,onLogout,onSoon}:{
 email:string;onOpen:Go;onEdit:()=>void;onLogout:()=>void;onSoon:()=>void;
}){
 const initial=(email.trim().charAt(0)||'P').toLocaleUpperCase('tr-TR');
 return <View style={ui.page}>
  <Headline title="Profilim"/>
  <View style={ui.profileHero}>
   <View style={ui.avatar}><Text style={ui.avatarInitial}>{initial}</Text></View>
   <View style={{flex:1}}><Text style={ui.profileName}>{email.split('@')[0]||'PRİZMA'}</Text>
    <Text style={ui.profileEmail} numberOfLines={1}>{email}</Text>
    <TouchableOpacity onPress={onEdit}><Text style={ui.signatureLink}>PRİZMA İmzam  ›</Text></TouchableOpacity>
   </View>
  </View>
  <Section title="Kişisel alanım"/>
  <TextRow symbol="◯" title="PRİZMA İmzam" description="Stil, cilt ve renk tercihlerini düzenle" onPress={onEdit}/>
  <TextRow symbol="♧" title="Gardırobum ve kombinlerim" onPress={()=>onOpen('Gardırop')}/>
  <TextRow symbol="▣" title="Denemelerim ve kullanım geçmişim" onPress={()=>onOpen('Sanal Deneme')}/>
  <TextRow symbol="▤" title="Ürün koleksiyonum" onPress={()=>onOpen('Bakım Koleksiyonum')}/>
  <Section title="Hesabım"/>
  <TextRow symbol="♕" title="PRİZMA Premium" description="Abonelik sistemi hazırlanıyor" onPress={onSoon}/>
  <TextRow symbol="▢" title="Sanal deneme fotoğrafım" onPress={()=>onOpen('Deneme Fotoğrafım')}/>
  <TextRow symbol="⚙" title="Gizlilik ve ayarlar" description="Hesap ayarları bölümü hazırlanıyor" onPress={onSoon}/>
  <TextRow symbol="?" title="Yardım ve destek" description="Destek merkezi hazırlanıyor" onPress={onSoon}/>
  <TouchableOpacity style={ui.logout} onPress={onLogout}><Text style={ui.logoutLabel}>Çıkış yap  →</Text></TouchableOpacity>
 </View>;
}

const ui=StyleSheet.create({
 page:{paddingTop:4,paddingBottom:30},
 homeActionGrid:{flexDirection:'row',gap:9},
 homeActionPrimary:{backgroundColor:'#51206F',borderRadius:17,padding:16,flex:1,minHeight:112,justifyContent:'space-between'},
 homeActionSecondary:{backgroundColor:'#F2E5F7',borderRadius:17,padding:16,flex:1,minHeight:112,justifyContent:'space-between',borderWidth:1,borderColor:'#E5D4EF'},
 homeActionOverline:{fontSize:9,fontWeight:'800',letterSpacing:0.8,color:'#B594C6'},
 homeActionPrimaryTitle:{fontSize:16,fontWeight:'800',color:'#FFFFFF',marginTop:7},
 homeActionPrimaryArrow:{fontSize:22,color:'#FFFFFF',alignSelf:'flex-end'},
 homeActionSecondaryTitle:{fontSize:16,fontWeight:'800',color:'#391947',marginTop:7},
 homeActionSecondaryArrow:{fontSize:22,color:'#51206F',alignSelf:'flex-end'},
 homeTextActions:{flexDirection:'row',gap:9,marginTop:9},
 homeTextAction:{flex:1,paddingVertical:12,paddingHorizontal:13,backgroundColor:'#FFFFFF',borderRadius:11,borderWidth:1,borderColor:'#EBE1F0'},
 homeTextActionLabel:{fontSize:12,fontWeight:'800',color:'#49205F'},
 homeChatRow:{flexDirection:'row',alignItems:'center',padding:14,borderRadius:16,borderWidth:1,borderColor:'#E4D8EC',gap:10,backgroundColor:'#FFF'},
 homeChatIcon:{fontSize:17,color:'#5F2C7E',backgroundColor:'#F2E9F7',overflow:'hidden',paddingHorizontal:11,paddingVertical:7,borderRadius:12,fontWeight:'800'},
 homeChatTitle:{fontSize:14,color:C.navy,fontWeight:'800'},
 homeChatSubtitle:{fontSize:11,color:'#776680',marginTop:4},
 homeChatArrow:{fontSize:21,color:'#5F2C7E'},
 homeStudioLink:{flexDirection:'row',justifyContent:'space-between',marginTop:15,paddingHorizontal:4,paddingVertical:6},
 homeStudioLinkText:{fontSize:13,color:'#5E2B7D',fontWeight:'800'},
 beautyFocus:{backgroundColor:'#F3EAF8',borderRadius:19,padding:16},
 beautyFocusTop:{flexDirection:'row',gap:13,alignItems:'center'},
 beautyFocusIllustration:{width:80,height:108,borderRadius:14,backgroundColor:'#E6D4EE',justifyContent:'center',alignItems:'center'},
 beautyFocusIcon:{fontSize:39,color:'#66347A'},
 beautyFocusEyebrow:{fontSize:10,color:'#7F5B8E',letterSpacing:1,fontWeight:'800'},
 beautyFocusTitle:{fontFamily:serif,fontSize:22,lineHeight:26,color:C.navy,marginTop:5},
 beautyFocusDescription:{fontSize:11,color:'#6C6078',marginTop:5,lineHeight:16},
 beautyFocusButton:{backgroundColor:'#5E2778',paddingVertical:13,paddingHorizontal:15,borderRadius:12,flexDirection:'row',justifyContent:'space-between',marginTop:13,alignItems:'center'},
 beautyFocusButtonText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},
 beautyFocusButtonArrow:{color:'#FFFFFF',fontSize:21},
 beautyQuickGrid:{flexDirection:'row',gap:10},
 beautyQuick:{flex:1,minHeight:79,backgroundColor:'#FFF',padding:14,borderRadius:14,borderWidth:1,borderColor:'#E7DFEB'},
 beautyQuickTitle:{fontSize:13,color:C.navy,fontWeight:'800'},
 beautyQuickSub:{fontSize:11,color:'#827189',marginTop:7},

 homeGreeting:{flexDirection:'row',alignItems:'flex-start',gap:10,marginTop:5,marginBottom:19},
 homeWelcome:{fontFamily:serif,fontWeight:'600',color:C.navy,fontSize:25,lineHeight:30},
 homeWelcomeSubtitle:{fontSize:12,color:'#655A72',marginTop:5,lineHeight:17},
 homeDate:{fontSize:10,color:'#6D5D7E',maxWidth:87,textAlign:'right',lineHeight:15,marginTop:3},
 homeAgenda:{flexDirection:'row',gap:13,alignItems:'center',padding:14,borderRadius:17,backgroundColor:'#F4EBF8'},
 agendaCalendar:{height:55,width:52,backgroundColor:'#FFFFFF',borderRadius:13,justifyContent:'center',alignItems:'center'},
 agendaDay:{fontFamily:serif,fontSize:22,color:C.navy,lineHeight:25},
 agendaMonth:{fontSize:10,fontWeight:'800',color:'#774291'},
 agendaTitle:{fontSize:13,color:C.navy,fontWeight:'800'},
 agendaSubtitle:{fontSize:11,color:'#756780',marginTop:4,lineHeight:16},
 homeLuggage:{marginTop:19,flexDirection:'row',alignItems:'center',backgroundColor:'#57216F',borderRadius:16,padding:16,gap:12},
 luggageIcon:{fontSize:31,color:'#F6EBFC'},
 luggageTitle:{fontFamily:serif,fontSize:18,fontWeight:'600',color:'#FFFFFF'},
 luggageSubtitle:{fontSize:11,color:'#F2DDF8',marginTop:4},
 luggageArrow:{fontSize:27,color:'#FFFFFF'},
 todaySuggestion:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:'#F4EDF7',borderRadius:17,padding:10},
 suggestionImages:{width:119,height:88,flexDirection:'row',gap:3,alignItems:'center'},
 suggestionImage:{flex:1,height:85,backgroundColor:'#FFFFFF',borderRadius:7,overflow:'hidden'},
 suggestionPlaceholder:{width:100,height:80,backgroundColor:'#E7D5EF',borderRadius:10,justifyContent:'center',alignItems:'center'},
 suggestionPlaceholderIcon:{fontSize:31,color:'#673586'},
 todaySuggestionTitle:{fontSize:12,fontWeight:'800',color:C.navy,lineHeight:16},
 todaySuggestionSub:{fontSize:10,color:'#70637B',marginTop:5,lineHeight:15},
 todayArrow:{fontSize:20,color:'#5A2474'},

 heading:{marginBottom:22},
 eyebrow:{fontSize:10,letterSpacing:1.5,color:'#7B5B90',fontWeight:'800',marginBottom:9},
 title:{fontFamily:serif,fontSize:31,lineHeight:37,color:C.navy,fontWeight:'600'},
 subtitle:{fontSize:13,lineHeight:20,color:'#695D76',marginTop:7},
 sectionHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12,marginTop:24},
 sectionTitle:{fontFamily:serif,fontSize:21,fontWeight:'600',color:C.navy},
 sectionAction:{fontSize:12,color:'#72328F',fontWeight:'800'},
 chips:{flexDirection:'row',gap:8,marginBottom:18,flexWrap:'wrap'},
 chip:{paddingHorizontal:16,paddingVertical:10,borderRadius:22,borderWidth:1,borderColor:'#E4D8EA',backgroundColor:'#F8F3FB'},
 chipActive:{backgroundColor:'#68267F',borderColor:'#68267F'},
 chipLabel:{fontWeight:'700',fontSize:12,color:C.navy},
 chipLabelActive:{color:'#FFF'},
 homeFeature:{backgroundColor:'#F0E5F6',borderRadius:24,overflow:'hidden',minHeight:215,padding:18,marginBottom:15},
 homeFeatureText:{maxWidth:'67%',zIndex:1},
 featureTitle:{fontFamily:serif,fontSize:23,lineHeight:28,color:C.navy,marginTop:7,marginBottom:18},
 roundCTA:{alignSelf:'flex-start',backgroundColor:'#53206F',borderRadius:24,paddingVertical:11,paddingHorizontal:14},
 roundCTAText:{fontWeight:'800',fontSize:12,color:'#FFF'},
 featureLooks:{position:'absolute',right:11,bottom:13,top:18,width:'38%',justifyContent:'center',alignItems:'center',gap:3},
 featurePhoto:{height:56,width:'100%',backgroundColor:'#FFF',borderRadius:12,overflow:'hidden'},
 photo:{height:'100%',width:'100%'},
 featureEmpty:{padding:10,alignItems:'center',gap:8},
 featureEmptyIcon:{fontSize:38,color:'#7F5599'},
 featureEmptyText:{textAlign:'center',fontSize:11,color:'#6E557E'},
 summaryStrip:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EDE5F1',borderRadius:16,padding:14,gap:10},
 summaryLabel:{color:'#70647D',fontSize:11},
 summaryValue:{fontWeight:'800',fontSize:15,color:C.navy,flex:1},
 shortcutRow:{flexDirection:'row',gap:8},
 iconTile:{flex:1,backgroundColor:'#F5EFF8',borderRadius:16,paddingVertical:16,paddingHorizontal:3,alignItems:'center',justifyContent:'center',minHeight:84},
 tileIcon:{fontSize:27,color:'#50216D',marginBottom:6},
 tileLabel:{fontSize:10,fontWeight:'800',color:C.navy,textAlign:'center'},
 wideEditorial:{minHeight:150,backgroundColor:'#F0E9F7',borderRadius:22,overflow:'hidden',padding:19,flexDirection:'row',alignItems:'center'},
 editorialEyebrow:{fontSize:10,color:'#78558E',fontWeight:'800',letterSpacing:1},
 editorialTitle:{fontFamily:serif,fontSize:23,color:C.navy,lineHeight:29,marginTop:8},
 editorialLink:{color:'#5E247E',fontSize:12,fontWeight:'800',marginTop:12},
 editorialArt:{width:81,height:100,borderWidth:2,borderColor:'#D7BDE7',backgroundColor:'#E5D4F0',borderRadius:27,alignItems:'center',justifyContent:'center',transform:[{rotate:'-8deg'}]},
 editorialArtText:{fontSize:43,color:'#602784'},
 bottomLinkRow:{flexDirection:'row',gap:9,marginTop:12},
 miniLink:{flex:1,backgroundColor:'#FFF',borderWidth:1,borderColor:'#EEE5F1',borderRadius:15,paddingVertical:14,paddingHorizontal:9,alignItems:'center'},
 miniLinkIcon:{fontSize:24,color:'#76348D'},
 miniLinkText:{fontSize:11,fontWeight:'700',color:C.navy,marginTop:6},
 stats:{flexDirection:'row',alignItems:'center',backgroundColor:'#F4EDF8',borderWidth:1,borderColor:'#E9DDED',borderRadius:18,padding:18},
 statsDivider:{width:1,height:52,backgroundColor:'#D7C9DE'},
 statCaption:{fontSize:9,letterSpacing:1,color:'#7E6A8B',fontWeight:'800'},
 statBig:{fontFamily:serif,fontSize:27,color:C.navy,marginTop:4},
 statUnit:{fontSize:15},
 statLink:{fontSize:12,color:'#622780',fontWeight:'800',marginTop:9},
 photoBox:{height:116,borderRadius:13,backgroundColor:'#F5F0F7',overflow:'hidden',justifyContent:'center',alignItems:'center'},
 fallbackGarment:{fontSize:30,color:'#A68AB8'},
 photoLabel:{fontSize:10,color:C.navy,marginTop:6,fontWeight:'600'},
 emptyGarment:{padding:26,borderRadius:16,borderWidth:1,borderColor:'#E7D9ED',alignItems:'center',backgroundColor:'#F8F4FA'},
 emptyIcon:{color:'#75538D',fontSize:30},emptyText:{marginTop:5,fontSize:12,color:'#766581',textAlign:'center'},
 primaryCTA:{marginTop:17,borderRadius:16,backgroundColor:'#55206F',paddingVertical:15,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 primaryCTAText:{color:'#FFF',fontWeight:'800',fontSize:13},
 studioFeature:{flexDirection:'row',alignItems:'center',backgroundColor:'#EBDBF3',borderRadius:17,padding:15,gap:12,marginTop:12},
 studioFeatureIcon:{height:52,width:52,borderRadius:13,backgroundColor:'#F7F0FA',alignItems:'center',justifyContent:'center'},
 textRow:{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#ECE4F0',paddingVertical:13,gap:12},
 rowIcon:{height:44,width:44,borderRadius:12,backgroundColor:'#F4EDF9',alignItems:'center',justifyContent:'center'},
 rowIconText:{color:'#5B2C77',fontSize:23},
 rowTitle:{fontSize:14,fontWeight:'800',color:C.navy},
 rowDescription:{fontSize:11,color:'#786A84',marginTop:4,lineHeight:16},
 chevron:{color:'#3F2B55',fontSize:25},
 plannedRow:{marginTop:24,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 plannedTitle:{fontWeight:'700',color:C.navy,fontSize:13},
 plannedTag:{fontSize:10,color:'#74598D',backgroundColor:'#F3EDF8',overflow:'hidden',padding:7,borderRadius:8},
 footnote:{fontSize:11,color:'#85788E',lineHeight:17,marginTop:12},
 beautyFeature:{borderRadius:22,padding:18,backgroundColor:'#F2E9F7',overflow:'hidden'},
 beautyBottles:{height:115,flexDirection:'row',justifyContent:'center',alignItems:'flex-end',gap:15,marginBottom:14},
 beautyBottleTall:{height:101,width:48,borderRadius:12,backgroundColor:'#7C458D',borderWidth:5,borderColor:'#D7B8DE'},
 beautyBottleShort:{height:76,width:51,borderRadius:13,backgroundColor:'#FFFFFF',borderWidth:4,borderColor:'#CBA7D7'},
 beautyJar:{height:47,width:68,borderRadius:15,backgroundColor:'#A677BB',borderTopWidth:13,borderTopColor:'#E6D3EE'},
 beautyFeatureEyebrow:{color:'#773F8C',fontWeight:'800',fontSize:10,letterSpacing:1.1},
 beautyFeatureTitle:{fontFamily:serif,fontSize:25,color:C.navy,marginTop:6},
 beautyFeatureSub:{fontSize:12,color:'#6B5C78',marginTop:6,lineHeight:18},
 profileHero:{flexDirection:'row',alignItems:'center',padding:20,backgroundColor:'#F3EAF7',borderRadius:19,gap:15},
 avatar:{height:70,width:70,borderRadius:35,backgroundColor:'#E2D0E8',alignItems:'center',justifyContent:'center'},
 avatarInitial:{fontFamily:serif,fontSize:32,color:'#56216D'},
 profileName:{fontFamily:serif,fontSize:21,color:C.navy},
 profileEmail:{fontSize:11,color:'#7A6A83',marginTop:4},
 signatureLink:{fontWeight:'800',fontSize:12,color:'#693282',marginTop:10},
 logout:{borderWidth:1,borderColor:'#D5BDD9',borderRadius:15,padding:17,alignItems:'center',marginTop:26},
 logoutLabel:{color:'#5B2C74',fontWeight:'800',fontSize:13},
});
