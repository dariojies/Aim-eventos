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
const pgSession = require('connect-pg-simple')(session);

const SUPER_ADMINS = ['jmmarinborrego@gmail.com', 'dario.jimenez@cevhuertadelacruzesur.es'];

const app = express();
app.set('trust proxy', 1); // Trust Heroku proxy
const PORT = process.env.PORT || 8080;

const FRONTEND_URL = process.env.FRONTEND_URL || '';
app.use(cors({ origin: FRONTEND_URL || true, credentials: true }));
app.use(express.json());
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
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
    callbackURL: "/auth/google/callback",
    proxy: true
}, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value.toLowerCase();
    const domain = email.split('@')[1];
    const allowedDomain = (process.env.AUTH_DOMAIN || '').toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();

    if (domain === allowedDomain || email === adminEmail) {
        return done(null, profile);
    } else {
        return done(null, false, { message: 'Unauthorized domain' });
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: FRONTEND_URL || '/' }), (req, res) => {
    res.redirect(`${FRONTEND_URL || ''}/admin`);
});

app.get('/api/auth/status', async (req, res) => {
    if (req.isAuthenticated()) {
        const email = req.user.emails[0].value.toLowerCase();
        const isSuper = SUPER_ADMINS.includes(email);
        
        let assignedCourse = null;
        if (!isSuper) {
            const result = await pool.query('SELECT assigned_course FROM teacher_assignments WHERE email = $1', [email]);
            if (result.rows.length > 0) {
                assignedCourse = result.rows[0].assigned_course;
            }
        }

        res.json({ 
            authenticated: true, 
            user: req.user,
            role: isSuper ? 'superadmin' : 'teacher',
            assignedCourse
        });
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
const isAdmin = async (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const email = req.user.emails[0].value.toLowerCase();
    if (SUPER_ADMINS.includes(email)) {
        req.userRole = 'superadmin';
        return next();
    }

    const result = await pool.query('SELECT assigned_course FROM teacher_assignments WHERE email = $1', [email]);
    if (result.rows.length > 0) {
        req.userRole = 'teacher';
        req.assignedCourse = result.rows[0].assigned_course;
        return next();
    }

    res.status(403).json({ error: 'Forbidden: No assignment found' });
};

// Public Routes
app.post('/api/register', async (req, res) => {
    const { type, course, full_name, total_participants, ampa_members, wants_shirts, shirts, observations, email, phone } = req.body;
    try {
        const query = `
            INSERT INTO race_registrations (
                type, course, full_name, total_participants, ampa_members, wants_shirts,
                shirt_4y, shirt_8y, shirt_12y, shirt_16y, shirt_s, shirt_m, shirt_l, shirt_xl, shirt_xxl, 
                observations, external_email, external_phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`;

        const values = [
            type, course || null, full_name, total_participants || 1, ampa_members || 0, wants_shirts || false,
            shirts['4y'] || 0, shirts['8y'] || 0, shirts['12y'] || 0, shirts['16y'] || 0,
            shirts['s'] || 0, shirts['m'] || 0, shirts['l'] || 0, shirts['xl'] || 0, shirts['xxl'] || 0,
            observations || null, email || null, phone || null
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
        let query = 'SELECT * FROM race_registrations';
        let values = [];

        if (req.userRole === 'teacher') {
            query += ' WHERE course = $1';
            values.push(req.assignedCourse);
        }

        query += ' ORDER BY registration_date DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

app.post('/api/admin/generate-dorsales', isAdmin, async (req, res) => {
    try {
        // Find current max dorsal to continue from there
        const maxRes = await pool.query('SELECT MAX(dorsal_end) as max_dorsal FROM race_registrations');
        let currentDorsal = (maxRes.rows[0].max_dorsal || 0) + 1;

        // Get only paid registrations that DON'T have a dorsal yet
        const result = await pool.query('SELECT * FROM race_registrations WHERE is_paid = true AND dorsal_start IS NULL');
        const newRegistrations = result.rows;

        if (newRegistrations.length === 0) {
            return res.json({ success: true, count: 0, message: 'No new paid registrations to process' });
        }

        // Sort ONLY the new registrations (Alumnos -> Professors -> Externos)
        newRegistrations.sort((a, b) => {
            const typeA = a.type === 'profesor' ? 'Profesores' : (a.type === 'externo' ? 'Externos' : a.course);
            const typeB = b.type === 'profesor' ? 'Profesores' : (b.type === 'externo' ? 'Externos' : b.course);

            const indexA = COURSE_ORDER.indexOf(typeA);
            const indexB = COURSE_ORDER.indexOf(typeB);

            if (indexA !== indexB) return indexA - indexB;
            return a.full_name.localeCompare(b.full_name);
        });

        for (const reg of newRegistrations) {
            const start = currentDorsal;
            const end = currentDorsal + reg.total_participants - 1;
            await pool.query('UPDATE race_registrations SET dorsal_start = $1, dorsal_end = $2 WHERE id = $3', [start, end, reg.id]);
            currentDorsal = end + 1;
        }

        res.json({ success: true, count: newRegistrations.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate dorsales' });
    }
});

app.post('/api/admin/reset-dorsales', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
    try {
        await pool.query('UPDATE race_registrations SET dorsal_start = NULL, dorsal_end = NULL');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reset dorsales' });
    }
});

app.post('/api/admin/registrations/:id/toggle-paid', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Teachers can only toggle paid for their assigned course
        if (req.userRole === 'teacher') {
            const check = await pool.query('SELECT course FROM race_registrations WHERE id = $1', [id]);
            if (check.rows.length === 0 || check.rows[0].course !== req.assignedCourse) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }
        await pool.query('UPDATE race_registrations SET is_paid = NOT is_paid WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

app.delete('/api/admin/registrations/:id', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
    try {
        await pool.query('DELETE FROM race_registrations WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete registration' });
    }
});

// Assignment routes (Super Admin Only)
app.get('/api/admin/assignments', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const result = await pool.query('SELECT * FROM teacher_assignments ORDER BY email ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

app.post('/api/admin/assignments', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });
    const { email, course } = req.body;
    try {
        await pool.query(
            'INSERT INTO teacher_assignments (email, assigned_course) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET assigned_course = EXCLUDED.assigned_course',
            [email.toLowerCase(), course]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save assignment' });
    }
});

app.delete('/api/admin/assignments/:email', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        await pool.query('DELETE FROM teacher_assignments WHERE email = $1', [req.params.email.toLowerCase()]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete assignment' });
    }
});

// Economic Management Routes
app.get('/api/admin/economic-records', isAdmin, async (req, res) => {
    try {
        let query = 'SELECT * FROM economic_records';
        let values = [];
        if (req.userRole === 'teacher') {
            query += ' WHERE course = $1';
            values.push(req.assignedCourse);
        }
        query += ' ORDER BY payment_date DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch economic records' });
    }
});

app.post('/api/admin/economic-records', isAdmin, async (req, res) => {
    const { amount, date, observations } = req.body;
    const course = req.userRole === 'teacher' ? req.assignedCourse : req.body.course;
    
    if (!course) return res.status(400).json({ error: 'Course is required' });

    try {
        await pool.query(
            'INSERT INTO economic_records (course, amount, payment_date, observations) VALUES ($1, $2, $3, $4)',
            [course, amount, date, observations]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save economic record' });
    }
});

app.delete('/api/admin/economic-records/:id', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        await pool.query('DELETE FROM economic_records WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete record' });
    }
});
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    res.sendFile(indexPath);
});

console.log(`Attempting to listen on port ${PORT}...`);
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
