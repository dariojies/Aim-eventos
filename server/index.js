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

// Organization Detection Middleware
const orgMiddleware = async (req, res, next) => {
    const host = req.headers.host || '';
    // Public Portal Domain (Allows any student to choose an event)
    if (
        host.includes('eventos.aimeducation.es') || 
        host.includes('localhost') || 
        host.includes('aim-eventos-7461019f1009.herokuapp.com')
    ) {
        req.isGlobal = true;
        return next();
    }

    // Check if it's a specific organization subdomain
    try {
        const result = await pool.query('SELECT * FROM race_organizations');
        const org = result.rows.find(o => host.includes(o.subdomain));
        if (org) {
            req.org = org;
            req.isGlobal = false;
        }
    } catch (err) {
        console.error('Org detection failed:', err);
    }
    next();
};

const app = express();
app.set('trust proxy', 1); // Trust Heroku proxy
const PORT = process.env.PORT || 8080;

// Dynamic CORS configuration to support multiple subdomains
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const ENV_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

const WHITESPACE_REGEX = /\s+/;
const ALLOWED_ORIGINS = [
    FRONTEND_URL,
    'https://eventos.huertadelacruz.escuelavicencianaesur.es',
    'https://eventos.aimeducation.es',
    'https://aim-eventos-7461019f1009.herokuapp.com',
    'http://localhost:5173',
    ...ENV_ALLOWED_ORIGINS
].filter(Boolean);

app.use(cors({ 
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.toLowerCase() === allowed.toLowerCase());
        
        if (isAllowed || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    }, 
    credentials: true 
}));
app.use(express.json());
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'race_sessions'
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
app.use(orgMiddleware);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));



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
    proxy: true,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value.toLowerCase();
    const domain = email.split('@')[1];
    
    // 1. Always allow SuperAdmins
    if (SUPER_ADMINS.includes(email)) {
        return done(null, profile);
    }

    // 2. Explicit Staff Bypass (If explicitly added to any event staff, allow login)
    try {
        // Use LOWER() for case-insensitive matching against the database
        const staffCheck = await pool.query('SELECT 1 FROM race_staff WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        if (staffCheck.rows.length > 0) {
            return done(null, profile);
        }
    } catch (err) {
        console.error('Passport auth staff check error:', err);
    }

    // 3. AimEducation Context (Global)
    if (req.isGlobal) {
        const allowedDomains = ['aimeducation.es', 'allegro.in-ma.es'];
        if (allowedDomains.includes(domain)) {
            return done(null, profile);
        }
        console.warn(`Passport: Global Login rejected for domain ${domain} (email: ${email})`);
        return done(null, false, { message: 'Dominio no permitido para el panel global' });
    }

    // 4. Organization Context (Generic Domain fallback)
    const allowedDomain = (process.env.AUTH_DOMAIN || 'cevhuertadelacruzesur.es').toLowerCase();
    const secondaryAllowedDomain = 'escuelavicencianaesur.es';
    
    if (domain === allowedDomain || domain === secondaryAllowedDomain || domain.endsWith('.escuelavicencianaesur.es')) {
        return done(null, profile);
    }

    console.warn(`Passport: Org Login rejected for domain ${domain} (email: ${email}). Expected: ${allowedDomain} or ${secondaryAllowedDomain}`);
    return done(null, false, { message: 'Dominio o usuario no autorizado para esta organización' });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account' 
}));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    // Redirect to the same host they logged in from
    res.redirect(`${protocol}://${host}/`);
});

app.get('/api/auth/status', async (req, res) => {
    if (req.isAuthenticated()) {
        const email = req.user.emails[0].value.toLowerCase();
        const { eventId } = req.query; // Optional event context
        
        // 1. SuperAdmin (Global)
        if (SUPER_ADMINS.includes(email)) {
            return res.json({ authenticated: true, user: req.user, role: 'superadmin' });
        }

        if (!eventId) {
            return res.json({ authenticated: true, user: req.user, role: 'authorized_user' });
        }

        // 2. Event-specific roles
        try {
            const staffRes = await pool.query(
                `SELECT r.role, r.assigned_course 
                 FROM race_staff r
                 JOIN race_events e ON r.event_id = e.id
                 WHERE (e.slug = $1 OR e.id::text = $1) AND r.email = $2`,
                [eventId, email]
            );

            if (staffRes.rows.length > 0) {
                return res.json({ 
                    authenticated: true, 
                    user: req.user, 
                    role: staffRes.rows[0].role,
                    assignedCourse: staffRes.rows[0].assigned_course
                });
            }
        } catch (err) {
            console.error('API /auth/status - DB Error:', err.message);
        }

        res.json({ authenticated: true, user: req.user, role: 'unauthorized' });
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
    const eventId = req.headers['x-event-id'] || req.query.eventId;

    // Check SuperAdmin (Code)
    if (SUPER_ADMINS.includes(email)) {
        req.userRole = 'superadmin';
        req.eventId = eventId; // Fix: Attach event ID for SuperAdmin requests
        return next();
    }

    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    // Check Staff (DB) - Consolidated Table
    try {
        const staffCheck = await pool.query(
            `SELECT r.* FROM race_staff r
             JOIN race_events e ON r.event_id = e.id
             WHERE (e.slug = $1 OR e.id::text = $1) AND r.email = $2`, 
            [eventId, email]
        );
        if (staffCheck.rows.length > 0) {
            req.userRole = staffCheck.rows[0].role;
            req.assignedCourse = staffCheck.rows[0].assigned_course;
            req.eventId = staffCheck.rows[0].event_id; // Inject real UUID
            return next();
        }
    } catch (err) {
        console.error('Middleware isAdmin - DB Error:', err.message);
    }

    res.status(403).json({ error: 'Forbidden: No assignment found for this event' });
};

// Organization & Event Routes
app.get('/api/organizations', async (req, res) => {
    const email = req.isAuthenticated() ? req.user.emails[0].value.toLowerCase() : '';
    if (!SUPER_ADMINS.includes(email)) return res.status(403).json({ error: 'SuperAdmin only' });
    try {
        const result = await pool.query('SELECT * FROM race_organizations ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/organizations/current', (req, res) => {
    res.json(req.org || { name: 'AIM Education', isGlobal: true });
});

app.get('/api/events', async (req, res) => {
    try {
        let query = 'SELECT e.*, o.name as org_name FROM race_events e JOIN race_organizations o ON e.org_id = o.id';
        let values = [];
        if (req.org) {
            query += ' WHERE org_id = $1';
            values.push(req.org.id);
        }
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

app.get('/api/events/:slug', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM race_events WHERE slug = $1', [req.params.slug]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/events', async (req, res) => {
    const email = req.isAuthenticated() ? req.user.emails[0].value.toLowerCase() : '';
    if (!SUPER_ADMINS.includes(email)) return res.status(403).json({ error: 'SuperAdmin only' });

    const { org_id, name, slug, config } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO race_events (org_id, name, slug, config) VALUES ($1, $2, $3, $4) RETURNING *',
            [org_id, name, slug, config || {}]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.put('/api/admin/event-config', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins or superadmins can update configuration' });
    }
    const { config } = req.body;
    try {
        await pool.query('UPDATE race_events SET config = $1 WHERE id = $2', [config, req.eventId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update config' });
    }
});

// Public Routes
app.post('/api/register', async (req, res) => {
    const { event_id, type, course, full_name, total_participants, ampa_members, wants_shirts, shirts, observations, email, phone } = req.body;
    if (!event_id) return res.status(400).json({ error: 'Event ID required' });
    try {
        const query = `
            INSERT INTO race_registrations (
                event_id, type, course, full_name, total_participants, ampa_members, wants_shirts,
                shirt_4y, shirt_8y, shirt_12y, shirt_16y, shirt_s, shirt_m, shirt_l, shirt_xl, shirt_xxl, 
                observations, external_email, external_phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`;

        const values = [
            event_id, type, course || null, full_name, total_participants || 1, ampa_members || 0, wants_shirts || false,
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
        let query = 'SELECT * FROM race_registrations WHERE event_id = $1';
        let values = [req.eventId];

        if (req.userRole === 'teacher') {
            query += ' AND course = $2';
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
        const maxRes = await pool.query('SELECT MAX(dorsal_end) as max_dorsal FROM race_registrations WHERE event_id = $1', [req.eventId]);
        let currentDorsal = (maxRes.rows[0].max_dorsal || 0) + 1;

        // Get only paid registrations that DON'T have a dorsal yet
        const result = await pool.query('SELECT * FROM race_registrations WHERE event_id = $1 AND is_paid = true AND dorsal_start IS NULL', [req.eventId]);
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
        await pool.query('UPDATE race_registrations SET dorsal_start = NULL, dorsal_end = NULL WHERE event_id = $1', [req.eventId]);
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

app.put('/api/admin/registrations/:id', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admins only' });
    }
    const { id } = req.params;
    const { course, shirts } = req.body;
    try {
        if (course !== undefined) {
            await pool.query('UPDATE race_registrations SET course = $1 WHERE id = $2', [course, id]);
        }
        
        if (shirts) {
            const hasShirts = Object.values(shirts).some(v => (v as number) > 0);
            await pool.query(`UPDATE race_registrations SET 
                shirt_4y = $1, shirt_8y = $2, shirt_12y = $3, shirt_16y = $4,
                shirt_s = $5, shirt_m = $6, shirt_l = $7, shirt_xl = $8, shirt_xxl = $9,
                wants_shirts = $10
                WHERE id = $11`, 
                [shirts['4y'], shirts['8y'], shirts['12y'], shirts['16y'], 
                 shirts.s, shirts.m, shirts.l, shirts.xl, shirts.xxl, hasShirts, id]);
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update registration' });
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

// Staff management (Admin/SuperAdmin Only)
app.get('/api/admin/staff', isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM race_staff WHERE event_id = $1 ORDER BY email ASC', [req.eventId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
});

app.post('/api/admin/staff', isAdmin, async (req, res) => {
    const { email, role, course } = req.body;
    try {
        await pool.query(
            'INSERT INTO race_staff (event_id, email, role, assigned_course) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, email) DO UPDATE SET role = EXCLUDED.role, assigned_course = EXCLUDED.assigned_course',
            [req.eventId, email.toLowerCase(), role, course || null]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.delete('/api/admin/staff/:email', isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM race_staff WHERE event_id = $1 AND email = $2', [req.eventId, req.params.email.toLowerCase()]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.put('/api/admin/event-config', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    try {
        const { config } = req.body;
        await pool.query('UPDATE race_events SET config = $1 WHERE id = $2', [config, req.eventId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

// Legacy routes removed (consolidated in staff routes above)

// Economic Management Routes
app.get('/api/admin/economic-records', isAdmin, async (req, res) => {
    try {
        let query = 'SELECT * FROM race_economic_records WHERE event_id = $1';
        let values = [req.eventId];
        if (req.userRole === 'teacher') {
            query += ' AND course = $2';
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
            'INSERT INTO race_economic_records (event_id, course, amount, payment_date, observations) VALUES ($1, $2, $3, $4, $5)',
            [req.eventId, course, amount, date, observations]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save economic record' });
    }
});

app.delete('/api/admin/economic-records/:id', isAdmin, async (req, res) => {
    if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        await pool.query('DELETE FROM race_economic_records WHERE id = $1', [req.params.id]);
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

// Start server after DB initialization
const startServer = async () => {
    try {
        await initDB();
        console.log('Database initialized. Starting server...');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
