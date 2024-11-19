// Filename: app.js

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const session = require('express-session'); // Import express-session
const app = express();
const port = 3000; // Changed to 3000 as per your requirement

const execPromise = util.promisify(exec);

// ------------------------------
// Configuration
// ------------------------------

// Generic password for all users (Consider enhancing security in production)
const genericPassword = "1234";
const users = [
    "Participant 1",
    "Participant 2",
    "Participant 3"
];

// Configure body-parser to process form data
app.use(bodyParser.urlencoded({ extended: true }));

// Configure express-session middleware
app.use(session({
    secret: 'your_strong_secret_key', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: false
}));

// Middleware to serve static files (CSS)
app.use(express.static('public'));

// ------------------------------
// Helper Functions
// ------------------------------

// Pub Key Management
async function loadPubKeys() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(__dirname, `tpub${index + 1}.txt`);
        try {
            const key = await fs.readFile(filePath, 'utf-8');
            return key.trim();
        } catch {
            return "";
        }
    }));
}

async function savePubKeys(pubKeys) {
    try {
        await Promise.all(pubKeys.map(async (key, index) => {
            const filePath = path.join(__dirname, `tpub${index + 1}.txt`);
            await fs.writeFile(filePath, key);
            console.log(`Saved public key for user ${index + 1}`);
        }));
    } catch (error) {
        console.error(`Error saving public keys: ${error}`);
    }
}

function validatePubKey(pubKey) {
    return pubKey.startsWith("tpub") && pubKey.length >= 111 && pubKey.length <= 113;
}

async function loadConfirmations() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(__dirname, `confirm${index + 1}.txt`);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const status = data.trim() === 'true';
            console.log(`Loaded confirmation for user ${index + 1}: ${status}`);
            return status;
        } catch {
            await fs.writeFile(filePath, 'false');
            console.log(`Confirmation file for user ${index + 1} did not exist, created with false`);
            return false;
        }
    }));
}

async function saveConfirmation(userIndex, status) {
    const filePath = path.join(__dirname, `confirm${userIndex + 1}.txt`);
    try {
        await fs.writeFile(filePath, status ? 'true' : 'false');
        console.log(`Saved confirmation for user ${userIndex + 1}: ${status}`);
    } catch (error) {
        console.error(`Error saving confirmation for user ${userIndex + 1}: ${error}`);
    }
}

// Funding Txid Management
async function loadTxids() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(__dirname, `txid${index + 1}.txt`);
        try {
            const txid = await fs.readFile(filePath, 'utf-8');
            return txid.trim();
        } catch {
            // If txid file doesn't exist, create it with an empty string
            await fs.writeFile(filePath, '');
            console.log(`Created txid file for user ${index + 1}`);
            return "";
        }
    }));
}

async function saveTxids(txids) {
    try {
        await Promise.all(txids.map(async (txid, index) => {
            const filePath = path.join(__dirname, `txid${index + 1}.txt`);
            await fs.writeFile(filePath, txid);
            console.log(`Saved txid for user ${index + 1}`);
        }));
    } catch (error) {
        console.error(`Error saving txids: ${error}`);
    }
}

async function loadFundingConfirmations() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(__dirname, `confirm_fund${index + 1}.txt`);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const status = data.trim() === 'true';
            console.log(`Loaded funding confirmation for user ${index + 1}: ${status}`);
            return status;
        } catch {
            await fs.writeFile(filePath, 'false');
            console.log(`Funding confirmation file for user ${index + 1} did not exist, created with false`);
            return false;
        }
    }));
}

async function saveFundingConfirmation(userIndex, status) {
    const filePath = path.join(__dirname, `confirm_fund${userIndex + 1}.txt`);
    try {
        await fs.writeFile(filePath, status ? 'true' : 'false');
        console.log(`Saved funding confirmation for user ${userIndex + 1}: ${status}`);
    } catch (error) {
        console.error(`Error saving funding confirmation for user ${userIndex + 1}: ${error}`);
    }
}

// ------------------------------
// Routes
// ------------------------------

// Serve the login page
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Multisig Login</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        text-align: center;
                        padding-top: 50px;
                    }
                </style>
            </head>
            <body>
                <h1>Login to Access Public Keys</h1>
                <form action="/dashboard" method="POST">
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
app.post('/dashboard', async (req, res) => {
    const { password, username } = req.body;
    console.log(`Attempting login for user: ${username} with password: ${password}`);
    if (password === genericPassword && users.includes(username)) {
        try {
            const pubKeys = await loadPubKeys();
            const confirmations = await loadConfirmations();
            const unconfirmedUsers = users.filter((_, index) => !confirmations[index]);
            const confirmationsLeft = unconfirmedUsers.length;

            console.log(`Dashboard accessed by ${username}`);
            console.log(`Confirmations: ${confirmations}`);
            console.log(`Confirmations left: ${confirmationsLeft}`);

            // Save user info in session
            req.session.user = {
                username: username,
                pubKeys: pubKeys,
                confirmations: confirmations
            };

            res.redirect('/dashboard'); // Redirect to GET /dashboard
        } catch (error) {
            console.error(`Error loading dashboard data: ${error}`);
            res.send(`<h1>Error Loading Dashboard</h1><p>${error.message}</p><a href="/">Go back</a>`);
        }
    } else {
        res.send(`<h1>Incorrect Username or Password</h1><a href="/">Go back</a>`);
    }
});

// GET /dashboard route to render dashboard
app.get('/dashboard', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const { username } = req.session.user;
    try {
        const pubKeys = await loadPubKeys();
        const confirmations = await loadConfirmations();
        const unconfirmedUsers = users.filter((_, index) => !confirmations[index]);
        const confirmationsLeft = unconfirmedUsers.length;

        res.send(renderDashboard(pubKeys, username, confirmationsLeft, unconfirmedUsers, confirmations));
    } catch (error) {
        console.error(`Error loading dashboard data: ${error}`);
        res.send(`<h1>Error Loading Dashboard</h1><p>${error.message}</p><a href="/">Go back</a>`);
    }
});

// Handle updating public keys
app.post('/update', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const pubKeys = await loadPubKeys();
    const username = req.body.update_username; // Changed to unique field
    const userIndex = users.indexOf(username);
    const confirmations = await loadConfirmations();

    console.log(`Update requested by ${username}`);

    if (userIndex !== -1) {
        const newPubKey = req.body[`pubkey${userIndex + 1}`] || "";

        // Validate the new public key
        if (!validatePubKey(newPubKey)) {
            res.send(`
                <h1>Invalid Public Key Format</h1>
                <p>Public key must start with "tpub" and have a valid length.</p>
                <a href="/dashboard">Go back</a>
            `);
            return;
        }

        // Save the valid public key
        pubKeys[userIndex] = newPubKey;
        await savePubKeys(pubKeys);

        // Reset confirmation for this user since the pubkey has changed
        confirmations[userIndex] = false;
        await saveConfirmation(userIndex, false);
    }

    const unconfirmedUsers = users.filter((_, index) => !confirmations[index]);
    const confirmationsLeft = unconfirmedUsers.length;

    console.log(`Public key updated by ${username}`);
    console.log(`Confirmations: ${confirmations}`);
    console.log(`Confirmations left: ${confirmationsLeft}`);

    res.redirect('/dashboard');
});

// Handle confirmation of multisig wallet creation
app.post('/confirm', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const username = req.body.confirm_username; // Changed to unique field
    const userIndex = users.indexOf(username);
    let pubKeys, confirmations;

    try {
        pubKeys = await loadPubKeys();
        confirmations = await loadConfirmations();
    } catch (error) {
        console.error(`Error loading data: ${error}`);
        res.send(`<h1>Error Loading Data</h1><p>${error.message}</p><a href="/">Go back</a>`);
        return;
    }

    console.log(`Confirmation requested by ${username}`);

    if (userIndex !== -1) {
        confirmations[userIndex] = true;
        await saveConfirmation(userIndex, true);
    }

    // Reload confirmations after updating
    try {
        confirmations = await loadConfirmations();
    } catch (error) {
        console.error(`Error reloading confirmations: ${error}`);
    }

    const unconfirmedUsers = users.filter((_, index) => !confirmations[index]);
    const confirmationsLeft = unconfirmedUsers.length;

    console.log(`${username} has confirmed.`);
    console.log(`Confirmations: ${confirmations}`);
    console.log(`Confirmations left: ${confirmationsLeft}`);

    // Check if all participants have confirmed
    if (confirmations.every((confirmed, index) => confirmed && pubKeys[index] !== "")) {
        try {
            const { stdout, stderr } = await execPromise('./create_multisig_wallet.sh');
            console.log(`Script output: ${stdout}`);
            if (stderr) {
                console.error(`Script stderr: ${stderr}`);
            }

            // Read the multisig_address.txt file
            const multisigAddressPath = path.join(__dirname, 'multisig_address.txt');
            let multisigAddress = '';
            try {
                multisigAddress = await fs.readFile(multisigAddressPath, 'utf-8');
                multisigAddress = multisigAddress.trim();
                console.log(`Multisig Address: ${multisigAddress}`);
            } catch (readError) {
                console.error(`Error reading multisig_address.txt: ${readError}`);
                multisigAddress = 'Unable to retrieve multisig address.';
            }

            // Update session with latest data
            req.session.user.pubKeys = pubKeys;
            req.session.user.confirmations = confirmations;

            res.send(renderDashboard(pubKeys, username, null, null, confirmations, `<h2>🎉 Multisig wallet successfully created!</h2><p>🔗 Multisig Address: ${multisigAddress}</p>`));
        } catch (error) {
            console.error(`Error executing script: ${error}`);
            res.send(`<h1>Error Creating Multisig Wallet</h1><p>${error.message}</p><a href="/">Go back</a>`);
        }
    } else {
        res.redirect('/dashboard');
    }
});

// ------------------------------
// Routes for Funding Confirmations
// ------------------------------

// Serve the funding confirmation page
app.get('/funding', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    // Read the multisig address
    const multisigAddressPath = path.join(__dirname, 'multisig_address.txt');
    let multisigAddress = '';
    try {
        multisigAddress = await fs.readFile(multisigAddressPath, 'utf-8');
        multisigAddress = multisigAddress.trim();
        console.log(`Multisig Address: ${multisigAddress}`);
    } catch (error) {
        console.error(`Error reading multisig_address.txt: ${error}`);
        multisigAddress = 'Unable to retrieve multisig address.';
    }

    // Load txids and funding confirmations
    const txids = await loadTxids();
    let fundingConfirmations = await loadFundingConfirmations();

    const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
    const fundingConfirmationsLeft = unconfirmedFunds.length;

    res.send(renderFundingDashboard(multisigAddress, txids, req.session.user.username, fundingConfirmations, fundingConfirmationsLeft));
});

// Handle updating txids
app.post('/funding/update', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const pubKeys = await loadPubKeys();
    const username = req.body.update_fund_username; // Unique field
    const userIndex = users.indexOf(username);
    let fundingConfirmations = await loadFundingConfirmations();

    console.log(`Funding txid update requested by ${username}`);

    if (userIndex !== -1) {
        const newTxid = req.body[`txid${userIndex + 1}`] || "";

        // Simple txid validation (exactly 64 hexadecimal characters)
        const txidRegex = /^[A-Fa-f0-9]{64}$/;
        if (!txidRegex.test(newTxid)) {
            res.send(`
                <h1>Invalid TxID Format</h1>
                <p>Transaction ID must be exactly 64 hexadecimal characters.</p>
                <a href="/funding">Go back</a>
            `);
            return;
        }

        // Save the txid
        const txids = await loadTxids();
        txids[userIndex] = newTxid;
        await saveTxids(txids);

        // Reset funding confirmation for this user since the txid has changed
        fundingConfirmations[userIndex] = false;
        await saveFundingConfirmation(userIndex, false);
    }

    // Load updated txids and confirmations
    const txids = await loadTxids();
    fundingConfirmations = await loadFundingConfirmations();

    const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
    const fundingConfirmationsLeft = unconfirmedFunds.length;

    console.log(`TxID updated by ${username}`);
    console.log(`Funding Confirmations: ${fundingConfirmations}`);
    console.log(`Funding Confirmations left: ${fundingConfirmationsLeft}`);

    // Read the multisig address
    const multisigAddressPath = path.join(__dirname, 'multisig_address.txt');
    let multisigAddress = '';
    try {
        multisigAddress = await fs.readFile(multisigAddressPath, 'utf-8');
        multisigAddress = multisigAddress.trim();
        console.log(`Multisig Address: ${multisigAddress}`);
    } catch (error) {
        console.error(`Error reading multisig_address.txt: ${error}`);
        multisigAddress = 'Unable to retrieve multisig address.';
    }

    res.send(renderFundingDashboard(multisigAddress, txids, username, fundingConfirmations, fundingConfirmationsLeft));
});

// Handle funding confirmation
app.post('/funding/confirm', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const username = req.body.confirm_fund_username; // Unique field
    const userIndex = users.indexOf(username);
    let txids, fundingConfirmations;

    try {
        txids = await loadTxids();
        fundingConfirmations = await loadFundingConfirmations();
    } catch (error) {
        console.error(`Error loading funding data: ${error}`);
        res.send(`<h1>Error Loading Data</h1><p>${error.message}</p><a href="/funding">Go back</a>`);
        return;
    }

    console.log(`Funding confirmation requested by ${username}`);

    if (userIndex !== -1) {
        fundingConfirmations[userIndex] = true;
        await saveFundingConfirmation(userIndex, true);
    }

    // Reload funding confirmations after updating
    try {
        fundingConfirmations = await loadFundingConfirmations();
    } catch (error) {
        console.error(`Error reloading funding confirmations: ${error}`);
    }

    const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
    const fundingConfirmationsLeft = unconfirmedFunds.length;

    console.log(`${username} has confirmed funding.`);
    console.log(`Funding Confirmations: ${fundingConfirmations}`);
    console.log(`Funding Confirmations left: ${fundingConfirmationsLeft}`);

    // Read the multisig address
    const multisigAddressPath = path.join(__dirname, 'multisig_address.txt');
    let multisigAddress = '';
    try {
        multisigAddress = await fs.readFile(multisigAddressPath, 'utf-8');
        multisigAddress = multisigAddress.trim();
        console.log(`Multisig Address: ${multisigAddress}`);
    } catch (error) {
        console.error(`Error reading multisig_address.txt: ${error}`);
        multisigAddress = 'Unable to retrieve multisig address.';
    }

    // Check if all funding confirmations are done
    if (fundingConfirmations.every((confirmed, index) => confirmed && txids[index] !== "")) {
        res.send(renderFundingDashboard(multisigAddress, txids, username, fundingConfirmations, null, `<h2>🎉 All funding transactions confirmed!</h2>`));
    } else {
        res.send(renderFundingDashboard(multisigAddress, txids, username, fundingConfirmations, fundingConfirmationsLeft));
    }
});

// ------------------------------
// Rendering Functions
// ------------------------------

// Render the pub key confirmation dashboard
function renderDashboard(pubKeys, username, confirmationsLeft = null, unconfirmedUsers = [], confirmations, message = '') {
    const userIndex = users.indexOf(username);
    const formInputs = pubKeys.map((key, index) => {
        const isConfirmed = confirmations[index];
        if (index === userIndex) {
            return `
                <div>
                    <label>${users[index]} Master Public Key:</label><br>
                    <!-- Update Public Key Form -->
                    <form action="/update" method="POST" style="display: inline;">
                        <input type="text" name="pubkey${index + 1}" value="${key}" style="width: 80%;" ${isConfirmed ? 'disabled' : ''}><br><br>
                        <input type="hidden" name="update_username" value="${username}">
                        <button type="submit" ${isConfirmed ? 'disabled' : ''}>Edit Public Key</button>
                    </form>
                    <!-- Confirm Multisig Creation Form -->
                    <form action="/confirm" method="POST" style="display: inline;">
                        <input type="hidden" name="confirm_username" value="${username}">
                        <button type="submit" ${isConfirmed ? 'disabled' : ''}>
                            ${isConfirmed ? '✔️ Confirmed' : 'Confirm Multisig Creation'}
                        </button>
                    </form>
                </div>
            `;
        } else {
            return `
                <div>
                    <label>${users[index]} Master Public Key:</label><br>
                    <input type="text" value="${key}" style="width: 80%;" readonly><br><br>
                    <button type="button" disabled>Edit Public Key</button>
                    <button type="button" disabled>${isConfirmed ? '✔️ Confirmed' : 'Awaiting Confirmation'}</button>
                </div>
            `;
        }
    }).join('');

    const confirmationsInfo = (confirmationsLeft !== null && confirmationsLeft > 0) ? `
        <h3>${confirmationsLeft} confirmation(s) left</h3>
        <p>Waiting for: ${unconfirmedUsers.join(', ')}</p>
    ` : '';

    return `
        <html>
            <head>
                <title>Multisig Dashboard</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        text-align: center;
                        padding-top: 20px;
                    }
                    input[type="text"] {
                        padding: 8px;
                        font-size: 1em;
                    }
                    button {
                        padding: 10px 20px;
                        font-size: 1em;
                        margin: 5px;
                    }
                    form {
                        display: inline-block;
                        margin: 5px;
                    }
                    .navigation {
                        margin-bottom: 20px;
                    }
                    .navigation a {
                        margin: 0 10px;
                        text-decoration: none;
                        color: #007BFF;
                    }
                </style>
            </head>
            <body>
                <h1>Welcome, ${username}</h1>

                <div class="navigation">
                    <a href="/dashboard">Pub Key Confirmation</a> |
                    <a href="/funding">Funding Confirmation</a>
                </div>
                
                ${confirmationsInfo}

                ${message}

                ${formInputs}
                <br>
                <a href="/logout">Logout</a>
            </body>
        </html>
    `;
}

// Render the funding confirmation dashboard
function renderFundingDashboard(multisigAddress, txids = null, username = null, fundingConfirmations = null, fundingConfirmationsLeft = null, message = '') {
    const formInputs = users.map((user, index) => {
        const txid = txids ? txids[index] : "";
        const isConfirmed = fundingConfirmations ? fundingConfirmations[index] : false;

        return `
            <div>
                <label>${user} Funding Transaction ID (TxID):</label><br>
                <!-- Update TxID Form -->
                <form action="/funding/update" method="POST" style="display: inline;">
                    <input type="text" name="txid${index + 1}" value="${txid}" style="width: 80%;" ${isConfirmed ? 'disabled' : ''}><br><br>
                    <input type="hidden" name="update_fund_username" value="${user}">
                    <button type="submit" ${isConfirmed ? 'disabled' : ''}>Edit TxID</button>
                </form>
                <!-- Confirm Funding Form -->
                <form action="/funding/confirm" method="POST" style="display: inline;">
                    <input type="hidden" name="confirm_fund_username" value="${user}">
                    <button type="submit" ${isConfirmed ? 'disabled' : ''}>
                        ${isConfirmed ? '✔️ Confirmed' : 'Confirm Funding'}
                    </button>
                </form>
            </div>
        `;
    }).join('');

    const confirmationsInfo = (fundingConfirmationsLeft !== null && fundingConfirmationsLeft > 0) ? `
        <h3>${fundingConfirmationsLeft} funding confirmation(s) left</h3>
        <p>Waiting for: ${users.filter((_, index) => !fundingConfirmations[index]).join(', ')}</p>
    ` : '';

    return `
        <html>
            <head>
                <title>Funding Confirmation</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        text-align: center;
                        padding-top: 20px;
                    }
                    input[type="text"] {
                        padding: 8px;
                        font-size: 1em;
                    }
                    button {
                        padding: 10px 20px;
                        font-size: 1em;
                        margin: 5px;
                    }
                    form {
                        display: inline-block;
                        margin: 5px;
                    }
                    .navigation {
                        margin-bottom: 20px;
                    }
                    .navigation a {
                        margin: 0 10px;
                        text-decoration: none;
                        color: #007BFF;
                    }
                    .multisig-address {
                        margin-bottom: 20px;
                        font-size: 1.2em;
                        color: #333;
                    }
                </style>
            </head>
            <body>
                <h1>Funding Confirmation</h1>

                <div class="navigation">
                    <a href="/dashboard">Pub Key Confirmation</a> |
                    <a href="/funding">Funding Confirmation</a>
                </div>

                <div class="multisig-address">
                    <strong>🔗 Multisig Address to Fund:</strong><br>
                    <p>${multisigAddress}</p>
                </div>
                
                ${confirmationsInfo}

                ${message}

                ${formInputs}
                <br>
                <a href="/logout">Logout</a>
            </body>
        </html>
    `;
}

// ------------------------------
// Logout Route (Optional Enhancement)
// ------------------------------
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send(`<h1>Error Logging Out</h1><p>${err.message}</p><a href="/dashboard">Go back</a>`);
        }
        res.redirect('/');
    });
});

// ------------------------------
// Start the Server
// ------------------------------

app.listen(port, () => {
    console.log(`Multisig dApp server running at http://localhost:${port}`);
});
