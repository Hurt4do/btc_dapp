// Filename: app.js

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session'); // Import express-session
const path = require('path');
const config = require('./config');

const app = express();
const port = 3000; // As per your requirement

// Configure body-parser to process form data
app.use(bodyParser.urlencoded({ extended: true }));

// Configure express-session middleware
app.use(session({
    secret: 'your_strong_secret_key', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: false
}));

// Middleware to serve static files (CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const authRoutes = require('./routes/auth');
const pubkeysRoutes = require('./routes/pubkeys'); // Updated to pubkeys.js
const fundingRoutes = require('./routes/funding');

// Use routes
app.use('/', authRoutes);
app.use('/', pubkeysRoutes);
app.use('/', fundingRoutes);

// Start the Server
app.listen(port, () => {
    console.log(`Multisig dApp server running at http://localhost:${port}`);
});
