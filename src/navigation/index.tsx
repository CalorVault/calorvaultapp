import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuickLogSheet } from '../components/QuickLogSheet';
import {
  BowlIcon,
  ChartIcon,
  CloseIcon,
  CommunityIcon,
  HomeIcon,
  SettingsIcon,
} from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { CommunityScreen } from '../screens/CommunityScreen';
import { DayDetailScreen } from '../screens/DayDetailScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { IntroScreen } from '../screens/IntroScreen';
import { LogFoodScreen } from '../screens/LogFoodScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { RecipesScreen } from '../screens/RecipesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ShareDayScreen } from '../screens/ShareDayScreen';
import { colors, radius, spacing } from '../theme';
import { LogFoodTab, MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICON_COMPONENTS: Record<
  keyof MainTabParamList,
  React.ComponentType<{ size?: number; color: string }>
> = {
  Home: HomeIcon,
  History: ChartIcon,
  Recipes: BowlIcon,
  Community: CommunityIcon,
  Settings: SettingsIcon,
};

// The four visible tabs, split 2-and-2 with a gap in the middle for the
// floating "+" button (Settings is excluded -- it stays a valid route,
// reached from the header gear, but has no tab bar button of its own).
const VISIBLE_TAB_ORDER: (keyof MainTabParamList)[] = ['Home', 'History', 'Recipes', 'Community'];

function TabBarWithLogButton(props: BottomTabBarProps) {
  const [showQuickLog, setShowQuickLog] = useState(false);
  const { state, navigation } = props;
  const { t } = useApp();
  const tabLabels: Record<keyof MainTabParamList, string> = {
    Home: t.nav.home,
    History: t.nav.progress,
    Recipes: t.nav.recipes,
    Community: t.nav.community,
    Settings: t.common.settings,
  };

  function handleSelect(tab: LogFoodTab, opts?: { autoStartVoice?: boolean }) {
    setShowQuickLog(false);
    navigation.getParent()?.navigate('LogFood', { initialTab: tab, ...opts });
  }

  function renderTab(name: keyof MainTabParamList) {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return null;
    const isFocused = state.routes[state.index]?.key === route.key;
    const Icon = TAB_ICON_COMPONENTS[name];
    const color = isFocused ? colors.text : colors.textMuted;

    function onPress() {
      const event = navigation.emit({
        type: 'tabPress',
        target: route!.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(name as never);
      }
    }

    return (
      <Pressable key={name} style={styles.tabItem} onPress={onPress}>
        <Icon size={20} color={color} />
        <Text style={[styles.tabLabel, { color }]}>{tabLabels[name]}</Text>
      </Pressable>
    );
  }

  const [left1, left2, right1, right2] = VISIBLE_TAB_ORDER;

  return (
    <View>
      <SafeAreaView edges={['bottom']} style={styles.tabBar}>
        <View style={styles.tabGroup}>
          {renderTab(left1)}
          {renderTab(left2)}
        </View>
        <View style={styles.centerGap} />
        <View style={styles.tabGroup}>
          {renderTab(right1)}
          {renderTab(right2)}
        </View>
      </SafeAreaView>
      <Pressable
        style={styles.centerButton}
        onPress={() => setShowQuickLog(true)}
        hitSlop={8}
        accessibilityLabel={t.nav.logFood}
        accessibilityRole="button"
      >
        <Text style={styles.centerButtonIcon}>+</Text>
      </Pressable>
      <QuickLogSheet
        visible={showQuickLog}
        onClose={() => setShowQuickLog(false)}
        onSelect={handleSelect}
      />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBarWithLogButton {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Recipes" component={RecipesScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      {/* Settings stays reachable (the header gear on Home/Recipes/Community
          navigates here) via navigation.navigate, but the custom tab bar
          above only renders buttons for VISIBLE_TAB_ORDER, so it has no
          button of its own. */}
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function ModalCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.modalCloseButton, pressed && styles.modalCloseButtonPressed]}
      accessibilityLabel="Close"
      accessibilityRole="button"
    >
      <CloseIcon size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

export function RootNavigator() {
  const { loading, profile, t } = useApp();
  const [showIntro, setShowIntro] = useState(true);

  if (showIntro) {
    return <IntroScreen onFinish={() => setShowIntro(false)} />;
  }

  if (loading) return null;

  if (!profile) {
    return <OnboardingScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="DayDetail"
          component={DayDetailScreen}
          options={{ headerShown: true, title: t.nav.dayDetail }}
        />
        <Stack.Screen
          name="LogFood"
          component={LogFoodScreen}
          options={({ navigation }) => ({
            headerShown: true,
            title: t.nav.logFood,
            presentation: 'modal',
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerLeft: () => (
              <ModalCloseButton onPress={() => navigation.goBack()} />
            ),
          })}
        />
        <Stack.Screen
          name="RecipeDetail"
          component={RecipeDetailScreen}
          options={({ navigation }) => ({
            headerShown: true,
            title: '',
            presentation: 'modal',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerLeft: () => (
              <ModalCloseButton onPress={() => navigation.goBack()} />
            ),
          })}
        />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={({ navigation }) => ({
            headerShown: true,
            title: '',
            presentation: 'modal',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerLeft: () => (
              <ModalCloseButton onPress={() => navigation.goBack()} />
            ),
          })}
        />
        <Stack.Screen
          name="ShareDay"
          component={ShareDayScreen}
          options={({ navigation }) => ({
            headerShown: true,
            title: '',
            presentation: 'modal',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerLeft: () => (
              <ModalCloseButton onPress={() => navigation.goBack()} />
            ),
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  modalCloseButtonPressed: {
    opacity: 0.6,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tabGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  centerGap: {
    width: 64,
  },
  tabItem: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.xs,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: -28,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  centerButtonIcon: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 32,
  },
});
