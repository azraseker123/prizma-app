import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  loading?: boolean;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function PrizmaConfirm({
  visible,
  title,
  message,
  loading = false,
  confirmText = 'Evet, sil',
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✦</Text>
          </View>

          <Text style={styles.eyebrow}>PRİZMA · ONAY</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={[styles.confirm, loading && styles.disabled]}
            disabled={loading}
            onPress={onConfirm}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmText}>{confirmText}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancel}
            disabled={loading}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>Vazgeç</Text>
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
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#EEE7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    color: '#8050B5',
    fontSize: 34,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '800',
    color: '#A78BFA',
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
  confirm: {
    width: '100%',
    backgroundColor: '#8050B5',
    padding: 17,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancel: {
    padding: 15,
    marginTop: 5,
  },
  cancelText: {
    color: '#77718B',
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
