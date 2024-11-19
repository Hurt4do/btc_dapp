// Filename: routes/pubkeys.js

const express = require('express');
const router = express.Router();
const path = require('path');

const { users, dataFolder } = require('../config');

// Import helper functions
const { loadPubKeys, savePubKeys, validatePubKey } = require('../utils/pubKeys');
const { loadPubkeyConfirmations, savePubkeyConfirmation } = require('../utils/pubkeyConfirmations');
const { renderPubkeys } = require('../utils/render');

const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Handle GET /pubkeys
router.get('/pubkeys', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const { username } = req.session.user;
    try {
        const pubKeys = await loadPubKeys();
        const pubkeyConfirmations = await loadPubkeyConfirmations();
        const unconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
        const confirmationsLeft = unconfirmedUsers.length;

        res.send(renderPubkeys(pubKeys, username, confirmationsLeft, unconfirmedUsers, pubkeyConfirmations));
    } catch (error) {
        console.error(`Error loading pubkeys data: ${error}`);
        res.send(`<h1>Error Loading Pubkeys</h1><p>${error.message}</p><a href="/">Go back</a>`);
    }
});

// Handle updating public keys
router.post('/update', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const pubKeys = await loadPubKeys();
    const username = req.body.update_username; // Unique field
    const userIndex = users.indexOf(username);
    const pubkeyConfirmations = await loadPubkeyConfirmations();

    console.log(`Update requested by ${username}`);

    if (userIndex !== -1) {
        const newPubKey = req.body[`pubkey${userIndex + 1}`] || "";

        // Validate the new public key
        if (!validatePubKey(newPubKey)) {
            res.send(`
                <h1>Invalid Public Key Format</h1>
                <p>Public key must start with "tpub" and have a valid length.</p>
                <a href="/pubkeys">Go back</a>
            `);
            return;
        }

        // Save the valid public key
        pubKeys[userIndex] = newPubKey;
        await savePubKeys(pubKeys);

        // Reset confirmation for this user since the pubkey has changed
        pubkeyConfirmations[userIndex] = false;
        await savePubkeyConfirmation(userIndex, false);
    }

    const unconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
    const confirmationsLeft = unconfirmedUsers.length;

    console.log(`Public key updated by ${username}`);
    console.log(`Pubkey Confirmations: ${pubkeyConfirmations}`);
    console.log(`Confirmations left: ${confirmationsLeft}`);

    res.redirect('/pubkeys');
});

// Handle confirmation of multisig wallet creation
router.post('/confirm', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const username = req.body.confirm_username; // Unique field
    const userIndex = users.indexOf(username);
    let pubKeys, pubkeyConfirmations;

    try {
        pubKeys = await loadPubKeys();
        pubkeyConfirmations = await loadPubkeyConfirmations();
    } catch (error) {
        console.error(`Error loading data: ${error}`);
        res.send(`<h1>Error Loading Pubkeys</h1><p>${error.message}</p><a href="/">Go back</a>`);
        return;
    }

    console.log(`Confirmation requested by ${username}`);

    if (userIndex !== -1) {
        pubkeyConfirmations[userIndex] = true;
        await savePubkeyConfirmation(userIndex, true);
    }

    // Reload pubkey confirmations after updating
    try {
        pubkeyConfirmations = await loadPubkeyConfirmations();
    } catch (error) {
        console.error(`Error reloading pubkey confirmations: ${error}`);
    }

    const unconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
    const confirmationsLeft = unconfirmedUsers.length;

    console.log(`${username} has confirmed.`);
    console.log(`Pubkey Confirmations: ${pubkeyConfirmations}`);
    console.log(`Confirmations left: ${confirmationsLeft}`);

    // Check if all participants have confirmed
    if (pubkeyConfirmations.every((confirmed, index) => confirmed && pubKeys[index] !== "")) {
        try {
            const { stdout, stderr } = await execPromise('./create_multisig_wallet.sh');
            console.log(`Script output: ${stdout}`);
            if (stderr) {
                console.error(`Script stderr: ${stderr}`);
            }

            // Read the multisig_address.txt file
            const multisigAddressPath = path.join(dataFolder, 'multisig_address.txt');
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
            req.session.user.pubkeyConfirmations = pubkeyConfirmations;

            res.send(renderPubkeys(pubKeys, username, null, null, pubkeyConfirmations, `<h2>🎉 Multisig wallet successfully created!</h2><p>🔗 Multisig Address: ${multisigAddress}</p>`));
        } catch (error) {
            console.error(`Error executing script: ${error}`);
            res.send(`<h1>Error Creating Multisig Wallet</h1><p>${error.message}</p><a href="/">Go back</a>`);
        }
    } else {
        res.redirect('/pubkeys');
    }
});

module.exports = router;
