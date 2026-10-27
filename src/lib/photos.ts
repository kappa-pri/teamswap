import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'item-photos';

/** A picked photo, re-saved so its pixels are upright and its size is known. */
export interface SourcePhoto {
  uri: string;
  width: number;
  height: number;
}

/** Pixel rectangle on a SourcePhoto. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** What gets uploaded: the square (thumbnails, detail) and an uncropped copy (feed). */
export interface PhotoDraft {
  square: { uri: string; base64: string };
  full: { uri: string; base64: string };
}

// No system crop UI: on iOS it often returns a different square than the one
// you framed. The app crops itself (PhotoCropper) so the result matches exactly.
const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.9,
};

async function pick(source: 'camera' | 'library'): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take a photo.');
      return null;
    }
    const res = await ImagePicker.launchCameraAsync(PICK_OPTIONS);
    return res.canceled ? null : res.assets[0];
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photo access needed', 'Allow photo access in Settings to choose a picture.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS);
  return res.canceled ? null : res.assets[0];
}

/** Resize so the long side is at most `max` px (never upscales). */
function fitLongSide(ctx: ReturnType<typeof ImageManipulator.manipulate>, w: number, h: number, max: number) {
  if (Math.max(w, h) <= max) return;
  if (w >= h) ctx.resize({ width: max, height: null });
  else ctx.resize({ width: null, height: max });
}

/**
 * Re-save the picked photo through the manipulator. The cropper then shows and
 * crops the very same pixels, so rotation/EXIF can never shift the crop.
 */
async function normalize(asset: ImagePicker.ImagePickerAsset): Promise<SourcePhoto> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  fitLongSide(ctx, asset.width, asset.height, 2048);
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Ask camera vs. library, then return the picked photo ready for cropping (or null). */
export function choosePhoto(): Promise<SourcePhoto | null> {
  const run = (source: 'camera' | 'library') => async () => {
    const asset = await pick(source);
    return asset ? normalize(asset) : null;
  };
  return new Promise((resolve) => {
    const done = (p: Promise<SourcePhoto | null>) =>
      p.then(resolve, (e: Error) => {
        Alert.alert('Could not open photo', e.message);
        resolve(null);
      });
    Alert.alert(
      'Add a photo',
      undefined,
      [
        { text: 'Take photo', onPress: () => done(run('camera')()) },
        { text: 'Choose from library', onPress: () => done(run('library')()) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/** Build both upload versions from the source photo and the square the user framed. */
export async function buildPhotoDraft(src: SourcePhoto, crop: CropRect): Promise<PhotoDraft> {
  const sq = ImageManipulator.manipulate(src.uri);
  sq.crop(crop);
  if (crop.width > 1080) sq.resize({ width: 1080, height: 1080 });
  const square = await (await sq.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });

  const fl = ImageManipulator.manipulate(src.uri);
  fitLongSide(fl, src.width, src.height, 1440);
  const full = await (await fl.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });

  if (!square.base64 || !full.base64) throw new Error('Could not process the photo. Try again.');
  return { square: { uri: square.uri, base64: square.base64 }, full: { uri: full.uri, base64: full.base64 } };
}

async function uploadJpeg(uid: string, base64: string, suffix: string): Promise<string> {
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Uploads both versions to item-photos/<uid>/… and returns their public URLs. */
export async function uploadPhotoDraft(draft: PhotoDraft): Promise<{ photo_url: string; photo_full_url: string }> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Not signed in');
  const [photo_url, photo_full_url] = await Promise.all([
    uploadJpeg(uid, draft.square.base64, ''),
    uploadJpeg(uid, draft.full.base64, '-full'),
  ]);
  return { photo_url, photo_full_url };
}
