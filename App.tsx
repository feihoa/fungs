import React from 'react';
import Navigation from '@/navigation/Navigation';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ImageBackground, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';

async function initializeDatabase(db: { execAsync: (arg0: string) => any }) {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS fungi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        predictions TEXT NOT NULL,
        dateTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.log('Ошибка инициализации : ', error);
  }
}

export default function App() {
  const [loaded, error] = useFonts({
    ComicSansRegular: require('./assets/fonts/comic-sans-regular.ttf'),
    ComicSansBold: require('./assets/fonts/comic-sans-bold.ttf'),
  });

  if (!loaded && !error) {
    return null;
  }

  return (
    loaded && (
      <SQLiteProvider databaseName="fungi.db" onInit={initializeDatabase}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.container} edges={['left', 'right']}>
            <ImageBackground
              style={styles.image}
              source={require('./assets/images/bg.png')}
              resizeMode="cover">
              <Navigation />
            </ImageBackground>
          </SafeAreaView>
        </SafeAreaProvider>
      </SQLiteProvider>
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  image: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
});
