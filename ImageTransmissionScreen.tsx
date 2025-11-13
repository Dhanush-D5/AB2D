import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  Image,
  ScrollView,
  PermissionsAndroid,
  DeviceEventEmitter,
  NativeModules,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import RNFS from 'react-native-fs';
import CryptoJS from 'crypto-js';
import { useRoute, RouteProp } from '@react-navigation/native';

// Get screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // Reconstruct (and decrypt if needed) — checksum now compares to original image base64 checksum
  const reconstructImageFromDemo = useCallback(async (base64Payload: string, checksum: string, enc: number) => {
    setPendingImage(null);
    setReceivedSmsHeader(null);
    setIsTimerFinished(false);

    setProgress('Reconstructing image...');
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));

    try {
      let finalBase64 = base64Payload;

      if (enc) {
        if (!pass) {
          Alert.alert('Error', 'Encrypted image. Enter passphrase to decrypt.');
          setProgress('');
          return;
        }
        setProgress('Decrypting image...');
        // payload was: Base64(encryptedString)
        const encryptedStr = CryptoJS.enc.Base64.parse(base64Payload).toString(CryptoJS.enc.Utf8);
        // decrypt -> should produce original image base64 (utf8)
        const decryptedUtf8 = CryptoJS.AES.decrypt(encryptedStr, pass).toString(CryptoJS.enc.Utf8);
        if (!decryptedUtf8) {
          throw new Error('Decryption failed (wrong passphrase or corrupted data).');
        }
        finalBase64 = decryptedUtf8;
      }

      // checksum is always of the original image base64 (see send side)
      const computed = CryptoJS.SHA256(finalBase64).toString();
      if (computed !== checksum) {
        Alert.alert('Checksum error', 'Corrupted image or wrong passphrase.');
        setProgress('');
        return;
      }

      setProgress('Image reconstructed!');
      setReceivedImage('data:image/jpeg;base64,' + finalBase64);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 800));
      setProgress('');
    }
  }, [pass]);

  const handleIncomingSmsForShow = useCallback((text: string) => {
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
    setServerStatus('Connecting...');
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => setServerStatus('Connected (Ready)');

    socket.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);
        if (message.type === 'NEW_IMAGE' && message.payload) {
          const { payload, checksum, enc, total } = message;
          // payload here is the full payload (either original base64 or base64(encryptedString))
          setPendingImage({ payload, checksum, enc, total });
        }
      } catch (err) {
        console.log('Error : ', err);
      }
    };

    socket.onerror = () => setServerStatus('Connection Error');
    socket.onclose = () => {
      setServerStatus('Disconnected. Retrying...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.current = socket;
  }, []);

  useEffect(() => {
    async function requestPermissions() {
      const perms = [
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ];
      try {
        await PermissionsAndroid.requestMultiple(perms);
      } catch (e) {
        console.warn('Permission request failed', e);
      }
    }

    requestPermissions();
    connectWebSocket();

    return () => {
      ws.current?.close();
    };
  }, [connectWebSocket]);

  useEffect(() => {
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
    if (receivedSmsHeader && isTimerFinished && pendingImage) {
      if (pendingImage.total === receivedSmsHeader.total &&
          pendingImage.checksum === receivedSmsHeader.checksum) {
        // pendingImage.payload contains the full payload (not per-chunk assembly here — this demo expects server to forward full payload)
        reconstructImageFromDemo(pendingImage.payload, pendingImage.checksum, pendingImage.enc);
      } else {
        console.log("Mismatch between SMS header and pending image payload.");
        setReceivedSmsHeader(null);
        setIsTimerFinished(false);
        setPendingImage(null);
      }
    }
  }, [receivedSmsHeader, isTimerFinished, pendingImage, reconstructImageFromDemo]);

  const processAndSendImage = async (imageUri: string) => {
    try {
      setSending(true);
      setProgress('Resizing image...');

      const resized = await ImageResizer.createResizedImage(imageUri, 400, 400, 'JPEG', 50);
      const data = await RNFS.readFile(resized.uri, 'base64'); // original image base64
      let payload = data; // default: send raw base64
      // IMPORTANT: checksum should ALWAYS be of the ORIGINAL image base64 data
      const originalChecksum = CryptoJS.SHA256(data).toString();

      if (pass) {
        setProgress('Encrypting payload...');
        // encrypt original base64, producing an encrypted string
        const encryptedString = CryptoJS.AES.encrypt(data, pass).toString(); // AES ciphertext as string (base64)
        // To safely transport, encode that encrypted string into base64 again:
        payload = CryptoJS.enc.Utf8.parse(encryptedString).toString(CryptoJS.enc.Base64);
        // note: checksum remains originalChecksum (checksum of original image base64)
      }

      const checksum = originalChecksum;
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
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setSending(false);
      setProgress('');
    }
  };

  const preSendCheck = () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter a recipient phone number.');
      return false;
    }
    if (!SmsSender) {
      Alert.alert('Native Module Error', 'SmsSender is not installed.');
      return false;
    }

    setReceivedImage(null);
    setPendingImage(null);
    setReceivedSmsHeader(null);
    setIsTimerFinished(false);
    setProgress('');
    return true;
  };

  const pickAndSend = async () => {
    if (!preSendCheck()) return;

    launchImageLibrary({ mediaType: 'photo' }, async (res) => {
      if (res.didCancel || !res.assets || !res.assets[0]?.uri) {
        return;
      }
      await processAndSendImage(res.assets[0].uri);
    });
  };

  const takeAndSend = async () => {
    if (!preSendCheck()) return;

    launchCamera({ mediaType: 'photo', saveToPhotos: true }, async (res) => {
      if (res.didCancel || !res.assets || !res.assets[0]?.uri) {
        return;
      }
      await processAndSendImage(res.assets[0].uri);
    });
  };

  const sendFakeSmsWithChunks = async (recipientPhone: string, header: Omit<ImageHeader, 'index'>, chunks: string[]) => {
    try {
      const messagesToSend: string[] = [];
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <Text style={styles.header}>📩 SMS Image App</Text>
          <Text style={[styles.statusText, { color: serverStatus.startsWith('Connected') ? '#32CD32' : '#FF5459' }]}>
            Bundler : {serverStatus}
          </Text>

          {route.params?.name && (
            <Text style={styles.contactName}>Sending to: {route.params.name}</Text>
          )}

          <TextInput
            placeholder="Recipient phone"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TextInput
            placeholder="Passphrase (optional)"
            placeholderTextColor="#999"
            value={pass}
            onChangeText={setPass}
            secureTextEntry
            style={styles.input}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, (!serverStatus.startsWith('Connected') || sending) && styles.buttonDisabled]}
              onPress={pickAndSend}
              disabled={sending || !serverStatus.startsWith('Connected')}
            >
              <Text style={styles.buttonText}>
                {sending ? 'Sending...' : '📁 Pick from Library'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, (!serverStatus.startsWith('Connected') || sending) && styles.buttonDisabled]}
              onPress={takeAndSend}
              disabled={sending || !serverStatus.startsWith('Connected')}
            >
              <Text style={styles.buttonText}>
                {sending ? 'Sending...' : '📷 Take Photo and Send'}
              </Text>
            </TouchableOpacity>
          </View>

          {progress ? <Text style={styles.progressText}>{progress}</Text> : null}

          {receivedImage ? (
            <View style={styles.imageContainer}>
              <Text style={styles.imageHeader}>🖼️ Received Image Preview</Text>
              <Image source={{ uri: receivedImage }} style={styles.image} resizeMode="contain" />
            </View>
          ) : null}

        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
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
  header: {
    fontSize: SCREEN_WIDTH < 360 ? 22 : 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#6a0dad',
  },
  statusText: {
    textAlign: 'center',
    fontSize: SCREEN_WIDTH < 360 ? 14 : 16,
    paddingBottom: 15,
    fontWeight: '600',
  },
  contactName: {
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
    color: '#d1c4e9',
  },
  input: {
    backgroundColor: "#1e1e2f",
    borderWidth: 1,
    borderColor: 'rgba(106, 13, 173, 0.3)',
    marginVertical: 10,
    padding: 14,
    borderRadius: 14,
    color: '#fff',
    fontSize: SCREEN_WIDTH < 360 ? 14 : 16,
  },
  buttonContainer: {
    marginVertical: 15,
    gap: 12,
  },
  button: {
    backgroundColor: '#6a0dad',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#4a0d7d',
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    fontWeight: '700',
  },
  progressText: {
    marginTop: 20,
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    textAlign: 'center',
    color: '#d1c4e9',
    fontWeight: '600',
  },
  imageContainer: {
    marginTop: 25,
  },
  imageHeader: {
    fontSize: SCREEN_WIDTH < 360 ? 18 : 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#6a0dad',
    marginBottom: 15,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    backgroundColor: '#1e1e2f',
    borderWidth: 2,
    borderColor: 'rgba(106, 13, 173, 0.3)',
  },
}); 
