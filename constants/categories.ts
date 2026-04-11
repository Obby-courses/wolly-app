export interface Subcategory {
  key: string;
  label: string;
}

export interface Category {
  key: string;
  label: string;
  direction: 'in' | 'out' | 'both';
  subcategories: Subcategory[];
}

export const CATEGORIES_CONFIG: Category[] = [
  {
    key: 'cibo_bevande',
    label: 'Cibo e Bevande',
    direction: 'out',
    subcategories: [
      { key: 'alimentari', label: 'Alimentari' },
      { key: 'ristorante_fast_food', label: 'Ristorante, Fast Food' },
      { key: 'bar_caffe', label: 'Bar, Caffè' }
    ]
  },
  {
    key: 'acquisti',
    label: 'Acquisti',
    direction: 'out',
    subcategories: [
      { key: 'abbigliamento_scarpe', label: 'Abbigliamento e Scarpe' },
      { key: 'gioielli_accessori', label: 'Gioielli, Accessori' },
      { key: 'salute_bellezza', label: 'Salute e Bellezza' },
      { key: 'bambini', label: 'Bambini' },
      { key: 'casa_giardino', label: 'Casa, Giardino' },
      { key: 'animali', label: 'Animali domestici, animali' },
      { key: 'elettronica_accessori', label: 'Elettronica, accessori' },
      { key: 'regali_gioia', label: 'Regali, gioia' },
      { key: 'cancelleria_attrezzi', label: 'Cancelleria, attrezzi' },
      { key: 'tempo_libero', label: 'Tempo Libero' },
      { key: 'drogheria_farmacia', label: 'Drogheria, farmacia' }
    ]
  },
  {
    key: 'alloggio',
    label: 'Alloggio',
    direction: 'out',
    subcategories: [
      { key: 'affitto', label: 'Affitto' },
      { key: 'mutuo', label: 'Mutuo' },
      { key: 'energia_utenze', label: 'Energia, utenze' },
      { key: 'manutenzione_riparazioni', label: 'Manutenzione, riparazioni' },
      { key: 'assicurazione_proprieta', label: 'Assicurazione sulla proprietà' }
    ]
  },
  {
    key: 'trasporti',
    label: 'Trasporti',
    direction: 'out',
    subcategories: [
      { key: 'trasporto_pubblico', label: 'Trasporto pubblico' },
      { key: 'taxi', label: 'Taxi' },
      { key: 'lunga_distanza', label: 'Lunga distanza' },
      { key: 'viaggi_lavoro', label: 'Viaggi di lavoro' }
    ]
  },
  {
    key: 'veicolo',
    label: 'Veicolo',
    direction: 'out',
    subcategories: [
      { key: 'carburante', label: 'Carburante' },
      { key: 'parcheggio', label: 'Parcheggio' },
      { key: 'manutezione_veicoli', label: 'Manutezione veicoli' },
      { key: 'noleggio', label: 'Noleggio' },
      { key: 'assicurazione_veicolo', label: 'Assicurazione veicolo' },
      { key: 'leasing', label: 'Leasing' }
    ]
  },
  {
    key: 'vita_intrattenimento',
    label: 'Vita e Intrattenimento',
    direction: 'out',
    subcategories: [
      { key: 'assistenza_sanitaria', label: 'Assistenza sanitaria, medico' },
      { key: 'wellness_bellezza', label: 'Wellness, bellezza' },
      { key: 'sport_fitness', label: 'Sport attivo, fitness' },
      { key: 'cultura_eventi', label: 'Cultura, eventi sportivi' },
      { key: 'eventi_vita', label: 'Eventi della vita' },
      { key: 'hobby', label: 'Hobby' },
      { key: 'formazione_sviluppo', label: 'Formazione, sviluppo personale' },
      { key: 'libri_audio_abbonamenti', label: 'Libri, audio, abbonamenti' },
      { key: 'tv_streaming', label: 'Tv, streaming' },
      { key: 'vacanze_viaggi_hotel', label: 'Vacanze, viaggi, hotel' },
      { key: 'beneficienza_regali', label: 'Beneficienza, regali' },
      { key: 'alcool_tabacco', label: 'Alcool, tabacco' },
      { key: 'lotteria_azzardo', label: 'Lotteria, gioco d\'azzardo' }
    ]
  },
  {
    key: 'comunicazione_pc',
    label: 'Comunicazione, PC',
    direction: 'out',
    subcategories: [
      { key: 'telefono_cellulare', label: 'Telefono, cellulare' },
      { key: 'internet', label: 'Internet' },
      { key: 'software_app_giochi', label: 'Software, app, giochi' },
      { key: 'servizi_postali', label: 'Servizi postali' }
    ]
  },
  {
    key: 'spese_finanziarie',
    label: 'Spese finanziarie',
    direction: 'out',
    subcategories: [
      { key: 'tasse', label: 'Tasse' },
      { key: 'assicurazioni', label: 'Assicurazioni' },
      { key: 'prestiti_interessi', label: 'Prestiti, interessi' },
      { key: 'multe', label: 'Multe' },
      { key: 'consulenza', label: 'Consulenza' },
      { key: 'commissioni', label: 'Spese, commissioni' },
      { key: 'mantenimento', label: 'Assegno di mantenimento' }
    ]
  },
  {
    key: 'investimenti',
    label: 'Investimenti',
    direction: 'out',
    subcategories: [
      { key: 'immobili', label: 'Immobili' },
      { key: 'veicoli_beni_immobili', label: 'Veicoli, beni immobili' },
      { key: 'investimenti_finanziari', label: 'Investimenti finanziari' },
      { key: 'risparmi', label: 'Risparmi' },
      { key: 'collezioni', label: 'Collezioni' }
    ]
  },
  {
    key: 'entrata',
    label: 'Entrata',
    direction: 'in',
    subcategories: [
      { key: 'salario_fatture', label: 'Salario, fatture' },
      { key: 'interessi_dividendi', label: 'Interessi, dividendi' },
      { key: 'vendita', label: 'Vendita' },
      { key: 'entrate_affitto', label: 'Entrate da affitto' },
      { key: 'quote_sovvenzioni', label: 'Quote o sovvenzioni' },
      { key: 'entrata_prestiti', label: 'Entrata da prestiti' },
      { key: 'assegni_buoni', label: 'Assegni, buoni, ticket' },
      { key: 'lotteria_azzardo', label: 'Lotteria, gioco d\'azzardo' },
      { key: 'rimborsi', label: 'Rimborsi (tassa, acquisto)' },
      { key: 'regali', label: 'Regali' }
    ]
  }
];
