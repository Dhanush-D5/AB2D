import React, { useEffect, useRef, useState, useCallback } from "react";
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
  AppState,
  Dimensions,
  StatusBar,
  Modal,
  PermissionsAndroid,
} from "react-native";
import Contacts, { Contact } from "react-native-contacts";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

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

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FetchContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const flatListRef = useRef<FlatList<Contact>>(null);
  const navigation = useNavigation<FetchContactsNavProp>();

  const loadContacts = useCallback(async () => {
    try {
      let permission = await Contacts.checkPermission();

      if (permission !== "authorized") {
        permission = await Contacts.requestPermission();
      }

      if (permission === "authorized") {
        const contactsList = await Contacts.getAll();
        contactsList.sort((a, b) =>
          (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
            sensitivity: "base",
          })
        );
        if (contactsList.length > 0) {
          setContacts(contactsList);
        }
      } else {
        Alert.alert(
          "Permission Denied",
          "Cannot access contacts. Please enable it from Settings."
        );
      }
    } catch (err) {
      console.error("Contacts fetch failed:", err);
      Alert.alert("Error", "Failed to fetch contacts.");
    }
  }, []);

  // Request all necessary permissions on mount
  useEffect(() => {
    async function requestAllPermissions() {
      try {
        // Request READ and WRITE permissions for contacts
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
        ]);

        // Check if WRITE_CONTACTS permission was granted
        const writeGranted = granted['android.permission.WRITE_CONTACTS'] === PermissionsAndroid.RESULTS.GRANTED;
        setHasWritePermission(writeGranted);

        if (!writeGranted) {
          console.log("WRITE_CONTACTS permission denied");
        }
      } catch (err) {
        console.warn("Permission request error:", err);
      }
    }

    requestAllPermissions();
    loadContacts();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadContacts();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadContacts]);

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

  // Check permission before opening add modal
  const handleAddContactPress = async () => {
    // Check current permission status
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS);
    
    if (!granted) {
      // Request permission
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
        {
          title: "Contacts Permission",
          message: "This app needs permission to add contacts to your device.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setHasWritePermission(true);
        setShowAddModal(true);
      } else {
        Alert.alert(
          "Permission Required",
          "Write contacts permission is required to add new contacts. Please grant permission in Settings.",
          [{ text: "OK" }]
        );
      }
    } else {
      setHasWritePermission(true);
      setShowAddModal(true);
    }
  };

  const handleAddContact = async () => {
    // Validation: Name cannot be empty
    if (!newContactName.trim()) {
      Alert.alert("Error", "Contact name cannot be empty.");
      return;
    }

    // Validation: Name must be at least 2 characters
    if (newContactName.trim().length < 2) {
      Alert.alert("Error", "Contact name must be at least 2 characters.");
      return;
    }

    // Validation: Phone number cannot be empty
    if (!newContactPhone.trim()) {
      Alert.alert("Error", "Phone number cannot be empty.");
      return;
    }

    // Validation: Phone number must be exactly 10 digits
    const cleanedPhone = newContactPhone.replace(/[^0-9]/g, '');
    if (cleanedPhone.length !== 10) {
      Alert.alert("Error", "Phone number must be exactly 10 digits.");
      return;
    }

    if (!hasWritePermission) {
      Alert.alert("Permission Denied", "Cannot add contact without write permission.");
      return;
    }

    try {
      // Create contact with minimal required fields
      const newContact = {
        givenName: newContactName.trim(),
        phoneNumbers: [{
          label: 'mobile',
          number: cleanedPhone,
        }],
      };

      await Contacts.addContact(newContact);
      
      Alert.alert("Success", "Contact added successfully!");
      setShowAddModal(false);
      setNewContactName("");
      setNewContactPhone("");
      
      // Reload contacts after a short delay
      setTimeout(() => {
        loadContacts();
      }, 500);
    } catch (err: any) {
      console.error("Error adding contact:", err);
      Alert.alert("Error", `Failed to add contact: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
    >
      {/* Add Contact Button */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={handleAddContactPress}
      >
        <Text style={styles.addButtonText}>➕ Add Contact</Text>
      </TouchableOpacity>

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
                <Text style={styles.contactName} numberOfLines={1}>
                  {item.displayName}
                </Text>

                {uniqueNumbers.length > 0 ? (
                  uniqueNumbers.map((num, i) => (
                    <Text key={i} style={styles.phone} numberOfLines={1}>
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
          contentContainerStyle={styles.listContent}
          getItemLayout={(_, index) => ({
            length: 90,
            offset: 90 * index,
            index,
          })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.alphabetContainer}>
          {ALPHABETS.map((letter) => (
            <TouchableOpacity
              key={letter}
              onPress={() => scrollToLetter(letter)}
              activeOpacity={0.6}
              style={styles.letterButton}
            >
              <Text style={styles.letter}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Add Contact Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Contact</Text>
            
            <TextInput
              placeholder="Contact Name"
              placeholderTextColor="#999"
              style={styles.modalInput}
              value={newContactName}
              onChangeText={setNewContactName}
              maxLength={50}
            />
            
            <TextInput
              placeholder="Phone Number (10 digits)"
              placeholderTextColor="#999"
              style={styles.modalInput}
              value={newContactPhone}
              onChangeText={(text) => {
                // Only allow numbers
                const cleaned = text.replace(/[^0-9]/g, '');
                setNewContactPhone(cleaned);
              }}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={styles.helperText}>
              {newContactPhone.length}/10 digits
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewContactName("");
                  setNewContactPhone("");
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddContact}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#140028",
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  addButton: {
    backgroundColor: "#6a0dad",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: {
    color: "#fff",
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    fontWeight: "700",
  },
  searchInput: {
    backgroundColor: "#1e1e2f",
    width: "100%",
    color: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    marginBottom: 12,
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
  },
  listAndSidebar: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingBottom: 20,
    paddingRight: 70,
  },
  contactCard: {
    backgroundColor: "#1e1e2f",
    width: "100%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  contactName: {
    fontSize: SCREEN_WIDTH < 360 ? 18 : 20,
    fontWeight: "700",
    color: "#6a0dad",
    marginBottom: 4,
  },
  phone: {
    fontSize: SCREEN_WIDTH < 360 ? 14 : 16,
    color: "#d1c4e9",
    marginTop: 2,
  },
  alphabetContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 8,
  },
  letterButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26,
    width: '100%',
  },
  letter: {
    fontSize: 14,
    color: "#6a0dad",
    fontWeight: "700",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e1e2f',
    borderRadius: 20,
    padding: 25,
    width: SCREEN_WIDTH * 0.85,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: SCREEN_WIDTH < 360 ? 20 : 22,
    fontWeight: 'bold',
    color: '#6a0dad',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: "#140028",
    borderWidth: 1,
    borderColor: 'rgba(106, 13, 173, 0.3)',
    marginTop: 10,
    marginBottom: 5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: '#fff',
    fontSize: SCREEN_WIDTH < 360 ? 14 : 16,
  },
  helperText: {
    color: '#d1c4e9',
    fontSize: SCREEN_WIDTH < 360 ? 12 : 13,
    marginBottom: 10,
    marginLeft: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#4a0d7d',
  },
  saveButton: {
    backgroundColor: '#6a0dad',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    fontWeight: '700',
  },
});