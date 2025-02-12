import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import MainButton from '@/components/shared/MainButton';
import { Camera, CameraPermissionStatus } from 'react-native-vision-camera';

interface CameraHandlerProps {
  children: React.ReactNode;
}

const CameraHandler: React.FC<CameraHandlerProps> = ({ children }) => {
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionStatus>('not-determined');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermissions = async () => {
      const status = await Camera.getCameraPermissionStatus();
      setCameraPermission(status);
      
      if (status === 'granted') {
        setPermissionError(null);
      } else if (status === 'denied') {
        setPermissionError('Доступ к камере запрещен. Перейдите в настройки, чтобы включить его.');
      }
    };

    checkPermissions();
  }, []);

  const handleRequestPermission = async () => {
    const result = await Camera.requestCameraPermission();

    if (result === 'granted') {
      setCameraPermission('granted');
      setPermissionError(null);
    } else {
      setPermissionError('Необходимо предоставить разрешение для доступа к камере.');
    }
  };

  if (cameraPermission === 'not-determined') {
    return (
      <View style={styles.centeredView}>
        <Text style={styles.permissionText}>Проверка доступ к камере</Text>
      </View>
    );
  }

  const openAppSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Ошибка', 'Не удалось открыть настройки. Попробуйте вручную.');
    });
  };

  if (cameraPermission !== 'granted') {
    return (
      <View style={styles.centeredView}>
        {permissionError && <Text style={styles.permissionErrorText}>{permissionError}</Text>}
        <MainButton
          onPress={cameraPermission === 'denied' ? openAppSettings : handleRequestPermission}
          text={cameraPermission === 'denied' ? 'Открыть настройки' : 'Предоставить доступ'}
        />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionErrorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: 'ComicSansRegular',
  },
  permissionText: {
    fontSize: 22,
    width: '80%',
    color: 'white',
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'ComicSansRegular',
  },
});

export default CameraHandler;
