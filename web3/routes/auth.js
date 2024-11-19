// Filename: routes/auth.js

const express = require('express');
const router = express.Router();
const { genericPassword, users } = require('../config');

// Import helper functions
const { loadPubKeys } = require('../utils/pubKeys');
const { loadPubkeyConfirmations } = require('../utils/pubkeyConfirmations');
const { renderPubkeys } = require('../utils/render');

// Serve the login page
router.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Multisig Login</title>
                <link rel="stylesheet" href="/styles.css">
            </head>
            <body>
                <h1>Login to Access Public Keys</h1>
                <form action="/pubkeys" method="POST">
                    <select name="username" required>
                        ${users.map(user => `<option value="${user}">${user}</option>`).join('')}
                    </select><br><br>
                    <input type="password" name="password" placeholder="Enter password" required>
                    <button type="submit">Login</button>
                </form>
            </body>
        </html>
    `);
});

// Handle login request
router.post('/pubkeys', async (req, res) => {
    const { password, username } = req.body;
    console.log(`Attempting login for user: ${username} with password: ${password}`);
    if (password === genericPassword && users.includes(username)) {
        try {
            const pubKeys = await loadPubKeys();
            const pubkeyConfirmations = await loadPubkeyConfirmations();
            const unconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
            const confirmationsLeft = unconfirmedUsers.length;

            console.log(`Pubkeys accessed by ${username}`);
            console.log(`Pubkey Confirmations: ${pubkeyConfirmations}`);
            console.log(`Confirmations left: ${confirmationsLeft}`);

            // Save user info in session
            req.session.user = {
                username: username,
                pubKeys: pubKeys,
                pubkeyConfirmations: pubkeyConfirmations
            };

            res.redirect('/pubkeys'); // Redirect to GET /pubkeys
        } catch (error) {
            console.error(`Error loading pubkeys data: ${error}`);
            res.send(`<h1>Error Loading Pubkeys</h1><p>${error.message}</p><a href="/">Go back</a>`);
        }
    } else {
        res.send(`<h1>Incorrect Username or Password</h1><a href="/">Go back</a>`);
    }
});

// Handle logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send(`<h1>Error Logging Out</h1><p>${err.message}</p><a href="/pubkeys">Go back</a>`);
        }
        res.redirect('/');
    });
});

module.exports = router;
