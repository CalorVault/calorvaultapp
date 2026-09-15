import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { RootNavigator } from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </AppProvider>
    </SafeAreaProvider>
  );
}
