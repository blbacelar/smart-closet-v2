import { Tabs } from 'expo-router';
import { Shirt, Sparkles, Store, UserRound } from 'lucide-react-native';
import { ColorValue, StyleSheet } from 'react-native';
import { colors, fonts } from '../../src/theme';

const icon = (Icon: typeof Shirt) => ({ color }: { color: ColorValue }) => (
  <Icon color={color as string} size={22} strokeWidth={2} />
);

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="tryon"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginTop: 4,
        },
        tabBarStyle: {
          height: 82,
          paddingTop: 10,
          paddingBottom: 22,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.line,
          backgroundColor: 'rgba(244,244,242,0.98)',
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen name="closet" options={{ title: 'Closet', tabBarIcon: icon(Shirt) }} />
      <Tabs.Screen name="tryon" options={{ title: 'Studio', tabBarIcon: icon(Sparkles) }} />
      <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: icon(Store) }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: icon(UserRound) }} />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="saved" options={{ href: null }} />
    </Tabs>
  );
}
