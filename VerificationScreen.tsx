// VerificationScreen.tsx
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type RootStackParamList = {
  VerificationScreen: { verificationCode: string };
  FetchContacts: undefined;
};

type VerificationScreenRouteProp = RouteProp<RootStackParamList, "VerificationScreen">;
type VerificationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "FetchContacts">;

export default function VerificationScreen() {
  const [smsCode, setSmsCode] = useState("");
  const route = useRoute<VerificationScreenRouteProp>();
  const navigation = useNavigation<VerificationScreenNavigationProp>();
  const { verificationCode } = route.params;

  const handleVerify = () => {
    // Check if the user's entered code matches the generated code
    if (smsCode === verificationCode) {
      Alert.alert("Success", "Phone number verified!", [{ text: "OK", onPress: () => navigation.replace("FetchContacts") }]);
    } else {
      Alert.alert("Verification Failed", "The code you entered is incorrect. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Enter SMS Code</Text>
        <Text style={styles.instructionText}>
          A verification code was generated. Please enter it here.
        </Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="••••••"
          placeholderTextColor="#aaa"
          value={smsCode}
          onChangeText={setSmsCode}
          autoFocus={true}
        />
        <TouchableOpacity
          style={[styles.button, smsCode.length !== 6 && styles.buttonDisabled]}
          onPress={handleVerify}
          activeOpacity={0.8}
          disabled={smsCode.length !== 6}
        >
          <Text style={styles.buttonText}>Verify</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#140028",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
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
    marginBottom: 10,
    textAlign: "center",
  },
  instructionText: {
    fontSize: 16,
    color: "#d1c4e9",
    textAlign: "center",
    marginBottom: 20,
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
    textAlign: "center",
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