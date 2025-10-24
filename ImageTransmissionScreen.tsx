// ImageTransmissionScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  Image,
  ScrollView,
  PermissionsAndroid,
  DeviceEventEmitter,
  NativeModules,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
// MODIFIED: Import launchCamera as well
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import RNFS from 'react-native-fs';
import CryptoJS from 'crypto-js';
import { useRoute, RouteProp } from '@react-navigation/native';

// ... (Types and constants remain the same) ...
type RootStackParamList = {
  ImageTransmissionScreen: {
    contactId: string;
    name: string | null;
    numbers: string[];
  };
};
type RouteProps = RouteProp<RootStackParamList, 'ImageTransmissionScreen'>;
const WS_URL = 'ws://localhost:8080';
const { SmsSender } = NativeModules;
const PROTOCOL_PREFIX = '[SMSIMG]';
const CHUNK_SIZE = 1200;
var count = -1;
interface ImageHeader {
  id: string;
  total: number;
  checksum: string;
  enc: number;
  index: number;
}
interface PendingImage {
  payload: string;
  checksum: string;
  enc: number;
  total: number;
}
interface SmsTrigger {
  total: number;
  checksum: string;
}

export default function ImageTransmissionScreen() {
  const route = useRoute<RouteProps>();
  const initialPhone = route.params?.numbers?.[0] ?? '';

  const [phone, setPhone] = useState(initialPhone);
  const [pass, setPass] = useState('');
  const [sending, setSending] = useState(false);
  const [receivedImage, setReceivedImage] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [serverStatus, setServerStatus] = useState('Disconnected');

  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [receivedSmsHeader, setReceivedSmsHeader] = useState<SmsTrigger | null>(null);
  const [isTimerFinished, setIsTimerFinished] = useState(false);

  const ws = useRef<WebSocket | null>(null);

  // --- Callbacks ---

  const reconstructImageFromDemo = useCallback(async (base64: string, checksum: string, enc: number) => {
    // ... (This function remains unchanged) ...
    setPendingImage(null);
    setReceivedSmsHeader(null);
    setIsTimerFinished(false);

    setProgress('Reconstructing image...');
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1500));

    let finalBase64 = base64;
    try {
      if (enc) {
        if (!pass) {
          Alert.alert('Error', 'Encrypted image. Enter passphrase to decrypt.');
          setProgress('');
          return;
        }
        setProgress('Decrypting image...');
        const encUtf8 = CryptoJS.enc.Base64.parse(base64).toString(CryptoJS.enc.Utf8);
        const dec = CryptoJS.AES.decrypt(encUtf8, pass).toString(CryptoJS.enc.Base64);
        finalBase64 = dec;
      }

      if (CryptoJS.SHA256(finalBase64).toString() !== checksum) {
        Alert.alert('Checksum error', 'Corrupted image.');
        setProgress('');
        return;
      }

      setProgress('Image reconstructed!');
      setReceivedImage('data:image/jpeg;base64,' + finalBase64);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
      setProgress('');
    }
  }, [pass]);


  const handleIncomingSmsForShow = useCallback((text: string) => {
    // ... (This function remains unchanged) ...
    if (!text.startsWith(PROTOCOL_PREFIX)) return;
    try {
      const body = text.slice(PROTOCOL_PREFIX.length);
      const headerEnd = body.indexOf('}') + 1;
      const header: ImageHeader = JSON.parse(body.substring(0, headerEnd));
  
      if (receivedSmsHeader) {
        console.log('Ignoring subsequent SMS for this transaction.');
        return;
      }

      setProgress('Receiving SMS...');
      const triggerInfo = { total: header.total, checksum: header.checksum };
      setReceivedSmsHeader(triggerInfo);
      
      setTimeout(() => {
        setIsTimerFinished(true);
      }, 8000);

    } catch (e) {
      console.log('Error parsing incoming SMS', e);
    }
  }, [receivedSmsHeader]);


  const connectWebSocket = useCallback(() => {
    // ... (This function remains unchanged) ...
    setServerStatus('Connecting...');
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => setServerStatus('Connected (Ready)');

    socket.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);
        if (message.type === 'NEW_IMAGE' && message.payload) {
          const { payload, checksum, enc, total } = message;
          setPendingImage({ payload, checksum, enc, total });
        }
      } catch (err) {
        console.error('Failed to parse message', err);
      }
    };

    socket.onerror = () => setServerStatus('Connection Error');
    socket.onclose = () => {
      setServerStatus('Disconnected. Retrying...');
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.current = socket;
  }, []);

  
  // --- Effects ---

  // MODIFIED: Added CAMERA permission
  useEffect(() => {
    async function requestPermissions() {
      const perms = [
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.CAMERA, // Added camera permission
      ];
      await PermissionsAndroid.requestMultiple(perms);
    }
    
    requestPermissions();
    connectWebSocket();
    
    return () => {
        ws.current?.close();
    }
  }, [connectWebSocket]);

  
  useEffect(() => {
    // ... (This SMS listener effect remains unchanged) ...
    const sub = DeviceEventEmitter.addListener('SMS_IMG_RECEIVED', (payload: string) => {
      try {
        const msg = JSON.parse(payload);
        handleIncomingSmsForShow(msg.text);
      } catch (e) {
        console.log('Error parsing SMS payload', e);
      }
    });

    return () => {
      sub.remove();
    };
  }, [handleIncomingSmsForShow]);


  useEffect(() => {
    // ... (This "brain" effect remains unchanged) ...
    if (receivedSmsHeader && isTimerFinished && pendingImage) {
      if (pendingImage.total === receivedSmsHeader.total && 
          pendingImage.checksum === receivedSmsHeader.checksum) {
        reconstructImageFromDemo(pendingImage.payload, pendingImage.checksum, pendingImage.enc);
      } else {
        console.log("Mismatch between SMS header and pending image payload.");
        setReceivedSmsHeader(null);
        setIsTimerFinished(false);
        setPendingImage(null);
      }
    }
  }, [receivedSmsHeader, isTimerFinished, pendingImage, reconstructImageFromDemo]);

  
  // --- Sending Logic ---

  // NEW: Extracted processing logic into its own function
  const processAndSendImage = async (imageUri: string) => {
    try {
      setSending(true);
      setProgress('Resizing image...');

      const resized = await ImageResizer.createResizedImage(imageUri, 400, 400, 'JPEG', 50);
      const data = await RNFS.readFile(resized.uri, 'base64');
      let payload = data;

      if (pass) {
        setProgress('Encrypting payload...');
        const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Base64.parse(data), pass).toString();
        payload = CryptoJS.enc.Utf8.parse(encrypted).toString(CryptoJS.enc.Base64);
      }

      const checksum = CryptoJS.SHA256(payload).toString();
      const chunks: string[] = [];
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) chunks.push(payload.slice(i, i + CHUNK_SIZE));
      const totalChunks = chunks.length;

      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'SMS Limit Warning',
          `This image will be sent in ${totalChunks} SMS. Continue?`,
          [
            { text: 'Cancel', onPress: () => resolve(false) },
            { text: 'Send', onPress: () => resolve(true) },
          ],
          { cancelable: false }
        );
      });
      if (!proceed) {
        setSending(false);
        setProgress('');
        return;
      }

      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'NEW_IMAGE', payload, checksum, enc: pass ? 1 : 0, total: totalChunks }));
      } else throw new Error('WebSocket is not connected.');

      setProgress('Sending SMS');
      const header = { id: Date.now().toString(36), total: totalChunks, checksum, enc: pass ? 1 : 0 };
      await sendFakeSmsWithChunks(phone, header, chunks);

      setProgress('All SMS parts sent!');
      Alert.alert('Done', 'SMS parts sent successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSending(false);
      setProgress('');
    }
  };

  // Shared validation and state reset
  const preSendCheck = () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter a recipient phone number.');
      return false;
    }
    if (!SmsSender) {
      Alert.alert('Native Module Error', 'SmsSender is not installed.');
      return false;
    }
    
    // Reset all state *immediately*
    setReceivedImage(null);
    setPendingImage(null);
    setReceivedSmsHeader(null);
    setIsTimerFinished(false);
    setProgress('');
    return true;
  };

  // MODIFIED: `pickAndSend` now uses the pre-check and new processor
  const pickAndSend = async () => {
    if (!preSendCheck()) return;

    launchImageLibrary({ mediaType: 'photo' }, async (res) => {
      if (res.didCancel || !res.assets || !res.assets[0]?.uri) {
        return; // User cancelled
      }
      // Pass the URI to the new handler
      await processAndSendImage(res.assets[0].uri);
    });
  };

  // NEW: `takeAndSend` function for the camera
  const takeAndSend = async () => {
    if (!preSendCheck()) return;

    launchCamera({ mediaType: 'photo', saveToPhotos: true }, async (res) => {
      if (res.didCancel || !res.assets || !res.assets[0]?.uri) {
        return; // User cancelled
      }
      // Pass the URI to the new handler
      await processAndSendImage(res.assets[0].uri);
    });
  };

  // ... (sendFakeSmsWithChunks remains the same) ...
  const sendFakeSmsWithChunks = async (recipientPhone: string, header: Omit<ImageHeader, 'index'>, chunks: string[]) => {
    try {
      const messagesToSend = [];
      const totalChunks = chunks.length;
      const indices = [0];
      if (totalChunks > 1) indices.push(Math.floor(totalChunks / 2));
      if (totalChunks > 2) indices.push(totalChunks - 1);
      for (const idx of indices) {
        count = count + 1;
        messagesToSend.push(PROTOCOL_PREFIX + JSON.stringify({ ...header, index: count }) + chunks[idx]);
      }
      for (const msg of messagesToSend) {
        await SmsSender.sendTextMessage(recipientPhone, msg);
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
      }
      count = -1;
    } catch (e) {
      console.warn('Could not send SMS:', e);
    }
  };


  // --- Render ---
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <Text style={styles.header}>📩 SMS Image App (Demo)</Text>
          <Text style={[styles.statusText, { color: serverStatus.startsWith('Connected') ? 'green' : 'red' }]}>
            Real Server Status: {serverStatus}
          </Text>

          {route.params?.name && (
            <Text style={styles.contactName}>Sending to: {route.params.name}</Text>
          )}

          <TextInput
            placeholder="Recipient phone (Real)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TextInput
            placeholder="Passphrase (optional)"
            value={pass}
            onChangeText={setPass}
            style={styles.input}
          />

          <View style={styles.buttonContainer}>
            <Button 
              title={sending ? 'Sending...' : 'Pick from Library'} 
              onPress={pickAndSend} 
              disabled={sending || !serverStatus.startsWith('Connected')} 
            />
            <View style={{ marginVertical: 5 }} />
            <Button 
              title={sending ? 'Sending...' : 'Take Photo and Send'} 
              onPress={takeAndSend} 
              disabled={sending || !serverStatus.startsWith('Connected')} 
            />
          </View>

          {/* ***** FIX: Wrap the progress variable in a <Text> component ***** */}
          {progress ? <Text style={styles.progressText}>{progress}</Text> : null}

          {/* ***** FIX: Use a ternary to safely render the image component ***** */}
          {receivedImage ? (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.imageHeader}>🖼️ Received Image Preview</Text>
              <Image source={{ uri: receivedImage }} style={styles.image} resizeMode="contain" />
            </View>
          ) : null}
          
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// MODIFIED: Added buttonContainer style
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  statusText: { textAlign: 'center', fontSize: 14, paddingBottom: 10 },
  contactName: { fontSize: 16, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', marginVertical: 10, padding: 10, borderRadius: 5 },
  buttonContainer: {
    marginVertical: 10,
  },
  progressText: { marginTop: 15, fontSize: 16, textAlign: 'center', color: '#333' },
  imageHeader: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  image: { width: '100%', height: 300, marginTop: 10, borderRadius: 10, backgroundColor: '#eee', borderWidth: 1, borderColor: '#ddd' },
});