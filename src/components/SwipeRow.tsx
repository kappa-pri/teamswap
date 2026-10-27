import { useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';

const TRIGGER = 90;

/** Swipe left past the threshold to fire `onSwipe`; the row springs back. */
export function SwipeRow({
  children,
  onSwipe,
  label,
}: {
  children: ReactNode;
  onSwipe: () => void;
  label: string;
}) {
  const [x] = useState(() => new Animated.Value(0));
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => x.setValue(Math.min(0, Math.max(-140, g.dx))),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -TRIGGER) onSwipe();
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [x, onSwipe],
  );

  const actionOpacity = x.interpolate({ inputRange: [-TRIGGER, -20, 0], outputRange: [1, 0.4, 0] });

  return (
    <View>
      <Animated.View style={[styles.action, { opacity: actionOpacity }]}>
        <MaterialCommunityIcons name="flag-variant" size={20} color="#fff" />
        <Text style={styles.actionText}>{label}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 18,
  },
  actionText: { color: '#fff', fontWeight: '800', marginLeft: 6 },
});
