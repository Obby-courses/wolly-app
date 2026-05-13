import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, ScrollView, Animated, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { getCategory } from '../constants/categories';
import { getCategoryColor } from '../components/CategoryPill';
import TimeFilter, { TimeRange } from '../components/TimeFilter';
import TransactionItem from '../components/TransactionItem';

export default function HistoryScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stati dei filtri
  const [timeRange, setTimeRange] = useState<TimeRange>('Mese');
  const [baseDate, setBaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [timeRange, baseDate, selectedCategory, selectedSubcategory])
  );

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await TransactionRepository.getFilteredTransactions(
        timeRange,
        {
          category_key: selectedCategory || undefined,
          subcategory_key: selectedSubcategory || undefined
        },
        'date',
        baseDate
      );
      setTransactions(data);
    } catch (error) {
      console.error('Errore caricamento history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      "Elimina Tutto",
      "Sei sicuro di voler eliminare TUTTE le transazioni? Questa azione non può essere annullata (almeno per ora).",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            try {
              await TransactionRepository.deleteAllActive();
              loadTransactions();
            } catch (error) {
              console.error('Errore eliminazione totale:', error);
            }
          }
        }
      ]
    );
  };

  // Carica categorie e sottocategorie uniche per i chip di filtro (opzionale, ma utile)
  // Per ora le estraiamo da tutte le transazioni attive per popolare i chip
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      const all = await TransactionRepository.getAllActive();
      const cats = new Set(all.map(t => t.category_key).filter(Boolean));
      setAvailableCategories(Array.from(cats) as string[]);
      
      if (selectedCategory) {
        const subs = new Set(all.filter(t => t.category_key === selectedCategory).map(t => t.subcategory_key).filter(Boolean));
        setAvailableSubcategories(Array.from(subs) as string[]);
      } else {
        setAvailableSubcategories([]);
      }
    };
    fetchMetadata();
  }, [selectedCategory]);

  const renderTransaction = ({ item }: { item: any }) => (
    <TransactionItem item={item} />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header con pulsante back */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
          </Pressable>
          <Text style={styles.title}>Dettaglio Spese</Text>
        </View>
        <Pressable onPress={handleDeleteAll} style={styles.deleteStatsButton}>
          <Ionicons name="trash-outline" size={24} color={COLORS.danger} />
        </Pressable>
      </View>

      {/* Sezione Filtri */}
      <View style={styles.filtersContainer}>
        <TimeFilter 
          timeRange={timeRange} 
          setTimeRange={setTimeRange} 
          baseDate={baseDate}
          onDateChange={setBaseDate}
        />

        {/* Filtro Categoria */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <Pressable
            onPress={() => {
              setSelectedCategory(null);
              setSelectedSubcategory(null);
            }}
            style={[styles.chip, !selectedCategory && styles.chipActive]}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>Tutte</Text>
          </Pressable>
          {availableCategories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => {
                setSelectedCategory(cat);
                setSelectedSubcategory(null);
              }}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Filtro Sottocategoria (mostrato solo se una categoria è selezionata) */}
        {selectedCategory && availableSubcategories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <Pressable
              onPress={() => setSelectedSubcategory(null)}
              style={[styles.chip, !selectedSubcategory && styles.chipActive]}
            >
              <Text style={[styles.chipText, !selectedSubcategory && styles.chipTextActive]}>Tutte le Sotto-cat</Text>
            </Pressable>
            {availableSubcategories.map((sub) => (
              <Pressable
                key={sub}
                onPress={() => setSelectedSubcategory(sub)}
                style={[styles.chip, selectedSubcategory === sub && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedSubcategory === sub && styles.chipTextActive]}>
                  {sub.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Lista Transazioni */}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nessuna spesa trovata con questi filtri.</Text>
              <Text style={styles.emptySubtext}>Magari smettila di filtrare e inizia a risparmiare.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: SPACING.md,
  },
  deleteStatsButton: {
    padding: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  filtersContainer: {
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterRow: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: COLORS.surface,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 120, // Increased to avoid BottomMenu
  },
  income: {
    color: COLORS.success,
  },
  expense: {
    color: COLORS.primary,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: SPACING.huge,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  }
});
