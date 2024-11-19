// Filename: routes/auth.js

const express = require('express');
const router = express.Router();
const config = require('../config');
const fs = require('fs').promises;

// Function to load users from users.json
async function loadUsers() {
    try {
        const usersData = await fs.readFile(config.usersFile, 'utf-8');
        return JSON.parse(usersData);
    } catch (error) {
        console.error(`Error reading users file: ${error}`);
        return [];
    }
}

// Serve Login Page
router.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/pubkeys'); // Redirect to pubkeys if already logged in
    } else {
        res.render('login', { title: 'Login', message: null });
    }
});

// Handle Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Read users from users.json
        const users = await loadUsers();

        // Find user with matching username and password
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            // Successful login
            req.session.user = {
                username: user.username
                // You can add more user-related data here if needed
            };
            res.redirect('/pubkeys');
        } else {
            // Failed login
            res.render('login', { title: 'Login', message: 'Incorrect Username or Password' });
        }
    } catch (error) {
        console.error(`Error during login: ${error}`);
        res.render('login', { title: 'Login', message: 'An error occurred. Please try again later.' });
    }
});

// Handle Logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.render('error', { title: 'Error', errorMessage: err.message });
        }
        res.redirect('/');
    });
});

module.exports = router;
