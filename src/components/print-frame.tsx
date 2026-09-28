import { router } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

/** Paper is always light, whatever the screen theme. */
export const Paper = Colors.light;

// Landscape pages, no app chrome, and colors kept when printing.
const PRINT_CSS = `
@page { size: landscape; margin: 0.4in; }
@media print {
  [data-noprint] { display: none !important; }
  html, body, #root { height: auto !important; overflow: visible !important; background: #fff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

function usePrintStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

function ToolButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: primary ? Paper.primary : Paper.surfaceMuted,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ color: primary ? Paper.primaryText : Paper.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/**
 * A printable page: a toolbar that never prints, then the content on white.
 * Printing uses the browser's print dialog (PRD §12).
 */
export function PrintFrame({
  title,
  subtitle,
  onPrev,
  onNext,
  controls,
  fallback,
  children,
}: {
  title: string;
  subtitle?: string;
  onPrev: () => void;
  onNext: () => void;
  controls?: ReactNode;
  fallback: '/' | '/time-off';
  children: ReactNode;
}) {
  usePrintStyles();
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View
        // @ts-expect-error dataSet is react-native-web only; it marks the toolbar as screen-only.
        dataSet={{ noprint: '1' }}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: Paper.border,
          backgroundColor: Paper.background,
        }}>
        <ToolButton label="‹ Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} />
        <ToolButton label="◀" onPress={onPrev} />
        <ToolButton label="▶" onPress={onNext} />
        {controls}
        <View style={{ flex: 1 }} />
        {Platform.OS === 'web' ? <ToolButton label="Print" primary onPress={() => window.print()} /> : null}
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: Paper.text }}>{title}</Text>
          {subtitle ? <Text style={{ color: Paper.textMuted, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        {children}
      </View>
    </View>
  );
}

export function PrintText({
  children,
  muted,
  bold,
  size = 12,
}: {
  children: ReactNode;
  muted?: boolean;
  bold?: boolean;
  size?: number;
}) {
  return (
    <Text style={{ fontSize: size, color: muted ? Paper.textMuted : Paper.text, fontWeight: bold ? '700' : '400' }}>
      {children}
    </Text>
  );
}
