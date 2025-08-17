require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const GitHubStorage = require('./github-storage');

const app = express();
const PORT = process.env.PORT || 3002;

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

// Configurazione sessioni con FileStore (risolve problemi MemoryStore su Render)
app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions'),
        encrypt: true,
        secret: process.env.SESSION_SECRET || 'fallback-secret-key',
        ttl: 86400 // 24 ore in secondi
    }),
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
app.get('/api/data', async (req, res) => {
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
app.post('/api/data', async (req, res) => {
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

// Route per informazioni sullo storage (utile per debugging)
app.get('/api/storage-info', (req, res) => {
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