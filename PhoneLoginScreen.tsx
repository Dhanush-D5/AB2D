// PhoneLoginScreen.tsx
import React, { useState } from "react";
import { Alert, Dimensions, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

type RootStackParamList = {
  FetchContacts: undefined;
  VerificationScreen: { verificationCode: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "VerificationScreen">;

export default function PhoneLoginScreen() {
  const [phone, setPhone] = useState("");
  const navigation = useNavigation<NavigationProp>();

  const isValidPhone = /^\d{10}$/.test(phone);

  const handleNext = () => {
    if (isValidPhone) {
      // Step 1: Generate a local, unique 6-digit verification code.
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Step 2: Navigate to the new VerificationScreen and pass the code.
      navigation.navigate("VerificationScreen", { verificationCode });

      // Step 3: Prompt the user with a clear message.
      Alert.alert(
        "Verification Required",
        `Enter the OTP ${verificationCode} to proceed.`
      );
    } else {
      Alert.alert("Invalid Phone Number", "Phone number must be exactly 10 digits.");
    }
  };

  // ... rest of your component (styles, return statement) remains the same
  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      enableOnAndroid={true}
      extraScrollHeight={Platform.OS === "ios" ? 100 : 120}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Image
        source={require("./assets/images/1.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="App Logo"
      />

      <View style={styles.card}>
        <Text style={styles.title}>Enter Your Phone Number</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="XXXXXXXXXX"
          placeholderTextColor="#aaa"
          value={phone}
          onChangeText={setPhone}
          autoFocus={true}
          returnKeyType="done"
          onSubmitEditing={handleNext}
          accessible
          accessibilityLabel="Phone number input field"
          importantForAutofill="yes"
        />
        <TouchableOpacity
          style={[styles.button, !isValidPhone && styles.buttonDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={!isValidPhone}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isValidPhone }}
          accessibilityLabel="Login button"
        >
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#140028",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: width * 0.8,
    height: height * 0.3,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  card: {
    backgroundColor: "#1e1e2f",
    width: "100%",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#6a0dad",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "#2a2a3d",
  },
  button: {
    backgroundColor: "#6a0dad",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  buttonDisabled: {
    backgroundColor: "#3e2266",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});