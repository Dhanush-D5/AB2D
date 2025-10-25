// App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PhoneLoginScreen from "./PhoneLoginScreen";
import FetchContactsScreen from "./FetchContactsScreen";
import ImageTransmissionScreen from "./ImageTransmissionScreen";
import VerificationScreen from "./VerificationScreen"; 

export type RootStackParamList = {
  PhoneLogin: undefined;
  FetchContacts: undefined;
  ImageTransmissionScreen: {
    contactId: string;
    name: string | null;
    numbers: string[];
  };
  VerificationScreen: { verificationCode: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
          <Stack.Screen name="FetchContacts" component={FetchContactsScreen} />
          <Stack.Screen
            name="ImageTransmissionScreen"
            component={ImageTransmissionScreen}
          />
          <Stack.Screen name="VerificationScreen" component={VerificationScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}