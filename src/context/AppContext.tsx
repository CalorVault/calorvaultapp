import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { calculateDailyPlan } from '../lib/calorieCalc';
import { DEFAULT_LANGUAGE, getTranslations, LanguageCode, Translations } from '../i18n';
import {
  getCustomerInfoSilently,
  hasPremiumEntitlement,
  isPurchasesSupported,
  purchasePackage as purchasePackageRC,
  restorePurchases as restorePurchasesRC,
} from '../lib/purchases';
import {
  addFoodEntry,
  addWeightEntry,
  DEFAULT_WATER_TARGET_ML,
  getApiKey,
  getDayLog,
  getLanguage,
  getPlan,
  getProfile,
  getRecipeApiKey,
  getSavedRecipes,
  getSubscription,
  getWaterIntake,
  getWaterTarget,
  getWeightLog,
  removeFoodEntry,
  saveApiKey as persistApiKey,
  saveLanguage as persistLanguage,
  savePlan,
  saveProfile,
  saveRecipeApiKey as persistRecipeApiKey,
  saveSavedRecipes,
  saveSubscription,
  saveWaterIntake,
  saveWaterTarget as persistWaterTarget,
  todayIso,
} from '../storage/db';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import {
  DailyPlan,
  DayLog,
  FoodEntry,
  Recipe,
  Subscription,
  SubscriptionPlan,
  UserProfile,
  WeightEntry,
} from '../types';

interface AppContextValue {
  loading: boolean;
  profile: UserProfile | null;
  plan: DailyPlan | null;
  apiKey: string | null;
  recipeApiKey: string | null;
  language: LanguageCode;
  t: Translations;
  today: DayLog;
  /** Local record of which plan the user picked, kept only for display -- the real premium gate is `isPremium`. */
  subscription: Subscription | null;
  /** Derived from the real RevenueCat entitlement check; false until a real purchase or restore succeeds. */
  isPremium: boolean;
  purchasesSupported: boolean;
  completeOnboarding: (profile: UserProfile) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setRecipeApiKey: (key: string) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  logFood: (entry: FoodEntry) => Promise<void>;
  deleteFood: (entryId: string) => Promise<void>;
  refreshToday: () => Promise<void>;
  savedRecipes: Recipe[];
  toggleSavedRecipe: (recipe: Recipe) => Promise<void>;
  weightLog: WeightEntry[];
  logWeight: (weightKg: number) => Promise<void>;
  waterMl: number;
  waterTargetMl: number;
  addWater: (deltaMl: number) => Promise<void>;
  setWaterTarget: (ml: number) => Promise<void>;
  /** Purchases the given RevenueCat package; `plan` is only used for the local display record. */
  purchasePremium: (pkg: PurchasesPackage, plan: SubscriptionPlan) => Promise<void>;
  /** Returns whether the restore actually found an active premium entitlement. */
  restorePremium: () => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [recipeApiKey, setRecipeApiKeyState] = useState<string | null>(null);
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [today, setToday] = useState<DayLog>({ date: todayIso(), entries: [] });
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [waterTargetMl, setWaterTargetMl] = useState(DEFAULT_WATER_TARGET_ML);

  const refreshToday = useCallback(async () => {
    const log = await getDayLog(todayIso());
    setToday(log);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [
          storedProfile,
          storedPlan,
          storedKey,
          storedRecipeKey,
          storedLanguage,
          storedSubscription,
          storedSavedRecipes,
          storedWeightLog,
          storedWaterMl,
          storedWaterTarget,
        ] = await Promise.all([
          getProfile(),
          getPlan(),
          getApiKey(),
          getRecipeApiKey(),
          getLanguage(),
          getSubscription(),
          getSavedRecipes(),
          getWeightLog(),
          getWaterIntake(todayIso()),
          getWaterTarget(),
        ]);
        setProfile(storedProfile);
        setPlan(storedPlan);
        setApiKeyState(storedKey);
        setRecipeApiKeyState(storedRecipeKey);
        setLanguageState(storedLanguage);
        setSubscription(storedSubscription);
        setSavedRecipes(storedSavedRecipes);
        setWeightLog(storedWeightLog);
        setWaterMl(storedWaterMl);
        setWaterTargetMl(storedWaterTarget);
        await refreshToday();
      } catch (err) {
        console.warn('Failed to load stored app state, starting fresh.', err);
      } finally {
        setLoading(false);
      }
      const info = await getCustomerInfoSilently();
      if (info) setCustomerInfo(info);
    })();
  }, [refreshToday]);

  const recomputePlan = useCallback(async (p: UserProfile) => {
    const newPlan = calculateDailyPlan(
      p.sex,
      p.weightKg,
      p.heightCm,
      p.age,
      p.activityLevel,
      p.goal
    );
    await savePlan(newPlan);
    setPlan(newPlan);
  }, []);

  const completeOnboarding = useCallback(
    async (p: UserProfile) => {
      await saveProfile(p);
      setProfile(p);
      await recomputePlan(p);
    },
    [recomputePlan]
  );

  const updateProfile = useCallback(
    async (p: UserProfile) => {
      await saveProfile(p);
      setProfile(p);
      await recomputePlan(p);
    },
    [recomputePlan]
  );

  const setApiKey = useCallback(async (key: string) => {
    await persistApiKey(key);
    setApiKeyState(key);
  }, []);

  const setRecipeApiKey = useCallback(async (key: string) => {
    await persistRecipeApiKey(key);
    setRecipeApiKeyState(key);
  }, []);

  const setLanguage = useCallback(async (lang: LanguageCode) => {
    await persistLanguage(lang);
    setLanguageState(lang);
  }, []);

  const t = useMemo(() => getTranslations(language), [language]);

  const logFood = useCallback(
    async (entry: FoodEntry) => {
      await addFoodEntry(entry);
      await refreshToday();
    },
    [refreshToday]
  );

  const deleteFood = useCallback(
    async (entryId: string) => {
      await removeFoodEntry(todayIso(), entryId);
      await refreshToday();
    },
    [refreshToday]
  );

  const purchasePremium = useCallback(async (pkg: PurchasesPackage, plan: SubscriptionPlan) => {
    const info = await purchasePackageRC(pkg);
    setCustomerInfo(info);
    const sub: Subscription = { plan, startedAt: new Date().toISOString() };
    await saveSubscription(sub);
    setSubscription(sub);
  }, []);

  const restorePremium = useCallback(async () => {
    const info = await restorePurchasesRC();
    setCustomerInfo(info);
    return hasPremiumEntitlement(info);
  }, []);

  const toggleSavedRecipe = useCallback(
    async (recipe: Recipe) => {
      const isSaved = savedRecipes.some((r) => r.id === recipe.id);
      const next = isSaved
        ? savedRecipes.filter((r) => r.id !== recipe.id)
        : [...savedRecipes, recipe];
      await saveSavedRecipes(next);
      setSavedRecipes(next);
    },
    [savedRecipes]
  );

  const logWeight = useCallback(
    async (weightKg: number) => {
      const entry: WeightEntry = {
        date: todayIso(),
        weightKg,
        loggedAt: new Date().toISOString(),
      };
      const next = await addWeightEntry(entry);
      setWeightLog(next);
      if (profile) {
        await updateProfile({ ...profile, weightKg });
      }
    },
    [profile, updateProfile]
  );

  const addWater = useCallback(
    async (deltaMl: number) => {
      const next = Math.max(0, waterMl + deltaMl);
      await saveWaterIntake(todayIso(), next);
      setWaterMl(next);
    },
    [waterMl]
  );

  const setWaterTarget = useCallback(async (ml: number) => {
    await persistWaterTarget(ml);
    setWaterTargetMl(ml);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      loading,
      profile,
      plan,
      apiKey,
      recipeApiKey,
      language,
      t,
      today,
      subscription,
      isPremium: hasPremiumEntitlement(customerInfo),
      purchasesSupported: isPurchasesSupported(),
      completeOnboarding,
      updateProfile,
      setApiKey,
      setRecipeApiKey,
      setLanguage,
      logFood,
      deleteFood,
      refreshToday,
      savedRecipes,
      toggleSavedRecipe,
      weightLog,
      logWeight,
      waterMl,
      waterTargetMl,
      addWater,
      setWaterTarget,
      purchasePremium,
      restorePremium,
    }),
    [
      loading,
      profile,
      plan,
      apiKey,
      recipeApiKey,
      language,
      t,
      today,
      subscription,
      customerInfo,
      completeOnboarding,
      updateProfile,
      setApiKey,
      setRecipeApiKey,
      setLanguage,
      logFood,
      deleteFood,
      refreshToday,
      savedRecipes,
      toggleSavedRecipe,
      weightLog,
      logWeight,
      waterMl,
      waterTargetMl,
      addWater,
      setWaterTarget,
      purchasePremium,
      restorePremium,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
