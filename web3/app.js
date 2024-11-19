const express = require('express');
const session = require('express-session');

const path = require('path');
const app = express();

const config = require('./config');

// Middleware to parse URL-encoded bodies and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure session
app.use(session({
    secret: config.sessionSecret, // Ensure this is a strong, unique secret
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 60 * 60 * 1000 // 1 hour
    }
}));

// Middleware to make session available in all EJS templates
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const authRoutes = require('./routes/auth');
const pubkeysRoutes = require('./routes/pubkeys');
const fundingRoutes = require('./routes/funding');

// Use routes
app.use('/', authRoutes);
app.use('/', pubkeysRoutes);
app.use('/', fundingRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { title: 'Error', errorMessage: 'Something went wrong!' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Multisig dApp server running at http://localhost:${PORT}`);
});
