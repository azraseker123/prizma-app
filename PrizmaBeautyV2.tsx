import PrizmaLineIcon from './PrizmaLineIcon';
import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Image,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {supabase} from './supabase';
import {getBeautyPhotoUrl} from './BeautyPhotoStore';
import {PRIZMA} from './prizmaTheme';
import LicensedProductImage from './LicensedProductImage';
type Page='Ana Sayfa'|'Gardırop'|'Stil Stüdyosu'|'Kombin Oluştur'|'PRİZMA AI'|'Sanal Deneme'|'Güzellik'|'Cilt Danışmanı'|'Bakım Rutini'|'Bakım Koleksiyonum'|'Cilt Analizi'|'Alışveriş'|'Profil'|'Deneme Fotoğrafım';
type Category='skin'|'hair'|'makeup';
type Product={id:string;brand:string|null;product_name:string;image_path:string|null;image_source_url:string|null;image_license_verified_at:string|null;image_license_name:string|null;image_license_url:string|null};
type Props={userId:string;onOpen:(page:Page)=>void;onBeautyCategory:(category:Category)=>void};
export default function PrizmaBeautyV2({userId,onOpen,onBeautyCategory}:Props){
 const [products,setProducts]=useState<Product[]>([]);
 const [photos,setPhotos]=useState<Record<string,string>>({});
 const [profile,setProfile]=useState<Record<string,string>>({});
 const [showBeautyProfile,setShowBeautyProfile]=useState(false);
 const readable=(value:unknown):string=>{if(Array.isArray(value))return value.map(readable).join(' · ');if(typeof value!=='string'||!value.trim())return 'Belirtilmedi';try{const decoded=JSON.parse(value);if(Array.isArray(decoded))return decoded.map(readable).join(' · ');}catch{}return value.replace(/[\[\]"]/g,'').replace(/\s*,\s*/g,' · ').trim();};
 const [loading,setLoading]=useState(true);
 const [activeProduct,setActiveProduct]=useState(0);
 const reload=useCallback(async()=>{
   setLoading(true);
   try{
     const [p,u]=await Promise.all([
       supabase.from('beauty_collection').select('id,brand,product_name,image_path,image_source_url,image_license_verified_at,image_license_name,image_license_url').eq('user_id',userId).order('created_at',{ascending:false}).limit(12),
       supabase.from('user_profiles').select('answers').eq('user_id',userId).maybeSingle(),
     ]);
     if(!p.error)setProducts((p.data||[]) as Product[]);
     if(u.data?.answers&&typeof u.data.answers==='object'&&!Array.isArray(u.data.answers))setProfile(u.data.answers as Record<string,string>);
     const paths=(p.data||[]) as Product[];
     const next:Record<string,string>={};
     await Promise.all(paths.filter(x=>x.image_path).map(async product=>{
       try{const url=await getBeautyPhotoUrl(product.image_path!);if(url)next[product.id]=url;}catch{/* fallback */ }
     }));
     setPhotos(next);
   }finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void reload();},[reload]);
 const choose=(category:Category)=>{onBeautyCategory(category);onOpen('Cilt Danışmanı');};
 const preview=products.slice(0,6);
 if(showBeautyProfile)return <View style={s.page}>
   <TouchableOpacity accessibilityRole="button" style={s.profileBack} onPress={()=>setShowBeautyProfile(false)}><Text style={s.profileBackText}>‹ Güzellik</Text></TouchableOpacity>
   <Text style={s.heading}>Güzellik Profilim</Text>
   <Text style={s.sub}>Cilt, saç ve makyaj tercihlerinin özeti</Text>
   <View style={s.profileDetailRow}><PrizmaLineIcon name="profile" size={30}/><View style={{flex:1}}><Text style={s.profileTitle}>Cilt Profilim</Text><Text style={s.profileText}>{readable(profile.skin_type)}</Text></View></View>
   <View style={s.profileDetailRow}><PrizmaLineIcon name="brush" size={30}/><View style={{flex:1}}><Text style={s.profileTitle}>Saç Profilim</Text><Text style={s.profileText}>{readable(profile.hair_type)} · {readable(profile.hair_color)}</Text></View></View>
   <View style={s.profileDetailRow}><PrizmaLineIcon name="lipstick" size={30}/><View style={{flex:1}}><Text style={s.profileTitle}>Makyaj Tercihlerim</Text><Text style={s.profileText}>{readable(profile.makeup_style||profile.makeup_preferences)}</Text></View></View>
   <TouchableOpacity style={s.cta} onPress={()=>onOpen('Profil')}><Text style={s.ctaText}>Profilimi Düzenle ›</Text></TouchableOpacity>
   </View>;
 return <View style={s.page}>
   <Text style={s.heading}>Güzellik Danışmanı</Text>
   <Text style={s.sub}>Cilt, saç ve makyajda kişisel asistanın.</Text>
   <View style={s.categories}>
      {([['skin','▤','Cilt Bakımı'],['hair','〰','Saç Bakımı'],['makeup','▰','Makyaj']] as const).map(([category,icon,label])=>
        <TouchableOpacity key={category} style={s.categoryCard} onPress={()=>choose(category)} accessibilityRole="button">
          <Text style={s.categoryIcon}>{icon}</Text><Text style={s.categoryLabel}>{label}</Text>
        </TouchableOpacity>)}
   </View>
   <TouchableOpacity style={s.profileCard} onPress={()=>setShowBeautyProfile(true)} accessibilityRole="button">
     <View style={s.profileAvatar}><PrizmaLineIcon name="profile" size={29}/></View>
     <View style={{flex:1}}><Text style={s.profileTitle}>Güzellik Profilin</Text>
       <Text style={s.profileText} numberOfLines={2}>{readable(profile.skin_type)} Cilt · {readable(profile.hair_type)} Saç</Text></View>
     <Text style={s.arrow}>›</Text>
   </TouchableOpacity>
   <View style={s.sectionHeading}><Text style={s.sectionTitle}>Bugün Sana Öneriler</Text><TouchableOpacity onPress={()=>onOpen('Bakım Koleksiyonum')}><Text style={s.sectionLink}>Tümünü Gör ›</Text></TouchableOpacity></View>
   {loading?<ActivityIndicator color={PRIZMA.purple} style={{marginVertical:20}}/>:preview.length?<>
     <ScrollView horizontal contentContainerStyle={s.productStrip} showsHorizontalScrollIndicator={false} snapToInterval={129} decelerationRate="fast">
       {preview.map((product,index)=><TouchableOpacity key={product.id} style={s.productCard} onPress={()=>{setActiveProduct(index);onOpen('Bakım Koleksiyonum')}} accessibilityRole="button">
         {photos[product.id]?<Image source={{uri:photos[product.id]}} style={s.productImage} resizeMode="contain"/>:
         <LicensedProductImage alt={product.product_name} height={110} url={product.image_source_url} licenseStatus={product.image_source_url&&product.image_license_verified_at&&product.image_license_name&&product.image_license_url?'approved':'unknown'}/>}
         <Text style={s.productBrand} numberOfLines={1}>{product.brand||'Ürün'}</Text>
         <Text style={s.productName} numberOfLines={2}>{product.product_name}</Text>
       </TouchableOpacity>)}
     </ScrollView>
     <View style={s.dots}>{preview.slice(0,4).map((p,i)=><View key={p.id} style={[s.dot,i===Math.min(activeProduct,3)&&s.dotSelected]}/>)}</View>
   </>:<TouchableOpacity style={s.empty} onPress={()=>choose('skin')}>
     <Text style={s.emptyHeading}>Senin için ürünler keşfedelim.</Text>
     <Text style={s.emptySub}>Henüz kayıtlı ürün yok. PRİZMA AI ile kişisel öneriler al.</Text>
     <Text style={s.sectionLink}>Ürün Önerilerine Git ›</Text>
   </TouchableOpacity>}
   <TouchableOpacity style={s.actionRow} onPress={()=>onOpen('Bakım Rutini')}>
     <PrizmaLineIcon name="calendar" size={28}/><View style={{flex:1}}><Text style={s.rowTitle}>Rutinim</Text><Text style={s.rowSubtitle}>Sabah & Akşam bakım adımların</Text></View><Text style={s.arrow}>›</Text>
   </TouchableOpacity>
   <TouchableOpacity style={s.actionRow} onPress={()=>onOpen('Bakım Koleksiyonum')}>
     <PrizmaLineIcon name="bag" size={28}/><View style={{flex:1}}><Text style={s.rowTitle}>Ürün Koleksiyonum</Text><Text style={s.rowSubtitle}>Kaydettiğin ve favorilediğin ürünler</Text></View><Text style={s.arrow}>›</Text>
   </TouchableOpacity>
   <TouchableOpacity style={s.cta} onPress={()=>choose('skin')}><Text style={s.ctaText}>PRİZMA AI ile Danış</Text></TouchableOpacity>
   <Text style={s.disclaimer}>ⓘ AI hata yapabilir. Ürün içeriklerini ve kullanım talimatlarını kontrol et.</Text>
 </View>;
}
const s=StyleSheet.create({
 profileBack:{minHeight:45,justifyContent:'center'},profileBackText:{fontSize:14,color:PRIZMA.purple,fontWeight:'700'},
 profileDetailRow:{flexDirection:'row',alignItems:'center',gap:16,minHeight:92,borderWidth:1,borderColor:PRIZMA.border,borderRadius:16,padding:15,marginBottom:11},

 page:{paddingBottom:40,backgroundColor:'#FFFFFF'},heading:{fontSize:23,fontWeight:'800',color:PRIZMA.ink,textAlign:'center',marginTop:10},sub:{textAlign:'center',fontSize:12,color:PRIZMA.muted,marginTop:6,marginBottom:21},
 categories:{flexDirection:'row',gap:9},categoryCard:{flex:1,minHeight:109,borderWidth:1,borderColor:PRIZMA.border,borderRadius:17,justifyContent:'center',alignItems:'center',backgroundColor:'#FFFFFF',gap:9},
 categoryIcon:{fontSize:31,color:PRIZMA.purple},categoryLabel:{fontSize:12,color:PRIZMA.ink,textAlign:'center',fontWeight:'600'},
 profileCard:{flexDirection:'row',gap:12,alignItems:'center',minHeight:87,borderWidth:1,borderColor:PRIZMA.border,borderRadius:18,padding:13,marginTop:20,backgroundColor:'#FFFFFF'},
 profileAvatar:{height:56,width:56,borderRadius:15,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:PRIZMA.border,alignItems:'center',justifyContent:'center'},profileAvatarText:{color:PRIZMA.purple,fontSize:32},
 profileTitle:{fontSize:14,color:PRIZMA.ink,fontWeight:'700'},profileText:{fontSize:12,color:PRIZMA.muted,lineHeight:18,marginTop:5},arrow:{fontSize:27,color:PRIZMA.purple},
 sectionHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:25,marginBottom:12},sectionTitle:{fontSize:18,color:PRIZMA.ink,fontWeight:'700'},sectionLink:{fontSize:12,color:PRIZMA.purple,fontWeight:'700'},
 productStrip:{flexDirection:'row',gap:9,paddingBottom:8},productCard:{width:120,minHeight:175,borderWidth:1,borderColor:PRIZMA.border,borderRadius:15,padding:7,backgroundColor:'#FFFFFF'},
 productImage:{height:110,width:'100%'},productBrand:{fontSize:10,color:PRIZMA.muted,marginTop:7},productName:{fontSize:11,fontWeight:'700',color:PRIZMA.ink,marginTop:3},
 dots:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:8,marginBottom:12},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#D8D6DC'},dotSelected:{backgroundColor:PRIZMA.purple},
 empty:{borderWidth:1,borderColor:PRIZMA.border,borderRadius:15,padding:18,gap:9,marginBottom:11},emptyHeading:{fontSize:14,fontWeight:'700',color:PRIZMA.ink},emptySub:{fontSize:12,color:PRIZMA.muted,lineHeight:18},
 actionRow:{flexDirection:'row',alignItems:'center',gap:13,minHeight:74,borderWidth:1,borderColor:PRIZMA.border,borderRadius:15,padding:14,backgroundColor:'#FFFFFF',marginTop:11},
 rowIcon:{fontSize:27,color:PRIZMA.purple},rowTitle:{fontSize:14,color:PRIZMA.ink,fontWeight:'700'},rowSubtitle:{fontSize:12,color:PRIZMA.muted,marginTop:5},
 cta:{minHeight:49,backgroundColor:PRIZMA.purple,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:24},ctaText:{fontSize:14,color:'#FFFFFF',fontWeight:'700'},
 disclaimer:{marginTop:16,fontSize:10,color:PRIZMA.muted,lineHeight:16}
});
