require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

// Configurazione middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurazione sessioni
app.use(session({
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
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// Middleware per servire file statici solo se autenticato
app.use((req, res, next) => {
    // Permetti accesso a login.html e risorse di login senza autenticazione
    if (req.path === '/login.html' || req.path === '/login' || req.path.startsWith('/login-assets/')) {
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

// Route per l'API dei dati (mantiene compatibilità con il frontend esistente)
app.get('/api/data', (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data.json');
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ members: [], categories: {}, activities: [] });
        }
    } catch (error) {
        console.error('Errore lettura dati:', error);
        res.status(500).json({ error: 'Errore lettura dati' });
    }
});

// Route per salvare i dati
app.post('/api/data', (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data.json');
        fs.writeFileSync(dataPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Errore salvataggio dati:', error);
        res.status(500).json({ error: 'Errore salvataggio dati' });
    }
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