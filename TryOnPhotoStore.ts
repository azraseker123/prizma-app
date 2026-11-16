import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'tryon-avatars';
export type TryOnPhoto = { uri: string; base64: string };

export async function chooseTryOnPhoto(camera: boolean): Promise<TryOnPhoto | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Fotoğraf çekmek için kamera iznine ihtiyacımız var. Ayarlardan açabilirsin.');
    }
  }
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], allowsEditing: false, quality: 0.85,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  const reduced = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 1200 } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true },
  );
  if (!reduced.base64) throw new Error('Fotoğraf okunamadı.');
  if (decode(reduced.base64).byteLength > 10 * 1024 * 1024) throw new Error('Fotoğraf 10 MB sınırını aşıyor.');
  return { uri: reduced.uri, base64: reduced.base64 };
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
  const path = userId + '/avatar-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12) + '.jpg';
  const bytes = decode(photo.base64);
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Fotoğraf 10 MB sınırını aşıyor.');
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg', upsert: false,
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
