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

- **GET /api/data** - Recupera tutti i dati (ora con storage persistente)
- **POST /api/data** - Salva tutti i dati (ora con storage persistente)
- **GET /api/storage-info** - Informazioni sul sistema di storage
- **GET /api/members** - Recupera solo i membri
- **GET /api/fines** - Recupera solo le multe
- **GET /api/categories** - Recupera solo le categorie
- **GET /api/donations** - Recupera solo le donazioni
- **POST /api/backup** - Crea un backup dei dati

### Persistenza Dati

**🔄 Sistema di Storage Ibrido (Locale + GitHub)**

L'applicazione ora supporta due modalità di persistenza:

1. **Storage Locale** (default):
   - I dati vengono salvati in `data.json` locale
   - Funziona sempre, anche senza configurazione aggiuntiva
   - ⚠️ **Limitazione su Render**: I file locali si perdono al riavvio/cold start

2. **Storage GitHub** (raccomandato per produzione):
   - I dati vengono salvati in un repository GitHub
   - **Persistenza garantita** anche su hosting gratuiti come Render
   - Backup automatico con versioning Git
   - Fallback automatico al file locale se GitHub non è disponibile

**Configurazione Storage GitHub:**

1. Crea un repository GitHub (può essere privato)
2. Genera un Personal Access Token: https://github.com/settings/tokens
3. Configura le variabili d'ambiente (vedi `.env.example`)
4. L'app salverà automaticamente su GitHub + file locale

**Variabili d'ambiente richieste:**
```bash
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo_name
GITHUB_TOKEN=your_personal_access_token
GITHUB_BRANCH=main  # opzionale
```

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

### Deployment su Render (Raccomandato)

**🎯 Soluzione per il Piano Gratuito di Render**

Render ha un filesystem effimero: i file locali si perdono al riavvio. La soluzione implementata usa GitHub come storage persistente.

**Passi per il deployment:**

1. **Preparazione Repository Codice:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tuousername/multe-app.git
   git push -u origin main
   ```

2. **Creazione Repository Dati (separato):**
   ```bash
   # Crea un nuovo repository su GitHub per i dati
   # Esempio: multe-data (può essere privato)
   ```

3. **Configurazione Render:**
   - Connetti il repository del codice
   - Aggiungi le variabili d'ambiente:
     ```bash
     NODE_ENV=production
     PORT=10000
     PASSWORD_HASH=your_bcrypt_hash
     SESSION_SECRET=your_session_secret
     GITHUB_OWNER=your_username
     GITHUB_REPO=multe-data
     GITHUB_TOKEN=your_personal_access_token
     GITHUB_BRANCH=main
     ```

4. **Generazione Personal Access Token:**
   - Vai su: https://github.com/settings/tokens
   - Crea un token con permessi `repo` (per repository privati)
   - Copia il token nelle variabili d'ambiente di Render

### Altri Servizi Cloud

- **Heroku:** Supporto nativo Node.js + GitHub storage
- **Railway:** Deployment semplice + GitHub storage
- **Vercel:** Deployment automatico + GitHub storage

### Variabili d'Ambiente Complete

```bash
# Essenziali
NODE_ENV=production
PORT=10000
PASSWORD_HASH=your_bcrypt_password_hash
SESSION_SECRET=your_session_secret

# GitHub Storage (per persistenza)
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_data_repository
GITHUB_TOKEN=your_personal_access_token
GITHUB_BRANCH=main
```

### Note Importanti per il Deployment

- ✅ **Persistenza garantita** con GitHub storage
- ✅ **Piano gratuito compatibile** - nessun database esterno richiesto
- ✅ **Backup automatico** tramite versioning Git
- ✅ **Fallback locale** se GitHub non è disponibile
- ⚠️ **Sicurezza**: Usa repository privati per dati sensibili
- 🔄 **Aggiornamenti**: `git push` per aggiornare il codice
- 📊 **Monitoraggio**: Usa `/api/storage-info` per verificare lo stato

## 📝 Note

- Il server serve sia il backend (API) che il frontend (file statici)
- I dati vengono salvati automaticamente ad ogni modifica
- Il sistema include un fallback a localStorage per maggiore affidabilità
- I backup vengono creati con timestamp per facilità di ripristino
- **Persistenza:** I dati rimangono salvati anche dopo refresh/riavvio

---

**Buon utilizzo! 🎯**