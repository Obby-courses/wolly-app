import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase } from '../services/database/db';
import { SubscriptionManager } from '../services/database/SubscriptionManager';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';

export default function Home() {
  const router = useRouter();
  const [isDbReady, setIsDbReady] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    // Inizializza il DB solo la prima volta
    const setupDB = async () => {
      try {
        await initDatabase();
        await SubscriptionManager.processDueSubscriptions();
        setIsDbReady(true);
      } catch (error) {
        console.error('[DB] Errore inizializzazione:', error);
      }
    };
    setupDB();
  }, []);

  // Ricarica le transazioni ogni volta che la schermata acquisisce il focus
  useFocusEffect(
    useCallback(() => {
      if (isDbReady) {
        loadTransactions();
      }
    }, [isDbReady])
  );

  const loadTransactions = async () => {
    try {
      const data = await TransactionRepository.getAllActive();
      setTransactions(data);
    } catch (error) {
      console.error('Errore nel caricamento transazioni:', error);
    }
  };

  const renderTransaction = ({ item }: { item: any }) => {
    const isIncome = item.direction === 'in';
    return (
      <Pressable 
        style={styles.transactionCard}
        onPress={() => router.push(`/transaction/${item.id}`)}
      >
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle}>
            {item.description || item.category_key.replace('_', ' ')}
          </Text>
          <Text style={styles.transactionCategory}>
            {item.category_key} • {item.date}
          </Text>
        </View>
        <Text style={[styles.transactionAmount, isIncome ? styles.income : styles.expense]}>
          {!isIncome ? '- ' : '+ '}€{Math.abs(item.amount).toFixed(2)}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Le Tue Spese</Text>
      </View>

      {!isDbReady ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Nessuna transazione registrata.</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable 
        style={styles.fab}
        onPress={() => router.push('/test-registration')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
  },
  listContent: {
    padding: 15,
    paddingBottom: 100, // Make room for FAB
  },
  transactionCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '900',
  },
  income: {
    color: '#10B981',
  },
  expense: {
    color: '#111827',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#111827',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  fabText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 38,
  }
});
