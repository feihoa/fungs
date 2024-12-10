import React, { FC, useState, useEffect } from 'react';
import { Text, View, FlatList, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/navigation.types';
import fungiData from '../../../../assets/fungs/fungs';
import { useSQLiteContext } from 'expo-sqlite';
import { Mushroom } from '../types';
import ListElement from './components/ListElement';

type MushroomHistoryProps = NativeStackScreenProps<RootStackParamList, 'MushroomHistory'>;

const MushroomHistory: FC<MushroomHistoryProps> = ({ navigation }) => {
  const db = useSQLiteContext();

  const [mushrooms, setMushrooms] = useState<Mushroom[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data: Mushroom[] = await db.getAllAsync('SELECT * FROM fungi ORDER BY dateTime');
        setMushrooms(data);
      } catch (error) {
        console.error('Ошибка при загрузке истории распознаваний:', error);
      }
    };

    fetchHistory();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await db.runAsync('DELETE FROM fungi WHERE id = ?', [id]);

      setMushrooms(prevMushrooms => prevMushrooms.filter(mushroom => mushroom.id !== id));
    } catch (error) {
      console.error('Ошибка при удалении записи:', error);
      Alert.alert('Ошибка', 'Не удалось удалить запись');
    }
  };

  const confirmDelete = (id: number) => {
    Alert.alert(
      'Удалить запись',
      'Вы уверены, что хотите удалить эту запись?',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => handleDelete(id) },
      ],
      { cancelable: true }
    );
  };

  const renderMushroomItem = ({ item }: { item: any }) => {
    const predictionsData = JSON.parse(item.predictions);

    const firstPrediction = predictionsData[0];
    const fungi = fungiData.find(fungi => +fungi.id === firstPrediction.id);

    return fungi ? (
      <ListElement
        onPress={() => navigation.navigate('MushroomCard', { id: item.id })}
        onDeletePress={() => confirmDelete(item.id)}
        isEdible={fungi.isEdible}
        path={item.path}
        name={fungi.name}></ListElement>
    ) : (
      <></>
    );
  };

  const renderMushroomRow = ({ item }: any) => {
    return (
      <View style={styles.rowContainer}>
        <FlatList
          data={item}
          renderItem={renderMushroomItem}
          keyExtractor={item => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowContent}
        />
      </View>
    );
  };

  const groupedMushrooms = [];
  for (let i = mushrooms.length - 1; i >= 0; i--) {
    groupedMushrooms.push(mushrooms.slice(i, i + 1));
  }

  return (
    <View style={[styles.container]}>
      {groupedMushrooms.length > 0 && (
        <FlatList
          data={groupedMushrooms}
          renderItem={renderMushroomRow}
          keyExtractor={(item, index) => `${index}`}
          showsVerticalScrollIndicator={false}
        />
      )}
      {!groupedMushrooms.length && <Text style={styles.noData}>Нет данных</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  noData: {
    textAlign: 'center',
    marginTop: '80%',
    fontSize: 26,
    color: 'white',
    fontWeight: '600',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rowContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});

export default MushroomHistory;
