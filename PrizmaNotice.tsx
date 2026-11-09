import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type NoticeType = 'success' | 'error' | 'info';

type Props = {
  visible: boolean;
  type: NoticeType;
  title: string;
  message: string;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export default function PrizmaNotice({
  visible,
  type,
  title,
  message,
  onClose,
  actionLabel,
  onAction,
}: Props) {
  const symbol =
    type === 'success' ? '✓' :
    type === 'error' ? '!' : '✦';

  const heading =
    type === 'success' ? 'GÜZEL HABER' :
    type === 'error' ? 'BİR SORUN OLUŞTU' : 'PRİZMA NOTU';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.symbolCircle}>
            <Text style={styles.symbol}>{symbol}</Text>
          </View>

          <Text style={styles.eyebrow}>{heading}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {actionLabel && onAction && (
            <TouchableOpacity
              style={styles.button}
              onPress={onAction}
            >
              <Text style={styles.buttonText}>
                {actionLabel}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>
              {type === 'success' ? 'Harika ✦' : 'Tamam'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(11,20,54,0.48)',
  },
  card: {
    backgroundColor: '#FAF9FC',
    borderRadius: 28,
    padding: 27,
    alignItems: 'center',
  },
  symbolCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#EEE7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  symbol: {
    fontSize: 31,
    fontWeight: '800',
    color: '#8050B5',
  },
  eyebrow: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: '#0B1436',
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: '#77718B',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 26,
  },
  button: {
    width: '100%',
    backgroundColor: '#8050B5',
    borderRadius: 16,
    padding: 17,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
