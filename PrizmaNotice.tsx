import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PRIZMA } from './prizmaTheme';

export type NoticeType = 'success' | 'error' | 'info';

type Props = {
  visible: boolean;
  type: NoticeType;
  title: string;
  message: string;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
  bottomOffset?: number;
};

/** Lightweight inline toast: never blocks the screen like a native Alert or Modal. */
export default function PrizmaNotice({
  visible, type, title, message, onClose, actionLabel, onAction, bottomOffset = 12,
}: Props) {
  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(onClose, actionLabel ? 6500 : 3800);
    return () => clearTimeout(timeout);
  }, [visible, type, title, message, onClose, actionLabel]);

  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom: bottomOffset }]}>
      <View style={[styles.toast, type === 'error' && styles.error]} accessibilityRole="alert">
        <Text style={[styles.symbol, type === 'error' && styles.errorText]}>
          {type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}
        </Text>
        <View style={styles.copy}>
          {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
          {!!message && <Text style={styles.message} numberOfLines={2}>{message}</Text>}
        </View>
        {actionLabel && onAction ? (
          <TouchableOpacity style={styles.action} onPress={onAction} accessibilityRole="button">
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Bildirimi kapat"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 1000, elevation: 12 },
  toast: { flexDirection: 'row', alignItems: 'center', minHeight: 58, backgroundColor: PRIZMA.purpleLight, borderColor: PRIZMA.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, elevation: 6 },
  error: { backgroundColor: PRIZMA.dangerLight, borderColor: '#F2C6D0' },
  symbol: { color: PRIZMA.purple, fontSize: 18, fontWeight: '800', width: 24, textAlign: 'center' },
  errorText: { color: PRIZMA.danger },
  copy: { flex: 1, paddingHorizontal: 8 },
  title: { color: PRIZMA.ink, fontSize: 13, fontWeight: '700' },
  message: { color: PRIZMA.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  actionText: { color: PRIZMA.purple, fontSize: 12, fontWeight: '700' },
  close: { minWidth: 38, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: PRIZMA.muted, fontSize: 24 },
});
