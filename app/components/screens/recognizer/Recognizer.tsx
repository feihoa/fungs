import React, { useState, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AntDesign from '@expo/vector-icons/AntDesign';
import Loader from '@/components/shared/Loader';
import * as FileSystem from 'expo-file-system';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/navigation.types';
import { useSQLiteContext } from 'expo-sqlite';
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO, decodeJpeg } from '@tensorflow/tfjs-react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

type CameraScreenProps = NativeStackScreenProps<RootStackParamList, 'Recognizer'>;

const Recognizer: React.FC<CameraScreenProps> = ({ navigation }) => {
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isTfReady, setIsTfReady] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [load, setLoad] = useState<boolean>(false);
  const cameraRef = useRef(null);

  const db = useSQLiteContext();

  const requestModel = async () => {
    if (!isTfReady) {
      await tf.ready();
      setIsTfReady(true);
    }

    const modelWeight = [
      await require('../../../../assets/models/fungs/group1-shard1of4.bin'),
      await require('../../../../assets/models/fungs/group1-shard2of4.bin'),
      await require('../../../../assets/models/fungs/group1-shard3of4.bin'),
      await require('../../../../assets/models/fungs/group1-shard4of4.bin'),
    ];

    const modelJson = await require('../../../../assets/models/fungs/model.json');

    return await tf
      .loadLayersModel(bundleResourceIO(modelJson, modelWeight))
      .catch(err => console.log(err, 'err'));
  };

  useEffect(() => {
    const requestPermissions = async () => {
      const cameraStatus = await requestPermission();
      setCameraPermission(cameraStatus.granted);
    };
    requestPermissions();
  }, [requestPermission]);

  if (cameraPermission === null) {
    return <View style={styles.centeredView} />;
  }

  if (!cameraPermission) {
    return (
      <View style={[styles.centeredView, styles.permissionContainer]}>
        <Text style={styles.permissionText}>Необходимо разрешение для доступа к камере</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Предоставить доступ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const saveImageToAppFolder = async (uri: string) => {
    if (!FileSystem.documentDirectory) {
      return null;
    }
    const fileName = uri.split('/').pop();
    const newUri = FileSystem.documentDirectory + fileName;

    try {
      await FileSystem.copyAsync({ from: uri, to: newUri });
      return newUri;
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить изображение');
      console.error(error);
      return null;
    }
  };

  const pickImage = async () => {
    setLoad(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      handleSave(result.assets[0].uri);
    }
  };

  const makePredictions = async (img: any, model: any) => {
    try {
      const predictions = model.predict(img);
      return predictions;
    } catch (error) {
      throw error;
    }
  };

  const getPredictions = async (uri: string, model: any) => {
    const resizedImage = await manipulateAsync(uri, [{ resize: { width: 224, height: 224 } }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
    });

    const img64 = await FileSystem.readAsStringAsync(resizedImage.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const imgBuffer = tf.util.encodeString(img64, 'base64').buffer;
    const raw = new Uint8Array(imgBuffer);

    let imgTensor = decodeJpeg(raw);
    const scalar = tf.scalar(255);

    const tensorScaled = imgTensor.div(scalar);
    const img = tf.reshape(tensorScaled, [1, 224, 224, 3]);

    const predictions = await makePredictions(img, model);

    return predictions;
  };

  const handleSave = async (uri: string) => {
    if (!uri) return;

    try {
      const savedImageUri = await saveImageToAppFolder(uri);

      if (savedImageUri) {
        const model = await requestModel();
        const tensor = await getPredictions(savedImageUri, model);

        const predictionsAll: number[][] = await tensor.arraySync();
        const probabilities = predictionsAll[0];

        const predictions: { id: number; probability: number }[] = probabilities.map(
          (probability, id) => ({
            id,
            probability: +(probability * 100).toFixed(),
          })
        );

        const topPredictions = predictions
          .filter(pr => pr.probability !== 0)
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 3);

        await saveImageWithPredictions(savedImageUri, topPredictions);
      }
    } catch (error) {
      console.error('Ошибка при обработке изображения:', error);
      Alert.alert('Ошибка', 'Не удалось обработать изображение');
    }
  };

  const saveImageWithPredictions = async (path: string, predictions: any) => {
    try {
      const statement = await db.prepareAsync(
        'INSERT INTO fungi (path, predictions) VALUES (?, ?)'
      );
      const result = await statement.executeAsync([path, JSON.stringify(predictions)]);
      const newId = result.lastInsertRowId;

      if (newId) {
        console.log('Изображение и предсказания успешно сохранены с ID:', newId);
        navigation.navigate('MushroomCard', { id: newId });
        setLoad(false);
      }
    } catch (error) {
      console.error('Ошибка при сохранении в базу:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить данные');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await (cameraRef.current as any).takePictureAsync({
        quality: 1,
        skipProcessing: false,
        mute: true,
      });
      setLoad(true);
      await handleSave(photo.uri);
    }
  };

  return (
    <View style={styles.cameraContainer}>
      {!load && (
        <CameraView style={styles.cameraView} ref={cameraRef}>
          <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
            <AntDesign name="picture" size={32} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={takePicture}>
            <Text style={styles.saveButtonText}>Распознать</Text>
          </TouchableOpacity>
          <Text style={styles.tip}>Поместите гриб в центре кадра</Text>
        </CameraView>
      )}
      {load && <Loader />}
    </View>
  );
};

const styles = StyleSheet.create({
  tip: {
    position: 'absolute',
    top: 30,
    fontSize: 22,
    textAlign: 'center',
    width: '100%',
    fontWeight: 500,
    lineHeight: 26,
    backgroundColor: 'white'
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    backgroundColor: '#f0f0f0',
  },
  permissionText: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007bff',
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  cameraView: {
    flex: 1,
  },
  galleryButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
  },
  saveButton: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    width: '50%',
    transform: [{ translateX: -100 }],
    padding: 12,
    backgroundColor: '#28a745',
    borderRadius: 8,
  },
  saveButtonText: {
    textAlign: 'center',
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Recognizer;