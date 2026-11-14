import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { supabase } from './supabase';
import { addRoutineItem, type RoutinePeriod } from './RoutineStore';
import { PRIZMA_COLORS as C } from './theme';
import { createChat, deleteChat, listChatHistory, saveChatMessages, type ChatRecord, type ChatMessage } from './ChatHistoryStore';

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
  const [routinePeriod, setRoutinePeriod] = useState<RoutinePeriod>('Akşam');

  useEffect(() => {
    let alive = true;
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

  const saveProduct = async (message: Message, product: Product, index: number, action: 'collection' | 'routine') => {
    const selectedPeriod = routinePeriod;
    const alreadySaved = action === 'collection'
      ? message.savedCollection?.includes(index)
      : message.savedRoutines?.includes(index + ':' + selectedPeriod);
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
        await addRoutineItem(userId, {
          title: (product.brand ? product.brand + ' — ' : '') + product.name,
          period: selectedPeriod, source: 'ai-suggestion', note: product.caution,
        });
      }
      const updated = messages.map(m => m.id === message.id ? ({
        ...m,
        savedCollection: action === 'collection' ? [...(m.savedCollection || []), index] : m.savedCollection,
        savedRoutines: action === 'routine' ? [...(m.savedRoutines || []), index + ':' + selectedPeriod] : m.savedRoutines,
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
      setFeedback(action === 'collection' ? '✓ Koleksiyona eklendi.' : '✓ ' + selectedPeriod + ' rutinine eklendi.');
    } catch { setFeedback('Kaydedilemedi. Tekrar dene.'); }
    finally { setBusyAction(null); }
  };

  return (
    <View style={s.root}>
      <View style={s.chatControls}>
        <TouchableOpacity style={s.historyButton} onPress={() => setShowChats(value => !value)} disabled={loading || !!busyAction}>
          <Text style={s.historyButtonText}>☰ Sohbetlerim ({chats.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.newChatButton} onPress={startNewChat} disabled={loading || !!busyAction}>
          <Text style={s.newChatButtonText}>＋ Yeni</Text>
        </TouchableOpacity>
      </View>
      {showChats ? (
        <ScrollView style={s.chatList} contentContainerStyle={s.chatListContent} keyboardShouldPersistTaps="handled">
          {historyLoading && <ActivityIndicator color={C.lavender} />}
          {!historyLoading && chats.length === 0 && <Text style={s.listEmpty}>Henüz kayıtlı sohbet yok.</Text>}
          {chats.map(chat => (
            <View key={chat.id} style={s.chatListRow}>
              <TouchableOpacity style={s.chatListOpen} onPress={() => openChat(chat)} disabled={loading || !!busyAction}>
                <Text style={s.chatListTitle} numberOfLines={2}>{chat.title}</Text>
                <Text style={s.chatListMeta}>{chat.messages.length} mesaj</Text>
              </TouchableOpacity>
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
      ) : (<>
      <View style={s.heading}>
        <Text style={s.eyebrow}>PRİZMA ✦ KİŞİSEL ASİSTAN</Text>
        <Text style={s.title}>Sana nasıl yardımcı olayım?</Text>
        <Text style={s.hint}>Cilt, saç ve makyaj önerileri için yaz. Kombin önerileri Gardırop AI'da.</Text>
        <View style={s.categories}>
          {(['skin', 'hair', 'makeup'] as const).map(key => (
            <TouchableOpacity key={key} style={[s.chip, category === key && s.chipActive]} onPress={() => setCategory(key)} disabled={loading}>
              <Text style={[s.chipText, category === key && s.chipTextActive]}>{labels[key]}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.outfitChip} onPress={onOutfit}>
            <Text style={s.outfitChipText}>✦ Kombin AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={historyRef}
        style={s.history}
        contentContainerStyle={s.historyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        onContentSizeChange={() => historyRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>✦</Text>
            <Text style={s.emptyTitle}>PRİZMA'ya sor</Text>
            <Text style={s.emptyText}>Örneğin: “Hassas cildim için hafif bir nemlendirici önerir misin?”</Text>
            <Text style={s.emptyNotice}>AI hata yapabilir. Önerileri ve ürün talimatlarını kontrol et.</Text>
          </View>
        )}
        {messages.map(m => (
          <View key={m.id} style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble]}>
            <Text style={[s.role, m.role === 'user' && s.userRole]}>{m.role === 'user' ? 'SEN' : 'PRİZMA ✦'}</Text>
            <Text style={[s.messageText, m.role === 'user' && s.userText]}>{m.text}</Text>
            {m.products?.map((p, index) => {
              const isCollected = m.savedCollection?.includes(index) === true;
              const isRoutineSaved = m.savedRoutines?.includes(index + ':' + routinePeriod) === true;
              return (
                <View key={String(index)} style={s.product}>
                  <Text style={s.brand}>{p.brand}</Text>
                  <Text style={s.productTitle}>{p.name}</Text>
                  <Text style={s.productInfo}>{p.reason}</Text>
                  <Text style={s.caution}>Dikkat: {p.caution}</Text>
                  <TouchableOpacity style={s.save} disabled={!!busyAction || isCollected} onPress={() => saveProduct(m, p, index, 'collection')}>
                    <Text style={s.saveText}>{isCollected ? '✓ Koleksiyonda' : '+ Koleksiyona Ekle'}</Text>
                  </TouchableOpacity>
                  <View style={s.routineRow}>
                    {(['Sabah', 'Akşam'] as const).map(period => (
                      <TouchableOpacity key={period} onPress={() => setRoutinePeriod(period)} style={[s.period, period === routinePeriod && s.periodSelected]}>
                        <Text style={[s.periodText, period === routinePeriod && s.periodTextSelected]}>{period}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={s.routineSave} disabled={!!busyAction || isRoutineSaved} onPress={() => saveProduct(m, p, index, 'routine')}>
                    <Text style={s.routineSaveText}>{isRoutineSaved ? '✓ Rutine eklendi' : '+ Rutine Ekle'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
        {loading && <View style={s.loading}><ActivityIndicator color={C.lavender}/><Text style={s.loadingText}>PRİZMA düşünüyor...</Text></View>}
        {!!feedback && <Text style={s.feedback}>{feedback}</Text>}
      </ScrollView>

      <View style={s.composer}>
        <TextInput style={s.input} multiline maxLength={300} placeholder="PRİZMA'ya yaz..." placeholderTextColor="#87839A" value={draft} onChangeText={setDraft} editable={!loading} />
        <TouchableOpacity style={[s.send, (!draft.trim() || loading || historyLoading || !!busyAction) && s.sendDisabled]} onPress={() => { void send(); }} disabled={!draft.trim() || loading || historyLoading || !!busyAction}>
          <Text style={s.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
      </>)}
    </View>
  );
}

const s = StyleSheet.create({
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
