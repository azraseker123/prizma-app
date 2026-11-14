import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export type BeautyPhoto = { uri: string; base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' };
const BUCKET = 'beauty-products';

export async function selectBeautyPhoto(): Promise<BeautyPhoto | null> {
  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: false, quality: 0.85,
  });
  if (selection.canceled || !selection.assets?.[0]?.uri) return null;
  const compressed = await ImageManipulator.manipulateAsync(
    selection.assets[0].uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!compressed.base64) throw new Error('Fotoğraf okunamadı.');
  if (compressed.base64.length > 13_000_000) throw new Error('Fotoğraf çok büyük.');
  return { uri: compressed.uri, base64: compressed.base64, mimeType: 'image/jpeg' };
}

export async function captureBeautyPhoto(): Promise<BeautyPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Fotoğraf çekmek için kamera izni vermelisin. Ayarlardan izin verebilirsin.');
  }
  const capture = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'], allowsEditing: false, quality: 0.85,
  });
  if (capture.canceled || !capture.assets?.[0]?.uri) return null;
  const compressed = await ImageManipulator.manipulateAsync(
    capture.assets[0].uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!compressed.base64) throw new Error('Çekilen fotoğraf okunamadı.');
  if (compressed.base64.length > 13_000_000) throw new Error('Fotoğraf çok büyük.');
  return { uri: compressed.uri, base64: compressed.base64, mimeType: 'image/jpeg' };
}

export async function removeBeautyBackground(photo: BeautyPhoto | string): Promise<BeautyPhoto> {
  const inputUri = typeof photo === 'string' ? photo : photo.uri;
  const resized = await ImageManipulator.manipulateAsync(inputUri, [{ resize: { width: 1024 } }], {
    compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  if (!resized.base64 || resized.base64.length > 8_000_000) throw new Error('Fotoğraf çok büyük.');
  const { data, error } = await supabase.functions.invoke('remove-background', {
    body: { imageBase64: resized.base64, mimeType: 'image/jpeg' },
  });
  if (error) {
    let message = error.message || 'Arka plan kaldırılamadı.';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const details = await error.context.json();
        if (typeof details?.error === 'string') message = details.error;
      } catch { /* non-JSON response */ }
    }
    throw new Error(message);
  }
  if (!data?.imageBase64 || typeof data.imageBase64 !== 'string') throw new Error('Görsel oluşturulamadı.');
  return {
    uri: 'data:image/png;base64,' + data.imageBase64,
    base64: data.imageBase64,
    mimeType: 'image/png',
  };
}

export async function uploadBeautyPhoto(userId: string, photo: BeautyPhoto): Promise<string> {
  const bytes = decode(photo.base64);
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Fotoğraf 10 MB sınırını aşıyor.');
  const extension = photo.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = userId + '/beauty-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12) + '.' + extension;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: photo.mimeType, upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getBeautyPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return error ? null : data?.signedUrl || null;
}

export async function deleteBeautyPhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
