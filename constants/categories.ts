/**
 * WOLLY TAXONOMY
 * 
 * DOMAIN  = ex "categoria"   (macro-gruppo, es: "Vita e Intrattenimento")
 * CATEGORY = ex "sottocategoria" (voce specifica, es: "Cultura, eventi sportivi")
 *
 * Each category belongs uniquely to one domain.
 * The AI and UI always pick a specific category_key (which implies the domain).
 * Selecting only a domain_key is allowed and means "generic within that domain".
 */

export interface Category {
  key: string;           // category_key stored in DB (unique globally)
  label: string;
  domain_key: string;   // parent domain
}

export interface Domain {
  key: string;
  label: string;
  direction: 'in' | 'out' | 'both';
  categories: Category[];
}

export const DOMAINS_CONFIG: Domain[] = [
  {
    key: 'cibo_bevande',
    label: 'Cibo e Bevande',
    direction: 'out',
    categories: [
      { key: 'alimentari', label: 'Alimentari', domain_key: 'cibo_bevande' },
      { key: 'ristorante_fast_food', label: 'Ristorante, Fast Food', domain_key: 'cibo_bevande' },
      { key: 'bar_caffe', label: 'Bar, Caffè', domain_key: 'cibo_bevande' },
    ]
  },
  {
    key: 'acquisti',
    label: 'Acquisti',
    direction: 'out',
    categories: [
      { key: 'abbigliamento_scarpe', label: 'Abbigliamento e Scarpe', domain_key: 'acquisti' },
      { key: 'gioielli_accessori', label: 'Gioielli, Accessori', domain_key: 'acquisti' },
      { key: 'salute_bellezza', label: 'Salute e Bellezza', domain_key: 'acquisti' },
      { key: 'bambini', label: 'Bambini', domain_key: 'acquisti' },
      { key: 'casa_giardino', label: 'Casa, Giardino', domain_key: 'acquisti' },
      { key: 'animali', label: 'Animali domestici', domain_key: 'acquisti' },
      { key: 'elettronica_accessori', label: 'Elettronica, accessori', domain_key: 'acquisti' },
      { key: 'regali_gioia', label: 'Regali, gioia', domain_key: 'acquisti' },
      { key: 'cancelleria_attrezzi', label: 'Cancelleria, attrezzi', domain_key: 'acquisti' },
      { key: 'tempo_libero', label: 'Tempo Libero', domain_key: 'acquisti' },
      { key: 'drogheria_farmacia', label: 'Drogheria, farmacia', domain_key: 'acquisti' },
    ]
  },
  {
    key: 'alloggio',
    label: 'Alloggio',
    direction: 'out',
    categories: [
      { key: 'affitto', label: 'Affitto', domain_key: 'alloggio' },
      { key: 'mutuo', label: 'Mutuo', domain_key: 'alloggio' },
      { key: 'energia_utenze', label: 'Energia, utenze', domain_key: 'alloggio' },
      { key: 'manutenzione_riparazioni', label: 'Manutenzione, riparazioni', domain_key: 'alloggio' },
      { key: 'assicurazione_proprieta', label: 'Assicurazione sulla proprietà', domain_key: 'alloggio' },
    ]
  },
  {
    key: 'trasporti',
    label: 'Trasporti',
    direction: 'out',
    categories: [
      { key: 'trasporto_pubblico', label: 'Trasporto pubblico', domain_key: 'trasporti' },
      { key: 'taxi', label: 'Taxi', domain_key: 'trasporti' },
      { key: 'lunga_distanza', label: 'Lunga distanza', domain_key: 'trasporti' },
    ]
  },
  {
    key: 'veicolo',
    label: 'Veicolo',
    direction: 'out',
    categories: [
      { key: 'carburante', label: 'Carburante', domain_key: 'veicolo' },
      { key: 'parcheggio', label: 'Parcheggio', domain_key: 'veicolo' },
      { key: 'manutenzione_veicoli', label: 'Manutenzione veicoli', domain_key: 'veicolo' },
      { key: 'noleggio', label: 'Noleggio', domain_key: 'veicolo' },
      { key: 'assicurazione_veicolo', label: 'Assicurazione veicolo', domain_key: 'veicolo' },
      { key: 'leasing', label: 'Leasing', domain_key: 'veicolo' },
    ]
  },
  {
    key: 'vita_intrattenimento',
    label: 'Vita e Intrattenimento',
    direction: 'out',
    categories: [
      { key: 'assistenza_sanitaria', label: 'Assistenza sanitaria, medico', domain_key: 'vita_intrattenimento' },
      { key: 'wellness_bellezza', label: 'Wellness, bellezza', domain_key: 'vita_intrattenimento' },
      { key: 'sport_fitness', label: 'Sport attivo, fitness', domain_key: 'vita_intrattenimento' },
      { key: 'cultura_eventi', label: 'Cultura, eventi sportivi', domain_key: 'vita_intrattenimento' },
      { key: 'eventi_vita', label: 'Eventi della vita', domain_key: 'vita_intrattenimento' },
      { key: 'hobby', label: 'Hobby', domain_key: 'vita_intrattenimento' },
      { key: 'formazione_sviluppo', label: 'Formazione, sviluppo personale', domain_key: 'vita_intrattenimento' },
      { key: 'libri_audio_abbonamenti', label: 'Libri, audio, abbonamenti', domain_key: 'vita_intrattenimento' },
      { key: 'tv_streaming', label: 'Tv, streaming', domain_key: 'vita_intrattenimento' },
      { key: 'vacanze_viaggi_hotel', label: 'Vacanze, viaggi, hotel', domain_key: 'vita_intrattenimento' },
      { key: 'beneficienza_regali', label: 'Beneficienza, regali', domain_key: 'vita_intrattenimento' },
      { key: 'alcool_tabacco', label: 'Alcool, tabacco', domain_key: 'vita_intrattenimento' },
      { key: 'lotteria_azzardo', label: "Lotteria, gioco d'azzardo", domain_key: 'vita_intrattenimento' },
    ]
  },
  {
    key: 'comunicazione_pc',
    label: 'Comunicazione, PC',
    direction: 'out',
    categories: [
      { key: 'telefono_cellulare', label: 'Telefono, cellulare', domain_key: 'comunicazione_pc' },
      { key: 'internet', label: 'Internet', domain_key: 'comunicazione_pc' },
      { key: 'software_app_giochi', label: 'Software, app, giochi', domain_key: 'comunicazione_pc' },
      { key: 'servizi_postali', label: 'Servizi postali', domain_key: 'comunicazione_pc' },
    ]
  },
  {
    key: 'spese_finanziarie',
    label: 'Spese finanziarie',
    direction: 'out',
    categories: [
      { key: 'tasse', label: 'Tasse', domain_key: 'spese_finanziarie' },
      { key: 'assicurazioni', label: 'Assicurazioni', domain_key: 'spese_finanziarie' },
      { key: 'prestiti_interessi', label: 'Prestiti, interessi', domain_key: 'spese_finanziarie' },
      { key: 'multe', label: 'Multe', domain_key: 'spese_finanziarie' },
      { key: 'consulenza', label: 'Consulenza', domain_key: 'spese_finanziarie' },
      { key: 'commissioni', label: 'Spese, commissioni', domain_key: 'spese_finanziarie' },
      { key: 'mantenimento', label: 'Assegno di mantenimento', domain_key: 'spese_finanziarie' },
    ]
  },
  {
    key: 'investimenti',
    label: 'Investimenti',
    direction: 'out',
    categories: [
      { key: 'immobili', label: 'Immobili', domain_key: 'investimenti' },
      { key: 'veicoli_beni_immobili', label: 'Veicoli, beni immobili', domain_key: 'investimenti' },
      { key: 'investimenti_finanziari', label: 'Investimenti finanziari', domain_key: 'investimenti' },
      { key: 'risparmi', label: 'Risparmi', domain_key: 'investimenti' },
      { key: 'collezioni', label: 'Collezioni', domain_key: 'investimenti' },
    ]
  },
  {
    key: 'entrata',
    label: 'Entrata',
    direction: 'in',
    categories: [
      { key: 'salario_fatture', label: 'Salario, fatture', domain_key: 'entrata' },
      { key: 'interessi_dividendi', label: 'Interessi, dividendi', domain_key: 'entrata' },
      { key: 'vendita', label: 'Vendita', domain_key: 'entrata' },
      { key: 'entrate_affitto', label: 'Entrate da affitto', domain_key: 'entrata' },
      { key: 'quote_sovvenzioni', label: 'Quote o sovvenzioni', domain_key: 'entrata' },
      { key: 'entrata_prestiti', label: 'Entrata da prestiti', domain_key: 'entrata' },
      { key: 'assegni_buoni', label: 'Assegni, buoni, ticket', domain_key: 'entrata' },
      { key: 'lotteria_vincite', label: "Lotteria, vincite", domain_key: 'entrata' },
      { key: 'rimborsi', label: 'Rimborsi (tassa, acquisto)', domain_key: 'entrata' },
      { key: 'regali', label: 'Regali', domain_key: 'entrata' },
    ]
  },
];

// ─── Compatibility helpers ───────────────────────────────────────────────────

/** Flat list of ALL categories across all domains */
export const ALL_CATEGORIES: Category[] = DOMAINS_CONFIG.flatMap(d => d.categories);

/** Find a domain by its key */
export const getDomain = (domain_key: string): Domain | undefined =>
  DOMAINS_CONFIG.find(d => d.key === domain_key);

/** Find a category by its key (globally unique) */
export const getCategory = (category_key: string): Category | undefined =>
  ALL_CATEGORIES.find(c => c.key === category_key);

/** Find the parent domain of a category key (or the domain itself if key is a domain) */
export const getDomainForCategory = (category_key: string): Domain | undefined => {
  const cat = getCategory(category_key);
  if (cat) return getDomain(cat.domain_key);
  // If not a category, check if it's a domain itself (generic classification)
  return getDomain(category_key);
};

/**
 * LEGACY COMPATIBILITY:
 * Many parts of the codebase use CATEGORIES_CONFIG with the old shape.
 * This shim provides backwards compatibility during migration.
 * category_key in DB = old subcategory_key
 * subcategory_key in DB = same as category_key (redundant, kept for DB compat)
 */
export const CATEGORIES_CONFIG = DOMAINS_CONFIG.map(domain => ({
  key: domain.key,
  label: domain.label,
  direction: domain.direction,
  subcategories: domain.categories.map(cat => ({
    key: cat.key,
    label: cat.label,
  })),
}));
