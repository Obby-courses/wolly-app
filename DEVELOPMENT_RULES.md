# 🛠 Wolly Development Rules & Guidelines

Queste regole devono essere lette e rispettate ogni volta che si sviluppa nuovo codice per il progetto Wolly.

## 1. Centralizzazione dei Componenti Grafici
- **Unicità**: Ogni componente grafico (pulsanti, card, grafici, input) deve essere centralizzato nella cartella `/components`.
- **Verifica Esistenza**: Prima di creare un nuovo componente, è **obbligatorio** controllare se ne esiste già uno simile o se un componente esistente può essere esteso tramite props.
- **Atomic Design**: Preferire componenti piccoli e specializzati che possono essere composti insieme.

## 2. Funzioni AI Modulari e Non Distruttive
- **Modularità**: Ogni funzione legata all'AI (parsing, trascrizione, analisi) deve risiedere in `/services` o `/modules`.
- **Responsabilità Singola**: Una funzione AI deve fare una sola cosa (es: `transcribeAudio` si occupa solo di STT, `askAiChat` solo di LLM).
- **Non Distruttività**: Le funzioni AI non devono mai sovrascrivere dati esistenti in modo imprevisto. Devono restituire nuovi stati o oggetti che l'app deciderà come integrare.

## 3. Modularità e Riutilizzabilità
- **Props-Driven**: I componenti devono essere guidati dalle props. Evitare di cablare (hardcode) logiche specifiche di una pagina dentro un componente riutilizzabile.
- **Stato Condiviso**: Per logiche complesse che coinvolgono più componenti (es: la registrazione vocale), utilizzare Store centralizzati come `voiceStore.ts` invece di passare callback infinite.
- **Documentazione**: Ogni componente complesso deve avere un breve commento in cima che ne spieghi lo scopo e le props principali.

## 4. Manutenzione del Progetto
- **Clean Code**: Rimuovere sempre codice morto, log ridondanti e commenti obsoleti dopo ogni implementazione.
- **Git Flow**: Ogni modifica significativa deve essere accompagnata da un commit descrittivo.

---
*Ultimo aggiornamento: 15 Maggio 2026*
