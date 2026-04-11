import { EmotionalCategory } from '../modules/registration/types';

export const CATEGORY_KEYWORDS: Record<EmotionalCategory, string[]> = {
  necessità: [
    'supermercato', 'farmacia', 'affitto', 'bolletta', 'spesa', 'medico', 'dentista', 
    'luce', 'gas', 'internet', 'treno', 'benzina', 'assicurazione', 'mutuo', 
    'condominio', 'tasse', 'commercialista', 'spesa alimentare'
  ],
  cura_di_sé: [
    'palestra', 'parrucchiere', 'estetista', 'massaggio', 'yoga', 'benessere',
    'crema', 'terapia', 'psicologo', 'skincare', 'trucchi', 'barbiere', 
    'meditazione', 'profumo', 'spa', 'terme', 'integrazione', 'vitamine'
  ],
  amicizie: [
    'cena', 'pizza', 'aperitivo', 'bar', 'birra', 'spritz', 'regalo', 'uscita', 
    'amici', 'compleanno', 'festa', 'drink', 'cocktail', 'pub', 'calcetto',
    'poker', 'regalo amici', 'serata'
  ],
  passioni: [
    'libro', 'musica', 'spotify', 'netflix', 'cinema', 'concerto', 'corso',
    'videogioco', 'teatro', 'museo', 'viaggio', 'biglietto', 'mostra', 
    'fotografia', 'abbonamento', 'strumento', 'vinile', 'fai da te'
  ],
  impulso: [
    'amazon', 'zalando', 'asos', 'online', 'shop', 'scarpe', 'vestiti', 
    'abbigliamento', 'shein', 'vinted', 'shopping', 'cover', 'accessori', 
    'gadget', 'saldi', 'profumeria', 'compulsivo', 'gioielli'
  ],
  ansia: [
    'delivery', 'just eat', 'deliveroo', 'uber eats', 'takeaway', 'cibo', 'notte',
    'glovo', 'mcdonalds', 'dolce', 'gelato', 'comfort food', 'taxi', 'uber',
    'sigarette', 'tabaccaio', 'snack', 'macchinetta'
  ],
  obiettivi: [
    'risparmio', 'investimento', 'corso professionale', 'attrezzatura lavoro',
    'etf', 'azioni', 'crypto', 'mentoring', 'master', 'certificazione', 
    'software', 'pc', 'macbook', 'strumentazione', 'hosting', 'dominio',
    'business', 'libero professionista'
  ]
};
