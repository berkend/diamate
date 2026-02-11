/**
 * DiaMate - Production Mobile App
 * React Native (Expo) Entry Point
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, StyleSheet } from 'react-native';

// UI
import { ErrorBoundary } from './src/ui/ErrorBoundary';

// Screens
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MealScreen } from './src/screens/MealScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { HealthConnectionsScreen } from './src/screens/HealthConnectionsScreen';

// Store & Services
import { useAppStore } from './src/store/appStore';
import { initPurchases } from './src/services/purchases';
import { initSupabase } from './src/services/supabase';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// DiaMate brand color
const BRAND_GREEN = '#16A34A';

// Tab Navigator for main app
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: BRAND_GREEN,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Meal"
        component={MealScreen}
        options={{
          tabBarLabel: 'Öğün',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>📸</Text>,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'AI Koç',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🤖</Text>,
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarLabel: 'Öneriler',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>💡</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Ayarlar',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>⚙️</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isOnboarded, initialize } = useAppStore();

  useEffect(() => {
    const init = async () => {
      await initSupabase();
      await initPurchases();
      await initialize();
    };
    init();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {!isOnboarded ? (
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              ) : (
                <>
                  <Stack.Screen name="Main" component={MainTabs} />
                  <Stack.Screen
                    name="Paywall"
                    component={PaywallScreen}
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen
                    name="HealthConnections"
                    component={HealthConnectionsScreen}
                    options={{ presentation: 'modal' }}
                  />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: 8,
    height: 70,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 24,
  },
});
