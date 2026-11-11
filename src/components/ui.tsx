import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

export const C = {
  bg: '#0f1a14',
  panel: '#16251c',
  card: '#1d3126',
  line: '#2a4334',
  text: '#e8f3ec',
  muted: '#8fae9b',
  accent: '#2ecc71',
  gold: '#f5b83d',
  me: '#1f7a4a',
  them: '#24392d',
  danger: '#ff7a6b',
};

const PALETTE = ['#e67e22', '#9b59b6', '#3498db', '#e84393', '#16a085', '#d35400', '#2980b9', '#c0392b', '#27ae60', '#8e44ad'];
export const colorFor = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

export function Avatar({ name, size = 40, online }: { name: string; size?: number; online?: boolean }) {
  return (
    <View style={[s.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(name) }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{(name[0] || '?').toUpperCase()}</Text>
      {online !== undefined && (
        <View style={[s.dot, { backgroundColor: online ? C.accent : '#666' }]} />
      )}
    </View>
  );
}

export function GroupIcon({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2b4a3a', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.text, fontWeight: '800', fontSize: size * 0.38 }}>{(name[0] || '#').toUpperCase()}</Text>
    </View>
  );
}

export function Badge({ children, color = C.gold }: { children: ReactNode; color?: string }) {
  return (
    <View style={s.badge}>
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  ghost,
  danger,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  ghost?: boolean;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg = ghost ? 'transparent' : danger ? C.danger : C.accent;
  const fg = ghost ? (danger ? C.danger : C.accent) : '#04210f';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: danger ? C.danger : C.accent, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.muted} {...props} style={[s.input, props.style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Section({ title }: { title: string }) {
  return <Text style={s.section}>{title}</Text>;
}

export function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.accent} size="large" />
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  av: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: C.bg },
  badge: { backgroundColor: '#2b3f33', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, marginTop: 10 },
  input: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    color: C.text,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
  },
  card: { backgroundColor: C.card, marginHorizontal: 14, marginTop: 12, borderRadius: 14, padding: 14 },
  section: { color: C.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { color: C.text, fontWeight: '600', fontSize: 15 },
  sub: { color: C.muted, fontSize: 13, marginTop: 2 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800' },
  body: { color: C.text, fontSize: 14, lineHeight: 21 },
  error: { color: C.danger, fontSize: 13, minHeight: 18 },
});
