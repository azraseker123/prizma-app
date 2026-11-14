import RoutineScreen from './RoutineScreen';
import PrizmaChatScreen from './PrizmaChatScreen';
import { PRIZMA_COLORS as C } from './theme';
import PrizmaConfirm from './PrizmaConfirm';
import PrizmaNotice, { type NoticeType } from './PrizmaNotice';
import ShoppingDecisionScreen from './ShoppingDecisionScreen';
import OutfitAIScreen from './OutfitAIScreen';
import SkinAnalysisScreen from './SkinAnalysisScreen';
import BeautyCollectionScreen from './BeautyCollectionScreen';
import BeautyAdviceScreen from './BeautyAdviceScreen';
import OnboardingScreen, { type OnboardingAnswers } from './OnboardingScreen';
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
  | 'Profil' | 'Alışveriş' | 'Cilt Analizi' | 'Bakım Koleksiyonum' | 'Cilt Danışmanı' | 'Bakım Rutini';



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
  const [beautyCategory, setBeautyCategory] = useState<'skin' | 'hair' | 'makeup'>('skin');


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
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [profileRetry, setProfileRetry] = useState(0);

  const [onboardingDone, setOnboardingDone] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [loadingEditProfile, setLoadingEditProfile] = useState(false);
  const [savingEditProfile, setSavingEditProfile] = useState(false);
  const [profileAnswers, setProfileAnswers] = useState<OnboardingAnswers>({});



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


  useEffect(() => {
    let cancelled = false;

    if (!session?.user.id) {
      setOnboardingDone(false);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileLoadError(false);

    supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          showNotice('error', 'Profil yüklenemedi',
            'İnternet bağlantını kontrol edip tekrar dene.');
          setProfileLoadError(true);
        } else {
          setOnboardingDone(data?.onboarding_completed === true);
        }

        setProfileLoading(false);
      });

    return () => { cancelled = true; };
  }, [session?.user.id, profileRetry]);

  const openProfileEditor = async () => {
    if (!session?.user.id || loadingEditProfile) return;

    setLoadingEditProfile(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('answers')
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;

      setProfileAnswers(
        data?.answers && typeof data.answers === 'object'
          && !Array.isArray(data.answers)
          ? data.answers as OnboardingAnswers
          : {}
      );
      setEditingProfile(true);
    } catch (error: any) {
      showNotice('error', 'Profil açılamadı',
        error?.message || 'Lütfen tekrar dene.');
    } finally {
      setLoadingEditProfile(false);
    }
  };

  const saveProfileAnswers = async (answers: OnboardingAnswers) => {
    if (!session?.user.id || savingEditProfile) return;

    setSavingEditProfile(true);
    try {
      const { data, error: readError } = await supabase
        .from('user_profiles')
        .select('answers')
        .eq('user_id', session.user.id)
        .single();

      if (readError) throw readError;

      const current: OnboardingAnswers =
        data?.answers &&
        typeof data.answers === 'object' &&
        !Array.isArray(data.answers)
          ? data.answers as OnboardingAnswers
          : {};

      const updated: OnboardingAnswers = { ...current };

      // Düzenleme ekranı açıldığından beri değişen alanları bul.
      const keys = new Set([
        ...Object.keys(profileAnswers),
        ...Object.keys(answers),
      ]);

      for (const key of keys) {
        if (profileAnswers[key] === answers[key]) continue;

        if (answers[key] === undefined || answers[key] === '') {
          delete updated[key];
        } else {
          updated[key] = answers[key];
        }
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          answers: updated,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      setProfileAnswers(updated);
      setEditingProfile(false);
      showNotice('success', 'PRİZMA İmzan güncellendi',
        'Tercihlerin başarıyla kaydedildi.');
    } catch (error: any) {
      showNotice('error', 'Değişiklikler kaydedilemedi',
        error?.message || 'Lütfen tekrar dene.');
    } finally {
      setSavingEditProfile(false);
    }
  };

  const finishOnboarding = async (answers: OnboardingAnswers) => {
    if (!session?.user.id || savingOnboarding) return;

    setSavingOnboarding(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: session.user.id,
          onboarding_completed: true,
          answers,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setOnboardingDone(true);
    } catch (error: any) {
      showNotice('error', 'Cevaplar kaydedilemedi',
        error?.message || 'Lütfen tekrar dene.');
    } finally {
      setSavingOnboarding(false);
    }
  };

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

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={C.lavender} />
        <Text style={styles.loadingText}>
          PRİZMA profilin hazırlanıyor ✦
        </Text>
      </SafeAreaView>
    );
  }

  if (profileLoadError) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.loadingText}>
          Profil bilgilerin yüklenemedi.
        </Text>
        <Text style={styles.loadingText}>
          İnternet bağlantını kontrol edip tekrar deneyebilirsin.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setProfileRetry(value => value + 1)}
        >
          <Text style={styles.primaryButtonText}>
            Tekrar Dene ✦
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!onboardingDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <PrizmaNotice
          visible={Boolean(notice)}
          type={notice?.type || 'info'}
          title={notice?.title || ''}
          message={notice?.message || ''}
          onClose={() => setNotice(null)}
        />
        <OnboardingScreen onComplete={finishOnboarding} />
        {savingOnboarding && (
          <ActivityIndicator color={C.lavender} />
        )}
      </SafeAreaView>
    );
  }

  if (editingProfile) {
    return (
      <SafeAreaView style={styles.safe}>
        <PrizmaNotice
          visible={Boolean(notice)}
          type={notice?.type || 'info'}
          title={notice?.title || ''}
          message={notice?.message || ''}
          onClose={() => setNotice(null)}
        />
        <OnboardingScreen
          editing
          initialAnswers={profileAnswers}
          saving={savingEditProfile}
          onComplete={saveProfileAnswers}
          onCancel={() => setEditingProfile(false)}
        />
        {savingEditProfile && (
          <ActivityIndicator color={C.lavender} />
        )}
      </SafeAreaView>
    );
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
          <View style={styles.compactHome}>
            <Text style={styles.compactHomeWelcome}>Merhaba ✦</Text>
            <Text style={styles.compactHomeSub}>Bugün ne yapmak istersin?</Text>
            <View style={styles.quickHomeRow}>
              {([
                ['♧', 'Gardırop', 'Gardırop'],
                ['✧', 'Güzellik', 'Güzellik'],
                ['▢', 'Alışveriş', 'Alışveriş'],
                ['♡', 'Koleksiyon', 'Bakım Koleksiyonum'],
              ] as const).map(([icon, title, target]) => (
                <TouchableOpacity key={title} style={styles.quickHomeItem} onPress={() => open(target)}>
                  <View style={styles.quickHomeIconBox}><Text style={styles.quickHomeIcon}>{icon}</Text></View>
                  <Text style={styles.quickHomeLabel}>{title}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.compactAIHero} onPress={() => open('PRİZMA AI')}>
              <View pointerEvents="none" style={styles.compactAIOrbOne} />
              <View pointerEvents="none" style={styles.compactAIOrbTwo} />
              <View style={{ flex: 1 }}>
                <Text style={styles.compactAIName}>PRİZMA AI ✦</Text>
                <Text style={styles.compactAIDesc}>Kişisel asistanın her an yanında.</Text>
              </View>
              <Text style={styles.compactAIArrow}>➜</Text>
            </TouchableOpacity>
            {([
              ['♧', 'Gardırop', 'Kıyafetlerin, kombinlerin ve AI stil önerileri', 'Gardırop'],
              ['✧', 'Güzellik', 'Cilt, saç ve makyaj rutinlerin', 'Güzellik'],
              ['▢', 'Alışveriş Analizi', 'Almadan önce birlikte değerlendirelim', 'Alışveriş'],
              ['♡', 'Koleksiyonum', 'Kaydettiğin tüm ürünler', 'Bakım Koleksiyonum'],
            ] as const).map(([icon, title, description, target]) => (
              <TouchableOpacity key={title} style={styles.compactHomeListCard} onPress={() => open(target)}>
                <View style={styles.compactListIcon}><Text style={styles.compactListIconText}>{icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.compactListTitle}>{title}</Text>
                  <Text style={styles.compactListDesc}>{description}</Text>
                </View>
                <Text style={styles.compactListArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
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
          <PrizmaChatScreen userId={session.user.id} onOutfit={() => open('Gardırop')} />
        )}

        {/* CİLT ANALİZİ */}
        {tab === 'Cilt Analizi' && (
          <SkinAnalysisScreen userId={session.user.id} />
        )}

        {/* BAKIM KOLEKSİYONUM */}
        {tab === 'Cilt Danışmanı' && (
          <BeautyAdviceScreen userId={session.user.id} initialCategory={beautyCategory} />
        )}

        {tab === 'Bakım Koleksiyonum' && (
          <BeautyCollectionScreen userId={session.user.id} />
        )}

        {tab === 'Bakım Rutini' && (
          <RoutineScreen userId={session.user.id} onAIRequest={() => { setBeautyCategory('skin'); open('Cilt Danışmanı'); }} />
        )}

        {/* GÜZELLİK */}
        {tab === 'Güzellik' && (
          <View style={styles.compactBeauty}>
            <Text style={styles.compactBeautyTitle}>♡  Güzellik</Text>
            <Text style={styles.compactBeautySub}>Cilt, saç ve makyaj rutinlerini yönet.</Text>
            <View style={styles.beautyCategoryRow}>
              {([
                ['◉', 'Cilt', 'Cilt Danışmanı'],
                ['♧', 'Saç', 'Cilt Danışmanı'],
                ['✎', 'Makyaj', 'Cilt Danışmanı'],
                ['▤', 'Rutin', 'Bakım Rutini'],
              ] as const).map(([icon, label, target]) => (
                <TouchableOpacity key={label} style={styles.beautyCategory} onPress={() => {
                  if (label === 'Cilt' || label === 'Saç' || label === 'Makyaj') {
                    setBeautyCategory(label === 'Cilt' ? 'skin' : label === 'Saç' ? 'hair' : 'makeup');
                  }
                  open(target);
                }}>
                  <Text style={styles.beautyCategoryIcon}>{icon}</Text>
                  <Text style={styles.beautyCategoryLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.compactBeautySection}>Hızlı Araçlar</Text>
            <View style={styles.beautyToolsGrid}>
              {([
                ['▦', 'Manuel Rutin Ekle', 'Sabah / akşam', 'Bakım Rutini'],
                ['✧', 'AI ile Ürün Önerisi', 'Rutinine ekle', 'Cilt Danışmanı'],
                ['♡', 'Bakım Koleksiyonum', 'Kaydettiğin ürünler', 'Bakım Koleksiyonum'],
                ['♢', 'İçerik Analizi', 'Ürünleri değerlendir', 'Alışveriş'],
              ] as const).map(([icon, title, desc, target]) => (
                <TouchableOpacity key={title} style={styles.beautyTool} onPress={() => open(target)}>
                  <Text style={styles.beautyToolIcon}>{icon}</Text>
                  <Text style={styles.beautyToolTitle}>{title}</Text>
                  <Text style={styles.beautyToolDesc}>{desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: "#725A81", marginBottom: 15 }}>ⓘ AI önerileri hata yapabilir. Ürün talimatlarını doğrula.</Text>
            <Text style={styles.compactBeautySection}>Koleksiyonum</Text>
            <TouchableOpacity style={styles.beautyCollectionLink} onPress={() => open('Bakım Koleksiyonum')}>
              <Text style={styles.beautyCollectionLinkText}>Kaydettiğin ürünleri görüntüle</Text>
              <Text style={styles.compactListArrow}>›</Text>
            </TouchableOpacity>
          </View>
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

            <TouchableOpacity
              style={styles.profileInfoCard}
              onPress={() => { void openProfileEditor(); }}
              disabled={loadingEditProfile}
              activeOpacity={0.8}
            >
              <Text style={styles.profileInfoTitle}>
                ✦ PRİZMA İmzan
              </Text>

              <Text style={styles.profileInfoDescription}>
                Stil, cilt, saç ve makyaj tercihlerini
                görüntüle ve düzenle. →
              </Text>

              {loadingEditProfile && (
                <ActivityIndicator color={C.lavender} />
              )}
            </TouchableOpacity>

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
  compactHome: { paddingTop: 7, paddingBottom: 24 },
  compactHomeWelcome: { fontSize: 22, fontWeight: '800', color: C.navy, marginBottom: 3 },
  compactHomeSub: { fontSize: 13, color: '#5C5C78', marginBottom: 18 },
  quickHomeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, gap: 7 },
  quickHomeItem: { flex: 1, alignItems: 'center' },
  quickHomeIconBox: { width: '100%', height: 54, borderRadius: 16, borderWidth: 1, borderColor: '#D7C8F1', backgroundColor: '#EDE5F8', alignItems: 'center', justifyContent: 'center', marginBottom: 6, elevation: 2, shadowColor: C.lavender, shadowOpacity: 0.10, shadowRadius: 5, shadowOffset: {width: 0,height: 2} },
  quickHomeIcon: { fontSize: 27, color: '#5C389E' },
  quickHomeLabel: { fontSize: 10, color: C.navy, fontWeight: '700', textAlign: 'center' },
  compactAIHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lavender, borderRadius: 20, padding: 19, minHeight: 105, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#7958B7', elevation: 3, shadowColor: '#6840A8', shadowOpacity: 0.17, shadowRadius: 11, shadowOffset: {width: 0,height: 5} },
  compactAIOrbOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -90, top: -116, backgroundColor: '#9B7ACC', opacity: 0.30 },
  compactAIOrbTwo: { position: 'absolute', width: 185, height: 185, borderRadius: 93, left: 105, bottom: -165, backgroundColor: '#45247D', opacity: 0.18 },
  compactAIName: { fontSize: 16, color: C.white, fontWeight: '800', marginBottom: 5 },
  compactAIDesc: { fontSize: 12, color: '#F2EAFB' },
  compactAIArrow: { fontSize: 26, color: C.white, fontWeight: '800' },
  compactHomeListCard: { flexDirection: 'row', alignItems: 'center', minHeight: 76, borderWidth: 1, borderColor: '#E2D8F0', borderRadius: 18, backgroundColor: C.white, padding: 8, marginBottom: 9, gap: 12, elevation: 2, shadowColor: C.navy, shadowOpacity: 0.055, shadowRadius: 6, shadowOffset: {width: 0,height: 2} },
  compactListIcon: { width: 63, height: 61, borderRadius: 13, backgroundColor: '#ECE3F7', alignItems: 'center', justifyContent: 'center' },
  compactListIconText: { fontSize: 29, color: '#5C389E' },
  compactListTitle: { fontSize: 15, fontWeight: '800', color: C.navy, marginBottom: 4 },
  compactListDesc: { fontSize: 11, color: '#5C5C78', lineHeight: 15 },
  compactListArrow: { fontSize: 26, color: '#5B379B' },
  compactBeauty: { paddingTop: 9, paddingBottom: 22 },
  compactBeautyTitle: { fontSize: 23, fontWeight: '800', color: C.navy, marginBottom: 5 },
  compactBeautySub: { color: '#5C5C78', fontSize: 12, marginBottom: 18 },
  beautyCategoryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  beautyCategory: { flex: 1, minHeight: 73, borderWidth: 1, borderColor: '#CDB8EC', borderRadius: 16, backgroundColor: '#EDE5F8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, elevation: 2, shadowColor: C.lavender, shadowOpacity: 0.09, shadowRadius: 4, shadowOffset: {width: 0,height: 2} },
  beautyCategoryIcon: { color: '#5C389E', fontSize: 27, marginBottom: 7 },
  beautyCategoryLabel: { color: C.navy, fontSize: 11, fontWeight: '800' },
  compactBeautySection: { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 11 },
  beautyToolsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  beautyTool: { width: '48%', minHeight: 108, borderWidth: 1, borderColor: '#E1D5F2', borderRadius: 17, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', padding: 9, elevation: 2, shadowColor: C.navy, shadowOpacity: 0.055, shadowRadius: 6, shadowOffset: {width: 0,height: 2} },
  beautyToolIcon: { fontSize: 27, color: '#5C389E', marginBottom: 7 },
  beautyToolTitle: { fontSize: 12, color: C.navy, fontWeight: '800', textAlign: 'center' },
  beautyToolDesc: { fontSize: 10, color: '#5C5C78', textAlign: 'center', marginTop: 4 },
  beautyCollectionLink: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E1D5F2', borderRadius: 16, padding: 15, backgroundColor: C.white },
  beautyCollectionLinkText: { color: C.navy, fontSize: 13, fontWeight: '700' },
  homeModern: {
    paddingTop: 12,
    paddingBottom: 28,
  },
  homeEyebrow: {
    fontSize: 10,
    letterSpacing: 2.2,
    color: '#8C729D',
    fontWeight: '700',
    marginBottom: 8,
  },
  homeHeading: {
    fontSize: 30,
    fontWeight: '800',
    color: '#292138',
    marginBottom: 22,
  },
  homeHero: {
    backgroundColor: '#E8D9F1',
    borderRadius: 24,
    padding: 24,
    minHeight: 235,
    overflow: 'hidden',
    marginBottom: 30,
  },
  homeHeroGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#C9A8DF',
    right: -75,
    top: -65,
    opacity: 0.65,
  },
  homeHeroLabel: {
    color: '#704295',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 17,
  },
  homeHeroTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#30203D',
    lineHeight: 34,
    maxWidth: 270,
    marginBottom: 10,
  },
  homeHeroDescription: {
    color: '#65536E',
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: 20,
  },
  homeHeroButton: {
    backgroundColor: '#78529A',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 17,
    alignSelf: 'flex-start',
  },
  homeHeroButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  homeSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#30203D',
    marginBottom: 16,
  },
  homeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  homeTile: {
    width: '48%',
    minHeight: 168,
    backgroundColor: '#F8F3FA',
    borderWidth: 1,
    borderColor: '#E6DBEA',
    borderRadius: 20,
    padding: 16,
  },
  homeTileIcon: {
    color: '#805CA1',
    fontSize: 28,
    marginBottom: 16,
  },
  homeTileTitle: {
    color: '#30203D',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 7,
  },
  homeTileSubtitle: {
    color: '#786A80',
    fontSize: 12,
    lineHeight: 17,
    paddingRight: 8,
  },
  homeTileArrow: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    fontSize: 20,
    color: '#805CA1',
  },

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
    color: '#8C6BAC',
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
    color: '#9272B7',
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
    backgroundColor: '#8067A7',
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
    color: '#8062A2',
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
    color: '#8D73B0',
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