import React,{useState} from 'react';
import {Image,Linking,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import LicensedProductImage from './LicensedProductImage';
import {PRIZMA} from './prizmaTheme';

export type ProductDetailsInfo={
 id:string;brand:string;product_name:string;notes?:string|null;image_source_url?:string|null;
 image_license_name?:string|null;image_license_url?:string|null;image_license_verified_at?:string|null;image_source_page?:string|null;
 inci_ingredients?:string|null;product_benefits?:string|null;usage_instructions?:string|null;product_cautions?:string|null;
};
type Props={product:ProductDetailsInfo;photoUrl?:string|null;onBack:()=>void;onAddCollection?:()=>void;onAddRoutine:()=>void;onEdit?:()=>void};
const sections=['Ürün Hakkında','İçerik Listesi (INCI)','Neden Önerildi?','Kullanım Bilgileri'] as const;
export default function PrizmaProductDetail({product,photoUrl,onBack,onAddCollection,onAddRoutine,onEdit}:Props){
 const [open,setOpen]=useState<string>('Ürün Hakkında');
 const values:Record<string,string>={
  'Ürün Hakkında':product.product_benefits||'Ürünün doğrulanmış açıklaması henüz eklenmedi.',
  'İçerik Listesi (INCI)':product.inci_ingredients||'Doğrulanmış içerik listesi henüz bulunmuyor. Ürün ambalajını kontrol et.',
  'Neden Önerildi?':product.notes||'Bu ürün için kişisel öneri açıklaması bulunmuyor.',
  'Kullanım Bilgileri':product.usage_instructions||'Kullanım bilgileri için üretici talimatlarını kontrol et.',
 };
 const approved=!!(product.image_source_url&&product.image_license_verified_at&&product.image_license_name&&product.image_license_url);
 return <ScrollView style={{backgroundColor:'#FFFFFF'}} contentContainerStyle={s.page}>
  <View style={s.header}><TouchableOpacity style={s.back} onPress={onBack}><Text style={s.backText}>‹</Text></TouchableOpacity><Text style={s.logo}>PRİZMA</Text><TouchableOpacity style={s.back} onPress={onEdit}><Text style={s.edit}>✎</Text></TouchableOpacity></View>
  <View style={s.photoBox}>{photoUrl?<Image source={{uri:photoUrl}} resizeMode="contain" style={s.image}/>:<LicensedProductImage alt={product.product_name} url={product.image_source_url} licenseStatus={approved?'approved':'unknown'} height={265}/>}</View>
  <Text style={s.brand}>{product.brand}</Text><Text style={s.name}>{product.product_name}</Text>
  <Text style={s.description}>{product.product_benefits||'Ürün bilgilerini görüntüle, koleksiyonunu ve rutinini yönet.'}</Text>
  <View style={s.sections}>{sections.map(section=><View key={section} style={s.section}>
    <TouchableOpacity style={s.sectionHeader} accessibilityRole="button" accessibilityState={{expanded:open===section}} onPress={()=>setOpen(open===section?'':section)}>
      <Text style={s.sectionTitle}>{section}</Text><Text style={s.chevron}>{open===section?'⌃':'⌄'}</Text>
    </TouchableOpacity>
    {open===section&&<Text style={s.sectionBody}>{values[section]}</Text>}
  </View>)}</View>
  {approved&&<View style={s.creditBox}>
    <Text style={s.creditTitle}>Görsel Kaynağı ve Lisans</Text>
    <Text style={s.creditText}>{product.image_license_name}</Text>
    {product.image_source_page?.startsWith('https://world.openbeautyfacts.org/product/')&&
      <TouchableOpacity style={s.creditLink} accessibilityRole="link" onPress={()=>{void Linking.openURL(product.image_source_page!);}}>
        <Text style={s.creditLinkText}>Open Beauty Facts ürün sayfasını gör ›</Text>
      </TouchableOpacity>}
    {product.image_license_url?.startsWith('https://creativecommons.org/licenses/')&&
      <TouchableOpacity style={s.creditLink} accessibilityRole="link" onPress={()=>{void Linking.openURL(product.image_license_url!);}}>
        <Text style={s.creditLinkText}>Görsel lisansının koşullarını gör ›</Text>
      </TouchableOpacity>}
  </View>}
  {!!product.product_cautions&&<View style={s.cautionBox}><Text style={s.sectionTitle}>Dikkat Edilecekler</Text><Text style={s.sectionBody}>{product.product_cautions}</Text></View>}
  <View style={s.buttons}>
    <TouchableOpacity style={s.outline} onPress={onAddCollection||onBack}><Text style={s.outlineText}>Koleksiyonuma Git</Text></TouchableOpacity>
    <TouchableOpacity style={s.primary} onPress={onAddRoutine}><Text style={s.primaryText}>Rutine Ekle</Text></TouchableOpacity>
  </View>
  <Text style={s.footnote}>ⓘ PRİZMA AI hata yapabilir. Ürün içeriğini ve kullanım talimatlarını kontrol et.</Text>
 </ScrollView>;
}
const s=StyleSheet.create({
 creditBox:{marginTop:13,borderWidth:1,borderColor:PRIZMA.border,borderRadius:14,padding:13,gap:7},
 creditTitle:{color:PRIZMA.ink,fontSize:13,fontWeight:'700'},
 creditText:{fontSize:11,lineHeight:17,color:PRIZMA.muted},
 creditLink:{minHeight:37,justifyContent:'center'},
 creditLinkText:{fontSize:11,fontWeight:'700',color:PRIZMA.purple},

 page:{paddingHorizontal:17,paddingBottom:40,backgroundColor:'#FFFFFF'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:62},
 back:{width:40,height:44,alignItems:'center',justifyContent:'center'},backText:{fontSize:30,color:PRIZMA.ink},edit:{fontSize:23,color:PRIZMA.purple},
 logo:{fontFamily:'serif',color:PRIZMA.purple,fontSize:23,letterSpacing:4},photoBox:{height:288,borderRadius:18,borderColor:PRIZMA.border,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF',marginTop:12},
 image:{height:270,width:'95%'},brand:{fontSize:14,color:PRIZMA.muted,marginTop:21},name:{fontSize:24,fontWeight:'800',color:PRIZMA.ink,marginTop:4},
 description:{fontSize:13,color:PRIZMA.muted,lineHeight:20,marginTop:8,marginBottom:17},
 sections:{gap:7},section:{borderWidth:1,borderColor:PRIZMA.border,borderRadius:14,backgroundColor:'#FFFFFF',overflow:'hidden'},
 sectionHeader:{paddingHorizontal:14,minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 sectionTitle:{fontSize:14,fontWeight:'700',color:PRIZMA.ink},chevron:{color:PRIZMA.purple,fontSize:23},
 sectionBody:{fontSize:12,lineHeight:19,color:PRIZMA.muted,padding:14,paddingTop:0},
 cautionBox:{borderWidth:1,borderColor:PRIZMA.border,borderRadius:14,padding:14,marginTop:10},
 buttons:{flexDirection:'row',gap:8,marginTop:22},
 outline:{flex:1,minHeight:51,borderWidth:1,borderColor:PRIZMA.purple,borderRadius:13,alignItems:'center',justifyContent:'center'},outlineText:{color:PRIZMA.purple,fontSize:13,fontWeight:'700'},
 primary:{flex:1,minHeight:51,borderRadius:13,backgroundColor:PRIZMA.purple,alignItems:'center',justifyContent:'center'},primaryText:{color:'#FFFFFF',fontSize:13,fontWeight:'700'},
 footnote:{fontSize:11,color:PRIZMA.muted,lineHeight:17,marginTop:18}
});
