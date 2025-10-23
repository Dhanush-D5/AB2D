// App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
  // 👈 Add this line to your type definition
  VerificationScreen: { verificationCode: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
        <Stack.Screen name="FetchContacts" component={FetchContactsScreen} />
        <Stack.Screen
          name="ImageTransmissionScreen"
          component={ImageTransmissionScreen}
        />
        {/* 👈 Add this line to register the screen */}
        <Stack.Screen name="VerificationScreen" component={VerificationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}