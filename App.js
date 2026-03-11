import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import DownloadsScreen from './src/screens/DownloadsScreen';

const Stack = createNativeStackNavigator();

const darkTheme = {
  dark: true,
  colors: {
    primary: '#e50914',
    background: '#0d0d0d',
    card: '#0d0d0d',
    text: '#e0e0e0',
    border: '#1a1a2e',
    notification: '#e50914',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={darkTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Detail" component={DetailScreen} />
        <Stack.Screen name="Downloads" component={DownloadsScreen} />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ orientation: 'landscape' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
