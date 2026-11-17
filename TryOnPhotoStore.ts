import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode, encode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'tryon-avatars';
export type TryOnPhoto = { uri: string; base64: string; mimeType?: 'image/jpeg' | 'image/png' };

export async function prepareTryOnPhoto(uri: string): Promise<TryOnPhoto> {
  const reduced = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 960 } }], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.65, base64: true });
  if (!reduced.base64) throw new Error('Fotoğraf okunamadı.');
  if (decode(reduced.base64).byteLength > 10 * 1024 * 1024) throw new Error('Fotoğraf 10 MB sınırını aşıyor.');
  return { uri: reduced.uri, base64: reduced.base64, mimeType: 'image/jpeg' };
}

export const PENDING_TRYON_CAMERA_KEY = 'prizma:pending-tryon-camera-v1';
export async function chooseTryOnPhoto(camera: boolean, purpose: 'person' | 'garment' = 'garment'): Promise<TryOnPhoto | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Fotoğraf çekmek için kamera iznine ihtiyacımız var. Ayarlardan açabilirsin.');
    }
  }
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], allowsEditing: false, quality: camera ? 0.6 : 0.8,
  };
  if (camera) await AsyncStorage.setItem(PENDING_TRYON_CAMERA_KEY, JSON.stringify({ purpose, time: Date.now() }));
  const result = camera
    ? await ImagePicker.launchCameraAsync({ ...pickerOptions, cameraType: ImagePicker.CameraType.back })
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (camera) await AsyncStorage.removeItem(PENDING_TRYON_CAMERA_KEY);
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return prepareTryOnPhoto(result.assets[0].uri);
}

export async function readTryOnPhoto(userId: string): Promise<{ path: string; url: string } | null> {
  const { data, error } = await supabase.from('tryon_profiles')
    .select('photo_path').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data?.photo_path) return null;
  const { data: signed, error: urlError } = await supabase.storage
    .from(BUCKET).createSignedUrl(data.photo_path, 3600);
  if (urlError || !signed?.signedUrl) throw urlError || new Error('Fotoğraf açılamadı.');
  return { path: data.photo_path, url: signed.signedUrl };
}

export async function saveTryOnPhoto(userId: string, photo: TryOnPhoto, previousPath?: string): Promise<void> {
  const mime = photo.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const path = userId + '/avatar-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12) + (mime === 'image/png' ? '.png' : '.jpg');
  const bytes = decode(photo.base64);
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Fotoğraf 10 MB sınırını aşıyor.');
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime, upsert: false,
  });
  if (uploadError) throw uploadError;
  const { error: profileError } = await supabase.from('tryon_profiles').upsert({
    user_id: userId, photo_path: path, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (profileError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw profileError;
  }
  if (previousPath && previousPath !== path && previousPath.startsWith(userId + '/')) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([previousPath]);
    if (cleanupError) console.warn('Previous avatar cleanup:', cleanupError.message);
  }
}

export async function deleteTryOnPhoto(userId: string, path: string): Promise<void> {
  if (!path.startsWith(userId + '/')) throw new Error('Fotoğraf yolu geçersiz.');
  // Remove the photo first; if it fails, keep the profile intact so deletion can be retried.
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);
  if (storageError) throw storageError;
  const { error: profileError } = await supabase.from('tryon_profiles').delete()
    .eq('user_id', userId).eq('photo_path', path);
  if (profileError) throw profileError;
}


/** Validates real photos via a server-side AI check; fails closed on API errors. */
export async function validateTryOnImage(photo: TryOnPhoto, kind: 'person' | 'garment'): Promise<void> {
  const { data, error } = await supabase.functions.invoke('validate-tryon-image', {
    body: { imageBase64: photo.base64, kind, consent: true },
  });
  if (error) {
    let message = error.message || 'Görsel kontrolü tamamlanamadı.';
    if (error.context && typeof error.context.json === 'function') {
      try { const detail = await error.context.json(); if (typeof detail?.error === 'string') message = detail.error; } catch { /* ignore */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  if (data?.valid !== true) throw new Error(typeof data?.reason === 'string' ? data.reason : 'Bu fotoğraf sanal deneme için uygun değil.');
}

/** Runs a paid background removal only after explicit action; replaces the current private avatar. */
export async function removeSavedTryOnBackground(userId: string, path: string): Promise<void> {
  if (!path.startsWith(userId + '/')) throw new Error('Fotoğraf yolu geçersiz.');
  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
  if (downloadError || !file) throw downloadError || new Error('Fotoğraf okunamadı.');
  const rawBytes = await file.arrayBuffer();
  if (rawBytes.byteLength > 6 * 1024 * 1024) throw new Error('Fotoğraf işlenemeyecek kadar büyük.');
  const { data, error } = await supabase.functions.invoke('remove-background', {
    body: { imageBase64: encode(rawBytes), mimeType: path.endsWith('.png') ? 'image/png' : 'image/jpeg' },
  });
  if (error) {
    let message = error.message || 'Arka plan kaldırılamadı.';
    if (error.context && typeof error.context.json === 'function') {
      try { const details = await error.context.json(); if (typeof details?.error === 'string') message = details.error; } catch { /* response not JSON */ }
    }
    throw new Error(message);
  }
  if (typeof data?.imageBase64 !== 'string' || !data.imageBase64) throw new Error('Arka plan kaldırma sonucu alınamadı.');
  await saveTryOnPhoto(userId, { uri: 'data:image/png;base64,' + data.imageBase64, base64: data.imageBase64, mimeType: 'image/png' }, path);
}
