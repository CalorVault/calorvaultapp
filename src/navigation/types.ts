import { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Recipe } from '../types';

export type LogFoodTab = 'camera' | 'voice' | 'manual' | 'ask' | 'recent';

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  DayDetail: { date: string };
  LogFood: { initialTab?: LogFoodTab; autoStartVoice?: boolean } | undefined;
  Paywall: undefined;
  RecipeDetail: { recipe: Recipe; servings?: number };
  MealPlan: undefined;
  ShareDay: {
    calories: number;
    target: number;
    protein: number;
    carbs: number;
    fat: number;
    streak: number;
    dateLabel: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Recipes: undefined;
  Community: { pendingFriendUsername?: string } | undefined;
  Settings: undefined;
};

export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type RecipesScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Recipes'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type CommunityScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Community'>,
  NativeStackNavigationProp<RootStackParamList>
>;
