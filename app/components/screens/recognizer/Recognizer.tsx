import React, { useState, useRef, useEffect } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Alert } from 'react-native';
import { Camera, Frame, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { TensorflowModel, useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import AntDesign from '@expo/vector-icons/AntDesign';
import Loader from '@/components/shared/Loader';
import * as FileSystem from 'expo-file-system';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/navigation.types';
import { useSQLiteContext } from 'expo-sqlite';
import CameraOverlay from '@/components/shared/CameraOverlay';
import SearchButton from '@/components/shared/SearchButton';
import { Prediction } from '../types';
import CameraHandler from './components/CameraHandler';

type CameraScreenProps = NativeStackScreenProps<RootStackParamList, 'Recognizer'> & {
  model: TensorflowModel;
};

const Recognizer: React.FC<CameraScreenProps> = ({ navigation, model }) => {
  const device = useCameraDevice('back');
  const [load, setLoad] = useState<boolean>(false);
  const cameraRef = useRef<Camera>(null);
  const db = useSQLiteContext();
  
  const { resize } = useResizePlugin();

  const saveImageToAppFolder = async (uri: string) => {
    if (!FileSystem.documentDirectory) return null;
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

  const getPredictions = async (uri: string) => {
    try {
      const imageBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const binaryString = atob(imageBase64);
      const uint8Array = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      const inputs = [uint8Array];
      const outputs = model.runSync(inputs);

      if (!outputs) throw new Error('Не удалось получить предсказания');
      
      const outputTensor = outputs[0] as ArrayLike<number>;
      let probabilities: number[] = Array.from(outputTensor).map(value => Number(value));

      return probabilities;
    } catch (error) {
      console.error('Ошибка при предсказании:', error);
      throw error;
    }
  };

  const handleSave = async (uri: string) => {
    if (!uri) return;
    try {
      const savedImageUri = await saveImageToAppFolder(uri);
      if (savedImageUri) {
        const probabilities = await getPredictions(savedImageUri);
        console.log(probabilities);

        const predictions: Prediction[] = probabilities.map((probability, id) => ({
          id,
          probability: +(probability * 100).toFixed(),
        }));

        let topPredictions = predictions
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

  const saveImageWithPredictions = async (path: string, predictions: Prediction[]) => {
    try {
      const statement = await db.prepareAsync(
        'INSERT INTO fungi (path, predictions) VALUES (?, ?)'
      );
      const result = await statement.executeAsync([path, JSON.stringify(predictions)]);
      const newId = result.lastInsertRowId;

      if (newId) {
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
      setLoad(true);
      const photo = await cameraRef.current.takePhoto();
      await handleSave(photo.path);
    }
  };

  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';
    if (!model) return;

    try {
      const resized = resize(frame, {
        scale: { width: 300, height: 300 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      const outputs = model.runSync([resized]);
      const predictions = outputs[0];
      console.log(predictions);
    } catch (e) {
      console.error('Ошибка обработки кадра:', e);
    }
  }, [model]);

  if (!device) return <Loader />;

  return (
    <CameraHandler>
      <View style={styles.cameraContainer}>
        {!load && (
          <>
            <Camera
              ref={cameraRef}
              style={styles.cameraView}
              device={device}
              isActive={true}
              photo={true}
              frameProcessor={frameProcessor}
            >
              <CameraOverlay />
              <TouchableOpacity style={styles.galleryButton} onPress={() => {}}>
                <AntDesign name="picture" size={32} color="white" />
              </TouchableOpacity>
            </Camera>
            <View style={styles.buttonsView}>
              <Text style={styles.tip}>Поместите гриб в центре кадра</Text>
              <SearchButton onPress={takePicture} />
            </View>
          </>
        )}
        {load && <Loader />}
      </View>
    </CameraHandler>
  );
};

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
  },
  cameraView: {
    height: '75%',
  },
  buttonsView: {
    height: '23%',
    display: 'flex',
    alignItems: 'center',
  },
  galleryButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    padding: 10,
    backgroundColor: 'rgba(150, 255, 200, 0.3)',
    borderRadius: 30,
  },
  tip: {
    marginTop: 10,
    fontSize: 22,
    textAlign: 'center',
    width: '100%',
    lineHeight: 26,
    color: 'white',
    fontFamily: 'ComicSansRegular',
  },
});

export default Recognizer;
