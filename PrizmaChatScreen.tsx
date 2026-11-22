import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { supabase } from './supabase';
import { addRoutineItem, removeRoutineItem, type RoutinePeriod } from './RoutineStore';
import { PRIZMA_COLORS as C } from './theme';
import { createChat, deleteChat, renameChat, listChatHistory, saveChatMessages, type ChatRecord, type ChatMessage } from './ChatHistoryStore';

type Category = 'skin' | 'hair' | 'makeup';
type Product = { name: string; brand: string; reason: string; caution: string };
type Message = ChatMessage;
type Props = { userId: string; onOutfit: () => void };
const labels: Record<Category, string> = { skin: 'Cilt', hair: 'Saç', makeup: 'Makyaj' };

export default function PrizmaChatScreen({ userId, onOutfit }: Props) {
  const historyRef = useRef<ScrollViewInstance>(null);
  const [category, setCategory] = useState<Category>('skin');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showChats, setShowChats] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [routinePeriod, setRoutinePeriod] = useState<RoutinePeriod | 'Her İkisi'>('Akşam');
  const [routinePicker,setRoutinePicker]=useState<{messageId:number;index:number}|null>(null);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [explanations, setExplanations] = useState<string[]>([]);
  const [lookIdeas, setLookIdeas] = useState<{name:string;description:string;item_ids:string[]}[]>([]);
  const [lookItems, setLookItems] = useState<Record<string,{name:string;url:string|null}>>({});
  const [lookDraftNames, setLookDraftNames] = useState<Record<number,string>>({});
  const [savedLookIndices, setSavedLookIndices] = useState<number[]>([]);
  const [lookBusy, setLookBusy] = useState(false);

  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem('prizma-chat-pins:'+userId).then(raw=>{
      if(active)setPinnedIds(raw?JSON.parse(raw):[]);
    }).catch(()=>{});
    return ()=>{active=false;};
  },[userId]);
  const togglePin = async (id:string) => {
    const next=pinnedIds.includes(id)?pinnedIds.filter(x=>x!==id):[...pinnedIds,id];
    setPinnedIds(next);
    await AsyncStorage.setItem('prizma-chat-pins:'+userId,JSON.stringify(next));
  };
  const commitRename = async () => {
    if(!renameId||!renameDraft.trim())return;
    setBusyAction('rename');
    try{
      await renameChat(userId,renameId,renameDraft);
      setChats(old=>old.map(x=>x.id===renameId?{...x,title:renameDraft.trim().slice(0,80)}:x));
      setRenameId(null);
      setRenameDraft('');
    }catch{setFeedback('Sohbet adı değiştirilemedi.');}
    finally{setBusyAction(null);}
  };
  const filteredChats=chats.filter(x=>x.title.toLocaleLowerCase('tr-TR').includes(archiveQuery.toLocaleLowerCase('tr-TR')))
    .sort((a,b)=>Number(pinnedIds.includes(b.id))-Number(pinnedIds.includes(a.id)));

  useEffect(() => {
    let alive = true;
    setMessages([]);
    setActiveChatId(null);
    setChats([]);
    setShowChats(false);
    setHistoryLoading(true);
    void listChatHistory(userId).then(records => {
      if (alive) setChats(records);
    }).catch(() => { if (alive) setFeedback('Geçmiş sohbetler yüklenemedi.'); })
      .finally(() => { if (alive) setHistoryLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  const openChat = (chat: ChatRecord) => {
    if (loading || busyAction) return;
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    setDraft('');
    setFeedback('');
    setShowChats(false);
    setConfirmDelete(null);
  };

  const startNewChat = () => {
    if (loading || busyAction) return;
    setActiveChatId(null);
    setMessages([]);
    setDraft('');
    setFeedback('');
    setShowChats(false);
    setConfirmDelete(null);
  };

  const removeChat = async (id: string) => {
    if (loading || busyAction) return;
    setBusyAction('delete');
    try {
      await deleteChat(userId, id);
      setChats(old => old.filter(chat => chat.id !== id));
      if (activeChatId === id) { setActiveChatId(null); setMessages([]); }
      setConfirmDelete(null);
      setFeedback('Sohbet silindi.');
    } catch { setFeedback('Sohbet silinemedi.'); }
    finally { setBusyAction(null); }
  };

  const send = async () => {
    const question = draft.trim();
    if (loading || historyLoading || busyAction || !question) return;
    if (messages.filter(m => m.role === 'user').length >= 10) {
      setFeedback('Bu sohbet için 10 mesaj sınırına ulaştın. Yeni sohbet açabilirsin.');
      return;
    }
    const id = Date.now();
    const requestCategory = category;
    const history = messages.filter(m => m.category === requestCategory)
      .slice(-6).map(m => ({ role: m.role, text: m.text.slice(0, 800) }));
    const sent: Message = { id, role: 'user', text: question, category: requestCategory };
    const nextMessages = [...messages, sent];
    setMessages(nextMessages);
    setDraft('');
    setFeedback('');
    setLoading(true);
    let chatId = activeChatId;
    try {
      if (!chatId) {
        const created = await createChat(userId, question);
        chatId = created.id;
        setActiveChatId(created.id);
        setChats(old => [created, ...old]);
      }
      await saveChatMessages(userId, chatId, nextMessages);
    } catch {
      setFeedback('Mesaj kaydedilemedi. İnternet bağlantını kontrol edip yeniden dene.');
      setDraft(question);
      setMessages(messages);
      setLoading(false);
      return;
    }
    let answer: Message;
    try {
      const { data, error } = await supabase.functions.invoke('beauty-advisor', {
        body: { category: requestCategory, concern: question.slice(0, 300), history },
      });
      if (error) throw new Error('AI servisine şu an ulaşılamıyor. Biraz sonra tekrar dene.');
      if (!data || typeof data.introduction !== 'string' || !Array.isArray(data.products)) {
        throw new Error('AI yanıtı beklenen biçimde gelmedi.');
      }
      const products: Product[] = data.products.slice(0, 5).filter(
        (p: unknown): p is Product => !!p && typeof p === 'object' &&
          typeof (p as Product).name === 'string' &&
          typeof (p as Product).brand === 'string' &&
          typeof (p as Product).reason === 'string' &&
          typeof (p as Product).caution === 'string'
      );
      answer = { id: id + 1, role: 'assistant', text: data.introduction.slice(0, 1300),
        category: requestCategory, products };
    } catch (error) {
      answer = { id: id + 1, role: 'assistant',
        text: error instanceof Error ? error.message : 'Yanıt alınamadı. Tekrar deneyebilirsin.',
        category: requestCategory };
    }
    const completed = [...nextMessages, answer];
    setMessages(completed);
    try {
      await saveChatMessages(userId, chatId!, completed);
      setChats(old => old.map(chat => chat.id === chatId ? { ...chat, messages: completed, updated_at: new Date().toISOString() } : chat));
    } catch { setFeedback('AI yanıtı görünüyor ama kaydedilemedi. Yeni sohbete geçmeden kontrol et.'); }
    finally { setLoading(false); }
  };

  const suggestChatLooks = async () => {
    if(lookBusy||loading||busyAction)return;
    setLookBusy(true);setFeedback('');
    try{
      const occasion=(draft.trim()||messages.filter(x=>x.role==='user').slice(-1)[0]?.text||'Günlük kullanım').slice(0,300);
      const {data,error}=await supabase.functions.invoke('generate-outfits',{
        body:{occasion,style:'Gardıroptan birbiriyle uyumlu farklı stil önerileri'},
      });
      if(error)throw new Error('Kombin AI servisine ulaşılamadı.');
      if(data?.error)throw new Error(data.error);
      const valid=(Array.isArray(data?.outfits)?data.outfits:[]).filter((x:any)=>x&&typeof x.name==='string'&&Array.isArray(x.item_ids)&&x.item_ids.length>=2&&typeof x.description==='string').slice(0,3);
      if(!valid.length)throw new Error('Kombin oluşturulamadı. Gardırobuna daha fazla parça ekle.');
      const allIds=[...new Set(valid.flatMap((x:any)=>x.item_ids))].filter((x):x is string=>typeof x==='string');
      const {data:wardrobe,error:wardrobeError}=await supabase.from('wardrobe_items')
        .select('id,name,image_path').eq('user_id',userId).in('id',allIds);
      if(wardrobeError)throw wardrobeError;
      const ownedIds=new Set((wardrobe||[]).map(x=>x.id));
      const secure=valid.filter((x:any)=>x.item_ids.every((id:string)=>ownedIds.has(id)));
      if(!secure.length)throw new Error('Kombin parçaları doğrulanamadı.');
      const images=await Promise.all((wardrobe||[]).map(async x=>{
        const {data:photo}=x.image_path?await supabase.storage.from('wardrobe').createSignedUrl(x.image_path,1800):{data:null};
        return [x.id,{name:x.name,url:photo?.signedUrl||null}] as const;
      }));
      setLookItems(Object.fromEntries(images));
      setLookDraftNames({});
      setSavedLookIndices([]);
      setLookIdeas(secure);
    }catch(error){
      setFeedback(error instanceof Error?error.message:'Kombin üretilemedi.');
    }finally{setLookBusy(false);}
  };
  const saveChatLook = async(index:number) => {
    const idea=lookIdeas[index];
    if(!idea||savedLookIndices.includes(index)||busyAction)return;
    setBusyAction('lookSave');
    try{
      const name=(lookDraftNames[index]||idea.name).trim().slice(0,100);
      if(!name)throw new Error('Kombine bir isim ver.');
      const {error}=await supabase.from('wardrobe_outfits').insert({user_id:userId,name,item_ids:idea.item_ids});
      if(error)throw error;
      setSavedLookIndices(old=>[...old,index]);
      setFeedback('Kombin gardırobuna kaydedildi.');
    }catch(e){setFeedback(e instanceof Error?e.message:'Kombin kaydedilemedi.');}
    finally{setBusyAction(null);}
  };

  const saveProduct = async (message: Message, product: Product, index: number, action: 'collection' | 'routine', periodOverride?:RoutinePeriod|'Her İkisi') => {
    const selectedPeriod = periodOverride||routinePeriod;
    const targetPeriods:RoutinePeriod[] = selectedPeriod === 'Her İkisi' ? ['Sabah','Akşam'] : [selectedPeriod];
    const alreadySaved = action === 'collection'
      ? message.savedCollection?.includes(index)
      : targetPeriods.every(period => message.savedRoutines?.includes(index + ':' + period));
    if (busyAction || loading || alreadySaved) return;
    setBusyAction('save');
    setFeedback('');
    try {
      if (action === 'collection') {
        const { error } = await supabase.from('beauty_collection').insert({
          user_id: userId, category: message.category, product_name: product.name,
          brand: product.brand, status: 'considering', source: 'ai', notes: product.reason,
        });
        if (error) throw error;
      } else {
        const createdIds:string[]=[];
        try{
          for(const period of targetPeriods){
            if(message.savedRoutines?.includes(index+':'+period))continue;
            const created=await addRoutineItem(userId, {
              title: (product.brand ? product.brand + ' — ' : '') + product.name,
              period, category: message.category, source: 'ai-suggestion', note: product.caution,
            });
            createdIds.push(created.id);
          }
        }catch(error){
          for(const id of createdIds)await removeRoutineItem(userId,id);
          throw error;
        }
      }
      const updated = messages.map(m => m.id === message.id ? ({
        ...m,
        savedCollection: action === 'collection' ? [...(m.savedCollection || []), index] : m.savedCollection,
        savedRoutines: action === 'routine' ? [...new Set([...(m.savedRoutines || []), ...targetPeriods.map(period => index + ':' + period)])] : m.savedRoutines,
      }) : m);
      setMessages(updated);
      if (activeChatId) {
        try {
          await saveChatMessages(userId, activeChatId, updated);
          setChats(old => old.map(chat => chat.id === activeChatId ? { ...chat, messages: updated } : chat));
        } catch {
          setFeedback('Ürün eklendi ancak sohbetin kayıt durumu güncellenemedi.');
          return;
        }
      }
      setFeedback(action === 'collection' ? '✓ Koleksiyona eklendi.' : selectedPeriod === 'Her İkisi' ? '✓ Sabah ve akşam rutinlerine eklendi.' : '✓ ' + selectedPeriod + ' rutinine eklendi.');
    } catch { setFeedback('Kaydedilemedi. Tekrar dene.'); }
    finally { setBusyAction(null); }
  };

  return (
    <View style={s.root}>
      <View style={s.aiPageHeading}>
        <View style={s.aiTopRow}>
          <TouchableOpacity accessibilityRole="button" onPress={()=>setShowChats(true)} style={s.aiHistoryIcon}><Text style={s.aiHistoryGlyph}>‹</Text></TouchableOpacity>
          <Text style={s.aiBrand}>PRİZMA AI</Text>
          <TouchableOpacity accessibilityRole="button" onPress={()=>setShowChats(true)} style={s.aiHistoryIcon}><Text style={s.aiHistoryGlyph}>⋮</Text></TouchableOpacity>
        </View>
        <View style={s.aiCircleShell}><View style={s.aiCircleInner}/></View>
        <Text style={s.aiSubtitle}>Stil, güzellik ve bakım danışmanın.</Text>
      </View>
      <>

      <ScrollView
        ref={historyRef}
        style={s.history}
        contentContainerStyle={s.historyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        onContentSizeChange={() => historyRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && <View style={s.aiWelcome}>
          <View style={s.aiHelloRow}><View style={s.aiMiniRing}/>
           <View style={s.aiHelloBubble}><Text style={s.aiHelloText}>Merhaba! Bugün sana nasıl yardımcı olabilirim?</Text></View>
          </View>
          <View style={s.aiActionGrid}>
            <TouchableOpacity style={[s.aiActionCard,s.aiActionPrimary]} accessibilityRole="button" onPress={()=>{void suggestChatLooks();}}>
              <Text style={[s.aiActionGlyph,s.aiActionGlyphActive]}>♧</Text><Text style={s.aiActionActiveText}>Kombin Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.aiActionCard} accessibilityRole="button" onPress={()=>{setCategory('skin');setDraft('Cilt tipime uygun ürün önerir misin?');}}>
              <Text style={s.aiActionGlyph}>▢</Text><Text style={s.aiActionLabel}>Ürün Önerisi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.aiActionCard} accessibilityRole="button" onPress={()=>setDraft('Üç günlük seyahatim için valiz planı hazırlar mısın?')}>
              <Text style={s.aiActionGlyph}>▣</Text><Text style={s.aiActionLabel}>Valiz Planla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.aiActionCard} accessibilityRole="button" onPress={()=>{setCategory('skin');setDraft('Cilt bakım rutinimi iyileştirmek için önerilerin neler?');}}>
              <Text style={s.aiActionGlyph}>▱</Text><Text style={s.aiActionLabel}>Cilt Bakım Rutini</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.aiDiscoverTitle}>Senin İçin Öneriler</Text>
          <View style={s.aiDiscoverRow}>
            <TouchableOpacity style={s.aiDiscoverCard} onPress={()=>{void suggestChatLooks();}}><Text style={s.aiDiscoverSymbol}>♧</Text><Text style={s.aiDiscoverLabel}>Günlük kombin önerileri</Text></TouchableOpacity>
            <TouchableOpacity style={s.aiDiscoverCard} onPress={()=>{setCategory('skin');setDraft('Cilt tipime göre bakım rutini önerir misin?');}}><Text style={s.aiDiscoverSymbol}>▤</Text><Text style={s.aiDiscoverLabel}>Cilt tipine göre rutin</Text></TouchableOpacity>
          </View>
          <Text style={s.aiSmallDisclaimer}>AI hata yapabilir. Ürün içeriklerini ve önerileri kontrol et.</Text>
        </View>}
        {messages.map(m => (
          <View key={m.id} style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble]}>
            <Text style={[s.role, m.role === 'user' && s.userRole]}>{m.role === 'user' ? 'SEN' : 'PRİZMA '}</Text>
            <Text numberOfLines={m.products?.length?4:undefined} style={[s.messageText, m.role === 'user' && s.userText]}>{m.text}</Text>
            {m.products?.map((p, index) => {
              const isCollected = m.savedCollection?.includes(index) === true;
              const isRoutineSaved = (routinePeriod === 'Her İkisi' ? (['Sabah','Akşam'] as const) : [routinePeriod]).every(period => m.savedRoutines?.includes(index+':'+period));
              return (
                <View key={String(index)} style={s.product}>
                  <Text style={s.brand}>{p.brand}</Text>
                  <Text style={s.productTitle}>{p.name}</Text>
                  <TouchableOpacity accessibilityRole="button" onPress={()=>setExplanations(old=>old.includes(m.id+':'+index)?old.filter(k=>k!==m.id+':'+index):[...old,m.id+':'+index])}>
                    <Text style={s.explainAction}>Neden önerildi? {explanations.includes(m.id+':'+index)?'⌃':'⌄'}</Text>
                  </TouchableOpacity>
                  {explanations.includes(m.id+':'+index)&&<View><Text style={s.productInfo}>{p.reason}</Text>{!!p.caution&&<Text style={s.caution}>{p.caution}</Text>}</View>}
                  <TouchableOpacity style={s.save} disabled={!!busyAction || isCollected} onPress={() => saveProduct(m, p, index, 'collection')}>
                    <Text style={s.saveText}>{isCollected ? '✓ Koleksiyonda' : '+ Koleksiyona Ekle'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.routineSave} disabled={!!busyAction} onPress={()=>setRoutinePicker({messageId:m.id,index})}>
                    <Text style={s.routineSaveText}>{m.savedRoutines?.some(x=>x.startsWith(index+':'))?'✓ Rutine Eklendi / Düzenle':'+ Rutine Ekle'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
        {loading && <View style={s.loading}><ActivityIndicator color={C.lavender}/><Text style={s.loadingText}>PRİZMA düşünüyor...</Text></View>}
        {!!feedback && <Text style={s.feedback}>{feedback}</Text>}
        <Text style={s.aiSmallDisclaimer}>ⓘ AI hata yapabilir. Ürün içeriğini ve kullanım talimatlarını kontrol et.</Text>
      </ScrollView>

      <View style={s.composer}>
        <TouchableOpacity style={s.aiComposerPlus} onPress={()=>setShowChats(true)} accessibilityRole="button" accessibilityLabel="Sohbet arşivi"><Text style={s.aiComposerPlusText}>＋</Text></TouchableOpacity>
        <TextInput style={s.input} multiline maxLength={300} placeholder="PRİZMA'ya yaz..." placeholderTextColor="#87839A" value={draft} onChangeText={setDraft} editable={!loading} />
        <TouchableOpacity style={[s.send, (!draft.trim() || loading || historyLoading || !!busyAction) && s.sendDisabled]} onPress={() => { void send(); }} disabled={!draft.trim() || loading || historyLoading || !!busyAction}>
          <Text style={s.sendText}>➤</Text>
        </TouchableOpacity>
      </View>

      <Modal transparent animationType="slide" visible={routinePicker!==null} onRequestClose={()=>setRoutinePicker(null)}>
        <View style={s.lookOverlay}><View style={s.routinePickerSheet}>
          <Text style={s.routinePickerTitle}>Hangi bakım rutinine ekleyelim?</Text>
          <Text style={s.routinePickerHint}>Ürüne özel kullanım talimatlarını kontrol et.</Text>
          {(['Sabah','Akşam','Her İkisi'] as const).map(period=><TouchableOpacity key={period} disabled={!!busyAction} style={s.routinePickerOption} onPress={()=>{
            const item=routinePicker;if(!item)return;
            const m=messages.find(x=>x.id===item.messageId);const product=m?.products?.[item.index];
            setRoutinePicker(null);if(m&&product)void saveProduct(m,product,item.index,'routine',period);
          }}><Text style={s.routinePickerOptionText}>{period}</Text><Text style={s.routinePickerOptionText}>›</Text></TouchableOpacity>)}
          <TouchableOpacity style={s.routinePickerCancel} onPress={()=>setRoutinePicker(null)}><Text style={s.routinePickerHint}>Vazgeç</Text></TouchableOpacity>
        </View></View>
      </Modal>
      <Modal visible={lookIdeas.length>0} transparent animationType="slide" onRequestClose={()=>setLookIdeas([])}>
        <View style={s.lookOverlay}>
          <View style={s.lookSheet}>
            <View style={s.lookSheetHeader}>
              <Text style={s.lookSheetTitle}>PRİZMA AI Kombin Önerileri</Text>
              <TouchableOpacity onPress={()=>setLookIdeas([])} accessibilityRole="button"><Text style={s.lookClose}>×</Text></TouchableOpacity>
            </View>
            <Text style={s.lookSheetDesc}>Gardırobundaki gerçek parçalardan oluşturuldu. Dilersen adını düzenleyerek kaydet.</Text>
            <ScrollView contentContainerStyle={s.lookCards} keyboardShouldPersistTaps="handled">
              {lookIdeas.map((idea,index)=><View key={index} style={s.lookCard}>
                <View style={s.lookGarmentRow}>{idea.item_ids.slice(0,4).map(id=>(
                  <View key={id} style={s.lookGarment}>
                    {lookItems[id]?.url?<Image source={{uri:lookItems[id].url!}} resizeMode="contain" style={s.lookPhoto}/>:<Text style={s.lookFallback}>♧</Text>}
                    <Text style={s.lookItemLabel} numberOfLines={1}>{lookItems[id]?.name||'Parça'}</Text>
                  </View>
                ))}</View>
                <TextInput style={s.lookNameInput} maxLength={100} value={lookDraftNames[index]??idea.name} onChangeText={value=>setLookDraftNames(old=>({...old,[index]:value}))}/>
                <Text style={s.lookDescription} numberOfLines={3}>{idea.description}</Text>
                <TouchableOpacity disabled={!!busyAction||savedLookIndices.includes(index)}
                  style={s.lookSaveButton} onPress={()=>{void saveChatLook(index);}}>
                  <Text style={s.lookSaveText}>{savedLookIndices.includes(index)?'✓ Kaydedildi':'Kombini Kaydet'}</Text>
                </TouchableOpacity>
              </View>)}
            </ScrollView>
            <TouchableOpacity onPress={()=>{setLookIdeas([]);onOutfit();}} style={s.lookStudioButton}><Text style={s.lookStudioText}>Kombin Editörüne Git ›</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      {showChats && (
        <View style={s.drawerOverlay}>
          <TouchableOpacity style={s.drawerScrim} onPress={()=>setShowChats(false)} accessibilityRole="button" accessibilityLabel="Sohbet arşivini kapat"/>
        <View style={s.sidePanel}>
        <View style={s.drawerHeading}><Text style={s.archiveTitle}>Sohbet Geçmişi</Text><TouchableOpacity onPress={()=>setShowChats(false)}><Text style={s.drawerClose}>×</Text></TouchableOpacity></View>
        <TextInput style={s.archiveInput} placeholder="Sohbetlerinde ara..." placeholderTextColor={C.muted} value={archiveQuery} onChangeText={setArchiveQuery}/>
        <TouchableOpacity style={s.drawerNewChat} onPress={startNewChat} accessibilityRole="button"><Text style={s.drawerNewText}>＋  Yeni Sohbet</Text></TouchableOpacity>
        <ScrollView style={s.chatList} contentContainerStyle={s.chatListContent} keyboardShouldPersistTaps="handled">
          {historyLoading && <ActivityIndicator color={C.lavender} />}
          {!historyLoading && filteredChats.length === 0 && <Text style={s.listEmpty}>Sohbet bulunamadı.</Text>}
          {filteredChats.map(chat => (
            <View key={chat.id} style={s.chatListRow}>
              <TouchableOpacity style={s.chatListOpen} onPress={() => openChat(chat)} disabled={loading || !!busyAction}>
                <Text style={s.chatListTitle} numberOfLines={2}>{pinnedIds.includes(chat.id)?'●  ':''}{chat.title}</Text>
                <Text style={s.chatListMeta}>{chat.messages.length} mesaj</Text>
              </TouchableOpacity>
              <View style={s.archiveActions}>
                <TouchableOpacity onPress={()=>{void togglePin(chat.id);}} disabled={!!busyAction} accessibilityRole="button"><Text style={s.archiveActionText}>{pinnedIds.includes(chat.id)?'Sabiti kaldır':'Sabitle'}</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>{setRenameId(chat.id);setRenameDraft(chat.title);}} disabled={!!busyAction} accessibilityRole="button"><Text style={s.archiveActionText}>Adlandır</Text></TouchableOpacity>
              </View>
              {confirmDelete === chat.id ? (
                <View style={s.confirmRow}>
                  <TouchableOpacity onPress={() => void removeChat(chat.id)} disabled={!!busyAction}>
                    <Text style={s.deleteConfirm}>Evet, sil</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirmDelete(null)}>
                    <Text style={s.deleteCancel}>Vazgeç</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setConfirmDelete(chat.id)} disabled={!!busyAction}>
                  <Text style={s.deleteText}>Sil</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
        {renameId && <View style={s.renameBox}>
          <TextInput value={renameDraft} onChangeText={setRenameDraft} maxLength={80} style={s.archiveInput} placeholder="Yeni sohbet adı"/>
          <View style={s.renameActions}>
            <TouchableOpacity onPress={()=>setRenameId(null)} accessibilityRole="button"><Text style={s.archiveActionText}>Vazgeç</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{void commitRename();}} disabled={!!busyAction} accessibilityRole="button"><Text style={s.archiveActionText}>Kaydet</Text></TouchableOpacity>
          </View>
        </View>}
        </View>

        </View>
      )}
      </>
    </View>
  );
}

const s = StyleSheet.create({
 routinePickerSheet:{backgroundColor:'#FFFFFF',paddingHorizontal:20,paddingTop:21,paddingBottom:33,borderTopLeftRadius:23,borderTopRightRadius:23},
 routinePickerTitle:{fontSize:18,fontWeight:'700',color:C.ink},
 routinePickerHint:{fontSize:12,color:C.muted,marginTop:9},
 routinePickerOption:{minHeight:49,marginTop:11,borderColor:C.border,borderWidth:1,borderRadius:13,paddingHorizontal:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 routinePickerOptionText:{fontSize:14,fontWeight:'700',color:C.lavender},
 routinePickerCancel:{minHeight:45,alignItems:'center',justifyContent:'center'},

  aiPageHeading:{alignItems:'center',backgroundColor:'#FFFFFF',paddingTop:3,paddingBottom:12},
  aiTopRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',width:'100%',marginBottom:15},
  aiHistoryIcon:{width:36,height:42,alignItems:'center',justifyContent:'center'},
  aiHistoryGlyph:{fontSize:28,color:C.ink},aiBrand:{fontFamily:'serif',fontSize:21,letterSpacing:3,color:C.ink},
  aiCircleShell:{width:62,height:62,borderWidth:3,borderColor:'#B044F2',borderRadius:31,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF',shadowColor:'#A629E7',shadowOpacity:.9,shadowRadius:9,elevation:9},
  aiCircleInner:{height:48,width:48,borderRadius:24,borderWidth:1,borderColor:'#E3B7FF'},
  aiSubtitle:{marginTop:14,fontSize:13,color:C.ink},
  aiWelcome:{paddingVertical:11,gap:17},aiHelloRow:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:7},
  aiMiniRing:{height:23,width:23,borderColor:'#B044F2',borderWidth:2,borderRadius:12,backgroundColor:'#FFFFFF'},
  aiHelloBubble:{flex:1,borderWidth:1,borderColor:C.border,borderRadius:17,padding:15,backgroundColor:'#FFFFFF'},
  aiHelloText:{fontSize:13,color:C.ink,lineHeight:20},
  aiActionGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},aiActionCard:{width:'48%',minHeight:112,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.border,borderRadius:17,alignItems:'center',justifyContent:'center',padding:12,gap:5},
  aiActionPrimary:{backgroundColor:C.lavender,borderColor:C.lavender},aiActionGlyph:{fontSize:27,color:C.lavender},aiActionGlyphActive:{color:'#FFFFFF'},
  aiActionLabel:{fontSize:13,color:C.ink,textAlign:'center'},aiActionActiveText:{fontSize:13,color:'#FFFFFF',fontWeight:'700',textAlign:'center'},
  aiDiscoverTitle:{fontSize:16,fontWeight:'700',color:C.ink,marginTop:8},
  aiDiscoverRow:{flexDirection:'row',gap:9},aiDiscoverCard:{flex:1,borderWidth:1,borderColor:C.border,borderRadius:15,padding:11,minHeight:77,flexDirection:'row',gap:8,alignItems:'center'},aiDiscoverSymbol:{fontSize:25,color:C.lavender},aiDiscoverLabel:{fontSize:11,color:C.ink,flex:1,fontWeight:'600'},
  aiSmallDisclaimer:{fontSize:10,color:C.muted,textAlign:'center'},
  aiComposerPlus:{width:41,height:43,borderRadius:22,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  aiComposerPlusText:{fontSize:22,color:C.lavender},
  drawerHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  drawerClose:{fontSize:28,color:C.ink},drawerNewChat:{minHeight:49,marginBottom:13,borderRadius:25,backgroundColor:C.lavender,alignItems:'center',justifyContent:'center'},
  drawerNewText:{fontSize:13,fontWeight:'700',color:'#FFFFFF'},

  lookOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(36,33,36,0.33)'},
  lookSheet:{maxHeight:'83%',padding:17,paddingBottom:24,borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:C.white},
  lookSheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  lookSheetTitle:{fontSize:17,color:C.ink,fontWeight:'700'},
  lookClose:{color:C.muted,fontSize:28},
  lookSheetDesc:{fontSize:12,color:C.muted,lineHeight:18,marginTop:7,marginBottom:12},
  lookCards:{gap:10,paddingBottom:10},
  lookCard:{padding:12,borderColor:C.border,borderWidth:1,borderRadius:15,backgroundColor:C.white},
  lookGarmentRow:{flexDirection:'row',gap:7,marginBottom:9},
  lookGarment:{flex:1,alignItems:'center',backgroundColor:C.pale,borderRadius:9,padding:4,minHeight:75},
  lookPhoto:{height:54,width:'100%'},lookFallback:{fontSize:25,color:C.lavender},lookItemLabel:{fontSize:9,color:C.muted},
  lookNameInput:{borderColor:C.border,borderWidth:1,borderRadius:9,padding:8,fontSize:13,color:C.ink,fontWeight:'700'},
  lookDescription:{fontSize:11,color:C.muted,lineHeight:16,marginTop:7},
  lookSaveButton:{minHeight:44,backgroundColor:C.lavender,borderRadius:11,alignItems:'center',justifyContent:'center',marginTop:10},
  lookSaveText:{fontSize:12,color:C.white,fontWeight:'700'},
  lookStudioButton:{minHeight:48,alignItems:'center',justifyContent:'center'},
  lookStudioText:{color:C.lavender,fontWeight:'700',fontSize:13},

  drawerOverlay:{position:'absolute',top:0,bottom:0,left:0,right:0,zIndex:500,flexDirection:'row',justifyContent:'flex-end'},
  drawerScrim:{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'rgba(36,33,36,0.27)'},
  explainAction:{fontSize:12,color:C.lavender,fontWeight:'700',marginTop:7,marginBottom:4},
  sidePanel:{height:'100%',width:'86%',maxWidth:370,backgroundColor:C.white,borderLeftWidth:1,borderColor:C.border,padding:13,elevation:10},
  archiveTitle:{fontSize:17,fontWeight:'700',color:C.ink,marginBottom:10},
  archiveInput:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:12,padding:10,minHeight:44,fontSize:13,color:C.ink,marginBottom:10},
  archiveActions:{gap:6,justifyContent:'center'},
  archiveActionText:{color:C.lavender,fontSize:11,fontWeight:'700'},
  renameBox:{padding:10,borderTopWidth:1,borderTopColor:C.border},
  renameActions:{flexDirection:'row',gap:25,justifyContent:'flex-end'},

  chatControls: { flexDirection: 'row', gap: 10, marginBottom: 9 },
  historyButton: { flex: 1, backgroundColor: C.lilac, borderRadius: 12, padding: 12 },
  historyButtonText: { color: C.navy, fontSize: 12, fontWeight: '800' },
  newChatButton: { borderWidth: 1, borderColor: C.lavender, borderRadius: 12, padding: 12 },
  newChatButtonText: { color: C.lavender, fontSize: 12, fontWeight: '800' },
  chatList: { flex: 1, minHeight: 0 }, chatListContent: { paddingBottom: 22, gap: 8 },
  chatListRow: { flexDirection: 'row', backgroundColor: C.white, borderColor: C.border, borderWidth: 1,
    borderRadius: 14, padding: 12, alignItems: 'center', gap: 10 },
  chatListOpen: { flex: 1 }, chatListTitle: { color: C.navy, fontSize: 13, fontWeight: '800' },
  chatListMeta: { color: C.muted, fontSize: 10, marginTop: 5 },
  deleteText: { color: C.lavender, fontSize: 12, fontWeight: '800', padding: 9 },
  confirmRow: { gap: 9 }, deleteConfirm: { color: '#AD3852', fontSize: 11, fontWeight: '800' },
  deleteCancel: { color: C.muted, fontSize: 11 },
  listEmpty: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 24 },
  root: { flex: 1, minHeight: 0, paddingBottom: 4 }, heading: { marginBottom: 10 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: C.lavender, letterSpacing: 1.6, marginBottom: 8 },
  title: { color: C.navy, fontSize: 21, fontWeight: '800', marginBottom: 6 },
  hint: { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border, borderRadius: 18, backgroundColor: C.white },
  chipActive: { backgroundColor: C.lavender, borderColor: C.lavender },
  chipText: { color: C.navy, fontSize: 11, fontWeight: '700' }, chipTextActive: { color: C.white },
  outfitChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: C.lilac },
  outfitChipText: { color: C.navy, fontSize: 11, fontWeight: '800' },
  history: { flex: 1, minHeight: 0 }, historyContent: { paddingTop: 11, paddingBottom: 22, gap: 12 },
  empty: { backgroundColor: C.pale, borderRadius: 20, padding: 24, alignItems: 'center' },
  emptyIcon: { fontSize: 35, color: C.lavender }, emptyTitle: { color: C.navy, fontSize: 19, fontWeight: '800', marginVertical: 8 },
  emptyText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 19 },
  emptyNotice: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 14 },
  bubble: { padding: 15, borderRadius: 19, maxWidth: '94%' }, userBubble: { backgroundColor: C.lavender, alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
  role: { color: C.lavender, fontWeight: '800', fontSize: 10, marginBottom: 7 },
  userRole: { color: '#EDE4FF' }, messageText: { color: C.navy, fontSize: 13, lineHeight: 20 },
  userText: { color: C.white }, product: { marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderColor: C.border },
  brand: { color: C.lavender, fontWeight: '700', fontSize: 11 }, productTitle: { color: C.navy, fontWeight: '800', fontSize: 14, marginVertical: 5 },
  productInfo: { color: C.ink, fontSize: 12, lineHeight: 18 }, caution: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  save: { marginTop: 10, backgroundColor: C.lavender, borderRadius: 11, padding: 10, alignItems: 'center' },
  saveText: { color: C.white, fontWeight: '800', fontSize: 11 }, routineRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  period: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: C.pale, borderRadius: 18 },
  periodSelected: { backgroundColor: C.lilac }, periodText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  periodTextSelected: { color: C.navy }, routineSave: { marginTop: 8, borderWidth: 1, borderColor: C.lavender, borderRadius: 11, padding: 10, alignItems: 'center' },
  routineSaveText: { color: C.lavender, fontWeight: '800', fontSize: 11 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 }, loadingText: { color: C.muted, fontSize: 12 },
  feedback: { color: C.lavender, fontWeight: '700', fontSize: 12, paddingVertical: 8 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 9 },
  input: { flex: 1, minHeight: 47, maxHeight: 100, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, color: C.navy, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, fontSize: 13 },
  send: { backgroundColor: C.lavender, width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.45 }, sendText: { color: C.white, fontSize: 22 },
  newChat: { alignItems: 'center', padding: 9 }, newChatText: { color: C.lavender, fontSize: 11, fontWeight: '700' },
});
