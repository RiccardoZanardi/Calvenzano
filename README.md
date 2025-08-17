# Applicazione Gestione Multe - Backend Node.js

Questa applicazione gestisce le multe di una squadra sportiva con un backend Node.js + JSON per la persistenza dei dati.

## 🚀 Installazione e Avvio

### Prerequisiti
- Node.js (versione 14 o superiore)
- npm (incluso con Node.js)

### Installazione

1. **Installa le dipendenze:**
   ```bash
   npm install
   ```

2. **Avvia il server:**
   ```bash
   npm start
   ```
   
   Oppure per lo sviluppo con auto-reload:
   ```bash
   npm run dev
   ```

3. **Apri l'applicazione:**
   - Vai su: http://localhost:3001
   - Il server serve sia il backend che il frontend

## 📁 Struttura del Progetto

```
Multe/
├── package.json          # Dipendenze e script npm
├── server.js             # Server backend Express
├── index.html            # Frontend dell'applicazione
├── script.js             # Logica frontend
├── styles.css            # Stili CSS
├── data.json             # File dati (creato automaticamente)
└── README.md             # Questo file
```

## 🔧 Funzionalità Backend

### API Endpoints

- **GET /api/data** - Recupera tutti i dati
- **POST /api/data** - Salva tutti i dati
- **GET /api/members** - Recupera solo i membri
- **GET /api/fines** - Recupera solo le multe
- **GET /api/categories** - Recupera solo le categorie
- **GET /api/donations** - Recupera solo le donazioni
- **POST /api/backup** - Crea un backup dei dati

### Persistenza Dati

- I dati vengono salvati automaticamente in `data.json`
- Backup automatico con timestamp
- Fallback a localStorage in caso di errori del server

## 🛠️ Sviluppo

### Script Disponibili

- `npm start` - Avvia il server in modalità produzione
- `npm run dev` - Avvia il server con nodemon per lo sviluppo

### Struttura Dati

Il file `data.json` contiene:
```json
{
  "members": [],
  "fines": [],
  "categories": {},
  "donations": [],
  "activities": [],
  "icsEvents": [],
  "notifications": [],
  "globalDonations": [],
  "lastUpdated": "2025-01-XX..."
}
```

## 🔒 Sicurezza

- **Helmet.js** - Header di sicurezza HTTP
- **Rate Limiting** - Protezione contro attacchi DDoS
  - 100 richieste per 15 minuti (generale)
  - 10 richieste per 15 minuti per endpoint di salvataggio
- **Validazione Input** - Sanitizzazione e validazione dati
- **Limitazione Payload** - Max 500KB per richieste POST
- **CORS configurato** - Restrizioni appropriate per produzione
- **Gestione errori robusta** - Logging sicuro senza esposizione dati
- **Backup automatici** - Prevenzione perdita dati

## 🐛 Risoluzione Problemi

### Il server non si avvia
- Verifica che Node.js sia installato: `node --version`
- Verifica che le dipendenze siano installate: `npm install`
- Controlla che la porta 3001 sia libera

### Errori di connessione
- Assicurati che il server sia avviato
- Controlla la console del browser per errori
- Verifica l'URL: http://localhost:3001

### Perdita dati
- I backup sono salvati automaticamente con timestamp
- Controlla la cartella per file `backup-*.json`
- In caso di emergenza, i dati sono anche in localStorage del browser

## 🚀 Deployment

### GitHub Hosting

1. **Preparazione Repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tuousername/multe-app.git
   git push -u origin main
   ```

2. **Deployment su Servizi Cloud:**
   - **Heroku:** Supporto nativo Node.js
   - **Vercel:** Deployment automatico da GitHub
   - **Railway:** Semplice deployment con database
   - **Render:** Hosting gratuito con SSL

3. **Variabili d'Ambiente:**
   ```bash
   PORT=3001
   NODE_ENV=production
   ```

### Note Importanti per il Deployment

- Il file `data.json` non è incluso nel repository (vedi `.gitignore`)
- Per produzione, considera l'uso di un database (MongoDB, PostgreSQL)
- Configura le variabili d'ambiente per la sicurezza
- Le modifiche locali NON si aggiornano automaticamente online
- Usa `git push` per aggiornare l'applicazione pubblicata

## 📝 Note

- Il server serve sia il backend (API) che il frontend (file statici)
- I dati vengono salvati automaticamente ad ogni modifica
- Il sistema include un fallback a localStorage per maggiore affidabilità
- I backup vengono creati con timestamp per facilità di ripristino
- **Persistenza:** I dati rimangono salvati anche dopo refresh/riavvio

---

**Buon utilizzo! 🎯**