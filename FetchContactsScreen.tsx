// FetchContactsScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from "react"; // 1. Import useCallback
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  AppState, // 2. Import AppState
} from "react-native";
import Contacts, { Contact } from "react-native-contacts";
import { useNavigation } from "@react-navigation/native"; // We don't need useIsFocused anymore
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// ... (RootStackParamList and other types remain the same) ...
export type RootStackParamList = {
  FetchContacts: undefined;
  ImageTransmissionScreen: {
    contactId: string;
    name: string | null;
    numbers: string[];
  };
};

type FetchContactsNavProp = NativeStackNavigationProp<
  RootStackParamList,
  "FetchContacts"
>;

const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const cleanNumber = (num: string) => num.replace(/[^0-9+]/g, "");

export default function FetchContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const flatListRef = useRef<FlatList<Contact>>(null);
  const navigation = useNavigation<FetchContactsNavProp>();

  // 3. Wrap your contact-loading logic in useCallback
  // This ensures the function is stable and doesn't trigger unnecessary re-renders
  const loadContacts = useCallback(async () => {
    try {
      let permission = await Contacts.checkPermission();

      // If we don't have permission, request it.
      if (permission !== "authorized") {
        permission = await Contacts.requestPermission();
      }

      // After requesting, check the permission *again*
      if (permission === "authorized") {
        const contactsList = await Contacts.getAll();
        contactsList.sort((a, b) =>
          (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
            sensitivity: "base",
          })
        );
        // Only update state if contacts are actually found
        // This prevents an empty list from flashing if permission was just granted
        if (contactsList.length > 0) {
          setContacts(contactsList);
        }
      } else {
        // If permission is still not authorized (e.g., user denied)
        Alert.alert(
          "Permission Denied",
          "Cannot access contacts. Please enable it from Settings."
        );
      }
    } catch (err) {
      console.error("Contacts fetch failed:", err);
      Alert.alert("Error", "Failed to fetch contacts.");
    }
  }, []); // Empty dependency array means this function is created once

  // 4. This useEffect now handles both initial load AND re-focusing the app
  useEffect(() => {
    // Run it once on mount
    loadContacts();

    // Add an event listener for AppState changes
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // If the app is coming back to the 'active' state (foreground)
      if (nextAppState === "active") {
        // Run the loadContacts function again.
        // This will re-check permission and load contacts if just granted.
        loadContacts();
      }
    });

    // Cleanup: remove the listener when the component unmounts
    return () => {
      subscription.remove();
    };
  }, [loadContacts]); // The effect depends on our stable loadContacts function

  // ... (The rest of your component logic remains exactly the same) ...

  const filteredContacts = contacts.filter((c) =>
    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scrollToLetter = (letter: string) => {
    if (!flatListRef.current) return;
    const index = filteredContacts.findIndex((contact) =>
      contact.displayName?.toUpperCase().startsWith(letter)
    );
    if (index !== -1) {
      flatListRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0,
      });
    }
  };

  const handleContactPress = (contact: Contact) => {
    const numbers = Array.from(
      new Set(
        contact.phoneNumbers
          .map((p) => cleanNumber(p.number ?? "").trim())
          .filter(Boolean)
      )
    );
    if (numbers.length === 0) {
      Alert.alert(
        "No number",
        "This contact does not have a valid phone number."
      );
      return;
    }
    navigation.navigate("ImageTransmissionScreen", {
      contactId: contact.recordID,
      name: contact.displayName ?? null,
      numbers,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.select({ ios: 100, android: 80 })}
    >
      <TextInput
        placeholder="Search contacts..."
        placeholderTextColor="#999"
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
      />

      <View style={styles.listAndSidebar}>
        <FlatList
          ref={flatListRef}
          data={filteredContacts}
          keyExtractor={(item) => item.recordID}
          renderItem={({ item }) => {
            const uniqueNumbers = Array.from(
              new Set(
                item.phoneNumbers
                  .map((p) => cleanNumber(p.number ?? "").trim())
                  .filter(Boolean)
              )
            );

            return (
              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => handleContactPress(item)}
                disabled={uniqueNumbers.length === 0}
              >
                <Text style={styles.contactName}>{item.displayName}</Text>

                {uniqueNumbers.length > 0 ? (
                  uniqueNumbers.map((num, i) => (
                    <Text key={i} style={styles.phone}>
                      {num}
                    </Text>
                  ))
                ) : (
                  <Text
                    style={[
                      styles.phone,
                      { fontStyle: "italic", color: "#888" },
                    ]}
                  >
                    No number available
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          windowSize={10}
          contentContainerStyle={{ paddingBottom: 20 }}
          getItemLayout={(_, index) => ({
            length: 90,
            offset: 90 * index,
            index,
          })}
          keyboardShouldPersistTaps="handled"
        />

        <View style={styles.alphabetContainer}>
          {ALPHABETS.map((letter) => (
            <TouchableOpacity
              key={letter}
              onPress={() => scrollToLetter(letter)}
              activeOpacity={0.6}
            >
              <Text style={styles.letter}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ... (Styles remain the same) ...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#140028",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchInput: {
    backgroundColor: "#1e1e2f",
    width: "100%",
    color: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 15,
    fontSize: 18,
  },
  listAndSidebar: {
    flexDirection: "row",
    flex: 1,
  },
  contactCard: {
    backgroundColor: "#1e1e2f",
    width: "100%",
    borderRadius: 20,
    padding: 15,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  contactName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#6a0dad",
    marginBottom: 6,
  },
  phone: {
    fontSize: 16,
    color: "#d1c4e9",
    marginTop: 3,
  },
  alphabetContainer: {
    width: 50,
    justifyContent: "flex-start",
    alignItems: "center",
    marginLeft: 10,
    backgroundColor: "#000000",
    borderRadius: 14,
    paddingVertical: 10,
    height: "100%",
  },
  letter: {
    fontSize: 18,
    color: "#6a0dad",
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: "700",
  },
});