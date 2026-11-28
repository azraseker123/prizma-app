import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
type Name='Ana Sayfa'|'Gardırop'|'PRİZMA AI'|'Güzellik'|'Profil';
export default function PrizmaNavIcon({name,color}:{name:Name;color:string}){
 if(name==='PRİZMA AI')return <View style={s.ringOuter}><View style={s.ringInner}/></View>;
 if(name==='Gardırop')return <View style={s.icon}>
   <View style={[s.hangerHook,{borderColor:color}]}/>
   <View style={[s.hangerLeft,{backgroundColor:color}]}/>
   <View style={[s.hangerRight,{backgroundColor:color}]}/>
   <View style={[s.hangerBase,{backgroundColor:color}]}/>
 </View>;
 if(name==='Güzellik')return <View style={s.icon}>
   <View style={[s.lipTop,{borderColor:color}]}/>
   <View style={[s.lipCap,{borderColor:color}]}/>
   <View style={[s.lipBody,{borderColor:color}]}/>
 </View>;
 if(name==='Profil')return <View style={s.icon}>
   <View style={[s.personHead,{borderColor:color}]}/>
   <View style={[s.personShoulder,{borderColor:color}]}/>
 </View>;
 return <View style={s.icon}>
   <View style={[s.houseRoof,{borderColor:color}]}/>
   <View style={[s.houseBody,{borderColor:color}]}/>
   <View style={[s.houseDoor,{borderColor:color}]}/>
 </View>;
}
const s=StyleSheet.create({
 icon:{width:30,height:30,position:'relative',alignItems:'center',justifyContent:'center'},
 ringOuter:{height:39,width:39,borderRadius:20,borderColor:'#B044F2',borderWidth:3,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',shadowColor:'#A133EF',shadowRadius:7,shadowOpacity:.95,shadowOffset:{width:0,height:0},elevation:9},
 ringInner:{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:'#E3B7FF'},
 hangerHook:{position:'absolute',top:0,left:12,width:9,height:10,borderWidth:2,borderBottomWidth:0,borderTopLeftRadius:8,borderTopRightRadius:8,transform:[{rotate:'16deg'}]},
 hangerLeft:{position:'absolute',height:2,width:17,left:1,top:19,transform:[{rotate:'-31deg'}],borderRadius:2},
 hangerRight:{position:'absolute',height:2,width:17,right:1,top:19,transform:[{rotate:'31deg'}],borderRadius:2},
 hangerBase:{position:'absolute',height:2,width:27,bottom:4,borderRadius:2},
 lipTop:{position:'absolute',top:3,width:11,height:11,borderWidth:2,borderBottomWidth:0,borderTopLeftRadius:7,borderTopRightRadius:3,transform:[{rotate:'-9deg'}]},
 lipCap:{position:'absolute',top:13,width:18,height:7,borderWidth:2,borderRadius:3},
 lipBody:{position:'absolute',top:19,width:18,height:11,borderWidth:2,borderRadius:3},
 personHead:{position:'absolute',top:2,width:12,height:12,borderWidth:2,borderRadius:7},
 personShoulder:{position:'absolute',bottom:2,width:26,height:14,borderWidth:2,borderBottomWidth:0,borderTopLeftRadius:16,borderTopRightRadius:16},
 houseRoof:{position:'absolute',top:3,width:21,height:21,borderLeftWidth:2,borderTopWidth:2,transform:[{rotate:'45deg'}],borderTopLeftRadius:2},
 houseBody:{position:'absolute',bottom:2,height:17,width:23,borderWidth:2,borderTopWidth:0,borderBottomLeftRadius:3,borderBottomRightRadius:3},
 houseDoor:{position:'absolute',bottom:2,height:12,width:7,borderWidth:2,borderBottomWidth:0,borderTopLeftRadius:3,borderTopRightRadius:3}
});
