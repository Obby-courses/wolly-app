import { EmotionalCategory } from '../modules/registration/types';

export const EMOTIONAL_CATEGORIES: { key: EmotionalCategory; label: string; description: string }[] = [
  { key: 'necessità', label: 'Necessità', description: 'Le spese ineludibili della vita: affitto, bollette, salute, nutrizione di base.' },
  { key: 'cura_di_sé', label: 'Cura di sé', description: 'Investimenti sul proprio benessere psicofisico (palestra, estetista, salute mentale, spa).' },
  { key: 'amicizie', label: 'Amicizie', description: 'Cene, aperitivi, uscite sociali, regali ad amici.' },
  { key: 'passioni', label: 'Passioni', description: 'Spese che nutrono i tuoi interessi profondi (hobby, libri, abbonamenti, arte, sport non per fitness ma per passione).' },
  { key: 'impulso', label: 'Impulso', description: 'Acquisti non programmati, spesso derivanti da noia, stimoli visivi momentanei (shopping online improvviso).' },
  { key: 'ansia', label: 'Ansia & Comfort', description: 'Spese fatte per alleviare stress o stanchezza (food delivery serale per pigrizia, comfort food, taxi per evitare i mezzi).' },
  { key: 'obiettivi', label: 'Obiettivi', description: 'Risparmi, investimenti, formazione professionale o attrezzatura per il lavoro dei sogni.' }
];
