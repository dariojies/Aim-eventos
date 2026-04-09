console.log('--- STARTING SERVER ---');
require('dotenv').config();
console.log('Dotenv loaded');
const express = require('express');
const path = require('path');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

initDB();

// Course sorting order (Alumnos by course -> Profesores -> Externos)
const COURSE_ORDER = [
    '3 años A', '3 años B', '4 años A', '4 años B', '5 años A', '5 años B',
    '1º EPO A', '1º EPO B', '2º EPO A', '2º EPO B', '3º EPO A', '3º EPO B', '4º EPO A', '4º EPO B', '5º EPO A', '5º EPO B', '6º EPO A', '6º EPO B',
    '1º ESO A', '1º ESO B', '2º ESO A', '2º ESO B', '3º ESO A', '3º ESO B', '4º ESO A', '4º ESO B',
    'Profesores',
    'Externos'
];

// Passport Google Auth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
    callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    const domain = email.split('@')[1];

    if (domain === process.env.AUTH_DOMAIN || email === process.env.ADMIN_EMAIL) {
        return done(null, profile);
    } else {
        return done(null, false, { message: 'Unauthorized domain' });
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL }), (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/admin`);
});

app.get('/api/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

app.get('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.json({ success: true });
    });
});

// Admin Middleware
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// Public Routes
app.post('/api/register', async (req, res) => {
    const { type, course, full_name, total_participants, ampa_members, wants_shirts, shirts, observations } = req.body;
    try {
        const query = `
            INSERT INTO race_registrations (
                type, course, full_name, total_participants, ampa_members, wants_shirts,
                shirt_4y, shirt_8y, shirt_12y, shirt_16y, shirt_s, shirt_m, shirt_l, shirt_xl, shirt_xxl, 
                observations
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`;

        const values = [
            type, course || null, full_name, total_participants || 1, ampa_members || 0, wants_shirts || false,
            shirts['4y'] || 0, shirts['8y'] || 0, shirts['12y'] || 0, shirts['16y'] || 0,
            shirts['s'] || 0, shirts['m'] || 0, shirts['l'] || 0, shirts['xl'] || 0, shirts['xxl'] || 0,
            observations || null
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Admin Routes
app.get('/api/admin/registrations', isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM race_registrations ORDER BY registration_date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

app.post('/api/admin/generate-dorsales', isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM race_registrations');
        const registrations = result.rows;

        // Sort registrations (Alumnos -> Professors -> Externos)
        registrations.sort((a, b) => {
            const typeA = a.type === 'profesor' ? 'Profesores' : (a.type === 'externo' ? 'Externos' : a.course);
            const typeB = b.type === 'profesor' ? 'Profesores' : (b.type === 'externo' ? 'Externos' : b.course);

            const indexA = COURSE_ORDER.indexOf(typeA);
            const indexB = COURSE_ORDER.indexOf(typeB);

            if (indexA !== indexB) return indexA - indexB;
            return a.full_name.localeCompare(b.full_name);
        });

        let currentDorsal = 1;

        for (const reg of registrations) {
            const start = currentDorsal;
            const end = currentDorsal + reg.total_participants - 1;
            await pool.query('UPDATE race_registrations SET dorsal_start = $1, dorsal_end = $2 WHERE id = $3', [start, end, reg.id]);
            currentDorsal = end + 1;
        }

        res.json({ success: true, count: registrations.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate dorsales' });
    }
});

app.delete('/api/admin/registrations/:id', isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM race_registrations WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete registration' });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

console.log(`Attempting to listen on port ${PORT}...`);
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
