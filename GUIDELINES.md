# Linee Guida di Sviluppo - Wolly App

Per garantire la qualità e la manutenibilità del progetto nel tempo, ogni contributo al codice deve seguire questi principi fondamentali:

### 1. Modularità e Scalabilità
*   Ogni nuovo sviluppo o componente deve essere **modulare, scalabile e non distruttivo**.
*   Il codice deve essere scritto in modo da poter essere esteso senza compromettere le funzionalità esistenti.

### 2. Centralizzazione del Design
*   Ogni elemento, soprattutto grafico, deve essere **centralizzato**.
*   Tutti gli stili, i colori, la tipografia e i componenti UI comuni devono fare riferimento a file di configurazione centrali (es. `constants/Theme.ts`).
*   Questo approccio permette che le modifiche future siano centralizzate e distribuite automaticamente in tutta l'applicazione.
