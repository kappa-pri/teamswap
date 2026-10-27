import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { CropRect, SourcePhoto } from '@/lib/photos';

const MAX_ZOOM = 4;

interface View3 {
  tx: number; // image-centre offset from the frame centre, in screen px
  ty: number;
  zoom: number; // 1 = photo just covers the square
}

/**
 * Full-screen square cropper. Drag to move, pinch (or +/-) to zoom. The square
 * on screen is exactly what gets saved, and it's what thumbnails and item screens show.
 */
export function PhotoCropper({
  photo,
  busy,
  onCancel,
  onDone,
}: {
  photo: SourcePhoto;
  busy?: boolean;
  onCancel: () => void;
  onDone: (rect: CropRect) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const frame = Math.min(screenW - 32, 520);
  const base = frame / Math.min(photo.width, photo.height); // scale at zoom 1

  const [view, setView] = useState<View3>({ tx: 0, ty: 0, zoom: 1 });
  // Where the current gesture started (reset whenever the finger count changes).
  const [start, setStart] = useState<{ touches: number; x: number; y: number; dist: number; v: View3 } | null>(null);

  const clamp = (v: View3): View3 => {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
    const maxX = (photo.width * base * zoom - frame) / 2;
    const maxY = (photo.height * base * zoom - frame) / 2;
    return {
      zoom,
      tx: Math.max(-maxX, Math.min(maxX, v.tx)),
      ty: Math.max(-maxY, Math.min(maxY, v.ty)),
    };
  };

  const pan = useMemo(() => {
    const read = (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        const dx = t[0].pageX - t[1].pageX;
        const dy = t[0].pageY - t[1].pageY;
        return { touches: 2, x: (t[0].pageX + t[1].pageX) / 2, y: (t[0].pageY + t[1].pageY) / 2, dist: Math.hypot(dx, dy) };
      }
      return { touches: 1, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, dist: 0 };
    };
    const zoomTo = (from: View3, zoom: number): View3 => {
      // Keep the point under the frame centre steady while zooming.
      const k = Math.min(MAX_ZOOM, Math.max(1, zoom)) / from.zoom;
      return { zoom: from.zoom * k, tx: from.tx * k, ty: from.ty * k };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => setStart({ ...read(e), v: view }),
      onPanResponderMove: (e) => {
        const now = read(e);
        if (!start || start.touches !== now.touches) {
          setStart({ ...now, v: view });
          return;
        }
        let next: View3 = { ...start.v, tx: start.v.tx + (now.x - start.x), ty: start.v.ty + (now.y - start.y) };
        if (now.touches === 2 && start.dist > 0) {
          const zoomed = zoomTo(start.v, start.v.zoom * (now.dist / start.dist));
          next = { ...zoomed, tx: zoomed.tx + (now.x - start.x), ty: zoomed.ty + (now.y - start.y) };
        }
        setView(clamp(next));
      },
      onPanResponderRelease: () => setStart(null),
      onPanResponderTerminate: () => setStart(null),
    });
    // clamp depends only on photo/frame, which are covered by `base`/`frame`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, start, base, frame]);

  const stepZoom = (delta: number) =>
    setView((v) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom + delta));
      const k = zoom / v.zoom;
      return clamp({ zoom, tx: v.tx * k, ty: v.ty * k });
    });

  const s = base * view.zoom;
  const dw = photo.width * s;
  const dh = photo.height * s;
  const left = frame / 2 - dw / 2 + view.tx;
  const top = frame / 2 - dh / 2 + view.ty;

  const done = () => {
    const size = Math.floor(frame / s);
    const originX = Math.round(Math.max(0, Math.min(photo.width - size, -left / s)));
    const originY = Math.round(Math.max(0, Math.min(photo.height - size, -top / s)));
    onDone({ originX, originY, width: size, height: size });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={[st.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={st.header}>
          <Pressable onPress={onCancel} hitSlop={10} disabled={busy}>
            <Text style={st.headerBtn}>Cancel</Text>
          </Pressable>
          <Text style={st.title}>Crop photo</Text>
          <Pressable onPress={done} hitSlop={10} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[st.headerBtn, st.use]}>Use photo</Text>}
          </Pressable>
        </View>

        <View style={st.body}>
          <View style={{ width: frame, height: frame }} {...pan.panHandlers}>
            <View style={[st.frame, { width: frame, height: frame }]}>
              <Image
                source={{ uri: photo.uri }}
                style={{ position: 'absolute', width: dw, height: dh, left, top }}
                resizeMode="stretch"
              />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.border]} />
              {/* Rule-of-thirds grid */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {[1, 2].map((i) => (
                  <View key={`v${i}`} style={[st.gridV, { left: (frame * i) / 3 }]} />
                ))}
                {[1, 2].map((i) => (
                  <View key={`h${i}`} style={[st.gridH, { top: (frame * i) / 3 }]} />
                ))}
              </View>
            </View>
          </View>
          <Text style={st.hint}>Drag to move · pinch to zoom</Text>
          <View style={st.zoomRow}>
            <Pressable onPress={() => stepZoom(-0.25)} style={st.zoomBtn} accessibilityLabel="Zoom out" disabled={view.zoom <= 1}>
              <MaterialCommunityIcons name="magnify-minus-outline" size={24} color={view.zoom <= 1 ? '#666' : '#fff'} />
            </Pressable>
            <Pressable onPress={() => setView({ tx: 0, ty: 0, zoom: 1 })} style={st.zoomBtn} accessibilityLabel="Reset">
              <MaterialCommunityIcons name="fit-to-screen-outline" size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={() => stepZoom(0.25)} style={st.zoomBtn} accessibilityLabel="Zoom in" disabled={view.zoom >= MAX_ZOOM}>
              <MaterialCommunityIcons name="magnify-plus-outline" size={24} color={view.zoom >= MAX_ZOOM ? '#666' : '#fff'} />
            </Pressable>
          </View>
          <Text style={st.note}>This square is what appears in your inventory and item pages.</Text>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  headerBtn: { color: '#fff', fontSize: 16, fontWeight: '600' },
  use: { color: '#7FB2FF', fontWeight: '800' },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { overflow: 'hidden', backgroundColor: '#111' },
  // Drawn on top so it doesn't shrink the area being cropped.
  border: { borderWidth: 2, borderColor: '#fff' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  hint: { color: '#bbb', marginTop: 16, fontSize: 14 },
  zoomRow: { flexDirection: 'row', gap: 18, marginTop: 14 },
  zoomBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  note: { color: '#888', marginTop: 18, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },
});
