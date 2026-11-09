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
  StatusBar,
  Image,
} from 'react-native';
import { supabase } from './supabase';

type ScreenMode = 'welcome' | 'login' | 'register' | 'reset';

const COLORS = {
  navy: '#101B42',
  navyLight: '#243469',
  lavender: '#BDA6FA',
  lavenderLight: '#E6DBFF',
  white: '#F8F6FF',
  muted: '#C9C4E2',
  border: 'rgba(230,219,255,0.38)',
};

export default function AuthScreen() {
  const [mode, setMode] = useState<ScreenMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const changeMode = (nextMode: ScreenMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      Alert.alert(
        'Eksik bilgi',
        'Lütfen e-posta adresini ve şifreni gir.'
      );
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        Alert.alert(
          'Şifre çok kısa',
          'Şifren en az 6 karakter olmalı.'
        );
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert(
          'Şifreler uyuşmuyor',
          'Lütfen şifrelerini kontrol et.'
        );
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
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

  const handleResetPassword = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      Alert.alert(
        'E-posta gerekli',
        'Şifre sıfırlama bağlantısını gönderebilmemiz için e-posta adresini gir.'
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: 'prizma://reset-password',
        }
      );

      if (error) throw error;

      Alert.alert(
        'E-postanı kontrol et 💌',
        'Bu adrese kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderilecektir.'
      );

      changeMode('login');
    } catch (error: any) {
      Alert.alert(
        'İşlem tamamlanamadı',
        error?.message || 'Lütfen tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isWelcome = mode === 'welcome';
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="light-content"
      />

      {/* Işıklı PRİZMA arka planı */}
      <Image
        source={require('./assets/prizma-background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <View
        pointerEvents="none"
        style={styles.backgroundShade}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            isWelcome && styles.welcomeContent,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {!isWelcome && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                changeMode(isReset ? 'login' : 'welcome')
              }
            >
              <Text style={styles.backText}>‹  Geri</Text>
            </TouchableOpacity>
          )}

          {/* Gerçek kristal PRİZMA logosu */}
          <View
            style={[
              styles.brandSection,
              !isWelcome && styles.brandSectionCompact,
            ]}
          >
            <Image
              source={require('./assets/prizma-logo.png')}
              style={[
                styles.brandLogo,
                !isWelcome && styles.brandLogoCompact,
              ]}
              resizeMode="contain"
              accessible
              accessibilityLabel="PRİZMA kristal logosu"
            />
          </View>

          {isWelcome ? (
            <View style={styles.welcomeActions}>
              <Text style={styles.welcomeDescription}>
                Stilini keşfet. Güzelliğini yansıt.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => changeMode('login')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>
                  Giriş Yap
                </Text>

                <Text style={styles.primaryArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => changeMode('register')}
                activeOpacity={0.85}
              >
                <Text style={styles.outlineButtonText}>
                  Hesap Oluştur
                </Text>
              </TouchableOpacity>

              <Text style={styles.legalText}>
                Devam ederek Kullanım Şartları'nı ve
                {'\n'}Gizlilik Politikası'nı kabul etmiş olursun.
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.formTitle}>
                {isReset
                  ? 'Şifreni yenile'
                  : isLogin
                    ? 'Tekrar hoş geldin'
                    : 'Aramıza katıl'}
              </Text>

              <Text style={styles.formSubtitle}>
                {isReset
                  ? 'E-posta adresine şifre sıfırlama bağlantısı gönderelim.'
                  : isLogin
                    ? 'Stil ve güzellik dünyan seni bekliyor.'
                    : 'PRİZMA yolculuğun burada başlıyor.'}
              </Text>

              <Text style={styles.inputLabel}>
                E-posta adresi
              </Text>

              <TextInput
                style={styles.input}
                placeholder="ornek@email.com"
                placeholderTextColor="#AAA6C6"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />

              {!isReset && (
                <>
                  <Text style={styles.inputLabel}>
                    Şifre
                  </Text>

                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder={
                        isRegister
                          ? 'En az 6 karakter'
                          : 'Şifreni gir'
                      }
                      placeholderTextColor="#AAA6C6"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete={
                        isLogin
                          ? 'current-password'
                          : 'new-password'
                      }
                      editable={!loading}
                    />

                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() =>
                        setShowPassword(!showPassword)
                      }
                    >
                      <Text style={styles.eyeText}>
                        {showPassword ? 'Gizle' : 'Göster'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isRegister && (
                    <>
                      <Text style={styles.inputLabel}>
                        Şifre tekrar
                      </Text>

                      <TextInput
                        style={styles.input}
                        placeholder="Şifreni tekrar gir"
                        placeholderTextColor="#AAA6C6"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                        autoComplete="new-password"
                        editable={!loading}
                      />
                    </>
                  )}

                  {isLogin && (
                    <TouchableOpacity
                      style={styles.forgotButton}
                      onPress={() => changeMode('reset')}
                    >
                      <Text style={styles.forgotText}>
                        Şifremi unuttum
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.submitButton,
                ]}
                onPress={
                  isReset
                    ? handleResetPassword
                    : handleSubmit
                }
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.navy} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      {isReset
                        ? 'Bağlantı Gönder'
                        : isLogin
                          ? 'Giriş Yap'
                          : 'Hesap Oluştur'}
                    </Text>

                    <Text style={styles.primaryArrow}>→</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() =>
                  changeMode(
                    isReset
                      ? 'login'
                      : isLogin
                        ? 'register'
                        : 'login'
                  )
                }
                disabled={loading}
              >
                <Text style={styles.switchText}>
                  {isReset
                    ? '← Giriş ekranına dön'
                    : isLogin
                      ? 'Hesabın yok mu? '
                      : 'Zaten hesabın var mı? '}

                  {!isReset && (
                    <Text style={styles.switchHighlight}>
                      {isLogin
                        ? 'Hesap oluştur'
                        : 'Giriş yap'}
                    </Text>
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safe: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  backgroundShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 13, 38, 0.20)',
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingVertical: 35,
    justifyContent: 'center',
  },

  welcomeContent: {
    justifyContent: 'space-between',
    paddingTop: 55,
    paddingBottom: 30,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    marginBottom: 28,
  },

  backText: {
    color: COLORS.lavenderLight,
    fontSize: 16,
  },

  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },

  brandSectionCompact: {
    marginTop: 0,
    marginBottom: 35,
  },

  brandLogo: {
    width: '100%',
    height: 350,
    maxWidth: 360,
  },

  brandLogoCompact: {
    height: 215,
    maxWidth: 245,
  },

  welcomeActions: {
    width: '100%',
    marginTop: 24,
  },

  welcomeDescription: {
    color: COLORS.lavenderLight,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 26,
    letterSpacing: 0.4,
  },

  primaryButton: {
    backgroundColor: COLORS.lavenderLight,
    borderRadius: 30,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 24,
    position: 'relative',
  },

  primaryButtonText: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  primaryArrow: {
    position: 'absolute',
    right: 24,
    color: COLORS.navy,
    fontSize: 22,
  },

  outlineButton: {
    borderWidth: 1,
    borderColor: COLORS.lavenderLight,
    borderRadius: 30,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    backgroundColor: 'rgba(8,14,40,0.55)',
  },

  outlineButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },

  legalText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 35,
  },

  form: {
    width: '100%',
    paddingBottom: 35,
  },

  formTitle: {
    color: COLORS.white,
    fontSize: 29,
    fontWeight: '600',
    marginBottom: 9,
  },

  formSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 32,
  },

  inputLabel: {
    color: COLORS.lavenderLight,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },

  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: COLORS.white,
    fontSize: 14,
    paddingHorizontal: 18,
    marginBottom: 22,
  },

  passwordContainer: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  passwordInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  eyeButton: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },

  eyeText: {
    color: COLORS.lavender,
    fontSize: 12,
    fontWeight: '600',
  },

  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -7,
    marginBottom: 25,
    paddingVertical: 5,
  },

  forgotText: {
    color: COLORS.lavender,
    fontSize: 13,
    fontWeight: '600',
  },

  submitButton: {
    marginTop: 8,
  },

  switchButton: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  switchText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
  },

  switchHighlight: {
    color: COLORS.lavender,
    fontWeight: '700',
  },
});