import React, { useState } from 'react';
import {
  Modal, View, Text, Pressable, ScrollView, StyleSheet, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DOMAINS_CONFIG, Domain, Category } from '../constants/categories';
import { COLORS, TYPOGRAPHY } from '../constants/Theme';

const DOMAIN_COLORS: Record<string, string> = {
  cibo_bevande: '#6366F1',
  acquisti: '#06B6D4',
  alloggio: '#8B5CF6',
  trasporti: '#3B82F6',
  veicolo: '#F59E0B',
  vita_intrattenimento: '#EC4899',
  comunicazione_pc: '#10B981',
  spese_finanziarie: '#EF4444',
  investimenti: '#D97706',
  entrata: '#059669',
};

const DOMAIN_ICONS: Record<string, string> = {
  cibo_bevande: 'restaurant-outline',
  acquisti: 'bag-handle-outline',
  alloggio: 'home-outline',
  trasporti: 'train-outline',
  veicolo: 'car-outline',
  vita_intrattenimento: 'heart-outline',
  comunicazione_pc: 'laptop-outline',
  spese_finanziarie: 'receipt-outline',
  investimenti: 'trending-up-outline',
  entrata: 'wallet-outline',
};

interface Props {
  visible: boolean;
  currentCategoryKey: string;
  direction?: 'in' | 'out';
  onSelect: (categoryKey: string) => void;
  onClose: () => void;
}

export default function CategoryPickerModal({ visible, currentCategoryKey, direction, onSelect, onClose }: Props) {
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  const filteredDomains = DOMAINS_CONFIG.filter(d =>
    !direction || d.direction === 'both' || d.direction === direction
  );

  const handleDomainPress = (domain: Domain) => {
    setSelectedDomain(domain);
  };

  const handleSelectDomain = (domain: Domain) => {
    // Select the domain generically
    onSelect(domain.key);
    setSelectedDomain(null);
    onClose();
  };

  const handleSelectCategory = (cat: Category) => {
    onSelect(cat.key);
    setSelectedDomain(null);
    onClose();
  };

  const handleBack = () => {
    if (selectedDomain) {
      setSelectedDomain(null);
    } else {
      onClose();
    }
  };

  const domainColor = selectedDomain ? (DOMAIN_COLORS[selectedDomain.key] || COLORS.secondary) : COLORS.primary;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleBack} accessibilityViewIsModal>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, selectedDomain && { borderBottomColor: domainColor + '40' }]}>
          <Pressable onPress={handleBack} style={styles.headerBack}>
            <Ionicons name={selectedDomain ? 'chevron-back' : 'close'} size={26} color={COLORS.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {selectedDomain ? selectedDomain.label : 'Classificazione'}
          </Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {!selectedDomain ? (
            /* ── STEP 1: Domain grid ─────────────────── */
            <>
              <Text style={styles.hint}>Scegli il dominio di appartenenza</Text>
              <View style={styles.domainGrid}>
                {filteredDomains.map(domain => {
                  const color = DOMAIN_COLORS[domain.key] || COLORS.secondary;
                  const icon = DOMAIN_ICONS[domain.key] || 'grid-outline';
                  const isDomainSelected = currentCategoryKey === domain.key;
                  // If not domain selected, check if current category belongs to this domain
                  const isDomainActive = isDomainSelected || domain.categories.some(c => c.key === currentCategoryKey);

                  return (
                    <Pressable
                      key={domain.key}
                      style={[
                        styles.domainCard, 
                        { backgroundColor: color },
                        isDomainActive && { borderWidth: 2, borderColor: '#FFF' }
                      ]}
                      onPress={() => handleDomainPress(domain)}
                      accessibilityRole="button"
                      accessibilityLabel={`${domain.label}, ${isDomainActive ? 'selezionato' : 'non selezionato'}`}
                    >
                      <View style={styles.domainCardTop}>
                        <Ionicons name={icon as any} size={28} color="#FFF" />
                        {isDomainSelected && (
                          <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                        )}
                      </View>
                      <Text style={styles.domainCardLabel}>{domain.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            /* ── STEP 2: Domain header + categories ──── */
            <>
              {/* Selectable domain header */}
              {(() => {
                const isDomainSelected = currentCategoryKey === selectedDomain.key;
                return (
                  <Pressable
                    style={[
                      styles.domainHeader, 
                      { backgroundColor: domainColor },
                      isDomainSelected && { borderWidth: 2, borderColor: '#FFF' }
                    ]}
                    onPress={() => handleSelectDomain(selectedDomain)}
                    accessibilityRole="button"
                    accessibilityLabel={`${selectedDomain.label}, ${isDomainSelected ? 'selezionato' : 'non selezionato'}`}
                  >
                    <View style={styles.domainHeaderLeft}>
                      <Ionicons name={(DOMAIN_ICONS[selectedDomain.key] || 'grid-outline') as any} size={24} color="#FFF" />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.domainHeaderLabel}>Dominio</Text>
                        <Text style={styles.domainHeaderName}>{selectedDomain.label}</Text>
                      </View>
                    </View>
                    <View style={[styles.domainSelectBadge, isDomainSelected && { backgroundColor: '#FFF' }]}>
                      {isDomainSelected ? (
                        <Ionicons name="checkmark" size={16} color={domainColor} />
                      ) : (
                        <Text style={styles.domainSelectBadgeText}>Seleziona</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })()}

              <Text style={styles.hint}>Oppure scegli una categoria specifica</Text>

              {/* Category list */}
              <View style={styles.categoryList}>
                {selectedDomain.categories.map((cat, index) => {
                  const isSelected = cat.key === currentCategoryKey;
                  const isLast = index === selectedDomain.categories.length - 1;
                  return (
                    <Pressable
                      key={cat.key}
                      style={[
                        styles.categoryItem,
                        !isLast && styles.categoryItemBorder,
                        isSelected && { backgroundColor: domainColor + '12' }
                      ]}
                      onPress={() => handleSelectCategory(cat)}
                      accessibilityRole="button"
                      accessibilityLabel={`${cat.label}, ${isSelected ? 'selezionato' : 'non selezionato'}`}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: isSelected ? domainColor : '#E5E7EB' }]} />
                      <Text style={[styles.categoryItemText, isSelected && { color: domainColor, fontFamily: TYPOGRAPHY.fontBold }]}>
                        {cat.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={domainColor} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBack: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: TYPOGRAPHY.fontBold, color: COLORS.primary },
  content: { padding: 20, paddingBottom: 60 },
  hint: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  // Domain grid
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  domainCard: {
    width: '47%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 100,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 }
    })
  },
  domainCardTop: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domainCardLabel: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    marginTop: 12,
    flexShrink: 1,
  },
  // Domain header (step 2)
  domainHeader: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
      android: { elevation: 5 }
    })
  },
  domainHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  domainHeaderLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: TYPOGRAPHY.fontBold, textTransform: 'uppercase', letterSpacing: 1 },
  domainHeaderName: { color: '#FFF', fontSize: 18, fontFamily: TYPOGRAPHY.fontBold, marginTop: 2 },
  domainSelectBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  domainSelectBadgeText: { color: '#FFF', fontSize: 12, fontFamily: TYPOGRAPHY.fontBold },
  // Category list
  categoryList: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 }
    })
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  categoryItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 14 },
  categoryItemText: { flex: 1, fontSize: 15, color: COLORS.primary, fontWeight: '500' },
});
