import { useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';

const ACTION_W = 96;

/**
 * Swipe left to reveal a Delete button; the row stays open until you tap
 * Delete (the confirming tap), swipe back, or tap the row. Never deletes on swipe.
 */
export function SwipeReveal({
  children,
  onDelete,
  deleteLabel = 'Delete',
}: {
  /** Receives `close` and whether the row is open, so taps can close it first. */
  children: (open: boolean, close: () => void) => ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  const [x] = useState(() => new Animated.Value(0));
  const [open, setOpen] = useState(false);

  const snap = (toOpen: boolean) => {
    setOpen(toOpen);
    Animated.spring(x, { toValue: toOpen ? -ACTION_W : 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const pan = useMemo(() => {
    const base = open ? -ACTION_W : 0;
    const settle = (toOpen: boolean) => {
      setOpen(toOpen);
      Animated.spring(x, { toValue: toOpen ? -ACTION_W : 0, useNativeDriver: true, bounciness: 4 }).start();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => x.setValue(Math.max(-ACTION_W * 1.3, Math.min(0, base + g.dx))),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => settle(base + g.dx < -ACTION_W / 2),
      onPanResponderTerminate: () => settle(open),
    });
  }, [open, x]);

  return (
    <View>
      <View style={s.actionWrap}>
        <Pressable
          onPress={() => {
            snap(false);
            onDelete();
          }}
          disabled={!open}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          style={({ pressed }) => [s.action, pressed && { opacity: 0.8 }]}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
          <Text style={s.actionText}>{deleteLabel}</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children(open, () => snap(false))}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  actionWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_W + radius.md,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    alignItems: 'flex-end',
  },
  action: { width: ACTION_W, flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontWeight: '800', marginTop: 2 },
});
