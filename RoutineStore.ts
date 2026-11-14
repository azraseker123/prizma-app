import AsyncStorage from '@react-native-async-storage/async-storage';

export type RoutinePeriod = 'Sabah' | 'Akşam';
export type RoutineCategory = 'skin' | 'hair' | 'makeup';
export type RoutineItem = {
  id: string;
  title: string;
  period: RoutinePeriod;
  category?: RoutineCategory;
  createdAt: string;
  note?: string;
  source: 'manual' | 'ai-suggestion';
};

const storageKey = (userId: string) => `prizma_routines_v1:${userId}`;

export async function getRoutineItems(userId: string): Promise<RoutineItem[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is RoutineItem => !!x && typeof x === 'object' &&
      typeof x.id === 'string' && typeof x.title === 'string' &&
      (x.period === 'Sabah' || x.period === 'Akşam') &&
      (x.source === 'manual' || x.source === 'ai-suggestion') &&
      (x.category === undefined || ['skin', 'hair', 'makeup'].includes(x.category)));
  } catch { return []; }
}

export async function addRoutineItem(userId: string, item: Omit<RoutineItem, 'id' | 'createdAt'>) {
  const existing = await getRoutineItems(userId);
  if (existing.length >= 100) throw new Error('En fazla 100 rutin adımı ekleyebilirsin.');
  const next: RoutineItem = {
    ...item,
    title: item.title.trim().slice(0, 100),
    note: item.note?.slice(0, 300),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };
  if (!next.title) throw new Error('Rutin adımı boş olamaz.');
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...existing, next]));
  return next;
}

export async function removeRoutineItem(userId: string, id: string) {
  const existing = await getRoutineItems(userId);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(existing.filter(x => x.id !== id)));
}
