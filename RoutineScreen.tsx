import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addRoutineItem, getRoutineItems, removeRoutineItem, type RoutineItem, type RoutinePeriod } from './RoutineStore';

type Props = { userId: string; onAIRequest: () => void };
const PURPLE = '#79569A';

export default function RoutineScreen({ userId, onAIRequest }: Props) {
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [period, setPeriod] = useState<RoutinePeriod>('Sabah');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const refresh = useCallback(async () => {
    try { setItems(await getRoutineItems(userId)); }
    catch { setFeedback('Rutinler şu anda okunamadı.'); }
  }, [userId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await addRoutineItem(userId, { title, period, source: 'manual' });
      setTitle('');
      setFeedback('Rutin adımı eklendi ✦');
      await refresh();
    } catch { setFeedback('Kaydedilemedi. Tekrar dene.'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try { await removeRoutineItem(userId, id); await refresh(); setFeedback('Adım kaldırıldı.'); }
    catch { setFeedback('Adım kaldırılamadı.'); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>PRİZMA BEAUTY STUDIO</Text>
      <Text style={s.title}>Bakım Rutinim ✦</Text>
      <Text style={s.desc}>Sabah ve akşam bakım adımlarını kendi ihtiyaçlarına göre düzenle.</Text>
      <View style={s.panel}>
        <Text style={s.panelTitle}>Manuel Rutin Ekle</Text>
        <View style={s.row}>
          {(['Sabah', 'Akşam'] as const).map(p => (
            <TouchableOpacity key={p} accessibilityRole="button" onPress={() => setPeriod(p)} style={[s.chip, period === p && s.chipSelected]}>
              <Text style={[s.chipText, period === p && s.chipTextSelected]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput value={title} onChangeText={setTitle} maxLength={100} style={s.input} placeholder="Örn. Nazik temizleyici kullan" placeholderTextColor="#90849B" />
        <TouchableOpacity style={[s.button, (!title.trim() || busy) && s.disabled]} onPress={() => void add()} disabled={!title.trim() || busy}>
          {busy ? <ActivityIndicator color="white"/> : <Text style={s.buttonText}>+ Rutinime Ekle</Text>}
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onAIRequest} style={s.aiCard}>
        <Text style={s.aiTitle}>✦ AI ile Ürün Önerisi Al</Text>
        <Text style={s.aiText}>Cilt danışmanından ürün önerisi al, incele ve onaylayarak rutinine ekle. Otomatik rutin üretimi ayrıca geliştirilecek.</Text>
        <Text style={s.aiLink}>Önerileri keşfet →</Text>
      </TouchableOpacity>
      <View style={s.info}><Text style={s.infoText}>ⓘ AI hata yapabilir. Ürün talimatları ve içeriklerini doğrula; yeni aktifleri kullanmadan önce uyumluluğunu kontrol et.</Text></View>
      {!!feedback && <Text accessibilityRole="alert" style={s.feedback}>{feedback}</Text>}
      {(['Sabah', 'Akşam'] as const).map(p => (
        <View key={p} style={s.listSection}>
          <Text style={s.sectionTitle}>{p === 'Sabah' ? '☀' : '☾'}  {p} Rutinim</Text>
          {items.filter(x => x.period === p).length === 0 && <Text style={s.empty}>Henüz bir adım eklenmedi.</Text>}
          {items.filter(x => x.period === p).map((item, index) => (
            <View key={item.id} style={s.item}>
              <View style={s.number}><Text style={s.numberText}>{index + 1}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.itemTitle}>{item.title}</Text><Text style={s.itemCaption}>{item.source === 'manual' ? 'Sen ekledin' : 'AI önerisi • senin onayınla eklendi'}</Text></View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.title} adımını kaldır`} onPress={() => void remove(item.id)}><Text style={s.remove}>Kaldır</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
      <Text style={s.footnote}>Bu sürümde rutinler bu cihazda hesabına özel saklanır; başka cihaza otomatik aktarılmaz. Uygulamayı silersen bu kayıtlar kaybolabilir.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page:{padding:17,paddingBottom:55},eyebrow:{fontSize:10,letterSpacing:2,color:PURPLE,fontWeight:'800',marginBottom:9},
  title:{color:'#271936',fontSize:25,fontWeight:'800',marginBottom:7},desc:{color:'#61556A',fontSize:13,lineHeight:20,marginBottom:19},
  panel:{borderRadius:20,padding:17,backgroundColor:'#FFFCFF',borderWidth:1,borderColor:'#E6D9EC',marginBottom:13},
  panelTitle:{fontSize:16,color:'#281C36',fontWeight:'800',marginBottom:12},row:{flexDirection:'row',gap:9,marginBottom:13},
  chip:{borderRadius:100,backgroundColor:'#EFE2F5',paddingVertical:10,paddingHorizontal:24},chipSelected:{backgroundColor:PURPLE},
  chipText:{color:'#554365',fontWeight:'700'},chipTextSelected:{color:'#FFFFFF'},
  input:{borderWidth:1,borderColor:'#E0D3E8',backgroundColor:'#FFFFFF',borderRadius:13,paddingHorizontal:13,paddingVertical:13,color:'#281C36',marginBottom:12},
  button:{padding:14,borderRadius:13,alignItems:'center',backgroundColor:PURPLE},disabled:{opacity:.5},buttonText:{color:'#FFFFFF',fontWeight:'800'},
  aiCard:{padding:17,borderRadius:19,backgroundColor:'#E0CBEF',marginBottom:12},aiTitle:{fontWeight:'800',color:'#4B2D61',fontSize:16,marginBottom:6},aiText:{color:'#4D3C5A',fontSize:12,lineHeight:19},aiLink:{color:'#673F87',fontWeight:'800',marginTop:10,fontSize:13},
  info:{padding:11,backgroundColor:'#F3E9F7',borderRadius:11,marginBottom:13},infoText:{color:'#615170',fontSize:11,lineHeight:17},
  feedback:{color:PURPLE,marginVertical:9,fontSize:12,fontWeight:'700'},listSection:{marginTop:14},sectionTitle:{color:'#2A1B3A',fontWeight:'800',fontSize:17,marginBottom:10},
  empty:{fontSize:12,color:'#887B91',paddingVertical:12},item:{flexDirection:'row',gap:10,alignItems:'center',padding:13,backgroundColor:'#FFFFFF',borderRadius:15,borderWidth:1,borderColor:'#EAE2EF',marginBottom:8},
  number:{width:27,height:27,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#E6D5EF'},numberText:{color:PURPLE,fontWeight:'800'},
  itemTitle:{fontWeight:'700',color:'#30203F',fontSize:13},itemCaption:{fontSize:10,color:'#8A7D92',marginTop:3},remove:{color:'#805DA0',fontWeight:'700',fontSize:11},
  footnote:{fontSize:11,color:'#7B7083',lineHeight:17,marginTop:18},
});
