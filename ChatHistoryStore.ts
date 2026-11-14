import { supabase } from './supabase';

export type ChatCategory = 'skin' | 'hair' | 'makeup';
export type ChatProduct = { name: string; brand: string; reason: string; caution: string };
export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  category: ChatCategory;
  products?: ChatProduct[];
  savedCollection?: number[];
  savedRoutines?: string[];
};
export type ChatRecord = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updated_at: string;
};

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).filter((m): m is ChatMessage => {
    if (!m || typeof m !== 'object') return false;
    const x = m as Record<string, unknown>;
    return typeof x.id === 'number' && Number.isFinite(x.id) &&
      (x.role === 'user' || x.role === 'assistant') &&
      typeof x.text === 'string' &&
      ['skin', 'hair', 'makeup'].includes(String(x.category));
  });
}

function readRow(row: Record<string, unknown>): ChatRecord {
  return {
    id: String(row.id),
    title: typeof row.title === 'string' ? row.title : 'Yeni sohbet',
    messages: parseMessages(row.messages),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
  };
}

export async function listChatHistory(userId: string): Promise<ChatRecord[]> {
  const { data, error } = await supabase.from('prizma_ai_chats')
    .select('id,title,messages,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []).map(row => readRow(row as Record<string, unknown>));
}

export async function createChat(userId: string, firstQuestion: string): Promise<ChatRecord> {
  const title = firstQuestion.trim().slice(0, 65) || 'Yeni sohbet';
  const { data, error } = await supabase.from('prizma_ai_chats')
    .insert({ user_id: userId, title, messages: [] })
    .select('id,title,messages,updated_at')
    .single();
  if (error || !data) throw error || new Error('Sohbet oluşturulamadı.');
  return readRow(data as Record<string, unknown>);
}

export async function saveChatMessages(userId: string, chatId: string, messages: ChatMessage[]): Promise<void> {
  const safeMessages = messages.slice(-60);
  if (JSON.stringify(safeMessages).length > 160000) {
    throw new Error('Sohbet çok uzadı. Yeni sohbet açmalısın.');
  }
  const { error } = await supabase.from('prizma_ai_chats')
    .update({ messages: safeMessages, updated_at: new Date().toISOString() })
    .eq('id', chatId).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteChat(userId: string, chatId: string): Promise<void> {
  const { error } = await supabase.from('prizma_ai_chats')
    .delete().eq('id', chatId).eq('user_id', userId);
  if (error) throw error;
}
