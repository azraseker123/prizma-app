import React from 'react';
import {StyleSheet, View} from 'react-native';

export type PrizmaLineIconName='scan'|'calendar'|'lipstick'|'bag'|'camera'|'image'|'images'|'profile'|'hanger'|'layers'|'palette'|'brush'|'shirt'|'bottle'|'mirror';
type Props={name:PrizmaLineIconName;size?:number;color?:string;stroke?:number};
export default function PrizmaLineIcon({name,size=28,color='#69318A',stroke=2}:Props){
 const k=size/28;
 const border=(width=stroke)=>({borderColor:color,borderWidth:width*k});
 const box=(left:number,top:number,width:number,height:number)=>({position:'absolute' as const,left:left*k,top:top*k,width:width*k,height:height*k});
 const line=(left:number,top:number,width:number,height=stroke)=>({...box(left,top,width,height),backgroundColor:color,borderRadius:3*k});
 const rounded=(left:number,top:number,width:number,height:number,radius:number)=>({...box(left,top,width,height),...border(),borderRadius:radius*k});
 const c=(left:number,top:number,r:number)=>({...box(left,top,r*2,r*2),...border(),borderRadius:r*k});
 const angled=(left:number,top:number,width:number,degrees:number)=>({...line(left,top,width),transform:[{rotate:(degrees+'deg') as `${number}deg`}]});
 let parts:React.ReactNode=null;
 switch(name){
  case 'scan':parts=<>
    <View style={{...box(2,2,9,9),borderTopWidth:stroke*k,borderLeftWidth:stroke*k,borderColor:color,borderTopLeftRadius:3*k}}/>
    <View style={{...box(17,2,9,9),borderTopWidth:stroke*k,borderRightWidth:stroke*k,borderColor:color,borderTopRightRadius:3*k}}/>
    <View style={{...box(2,17,9,9),borderBottomWidth:stroke*k,borderLeftWidth:stroke*k,borderColor:color,borderBottomLeftRadius:3*k}}/>
    <View style={{...box(17,17,9,9),borderBottomWidth:stroke*k,borderRightWidth:stroke*k,borderColor:color,borderBottomRightRadius:3*k}}/>
    <View style={c(10,10,4)}/>
  </>;break;
  case 'calendar':parts=<>
    <View style={rounded(3,6,22,19,4)}/><View style={line(4,12,20)}/>
    <View style={line(9,2,2,8)}/><View style={line(18,2,2,8)}/>
    <View style={line(8,17,4)}/><View style={line(15,17,4)}/>
  </>;break;
  case 'lipstick':parts=<>
    <View style={{...box(10,2,8,10),...border(),borderTopLeftRadius:5*k,borderTopRightRadius:2*k}}/>
    <View style={rounded(7,12,14,5,2)}/><View style={rounded(8,17,12,10,2)}/>
  </>;break;
  case 'bag':parts=<>
    <View style={rounded(5,10,18,16,3)}/>
    <View style={{...box(9,3,10,12),borderLeftWidth:stroke*k,borderRightWidth:stroke*k,borderTopWidth:stroke*k,borderColor:color,borderTopLeftRadius:7*k,borderTopRightRadius:7*k}}/>
  </>;break;
  case 'camera':parts=<>
    <View style={rounded(3,8,22,17,4)}/><View style={c(10,12,4)}/><View style={line(7,5,9,4)}/>
    <View style={{...box(20,11,2,2),backgroundColor:color,borderRadius:2*k}}/>
  </>;break;
  case 'image':parts=<>
    <View style={rounded(2,4,24,20,3)}/><View style={c(17,8,2)}/><View style={angled(5,19,12,-38)}/><View style={angled(13,20,10,-49)}/>
  </>;break;
  case 'images':parts=<>
    <View style={rounded(2,2,20,19,3)}/><View style={rounded(7,7,19,19,3)}/>
    <View style={c(17,11,2)}/><View style={angled(9,21,12,-40)}/>
  </>;break;
  case 'profile':parts=<><View style={c(9,3,5)}/>
    <View style={{...box(3,18,22,9),borderTopWidth:stroke*k,borderLeftWidth:stroke*k,borderRightWidth:stroke*k,borderColor:color,borderTopLeftRadius:14*k,borderTopRightRadius:14*k}}/>
  </>;break;
  case 'hanger':parts=<>
    <View style={{...box(11,2,7,10),borderTopWidth:stroke*k,borderRightWidth:stroke*k,borderColor:color,borderTopRightRadius:7*k,transform:[{rotate:'18deg'}]}}/>
    <View style={angled(1,19,15,-31)}/><View style={angled(12,19,15,31)}/><View style={line(3,24,22)}/>
  </>;break;
  case 'layers':parts=<><View style={{...box(3,4,20,14),...border(),borderRadius:4*k,transform:[{rotate:'-10deg'}]}}/>
    <View style={{...box(7,10,18,14),...border(),borderRadius:4*k}}/>
  </>;break;
  case 'palette':parts=<>
    <View style={{...box(2,3,24,22),...border(),borderRadius:12*k}}/>
    <View style={c(6,8,2)}/><View style={c(13,5,2)}/><View style={c(19,10,2)}/>
  </>;break;
  case 'brush':parts=<>
    <View style={{...box(17,2,7,9),...border(),borderTopLeftRadius:6*k,borderTopRightRadius:6*k,transform:[{rotate:'38deg'}]}}/>
    <View style={{...box(6,10,7,17),...border(),borderRadius:3*k,transform:[{rotate:'38deg'}]}}/>
  </>;break;
  case 'shirt':parts=<>
    <View style={{...box(9,3,10,6),borderBottomWidth:stroke*k,borderColor:color,borderBottomLeftRadius:7*k,borderBottomRightRadius:7*k}}/>
    <View style={{...box(3,7,22,20),...border(),borderRadius:4*k}}/>
  </>;break;
  case 'bottle':parts=<>
    <View style={rounded(8,11,12,16,3)}/><View style={rounded(10,2,8,9,2)}/><View style={line(8,18,12)}/>
  </>;break;
  case 'mirror':parts=<><View style={rounded(6,2,16,17,8)}/><View style={line(13,20,2,6)}/><View style={line(7,26,14)}/></>;break;
 }
 return <View style={{height:size,width:size,position:'relative'}} accessibilityLabel={name}>{parts}</View>;
}
