import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BarcodeType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  BarcodeIcon,
  CupIcon,
  FlashIcon,
  GalleryIcon,
  MealIcon as ScanMealIcon,
  SparkleIcon,
  TagIcon,
} from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { Translations } from '../i18n';
import { BarcodeLookupError, lookupBarcode } from '../lib/barcodeApi';
import {
  estimateNutritionFromPhoto,
  estimateNutritionFromText,
  MealSuggestion,
  PhotoScanMode,
  suggestMeals,
} from '../lib/aiFood';
import { LogFoodTab, RootStackParamList } from '../navigation/types';
import { getRecentUniqueFoodEntries, todayIso } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { FoodEntry, LogMethod, NutrientEstimate } from '../types';

type ScanMode = PhotoScanMode | 'barcode';
const SCAN_MODES: ScanMode[] = ['auto', 'meal', 'barcode', 'label', 'drink'];
function scanModeMeta(
  t: Translations
): Record<ScanMode, { label: string; Icon: React.ComponentType<{ size?: number; color: string }> }> {
  return {
    auto: { label: t.logFood.scanModes.auto, Icon: SparkleIcon },
    meal: { label: t.logFood.scanModes.meal, Icon: ScanMealIcon },
    barcode: { label: t.logFood.scanModes.barcode, Icon: BarcodeIcon },
    label: { label: t.logFood.scanModes.label, Icon: TagIcon },
    drink: { label: t.logFood.scanModes.drink, Icon: CupIcon },
  };
}
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];
const BARCODE_RESCAN_MS = 4000;
const MIN_ANALYZING_MS = 1400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Tab = LogFoodTab;
const TABS: Tab[] = ['manual', 'camera', 'voice', 'recent'];
function tabMeta(t: Translations): Record<Tab, { icon: string; label: string }> {
  return {
    camera: { icon: '📷', label: t.logFood.tabs.scan },
    voice: { icon: '🎙️', label: t.logFood.tabs.voice },
    manual: { icon: '✏️', label: t.logFood.tabs.manual },
    ask: { icon: '💬', label: t.logFood.tabs.ask },
    recent: { icon: '🕐', label: t.logFood.tabs.recent },
  };
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function LogFoodScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'LogFood'>>();
  const { t } = useApp();
  const TAB_META = tabMeta(t);
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? 'manual');
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  function handleBarLayout(e: LayoutChangeEvent) {
    const width = e.nativeEvent.layout.width;
    setBarWidth(width);
    // Snap the indicator to the current tab's position immediately (no
    // animation) now that we know the bar's width, instead of starting at 0
    // when the screen opened directly onto a non-first tab.
    indicatorX.setValue((width / TABS.length) * TABS.indexOf(tab));
  }

  function selectTab(t: Tab) {
    setTab(t);
    if (barWidth > 0) {
      Animated.spring(indicatorX, {
        toValue: (barWidth / TABS.length) * TABS.indexOf(t),
        useNativeDriver: true,
        friction: 8,
        tension: 90,
      }).start();
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.content}>
        {tab === 'camera' && <CameraTab />}
        {tab === 'voice' && <VoiceTab />}
        {tab === 'manual' && <ManualTab />}
        {tab === 'ask' && <AskTab />}
        {tab === 'recent' && <RecentTab />}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.tabBarWrap}>
        <View style={styles.tabBar} onLayout={handleBarLayout}>
          {barWidth > 0 && (
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  width: barWidth / TABS.length,
                  transform: [{ translateX: indicatorX }],
                },
              ]}
            />
          )}
          {TABS.map((tabName) => (
            <Pressable
              key={tabName}
              style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
              onPress={() => selectTab(tabName)}
            >
              <Text style={[styles.tabIcon, tab === tabName && styles.tabIconActive]}>
                {TAB_META[tabName].icon}
              </Text>
              <Text style={[styles.tabLabel, tab === tabName && styles.tabLabelActive]}>
                {TAB_META[tabName].label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

function ReviewCard({
  estimate,
  onChange,
  onSave,
  onDiscard,
  saving,
  apiKey,
}: {
  estimate: NutrientEstimate;
  onChange: (e: NutrientEstimate) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  apiKey: string | null;
}) {
  const { t } = useApp();
  const [swapping, setSwapping] = useState(false);
  const [swapOptions, setSwapOptions] = useState<MealSuggestion[] | null>(null);

  async function handleSwap() {
    if (!apiKey) return;
    setSwapping(true);
    try {
      const options = await suggestMeals(apiKey, {
        calories: estimate.calories,
        proteinG: estimate.proteinG,
        carbsG: estimate.carbsG,
        fatG: estimate.fatG,
        question: `Suggest alternatives to "${estimate.foodName}" with roughly the same nutrition.`,
      });
      setSwapOptions(options);
    } catch (err) {
      Alert.alert(t.logFood.swapFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setSwapping(false);
    }
  }

  function pickSwap(s: MealSuggestion) {
    onChange({
      foodName: s.name,
      quantity: '1 serving',
      calories: s.calories,
      proteinG: s.proteinG,
      carbsG: s.carbsG,
      fatG: s.fatG,
      confidence: 'medium',
    });
    setSwapOptions(null);
  }

  return (
    <View style={styles.reviewCard}>
      <Text style={styles.reviewTitle}>{t.logFood.confirmTitle}</Text>
      <TextInput
        style={styles.reviewInput}
        value={estimate.foodName}
        onChangeText={(v) => onChange({ ...estimate, foodName: v })}
        placeholder={t.logFood.foodNamePlaceholder}
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={styles.reviewInput}
        value={estimate.quantity}
        onChangeText={(v) => onChange({ ...estimate, quantity: v })}
        placeholder={t.logFood.quantityPlaceholder}
        placeholderTextColor={colors.textMuted}
      />
      <View style={styles.reviewNumbersRow}>
        <NumberField
          label="kcal"
          value={estimate.calories}
          onChange={(v) => onChange({ ...estimate, calories: v })}
        />
        <NumberField
          label={t.onboarding.protein}
          value={estimate.proteinG}
          onChange={(v) => onChange({ ...estimate, proteinG: v })}
        />
        <NumberField
          label={t.onboarding.carbs}
          value={estimate.carbsG}
          onChange={(v) => onChange({ ...estimate, carbsG: v })}
        />
        <NumberField
          label={t.onboarding.fat}
          value={estimate.fatG}
          onChange={(v) => onChange({ ...estimate, fatG: v })}
        />
      </View>

      {apiKey && (
        <Pressable style={styles.swapLink} onPress={handleSwap} disabled={swapping}>
          {swapping ? (
            <ActivityIndicator color={colors.primaryDark} size="small" />
          ) : (
            <Text style={styles.swapLinkText}>{t.logFood.swapLink}</Text>
          )}
        </Pressable>
      )}

      {swapOptions && (
        <View style={styles.suggestionsBlock}>
          {swapOptions.map((s, i) => (
            <Pressable key={i} style={styles.suggestionCard} onPress={() => pickSwap(s)}>
              <Text style={styles.suggestionIcon}>{s.icon}</Text>
              <View style={styles.suggestionInfo}>
                <Text style={styles.suggestionName}>{s.name}</Text>
                <Text style={styles.suggestionMacros}>
                  ~{s.calories} kcal · {s.proteinG}g protein
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.reviewActions}>
        <Pressable style={styles.discardButton} onPress={onDiscard} disabled={saving}>
          <Text style={styles.discardText}>{t.logFood.discard}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, styles.saveButtonInRow]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveText}>{t.logFood.addToLog}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.numberField}>
      <Text style={styles.numberLabel}>{label}</Text>
      <TextInput
        style={styles.numberInput}
        value={String(value)}
        onChangeText={(v) => onChange(parseInt(v, 10) || 0)}
        keyboardType="number-pad"
      />
    </View>
  );
}

function useSaveEntry() {
  const { logFood, apiKey, isPremium } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  async function save(estimate: NutrientEstimate, method: LogMethod, photoUri?: string) {
    const entry: FoodEntry = {
      ...estimate,
      id: makeId(),
      date: todayIso(),
      loggedAt: new Date().toISOString(),
      method,
      photoUri,
    };
    await logFood(entry);
    navigation.goBack();
  }

  return { save, apiKey, isPremium };
}

function PremiumGate({ feature }: { feature: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useApp();
  return (
    <View style={styles.center}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.reviewTitle}>{t.premiumGate.title}</Text>
      <Text style={styles.permissionText}>{feature} {t.premiumGate.suffix}</Text>
      <Pressable style={styles.saveButton} onPress={() => navigation.navigate('Paywall')}>
        <Text style={styles.saveText}>{t.premiumGate.upgrade}</Text>
      </Pressable>
    </View>
  );
}

function AnalyzingOverlay({ photoUri }: { photoUri?: string }) {
  const { t } = useApp();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const glyphScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  return (
    <View style={styles.analyzingContainer}>
      {photoUri && (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} blurRadius={18} />
      )}
      <View style={styles.analyzingScrim} />
      <View style={styles.analyzingContent}>
        <View style={styles.analyzingPulseWrap}>
          <Animated.View
            style={[
              styles.analyzingRing,
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
          <Animated.View style={[styles.analyzingGlyph, { transform: [{ scale: glyphScale }] }]}>
            <SparkleIcon size={30} color={colors.white} />
          </Animated.View>
        </View>
        <Text style={styles.analyzingText}>{t.logFood.analyzingFood}</Text>
      </View>
    </View>
  );
}

function CameraTab() {
  const { t } = useApp();
  const SCAN_MODE_META = scanModeMeta(t);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('auto');
  const [torch, setTorch] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [estimate, setEstimate] = useState<NutrientEstimate | null>(null);
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const { save, apiKey, isPremium } = useSaveEntry();

  if (!isPremium) return <PremiumGate feature={t.premiumGate.cameraFeature} />;

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t.logFood.needCameraPermission}</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{t.logFood.grantCameraAccess}</Text>
        </Pressable>
      </View>
    );
  }

  const needsApiKey = scanMode !== 'barcode';

  function selectMode(mode: ScanMode) {
    setScanMode(mode);
    setBarcodeStatus('idle');
    setBarcodeError(null);
  }

  async function runPhotoEstimate(base64: string) {
    if (!apiKey) return;
    const result = await estimateNutritionFromPhoto(apiKey, base64, scanMode as PhotoScanMode);
    setEstimate(result);
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    if (needsApiKey && !apiKey) {
      Alert.alert(t.logFood.apiKeyNeededTitle, t.logFood.apiKeyNeededMsg);
      return;
    }
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      if (!photo?.base64) throw new Error('Failed to capture photo');
      setPhotoUri(photo.uri);
      await Promise.all([runPhotoEstimate(photo.base64), wait(MIN_ANALYZING_MS)]);
    } catch (err) {
      setPhotoUri(undefined);
      Alert.alert(t.logFood.scanFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setCapturing(false);
    }
  }

  async function handlePickFromGallery() {
    if (needsApiKey && !apiKey) {
      Alert.alert(t.logFood.apiKeyNeededTitle, t.logFood.apiKeyNeededMsg);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.logFood.photoAccessTitle, t.logFood.photoAccessMsg);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      base64: true,
      quality: 0.5,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    setCapturing(true);
    try {
      setPhotoUri(result.assets[0].uri);
      await Promise.all([runPhotoEstimate(result.assets[0].base64), wait(MIN_ANALYZING_MS)]);
    } catch (err) {
      setPhotoUri(undefined);
      Alert.alert(t.logFood.scanFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setCapturing(false);
    }
  }

  async function handleBarcodeScanned(result: { data: string }) {
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.code === result.data && now - last.time < BARCODE_RESCAN_MS) return;
    lastScanRef.current = { code: result.data, time: now };
    setBarcodeStatus('loading');
    setBarcodeError(null);
    try {
      const found = await lookupBarcode(result.data);
      setBarcodeStatus('idle');
      setEstimate(found);
    } catch (err) {
      setBarcodeStatus('error');
      setBarcodeError(err instanceof BarcodeLookupError ? err.message : t.logFood.barcodeLookupFailed);
    }
  }

  if (capturing && photoUri && scanMode !== 'barcode') {
    return <AnalyzingOverlay photoUri={photoUri} />;
  }

  if (estimate) {
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <ReviewCard
          estimate={estimate}
          onChange={setEstimate}
          saving={saving}
          apiKey={apiKey}
          onDiscard={() => {
            setEstimate(null);
            setPhotoUri(undefined);
          }}
          onSave={async () => {
            setSaving(true);
            await save(estimate, scanMode === 'barcode' ? 'barcode' : 'camera', photoUri);
            setSaving(false);
            setEstimate(null);
            setPhotoUri(undefined);
          }}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.scannerContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={scanMode === 'barcode' ? { barcodeTypes: BARCODE_TYPES } : undefined}
        onBarcodeScanned={scanMode === 'barcode' ? handleBarcodeScanned : undefined}
      />

      <SafeAreaView style={styles.scannerOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.scanFrameWrap} pointerEvents="none">
          <Text style={styles.scanModeLabel}>
            {SCAN_MODE_META[scanMode].label} {t.logFood.scannerSuffix}
          </Text>
          <View style={styles.scanFrame}>
            <View style={[styles.scanCorner, styles.scanCornerTL]} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
          </View>
          {scanMode === 'barcode' && barcodeStatus === 'loading' && (
            <View style={styles.scannerStatusPill}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.scannerStatusText}>{t.logFood.lookingUp}</Text>
            </View>
          )}
          {scanMode === 'barcode' && barcodeStatus === 'error' && barcodeError && (
            <Pressable style={styles.scannerStatusPill} onPress={() => setBarcodeStatus('idle')} hitSlop={8}>
              <Text style={styles.scannerStatusText}>{barcodeError} {t.logFood.tapToTryAgain}</Text>
            </Pressable>
          )}
          {needsApiKey && !apiKey && (
            <View style={styles.scannerStatusPill}>
              <Text style={styles.scannerStatusText}>{t.logFood.needApiKeyScan}</Text>
            </View>
          )}
        </View>

        <View style={styles.modePillRow}>
          {SCAN_MODES.map((mode) => {
            const meta = SCAN_MODE_META[mode];
            const active = mode === scanMode;
            return (
              <Pressable key={mode} style={styles.modePillButton} onPress={() => selectMode(mode)} hitSlop={4}>
                <meta.Icon size={18} color={active ? colors.ink : colors.textMuted} />
                <Text style={[styles.modePillLabel, active && styles.modePillLabelActive]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.scannerControlsRow}>
          <Pressable style={styles.scannerSideButton} onPress={() => setTorch((v) => !v)} hitSlop={8}>
            <FlashIcon size={22} color={torch ? colors.accent : colors.white} />
          </Pressable>
          {scanMode === 'barcode' ? (
            <View style={styles.captureButtonSpacer} />
          ) : (
            <Pressable style={styles.captureButton} onPress={handleCapture} disabled={capturing}>
              {capturing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <View style={styles.captureInner} />
              )}
            </Pressable>
          )}
          <Pressable
            style={styles.scannerSideButton}
            onPress={handlePickFromGallery}
            disabled={scanMode === 'barcode'}
            hitSlop={8}
          >
            <GalleryIcon size={22} color={scanMode === 'barcode' ? colors.textMuted : colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const VOICE_EXAMPLES = [
  'I\'m eating chicken breast and 200 grams of rice',
  'a bowl of oatmeal with a banana and peanut butter',
  'two eggs and a slice of toast with butter',
];

function VoiceTab() {
  const route = useRoute<RouteProp<RootStackParamList, 'LogFood'>>();
  const { t } = useApp();
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [estimate, setEstimate] = useState<NutrientEstimate | null>(null);
  const [saving, setSaving] = useState(false);
  const { save, apiKey, isPremium } = useSaveEntry();
  const example = useMemo(
    () => VOICE_EXAMPLES[Math.floor(Math.random() * VOICE_EXAMPLES.length)],
    []
  );
  const pulse = useRef(new Animated.Value(1)).current;

  useSpeechRecognitionEvent('start', () => setRecognizing(true));
  useSpeechRecognitionEvent('end', () => setRecognizing(false));
  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('error', (event) => {
    setRecognizing(false);
    if (event.error === 'aborted') return; // user tapped Cancel, not a real error
    Alert.alert(t.logFood.voiceErrorTitle, event.message ?? event.error);
  });

  useEffect(() => {
    if (!recognizing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recognizing, pulse]);

  async function handleStart() {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert(t.logFood.micNeededTitle, t.logFood.micNeededMsg);
      return;
    }
    setTranscript('');
    setEstimate(null);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  }

  useEffect(() => {
    if (route.params?.autoStartVoice && isPremium && apiKey) {
      handleStart();
    }
    // Only ever auto-start once, right when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    ExpoSpeechRecognitionModule.abort();
    setTranscript('');
  }

  async function handleDone() {
    ExpoSpeechRecognitionModule.stop();
    await handleProcess();
  }

  async function handleProcess() {
    if (!transcript.trim() || !apiKey) return;
    setProcessing(true);
    try {
      const result = await estimateNutritionFromText(apiKey, transcript.trim());
      setEstimate(result);
    } catch (err) {
      Alert.alert(t.logFood.processFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }

  if (!isPremium) return <PremiumGate feature={t.premiumGate.voiceFeature} />;

  if (!apiKey) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t.logFood.needApiKeyVoice}</Text>
      </View>
    );
  }

  if (estimate) {
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <ReviewCard
          estimate={estimate}
          onChange={setEstimate}
          saving={saving}
          apiKey={apiKey}
          onDiscard={() => {
            setEstimate(null);
            setTranscript('');
          }}
          onSave={async () => {
            setSaving(true);
            await save(estimate, 'voice');
            setSaving(false);
            setEstimate(null);
            setTranscript('');
          }}
        />
      </ScrollView>
    );
  }

  if (recognizing || processing) {
    return (
      <View style={styles.listeningOverlay}>
        <Animated.View style={[styles.listeningPulse, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.listeningMicIcon}>🎙️</Text>
        </Animated.View>
        <Text style={styles.listeningTitle}>{processing ? t.logFood.oneSec : t.logFood.listening}</Text>
        <Text style={styles.listeningHint}>
          {transcript || `${t.logFood.trySaying} "${example}"`}
        </Text>
        <View style={styles.listeningActions}>
          <Pressable
            style={styles.listeningCancel}
            onPress={handleCancel}
            disabled={processing}
          >
            <Text style={styles.listeningCancelText}>{t.common.cancel}</Text>
          </Pressable>
          <Pressable
            style={styles.listeningDone}
            onPress={handleDone}
            disabled={processing || !recognizing}
          >
            {processing ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveText}>{t.common.done}</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.voiceHint}>{t.logFood.voiceHint} "{example}"</Text>
      <Pressable style={styles.micButton} onPress={handleStart}>
        <Text style={styles.micIcon}>🎙️</Text>
      </Pressable>
    </View>
  );
}

function ManualTab() {
  const { t } = useApp();
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const { save, apiKey, isPremium } = useSaveEntry();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const canSave = foodName.trim().length > 0 && calories.trim().length > 0;

  async function handleLookUp() {
    if (!apiKey || !isPremium || !foodName.trim()) return;
    setLookingUp(true);
    try {
      const result = await estimateNutritionFromText(apiKey, foodName.trim());
      setFoodName(result.foodName);
      setQuantity(result.quantity);
      setCalories(String(result.calories));
      setProtein(String(result.proteinG));
      setCarbs(String(result.carbsG));
      setFat(String(result.fatG));
    } catch (err) {
      Alert.alert(t.logFood.lookUpFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await save(
      {
        foodName: foodName.trim(),
        quantity: quantity.trim() || '1 serving',
        calories: parseInt(calories, 10) || 0,
        proteinG: parseInt(protein, 10) || 0,
        carbsG: parseInt(carbs, 10) || 0,
        fatG: parseInt(fat, 10) || 0,
        confidence: 'high',
      },
      'manual'
    );
    setSaving(false);
    setFoodName('');
    setQuantity('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.reviewInput}
        placeholder={t.logFood.foodNamePlaceholder}
        placeholderTextColor={colors.textMuted}
        value={foodName}
        onChangeText={setFoodName}
      />
      {apiKey && isPremium && (
        <Pressable
          style={styles.lookupLink}
          onPress={handleLookUp}
          disabled={lookingUp || !foodName.trim()}
        >
          {lookingUp ? (
            <ActivityIndicator color={colors.primaryDark} size="small" />
          ) : (
            <Text
              style={[
                styles.lookupLinkText,
                !foodName.trim() && styles.lookupLinkTextDisabled,
              ]}
            >
              {t.logFood.lookUpNutrition}
            </Text>
          )}
        </Pressable>
      )}
      {apiKey && !isPremium && (
        <Pressable
          style={styles.lookupLink}
          onPress={() => navigation.navigate('Paywall')}
        >
          <Text style={styles.lookupLinkText}>{t.logFood.upgradeToLookUp}</Text>
        </Pressable>
      )}
      <TextInput
        style={styles.reviewInput}
        placeholder={t.logFood.quantityExamplePlaceholder}
        placeholderTextColor={colors.textMuted}
        value={quantity}
        onChangeText={setQuantity}
      />
      <View style={styles.reviewNumbersRow}>
        <NumberField label="kcal" value={parseInt(calories, 10) || 0} onChange={(v) => setCalories(String(v))} />
        <NumberField label={t.onboarding.protein} value={parseInt(protein, 10) || 0} onChange={(v) => setProtein(String(v))} />
        <NumberField label={t.onboarding.carbs} value={parseInt(carbs, 10) || 0} onChange={(v) => setCarbs(String(v))} />
        <NumberField label={t.onboarding.fat} value={parseInt(fat, 10) || 0} onChange={(v) => setFat(String(v))} />
      </View>
      <Pressable
        style={[styles.saveButton, !canSave && styles.nextButtonDisabled]}
        onPress={handleSave}
        disabled={!canSave || saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.saveText}>{t.logFood.addToLog}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function AskTab() {
  const { plan, today, t } = useApp();
  const { save, apiKey, isPremium } = useSaveEntry();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MealSuggestion[] | null>(null);
  const [loggingIndex, setLoggingIndex] = useState<number | null>(null);

  const remaining = useMemo(() => {
    const totals = today.entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.proteinG,
        carbs: acc.carbs + e.carbsG,
        fat: acc.fat + e.fatG,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return {
      calories: Math.max(0, (plan?.calorieTarget ?? 0) - totals.calories),
      proteinG: Math.max(0, (plan?.proteinG ?? 0) - totals.protein),
      carbsG: Math.max(0, (plan?.carbsG ?? 0) - totals.carbs),
      fatG: Math.max(0, (plan?.fatG ?? 0) - totals.fat),
    };
  }, [plan, today.entries]);

  async function handleAsk(refresh: boolean) {
    if (!apiKey) return;
    setLoading(true);
    try {
      const result = await suggestMeals(apiKey, {
        ...remaining,
        question: question.trim() || 'What can I eat right now?',
        avoid: refresh && suggestions ? suggestions.map((s) => s.name) : undefined,
      });
      setSuggestions(result);
    } catch (err) {
      Alert.alert(t.logFood.askFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLog(s: MealSuggestion, index: number) {
    setLoggingIndex(index);
    await save(
      {
        foodName: s.name,
        quantity: '1 serving',
        calories: s.calories,
        proteinG: s.proteinG,
        carbsG: s.carbsG,
        fatG: s.fatG,
        confidence: 'medium',
      },
      'suggested'
    );
    setLoggingIndex(null);
  }

  if (!isPremium) return <PremiumGate feature={t.premiumGate.askFeature} />;

  if (!apiKey) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t.logFood.needApiKeyAsk}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
      <View style={styles.budgetCard}>
        <Text style={styles.budgetLabel}>{t.logFood.askYouHaveLeft}</Text>
        <Text style={styles.budgetBig}>{remaining.calories} kcal</Text>
        <Text style={styles.budgetSub}>
          P{remaining.proteinG}g · C{remaining.carbsG}g · F{remaining.fatG}g
        </Text>
      </View>
      <TextInput
        style={[styles.reviewInput, styles.askInput]}
        placeholder={t.logFood.askPlaceholder}
        placeholderTextColor={colors.textMuted}
        value={question}
        onChangeText={setQuestion}
        multiline
      />
      <Pressable style={styles.saveButton} onPress={() => handleAsk(false)} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.saveText}>{t.logFood.askButton}</Text>
        )}
      </Pressable>

      {suggestions && (
        <View style={styles.suggestionsBlock}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>{t.logFood.hereWhatFits}</Text>
            <Pressable onPress={() => handleAsk(true)} disabled={loading}>
              <Text style={styles.refreshLink}>{t.logFood.differentOptions}</Text>
            </Pressable>
          </View>
          {suggestions.map((s, i) => (
            <View key={i} style={styles.suggestionCard}>
              <Text style={styles.suggestionIcon}>{s.icon}</Text>
              <View style={styles.suggestionInfo}>
                <Text style={styles.suggestionName}>{s.name}</Text>
                <Text style={styles.suggestionMacros}>
                  ~{s.calories} kcal · {s.proteinG}g {t.onboarding.protein.toLowerCase()}
                </Text>
              </View>
              <Pressable
                style={styles.logButton}
                onPress={() => handleLog(s, i)}
                disabled={loggingIndex !== null}
              >
                {loggingIndex === i ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.logButtonText}>{t.logFood.logButton}</Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function RecentTab() {
  const { t } = useApp();
  const { save } = useSaveEntry();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  useEffect(() => {
    getRecentUniqueFoodEntries().then((result) => {
      setEntries(result);
      setLoading(false);
    });
  }, []);

  async function handleLog(entry: FoodEntry) {
    setLoggingId(entry.id);
    await save(
      {
        foodName: entry.foodName,
        quantity: entry.quantity,
        calories: entry.calories,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
      },
      'repeat'
    );
    setLoggingId(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t.logFood.recentEmpty}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.suggestionCard}>
          <Text style={styles.suggestionIcon}>🍽️</Text>
          <View style={styles.suggestionInfo}>
            <Text style={styles.suggestionName}>{entry.foodName}</Text>
            <Text style={styles.suggestionMacros}>
              {entry.quantity} · ~{entry.calories} kcal
            </Text>
          </View>
          <Pressable
            style={styles.logButton}
            onPress={() => handleLog(entry)}
            disabled={loggingId !== null}
          >
            {loggingId === entry.id ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.logButtonText}>{t.logFood.logButton}</Text>
            )}
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  tabBarWrap: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabIndicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  tabButtonPressed: {
    opacity: 0.6,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  tabLabelActive: { color: colors.primaryDark },
  tabContent: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionText: { color: colors.textMuted, textAlign: 'center', fontSize: 15 },
  lockIcon: { fontSize: 32 },
  permissionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  permissionButtonText: { color: colors.background, fontWeight: '700' },
  scannerContainer: { flex: 1, backgroundColor: colors.ink },
  analyzingContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  analyzingContent: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  analyzingPulseWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.white,
  },
  analyzingGlyph: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
  },
  scanFrameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  scanModeLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  scanFrame: {
    width: 260,
    height: 260,
  },
  scanCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.white,
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radius.md,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radius.md,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radius.md,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radius.md,
  },
  scannerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    maxWidth: 300,
  },
  scannerStatusText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  modePillRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modePillButton: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
  },
  modePillLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  modePillLabelActive: {
    color: colors.ink,
  },
  scannerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  scannerSideButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.primary,
  },
  captureButtonSpacer: { width: 72, height: 72 },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  voiceHint: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  micButton: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: { fontSize: 32 },
  listeningOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  listeningPulse: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningMicIcon: { fontSize: 48 },
  listeningTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  listeningHint: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  listeningActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  listeningCancel: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listeningCancelText: { color: colors.textMuted, fontWeight: '600' },
  listeningDone: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  reviewCard: { gap: spacing.md },
  reviewTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  reviewInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  reviewNumbersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  numberField: { flex: 1, gap: spacing.xs },
  numberLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  numberInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  reviewActions: { flexDirection: 'row', gap: spacing.md },
  discardButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discardText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveButtonInRow: {
    flex: 2,
  },
  saveText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  nextButtonDisabled: { opacity: 0.4 },
  swapLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  swapLinkText: {
    color: colors.primaryDark,
    fontWeight: '600',
    fontSize: 13,
  },
  lookupLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  lookupLinkText: {
    color: colors.primaryDark,
    fontWeight: '600',
    fontSize: 13,
  },
  lookupLinkTextDisabled: {
    color: colors.textMuted,
  },
  budgetCard: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  budgetLabel: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetBig: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  budgetSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  askInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  suggestionsBlock: {
    gap: spacing.sm,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionsTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  refreshLink: {
    color: colors.primaryDark,
    fontWeight: '600',
    fontSize: 13,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  suggestionIcon: {
    fontSize: 24,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  suggestionMacros: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  logButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  logButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 13,
  },
});
