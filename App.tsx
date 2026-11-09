import PrizmaConfirm from './PrizmaConfirm';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';
import ShoppingDecisionScreen from './ShoppingDecisionScreen';
import OutfitAIScreen from './OutfitAIScreen';
import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import {
  SafeAreaView,
  StatusBar,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';

import { supabase } from './supabase';
import AuthScreen from './AuthScreen';
import WardrobeScreen from './WardrobeScreen';

type Tab =
  | 'Ana Sayfa'
  | 'Gardırop'
  | 'PRİZMA AI'
  | 'Güzellik'
  | 'Profil' | 'Alışveriş';

const C = {
  navy: '#0B1436',
  lavender: '#A78BFA',
  lilac: '#E6DBFF',
  background: '#FAF9FC',
  white: '#FFFFFF',
  ink: '#172044',
  muted: '#777B94',
  border: '#ECE7F2',
  pale: '#F2EDFA',
};

const tabs: { name: Tab; icon: string }[] = [
  { name: 'Ana Sayfa', icon: '⌂' },
  { name: 'Gardırop', icon: '◇' },
  { name: 'PRİZMA AI', icon: '✦' },
  { name: 'Güzellik', icon: '♡' },
  { name: 'Profil', icon: '○' },
];

function EditorialCard({
  icon,
  title,
  description,
  color,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.editorialCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardArrow}>↗</Text>
      </View>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function App() {

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);


  const [notice, setNotice] = useState<{
    type: NoticeType;
    title: string;
    message: string;
  } | null>(null);

  const showNotice = (
    type: NoticeType,
    title: string,
    message: string
  ) => setNotice({ type, title, message });


  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [tab, setTab] = useState<Tab>('Ana Sayfa');

  useEffect(() => {
    const handleRecoveryLink = async (url: string | null) => {
      if (!url) return;

      const fragment = url.split('#')[1] || '';
      const query = url.split('?')[1]?.split('#')[0] || '';
      const params = new URLSearchParams(fragment || query);

      if (params.get('type') !== 'recovery') return;

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        showNotice('error', 'Bağlantı geçersiz',
          'Yeni bir şifre sıfırlama bağlantısı iste.');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        showNotice('error', 'Bağlantı açılamadı',
          'Bağlantı süresi dolmuş olabilir.');
      } else {
        setRecoveryMode(true);
      }
    };

    Linking.getInitialURL()
      .then(handleRecoveryLink)
      .catch(() => {});

    const subscription = Linking.addEventListener(
      'url',
      ({ url }) => {
        void handleRecoveryLink(url);
      }
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setAuthLoading(false));

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setAuthLoading(false);
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  const saveNewPassword = async () => {
    if (newPassword.length < 8) {
      showNotice('info', 'Şifre çok kısa',
        'En az 8 karakter kullan.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotice('info', 'Şifreler uyuşmuyor',
        'İki kutuya aynı şifreyi yaz.');
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      setRecoveryMode(false);

      const { error: signOutError } =
        await supabase.auth.signOut();

      showNotice('success', 'Şifren yenilendi ✦',
        signOutError
          ? 'Şifren değiştirildi. Çıkış yapıp yeni şifrenle giriş yap.'
          : 'Yeni şifrenle giriş yapabilirsin.');
    } catch (error: any) {
      showNotice('error', 'Şifre değiştirilemedi',
        error?.message || 'Lütfen tekrar dene.');
    } finally {
      setSavingPassword(false);
    }
  };

  const open = (target: Tab) => {
    setTab(target);
  };

  const comingSoon = () => {
    showNotice('info', 'PRİZMA hazırlanıyor ✦',
      'Bu özelliği sonraki geliştirme adımlarında aktif edeceğiz.');
  };

  const handleLogout = () => {
    setLogoutVisible(true);
  };

  const confirmLogout = async () => {
    if (logoutBusy) return;

    setLogoutBusy(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setLogoutVisible(false);
        showNotice(
          'error',
          'Çıkış yapılamadı',
          'Lütfen tekrar dene.'
        );
      } else {
        setLogoutVisible(false);
        setTab('Ana Sayfa');
      }
    } catch (error) {
      setLogoutVisible(false);
      showNotice(
        'error',
        'Çıkış yapılamadı',
        'Lütfen tekrar dene.'
      );
    } finally {
      setLogoutBusy(false);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
      <PrizmaNotice
        visible={Boolean(notice)}
        type={notice?.type || 'info'}
        title={notice?.title || ''}
        message={notice?.message || ''}
        onClose={() => setNotice(null)}
      />

        <ActivityIndicator size="large" color={C.lavender} />
        <Text style={styles.loadingText}>
          PRİZMA hazırlanıyor ✦
        </Text>
      </SafeAreaView>
    );
  }

  if (recoveryMode) {
    return (
      <SafeAreaView style={styles.safe}>
      <PrizmaNotice
        visible={Boolean(notice)}
        type={notice?.type || 'info'}
        title={notice?.title || ''}
        message={notice?.message || ''}
        onClose={() => setNotice(null)}
      />

        <ScrollView
          contentContainerStyle={styles.resetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.resetBrand}>PRİZMA ✦</Text>

          <Text style={styles.pageTitle}>
            Yeni şifreni oluştur
          </Text>

          <Text style={styles.pageDescription}>
            Şifreni yenilemek için iki alana da yeni şifreni yaz.
          </Text>

          <TextInput
            style={styles.resetInput}
            placeholder="Yeni şifre (en az 8 karakter)"
            placeholderTextColor={C.muted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            autoComplete="new-password"
          />

          <TextInput
            style={styles.resetInput}
            placeholder="Yeni şifreyi tekrar yaz"
            placeholderTextColor={C.muted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoComplete="new-password"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            disabled={savingPassword}
            onPress={saveNewPassword}
          >
            {savingPassword ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Şifremi Kaydet →
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const emailName =
    session.user.email?.split('@')[0] || 'PRİZMA';

  return (
    <SafeAreaView style={styles.safe}>
      <PrizmaConfirm
        visible={logoutVisible}
        title="Çıkış yapılsın mı?"
        message="PRİZMA hesabından çıkış yapmak istediğine emin misin?"
        confirmText="Evet, çıkış yap"
        loading={logoutBusy}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={() => { void confirmLogout(); }}
      />
      <PrizmaNotice
        visible={Boolean(notice)}
        type={notice?.type || 'info'}
        title={notice?.title || ''}
        message={notice?.message || ''}
        onClose={() => setNotice(null)}
      />

      <StatusBar
        barStyle="dark-content"
      />

      {/* ÜST MENÜ */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBrand}
          onPress={() => open('Ana Sayfa')}
        >
          <Text style={styles.brandText}>PRİZMA</Text>
          <Text style={styles.brandStar}>✦</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileCircle}
          onPress={() => open('Profil')}
        >
          <Text style={styles.profileCircleText}>♡</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'Ana Sayfa' && (
          <>
{/* SENİN DÜNYAN */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  CURATED FOR YOU
                </Text>

                <Text style={styles.sectionTitle}>
                  Senin dünyan
                </Text>
              </View>

              <Text style={styles.sectionSparkle}>✧</Text>
            </View>

            <View style={styles.grid}>
              <EditorialCard
                icon="◇"
                title="Gardırobum"
                description="Parçalarını bir araya getir."
                color="#EEE7FA"
                onPress={() => open('Gardırop')}
              />

              <EditorialCard
                icon="✦"
                title="Stil önerileri"
                description="Yeni kombinler keşfet."
                color="#F4EBF9"
                onPress={() => open('PRİZMA AI')}
              />

              <EditorialCard
                icon="♡"
                title="Güzellik"
                description="Kendi rutinini oluştur."
                color="#F8EAF1"
                onPress={() => open('Güzellik')}
              />

              <EditorialCard
                icon="◈"
                title="Akıllı alışveriş"
                description="Almadan önce birlikte düşün."
                color="#E9EDFA"
                onPress={() => open('Alışveriş')}
              />
            </View>


            {/* KARŞILAMA */}
            <View style={styles.greeting}>
              <View>
                <Text style={styles.eyebrow}>
                  SENİN STİL DÜNYAN
                </Text>

                <Text style={styles.greetingTitle}>
                  Kendine özgü,
                  {'\n'}
                  <Text style={styles.italicText}>
                    tamamen sen.
                  </Text>
                </Text>
              </View>

              <Text style={styles.greetingSparkle}>✧</Text>
            </View>

            <Text style={styles.introText}>
              Stilini keşfet, ilhamını bul ve kendi
              dünyanı oluştur.
            </Text>

            {/* ANA KART */}
            <TouchableOpacity
              style={styles.editorialHero}
              onPress={() => open('PRİZMA AI')}
              activeOpacity={0.85}
            >
              <View style={styles.heroCircleOne} />
              <View style={styles.heroCircleTwo} />

              <View style={styles.heroTopRow}>
                <Text style={styles.heroBadge}>
                  PRİZMA EDITION
                </Text>

                <Text style={styles.heroSmallStar}>✧</Text>
              </View>

              <View style={styles.heroCenter}>
                <Text style={styles.heroDecor}>✦</Text>

                <Text style={styles.heroMainTitle}>
                  The art of
                  {'\n'}
                  <Text style={styles.heroItalic}>
                    being you.
                  </Text>
                </Text>

                <Text style={styles.heroSubtitle}>
                  Her tarzın bir hikâyesi var.
                </Text>
              </View>

              <View style={styles.heroBottom}>
                <Text style={styles.heroExplore}>
                  STİLİNİ KEŞFET
                </Text>
                <Text style={styles.heroArrow}>↗</Text>
              </View>
            </TouchableOpacity>

            {/* KISA YOLLAR */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => open('Gardırop')}
              >
                <View style={styles.quickIcon}>
                  <Text style={styles.quickIconText}>◇</Text>
                </View>
                <Text style={styles.quickLabel}>Gardırop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => open('PRİZMA AI')}
              >
                <View style={styles.quickIcon}>
                  <Text style={styles.quickIconText}>✦</Text>
                </View>
                <Text style={styles.quickLabel}>Stil Analizi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => open('Güzellik')}
              >
                <View style={styles.quickIcon}>
                  <Text style={styles.quickIconText}>♡</Text>
                </View>
                <Text style={styles.quickLabel}>Makyaj</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => open('Güzellik')}
              >
                <View style={styles.quickIcon}>
                  <Text style={styles.quickIconText}>✧</Text>
                </View>
                <Text style={styles.quickLabel}>Saç</Text>
              </TouchableOpacity>
            </View>

            {/* PRİZMA AI */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => open('PRİZMA AI')}
              activeOpacity={0.85}
            >
              <View style={styles.aiCardTop}>
                <Text style={styles.aiLabel}>
                  ✦ PRİZMA AI
                </Text>
                <Text style={styles.aiArrow}>↗</Text>
              </View>

              <Text style={styles.aiTitle}>
                Bugün ne giymeliyim?
              </Text>

              <Text style={styles.aiDescription}>
                Stil asistanınla yeni fikirler keşfet.
              </Text>
            </TouchableOpacity>

            <View style={styles.quoteCard}>
              <Text style={styles.quoteStar}>✦</Text>
              <Text style={styles.quoteTitle}>
                Style is personal.
              </Text>
              <Text style={styles.quoteDescription}>
                En güzel stil, kendine ait olandır.
              </Text>
            </View>
          </>
        )}

        {tab === 'Alışveriş' && (
          <ShoppingDecisionScreen
            onBack={() => open('Ana Sayfa')}
            userId={session.user.id}
          />
        )}

        {/* GARDIROP */}
        {tab === 'Gardırop' && (
          <WardrobeScreen userId={session.user.id} />
        )}

        {/* PRİZMA AI */}
        {tab === 'PRİZMA AI' && (
          <OutfitAIScreen userId={session.user.id} />
        )}

        {/* GÜZELLİK */}
        {tab === 'Güzellik' && (
          <>
            <Text style={styles.eyebrow}>
              THE BEAUTY EDIT
            </Text>

            <Text style={styles.pageTitle}>
              Güzellik dünyan
            </Text>

            <Text style={styles.pageDescription}>
              Makyaj, saç ve bakım önerileri için
              sana özel alan.
            </Text>

            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>♡</Text>

              <Text style={styles.emptyTitle}>
                Güzellik alanın
              </Text>

              <Text style={styles.emptyDescription}>
                Güzellik önerilerini ve kişisel bakım
                araçlarını burada geliştireceğiz.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={comingSoon}
              >
                <Text style={styles.primaryButtonText}>
                  Keşfet ✦
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* PROFİL */}
        {tab === 'Profil' && (
          <>
            <Text style={styles.eyebrow}>
              YOUR PRİZMA PROFILE
            </Text>

            <Text style={styles.pageTitle}>
              Profilim
            </Text>

            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  ✦
                </Text>
              </View>

              <Text style={styles.profileWelcome}>
                PRİZMA'ya hoş geldin
              </Text>

              <Text style={styles.profileEmail}>
                {session.user.email || emailName}
              </Text>
            </View>

            <View style={styles.profileInfoCard}>
              <Text style={styles.profileInfoTitle}>
                ✧ Stil profilim
              </Text>

              <Text style={styles.profileInfoDescription}>
                Kişisel stil tercihlerini ve hesap ayarlarını
                burada geliştireceğiz.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>
                Çıkış Yap →
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ALT MENÜ */}
      <View style={styles.tabBar}>
        {tabs.map((item) => {
          const active = tab === item.name;
          const isAI = item.name === 'PRİZMA AI';

          return (
            <TouchableOpacity
              key={item.name}
              style={styles.tabItem}
              onPress={() => open(item.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View
                style={[
                  styles.tabIconWrap,
                  active && !isAI && styles.tabIconWrapActive,
                  isAI && styles.aiTabIconWrap,
                ]}
              >
                <Text
                  style={[
                    styles.tabIcon,
                    active && styles.tabIconActive,
                    isAI && styles.aiTabIcon,
                  ]}
                >
                  {item.icon}
                </Text>
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  active && styles.tabLabelActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
    paddingTop: Platform.OS === 'android' ? 4 : 0,
  },

  scroll: {
    flex: 1,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: C.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: C.lilac,
    marginTop: 20,
    fontSize: 15,
  },

  header: {
    backgroundColor: C.background,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  brandText: {
    color: C.navy,
    fontSize: 25,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 4,
    fontWeight: '600',
  },

  brandStar: {
    color: C.lavender,
    fontSize: 19,
    marginLeft: 8,
  },

  profileCircle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#F0E8FA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileCircleText: {
    color: C.navy,
    fontSize: 23,
  },

  content: {
    paddingHorizontal: 23,
    paddingTop: 29,
    paddingBottom: 45,
  },

  eyebrow: {
    color: '#937BC5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.1,
    marginBottom: 14,
  },

  greeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  greetingTitle: {
    color: C.navy,
    fontSize: 36,
    lineHeight: 46,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  italicText: {
    color: '#9678CF',
    fontStyle: 'italic',
  },

  greetingSparkle: {
    color: C.lavender,
    fontSize: 30,
    marginTop: 30,
  },

  introText: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 22,
    marginTop: 14,
    marginBottom: 27,
  },

  editorialHero: {
    backgroundColor: C.navy,
    borderRadius: 26,
    minHeight: 290,
    padding: 23,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },

  heroCircleOne: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#373465',
    right: -75,
    top: -90,
    opacity: 0.65,
  },

  heroCircleTwo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#7161B4',
    left: -100,
    bottom: -110,
    opacity: 0.25,
  },

  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  heroBadge: {
    color: C.lilac,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
  },

  heroSmallStar: {
    color: C.lilac,
    fontSize: 26,
  },

  heroCenter: {
    alignItems: 'center',
    marginVertical: 12,
  },

  heroDecor: {
    color: C.lilac,
    fontSize: 32,
    marginBottom: 8,
  },

  heroMainTitle: {
    color: C.white,
    fontSize: 36,
    lineHeight: 42,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
  },

  heroItalic: {
    color: C.lilac,
    fontStyle: 'italic',
  },

  heroSubtitle: {
    color: '#D1C7E9',
    fontSize: 12,
    marginTop: 12,
  },

  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  heroExplore: {
    color: C.lilac,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },

  heroArrow: {
    color: C.white,
    fontSize: 23,
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 29,
  },

  quickAction: {
    width: '24%',
    alignItems: 'center',
  },

  quickIcon: {
    width: 57,
    height: 57,
    borderRadius: 20,
    backgroundColor: C.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  quickIconText: {
    color: C.navy,
    fontSize: 27,
  },

  quickLabel: {
    color: C.ink,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  aiCard: {
    backgroundColor: '#EEE8F8',
    borderRadius: 23,
    padding: 23,
    marginBottom: 36,
  },

  aiCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  aiLabel: {
    color: '#8067AE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },

  aiArrow: {
    color: C.navy,
    fontSize: 22,
  },

  aiTitle: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 7,
  },

  aiDescription: {
    color: C.muted,
    fontSize: 12,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 19,
  },

  sectionEyebrow: {
    color: '#957BCB',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },

  sectionTitle: {
    color: C.navy,
    fontSize: 27,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  sectionSparkle: {
    color: C.lavender,
    fontSize: 29,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  editorialCard: {
    width: '48%',
    minHeight: 168,
    borderRadius: 22,
    padding: 17,
    justifyContent: 'space-between',
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cardIcon: {
    color: C.navy,
    fontSize: 29,
  },

  cardArrow: {
    color: C.navy,
    fontSize: 18,
  },

  cardTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 7,
  },

  cardDescription: {
    color: '#72718A',
    fontSize: 11,
    lineHeight: 17,
  },

  quoteCard: {
    backgroundColor: C.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    marginTop: 25,
    alignItems: 'center',
  },

  quoteStar: {
    color: C.lavender,
    fontSize: 27,
    marginBottom: 10,
  },

  quoteTitle: {
    color: C.navy,
    fontSize: 23,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  quoteDescription: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 9,
  },

  pageTitle: {
    color: C.navy,
    fontSize: 32,
    lineHeight: 40,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 13,
  },

  pageDescription: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 27,
  },

  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 27,
    padding: 28,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  emptyIcon: {
    color: C.lavender,
    fontSize: 58,
    marginBottom: 16,
  },

  emptyTitle: {
    color: C.navy,
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyDescription: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 13,
    marginBottom: 25,
  },

  primaryButton: {
    backgroundColor: C.navy,
    borderRadius: 30,
    minHeight: 52,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },

  aiFeatureCard: {
    backgroundColor: C.navy,
    borderRadius: 27,
    padding: 28,
    minHeight: 310,
    justifyContent: 'center',
    alignItems: 'center',
  },

  aiFeatureIcon: {
    color: C.lilac,
    fontSize: 55,
    marginBottom: 16,
  },

  aiFeatureTitle: {
    color: C.white,
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
  },

  aiFeatureDescription: {
    color: '#C8BDF1',
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 13,
    marginBottom: 25,
  },

  aiFeatureButton: {
    backgroundColor: C.lilac,
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 14,
  },

  aiFeatureButtonText: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '700',
  },

  profileCard: {
    backgroundColor: C.white,
    borderRadius: 25,
    padding: 27,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 18,
  },

  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.lilac,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  profileAvatarText: {
    color: C.navy,
    fontSize: 34,
  },

  profileWelcome: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '700',
  },

  profileEmail: {
    color: C.muted,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },

  profileInfoCard: {
    backgroundColor: C.pale,
    borderRadius: 20,
    padding: 23,
    marginBottom: 23,
  },

  profileInfoTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '700',
  },

  profileInfoDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 9,
  },

  logoutButton: {
    borderWidth: 1,
    borderColor: '#D7C9F4',
    borderRadius: 20,
    padding: 17,
    alignItems: 'center',
  },

  logoutText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '700',
  },

  tabBar: {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 9,
    paddingBottom: Platform.OS === 'ios' ? 15 : 9,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabIconWrap: {
    width: 43,
    height: 37,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabIconWrapActive: {
    backgroundColor: C.lilac,
  },

  aiTabIconWrap: {
    backgroundColor: C.navy,
    borderRadius: 20,
  },

  tabIcon: {
    color: '#8A8DA4',
    fontSize: 24,
  },

  tabIconActive: {
    color: C.navy,
  },

  aiTabIcon: {
    color: C.lilac,
    fontSize: 25,
  },

  tabLabel: {
    color: C.muted,
    fontSize: 10,
    marginTop: 5,
  },

  tabLabelActive: {
    color: C.navy,
    fontWeight: '700',
  },

  resetContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
    gap: 18,
  },

  resetBrand: {
    color: C.navy,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 18,
  },

  resetInput: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: C.navy,
  },
});