require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const GitHubStorage = require('./github-storage');

const app = express();
const PORT = process.env.PORT || 3002;

// Configurazione session store per produzione e sviluppo
let sessionStore;
if (process.env.NODE_ENV === 'production' && process.env.MONGODB_URI) {
    // Usa MongoDB in produzione se disponibile
    sessionStore = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600 // lazy session update
    });
    console.log('📦 Using MongoDB session store for production');
} else {
    // Usa MemoryStore per sviluppo locale (più stabile)
    sessionStore = new session.MemoryStore();
    console.log('📦 Using MemoryStore for development');
}

// Inizializza il sistema di storage persistente
const storage = new GitHubStorage();
console.log('📦 Storage system initialized:', storage.getStorageInfo());

// Abilita trust proxy in produzione (necessario per cookie 'secure' e rilevare HTTPS dietro proxy)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Configurazione middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware per gestione errori di sessione
app.use((req, res, next) => {
    // Gestione errori di sessione più robusta
    if (req.session && typeof req.session.save === 'function') {
        const originalSave = req.session.save;
        req.session.save = function(callback) {
            originalSave.call(this, (err) => {
                if (err) {
                    console.warn('⚠️ Session save error (continuing):', err.message);
                    // Continua senza errore per non bloccare l'app
                    if (callback) callback();
                } else {
                    if (callback) callback();
                }
            });
        };
    }
    next();
});

// Configurazione sessioni con FileStore (risolve problemi MemoryStore su Render)
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS automatico in produzione
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 ore
    }
}));

// Middleware per forzare HTTPS in produzione
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        // consenti health check senza redirect
        if (req.originalUrl === '/healthz') return next();
        const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
        if (!isSecure) {
            return res.redirect(`https://${req.get('host')}${req.originalUrl}`);
        }
        next();
    });
}

// Middleware per autenticazione API
function requireAuth(req, res, next) {
    if (!req.session.authenticated) {
        return res.status(401).json({ error: 'Non autenticato' });
    }
    next();
}

// Middleware per servire file statici solo se autenticato
app.use((req, res, next) => {
    // Permetti accesso a login.html e risorse di login senza autenticazione
    if (req.path === '/login.html' || req.path === '/login' || req.path.startsWith('/login-assets/') || req.path === '/healthz') {
        return next();
    }
    
    // Controlla se l'utente è autenticato
    if (!req.session.authenticated) {
        return res.redirect('/login.html');
    }
    
    next();
});

// Servire file statici
app.use(express.static(__dirname));

// Endpoint di health check (senza auth, sempre 200)
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// Route per il login
app.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password richiesta' });
        }
        
        // Verifica password con bcrypt
        const passwordHash = process.env.PASSWORD_HASH;
        if (!passwordHash) {
            console.error('PASSWORD_HASH non configurato nelle variabili d\'ambiente');
            return res.status(500).json({ success: false, message: 'Errore di configurazione server' });
        }
        
        const isValid = await bcrypt.compare(password, passwordHash);
        
        if (isValid) {
            req.session.authenticated = true;
            req.session.loginTime = new Date();
            res.json({ success: true, message: 'Login effettuato con successo' });
        } else {
            // Log del tentativo di accesso fallito (senza esporre la password)
            console.log(`Tentativo di login fallito da IP: ${req.ip} alle ${new Date().toISOString()}`);
            res.status(401).json({ success: false, message: 'Password non corretta' });
        }
    } catch (error) {
        console.error('Errore durante il login:', error.message);
        res.status(500).json({ success: false, message: 'Errore interno del server' });
    }
});

// Route per il logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Errore durante il logout:', err);
            return res.status(500).json({ success: false, message: 'Errore durante il logout' });
        }
        res.json({ success: true, message: 'Logout effettuato con successo' });
    });
});

// Route per verificare lo stato di autenticazione
app.get('/auth-status', (req, res) => {
    res.json({ 
        authenticated: !!req.session.authenticated,
        loginTime: req.session.loginTime || null
    });
});

// Route per l'API dei dati (ora con storage persistente GitHub)
app.get('/api/data', requireAuth, async (req, res) => {
    try {
        const data = await storage.readData();
        // Aggiungi timestamp di ultima lettura per debugging
        data.lastRead = new Date().toISOString();
        res.json(data);
    } catch (error) {
        console.error('Errore lettura dati:', error);
        res.status(500).json({ error: 'Errore lettura dati' });
    }
});

// Route per salvare i dati (ora con storage persistente GitHub)
app.post('/api/data', requireAuth, async (req, res) => {
    try {
        // Aggiungi timestamp di ultimo aggiornamento
        const dataToSave = {
            ...req.body,
            lastUpdated: new Date().toISOString()
        };
        
        const success = await storage.writeData(dataToSave);
        
        if (success || !storage.isGitHubConfigured()) {
            res.json({ 
                success: true, 
                savedToGitHub: success && storage.isGitHubConfigured(),
                savedLocally: true
            });
        } else {
            res.json({ 
                success: true, 
                savedToGitHub: false,
                savedLocally: true,
                warning: 'Dati salvati solo localmente - GitHub non disponibile'
            });
        }
    } catch (error) {
        console.error('Errore salvataggio dati:', error);
        res.status(500).json({ error: 'Errore salvataggio dati' });
    }
});

// Route per eliminare una multa specifica
app.delete('/api/fines/:memberId/:fineIndex', requireAuth, async (req, res) => {
    try {
        const { memberId, fineIndex } = req.params;
        const data = await storage.readData();
        
        // Trova il membro
        const member = data.members.find(m => m.id === memberId);
        if (!member) {
            return res.status(404).json({ error: 'Membro non trovato' });
        }
        
        // Verifica che l'indice della multa sia valido
        const fineIndexNum = parseInt(fineIndex);
        if (fineIndexNum < 0 || fineIndexNum >= member.fines.length) {
            return res.status(404).json({ error: 'Multa non trovata' });
        }
        
        // Rimuovi la multa
        const deletedFine = member.fines.splice(fineIndexNum, 1)[0];
        
        // Salva i dati aggiornati
        const dataToSave = {
            ...data,
            lastUpdated: new Date().toISOString()
        };
        
        const success = await storage.writeData(dataToSave);
        
        res.json({ 
            success: true,
            deletedFine,
            savedToGitHub: success && storage.isGitHubConfigured(),
            savedLocally: true
        });
    } catch (error) {
        console.error('Errore eliminazione multa:', error);
        res.status(500).json({ error: 'Errore eliminazione multa' });
    }
});

// Route per aggiornare i dati di un membro
app.put('/api/members/:memberId', requireAuth, async (req, res) => {
    try {
        const { memberId } = req.params;
        const { name, surname, nickname } = req.body;
        
        // Validazione campi richiesti
        if (!memberId || !name || !surname) {
            return res.status(400).json({ 
                success: false, 
                error: 'ID membro, nome e cognome sono richiesti' 
            });
        }
        
        // Validazione lunghezza input
        if (name.length > 50 || surname.length > 50 || (nickname && nickname.length > 50)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nome, cognome e soprannome devono essere di massimo 50 caratteri' 
            });
        }
        
        const data = await storage.readData();
        
        // Trova il membro
        const member = data.members.find(m => m.id === memberId);
        if (!member) {
            return res.status(404).json({ 
                success: false, 
                error: 'Membro non trovato' 
            });
        }
        
        // Controlla se esiste già un altro membro con questa combinazione nome/cognome
        const existingMember = data.members.find(m => 
            m.id !== memberId &&
            m.name.toLowerCase() === name.toLowerCase() && 
            m.surname.toLowerCase() === surname.toLowerCase()
        );
        
        if (existingMember) {
            return res.status(409).json({ 
                success: false, 
                error: 'Esiste già un membro con questo nome e cognome' 
            });
        }
        
        // Memorizza i vecchi valori per il log
        const oldDisplayName = member.nickname || `${member.name} ${member.surname}`;
        
        // Aggiorna i dati del membro
        member.name = name.trim();
        member.surname = surname.trim();
        member.nickname = nickname ? nickname.trim() : null;
        
        const newDisplayName = member.nickname || `${member.name} ${member.surname}`;
        
        // Salva i dati aggiornati
        const dataToSave = {
            ...data,
            lastUpdated: new Date().toISOString()
        };
        
        const success = await storage.writeData(dataToSave);
        
        console.log(`✅ Membro aggiornato: ${oldDisplayName} → ${newDisplayName}`);
        
        res.json({ 
            success: true, 
            message: 'Membro aggiornato con successo',
            member: {
                id: member.id,
                name: member.name,
                surname: member.surname,
                nickname: member.nickname,
                role: member.role
            },
            savedToGitHub: success && storage.isGitHubConfigured(),
            savedLocally: true
        });
        
    } catch (error) {
        console.error('Errore aggiornamento membro:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Errore interno del server' 
        });
    }
});

// Route per informazioni sullo storage (utile per debugging)
app.get('/api/storage-info', requireAuth, (req, res) => {
    res.json(storage.getStorageInfo());
});

// Redirect della root alla dashboard se autenticato, altrimenti al login
app.get('/', (req, res) => {
    if (req.session.authenticated) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.redirect('/login.html');
    }
});

// Gestione errori 404
app.use((req, res) => {
    res.status(404).send('Pagina non trovata');
});

// Avvio server
app.listen(PORT, () => {
    console.log(`🚀 Server avviato su http://localhost:${PORT}`);
    console.log(`🔐 Sistema di autenticazione attivo`);
    console.log(`📊 Dashboard disponibile dopo il login`);
});

// Gestione graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server in chiusura...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Server interrotto dall\'utente');
    process.exit(0);
});