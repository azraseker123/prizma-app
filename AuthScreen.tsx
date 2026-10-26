
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from './supabase';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifreni gir.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Şifre', 'Şifren en az 6 karakter olmalı.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          Alert.alert(
            'E-postanı kontrol et 💌',
            'Kaydını tamamlamak için e-postana gelen doğrulama bağlantısına tıkla.'
          );
        }
      }
    } catch (error: any) {
      Alert.alert(
        'İşlem tamamlanamadı',
        error?.message || 'Lütfen tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>PRİZMA ✦</Text>
          <Text style={styles.tagline}>STYLE • BEAUTY • YOU</Text>

          <View style={styles.card}>
            <Text style={styles.sparkle}>✧</Text>

            <Text style={styles.title}>
              {isLogin ? 'Yeniden hoş geldin.' : 'Kendini keşfet.'}
            </Text>

            <Text style={styles.subtitle}>
              {isLogin
                ? 'Stil dünyan seni bekliyor.'
                : 'PRİZMA yolculuğun burada başlıyor.'}
            </Text>

            <Text style={styles.label}>E-posta adresin</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@email.com"
              placeholderTextColor="#A49AA3"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={styles.label}>Şifren</Text>
            <TextInput
              style={styles.input}
              placeholder="En az 6 karakter"
              placeholderTextColor="#A49AA3"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? 'Giriş Yap →' : 'Hesap Oluştur →'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchText}>
                {isLogin
                  ? 'Hesabın yok mu? Kayıt ol ✦'
                  : 'Zaten hesabın var mı? Giriş yap ✦'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            YOUR STYLE. YOUR RULES. ✦
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#FAF7F4' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 45,
  },
  logo: {
    fontSize: 33,
    fontWeight: '700',
    letterSpacing: 5,
    color: '#4D3A54',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: '#857D84',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 42,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: '#EDE5E7',
  },
  sparkle: {
    fontSize: 38,
    color: '#8B6C96',
    textAlign: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 27,
    color: '#302A32',
    textAlign: 'center',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#857D84',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 32,
  },
  label: {
    fontSize: 12,
    color: '#4D3A54',
    fontWeight: '600',
    marginBottom: 9,
  },
  input: {
    backgroundColor: '#FAF7F4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE5E7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#302A32',
    marginBottom: 22,
  },
  button: {
    backgroundColor: '#4D3A54',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  switchButton: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#8B6C96',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    color: '#A49AA3',
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: 10,
    marginTop: 38,
  },
});
