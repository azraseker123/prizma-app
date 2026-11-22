import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PRIZMA } from './prizmaTheme';

export type OutfitPosition = { x:number; y:number; scale:number; locked?:boolean };
export type OutfitLayout = Record<string,OutfitPosition>;
type Garment = { id:string;name:string;category:string;imageUrl?:string|null };
type Props = { items:Garment[]; positions:OutfitLayout; onChange:(next:OutfitLayout)=>void; onAiComplete?:()=>void; aiBusy?:boolean };
const stageWidth=320;
const stageHeight=380;
const baseSize=100;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const initial=(index:number):OutfitPosition=>({x:8+(index%3)*103,y:12+Math.floor(index/3)*143,scale:1,locked:false});

function DraggablePiece({item,position,onPositionChange,active,onActivate}:{
 item:Garment;position:OutfitPosition;onPositionChange:(pos:OutfitPosition)=>void;active:boolean;onActivate:()=>void;
}){
 const [draft,setDraft]=useState(position);
 const posRef=useRef(position);
 const initialRef=useRef(position);
 const callbackRef=useRef(onPositionChange);
 const lockedRef=useRef(Boolean(position.locked));
 callbackRef.current=onPositionChange;
 lockedRef.current=Boolean(position.locked);
 useEffect(()=>{setDraft(position);posRef.current=position;},[position.x,position.y,position.scale,position.locked]);
 const pan=useMemo(()=>PanResponder.create({
   onStartShouldSetPanResponder:()=>true,
   onMoveShouldSetPanResponder:()=>!lockedRef.current,
   onPanResponderGrant:()=>{initialRef.current=posRef.current;onActivate();},
   onPanResponderMove:(_,gesture)=>{
     if(lockedRef.current)return;
     const next={...initialRef.current,x:clamp(initialRef.current.x+gesture.dx,0,stageWidth-baseSize*initialRef.current.scale),
       y:clamp(initialRef.current.y+gesture.dy,0,stageHeight-116*initialRef.current.scale)};
     posRef.current=next;setDraft(next);
   },
   onPanResponderRelease:()=>{callbackRef.current(posRef.current);},
 }),[]);
 const width=baseSize*draft.scale;
 return <View {...pan.panHandlers} style={[s.piece,{left:draft.x,top:draft.y,width:width,height:116*draft.scale},active&&s.pieceSelected]}>
  {item.imageUrl?<Image source={{uri:item.imageUrl}} style={s.image} resizeMode="contain"/>:<Text style={s.fallback}>♧</Text>}
  <Text style={s.label} numberOfLines={1}>{item.name}</Text>
  {draft.locked?<Text style={s.lock}>Kilitli</Text>:null}
 </View>;
}
export default function PrizmaOutfitEditor({items,positions,onChange,onAiComplete,aiBusy=false}:Props){
 const [mode,setMode]=useState<'Akıllı Eşleştirme'|'Stil Editörü'>('Stil Editörü');
 const [selectedCategory,setSelectedCategory]=useState('Üst');
 const [active,setActive]=useState<string|null>(null);
 const layout=useMemo(()=>Object.fromEntries(items.map((item,index)=>[item.id,positions[item.id]||initial(index)])) as OutfitLayout,[items,positions]);
 const selected=items.find(x=>x.id===active)||items[0];
 const current=selected?layout[selected.id]:null;
 const patch=(id:string,values:Partial<OutfitPosition>)=>{
   onChange({...layout,[id]:{...layout[id],...values}});
 };
 return <View style={s.container}>
  <Text style={s.headerTitle}>Kombin Stüdyosu</Text>
  <Text style={s.headerSubtitle}>Kendi stilini oluştur, düzenle veya AI'dan ilham al.</Text>
  <View style={s.modeTabs}>
    {(['Akıllı Eşleştirme','Stil Editörü'] as const).map(key=><TouchableOpacity key={key} onPress={()=>setMode(key)} style={[s.modeTab,mode===key&&s.modeActive]}><Text style={[s.modeLabel,mode===key&&s.modeLabelActive]}>{key}</Text></TouchableOpacity>)}
  </View>
  <View style={s.canvasRow}>
    <View style={s.categoryRail}>
      {([['Üst','♧'],['Alt','▥'],['Dış','▤'],['Ayakkabı','⌁'],['Çanta','▢'],['Aksesuar','○']] as const).map(([name,icon])=><TouchableOpacity accessibilityRole="button" accessibilityState={{selected:selectedCategory===name}} onPress={()=>setSelectedCategory(name)} key={name} style={[s.railButton,selectedCategory===name&&s.railSelected]}>
       <Text style={s.railSymbol}>{icon}</Text><Text style={s.railLabel}>{name}</Text>
      </TouchableOpacity>)}
    </View>
    <View style={s.board}>
      <View style={s.canvas}>
       {items.slice(0,8).map((item,index)=><DraggablePiece key={item.id} item={item} position={layout[item.id]||initial(index)}
          active={selected?.id===item.id} onActivate={()=>setActive(item.id)} onPositionChange={next=>patch(item.id,next)}/>)}
      </View>
    </View>
  </View>
  {selected&&current?<View style={s.controls}>
    <View style={s.controlHeading}><Text style={s.currentName} numberOfLines={1}>{selected.name}</Text>
      <TouchableOpacity onPress={()=>patch(selected.id,{locked:!current.locked})} style={s.lockButton}>
        <Text style={s.lockLabel}>{current.locked?'▣ Sabitlenmiş':'▢ Sabitle'}</Text>
      </TouchableOpacity></View>
    <View style={s.controlRow}>
      <TouchableOpacity disabled={current.locked} style={s.controlButton} onPress={()=>patch(selected.id,{scale:clamp(current.scale-.1,.6,1.6)})}><Text style={s.controlText}>− Küçült</Text></TouchableOpacity>
      <TouchableOpacity disabled={current.locked} style={s.controlButton} onPress={()=>patch(selected.id,{scale:clamp(current.scale+.1,.6,1.6)})}><Text style={s.controlText}>+ Büyüt</Text></TouchableOpacity>
      <TouchableOpacity style={s.controlButton} onPress={()=>patch(selected.id,{x:10,y:10})}><Text style={s.controlText}>Sıfırla</Text></TouchableOpacity>
    </View>
  </View>:null}
  <View style={s.featureRow}>
    {(['Renk Uyumu','Stil Filtresi','Alternatifler','Hava Durumu','Ortam Seç'] as const).map((label,index)=><TouchableOpacity key={label} style={s.featureButton} accessibilityRole="button" onPress={()=>{if(onAiComplete)onAiComplete();}}>
      <Text style={s.featureIcon}>{['◉','☷','▱','☁','▦'][index]}</Text><Text style={s.featureText}>{label}</Text>
    </TouchableOpacity>)}
  </View>
  <TouchableOpacity disabled={aiBusy||!onAiComplete} onPress={onAiComplete} style={s.aiComplete}>
    <Text style={s.aiCompleteText}>{aiBusy?'Alternatifler hazırlanıyor...':'◎  PRİZMA AI ile Tamamla'}</Text>
  </TouchableOpacity>
  <Text style={s.note}>Sabitlenen parçalar AI önerilerinde korunur. Kaydettiğinde yerleşim de hesabına aktarılır.</Text>
 </View>;
}
const s=StyleSheet.create({
 headerTitle:{fontSize:24,fontWeight:'700',color:PRIZMA.ink,marginBottom:6},
 headerSubtitle:{fontSize:12,color:PRIZMA.muted,lineHeight:18,marginBottom:16},
 modeTabs:{flexDirection:'row',borderWidth:1,borderColor:PRIZMA.border,borderRadius:20,overflow:'hidden',marginBottom:17},
 modeTab:{flex:1,minHeight:47,alignItems:'center',justifyContent:'center'},modeActive:{backgroundColor:PRIZMA.purple},
 modeLabel:{fontSize:12,color:PRIZMA.purple,fontWeight:'700'},modeLabelActive:{color:'#FFFFFF'},
 canvasRow:{flexDirection:'row',gap:9},categoryRail:{width:56,gap:8},
 railButton:{minHeight:57,borderWidth:1,borderColor:PRIZMA.border,borderRadius:13,alignItems:'center',justifyContent:'center'},
 railSelected:{borderColor:PRIZMA.purple},railSymbol:{fontSize:21,color:PRIZMA.purple},railLabel:{fontSize:9,color:PRIZMA.ink},
 board:{flex:1,overflow:'hidden',borderWidth:1,borderColor:PRIZMA.border,borderRadius:17,alignItems:'center',justifyContent:'center'},
 controlHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:11},
 lockButton:{minHeight:37,paddingHorizontal:8,justifyContent:'center',borderWidth:1,borderColor:PRIZMA.border,borderRadius:10},
 lockLabel:{fontSize:11,color:PRIZMA.purple,fontWeight:'700'},
 featureRow:{flexDirection:'row',gap:5,marginTop:15},featureButton:{flex:1,minHeight:68,borderWidth:1,borderColor:PRIZMA.border,borderRadius:12,alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:2},
 featureIcon:{fontSize:20,color:PRIZMA.purple},featureText:{fontSize:9,color:PRIZMA.ink,textAlign:'center'},
 aiComplete:{minHeight:49,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:PRIZMA.purple,marginTop:15},
 aiCompleteText:{color:'#FFFFFF',fontWeight:'700',fontSize:13},

 container:{paddingTop:12,marginTop:12,borderTopWidth:1,borderColor:PRIZMA.border},
 top:{marginBottom:12},title:{fontSize:17,fontWeight:'700',color:PRIZMA.ink},helper:{fontSize:12,color:PRIZMA.muted,marginTop:4},
 canvas:{height:stageHeight,width:stageWidth,maxWidth:'100%',alignSelf:'center',backgroundColor:'#FFFFFF',borderColor:PRIZMA.border,borderWidth:1,borderRadius:14,overflow:'hidden'},
 piece:{position:'absolute',alignItems:'center',justifyContent:'center',backgroundColor:PRIZMA.white,borderWidth:1,borderColor:PRIZMA.border,borderRadius:10,padding:4},
 pieceSelected:{borderWidth:2,borderColor:PRIZMA.purple},
 image:{height:'78%',width:'100%'},fallback:{fontSize:30,color:PRIZMA.purple},label:{fontSize:9,color:PRIZMA.ink,fontWeight:'600'},lock:{fontSize:8,color:PRIZMA.purple},
 controls:{marginTop:13,padding:12,borderColor:PRIZMA.border,borderWidth:1,borderRadius:13},currentName:{color:PRIZMA.ink,fontWeight:'700',fontSize:13,marginBottom:10},
 controlRow:{flexDirection:'row',gap:7},controlButton:{flex:1,borderColor:PRIZMA.border,borderWidth:1,borderRadius:10,minHeight:44,alignItems:'center',justifyContent:'center'},
 controlText:{fontSize:11,color:PRIZMA.purple,fontWeight:'700'},note:{fontSize:11,color:PRIZMA.muted,lineHeight:17,marginTop:12}
});
