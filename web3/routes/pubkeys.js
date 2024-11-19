// Filename: routes/pubkeys.js

const express = require('express');
const router = express.Router();
const path = require('path');

const config = require('../config');

// Import helper functions
const { loadPubKeys, savePubKeys, validatePubKey } = require('../utils/pubKeys');
const { loadPubkeyConfirmations, savePubkeyConfirmation } = require('../utils/pubkeyConfirmations');

const fs = require('fs').promises;

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

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

// Function to check if multisig wallet is created based on confirmations
async function isMultisigCreated(confirmationsLeft) {
    // Multisig wallet is considered "created" when there are no confirmations left
    return confirmationsLeft === 0;
}

// Handle GET /pubkeys
router.get('/pubkeys', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    try {
        const users = await loadUsers();
        const pubKeys = await loadPubKeys();
        const pubkeyConfirmations = await loadPubkeyConfirmations();

        // Determine which users have not confirmed their pubkeys
        const unconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
        const confirmationsLeft = unconfirmedUsers.length;

        // Determine if multisig wallet is ready to be created
        const multisigCreated = await isMultisigCreated(confirmationsLeft);

        res.render('pubkeys', {
            title: 'Pubkeys Dashboard',
            session: req.session,
            users: users,
            pubKeys: pubKeys,
            pubkeyConfirmations: pubkeyConfirmations,
            confirmationsLeft: confirmationsLeft,
            unconfirmedUsers: unconfirmedUsers,
            multisigCreated: multisigCreated, // Pass the flag to the template
            message: null
        });
    } catch (error) {
        console.error(`Error loading pubkeys data: ${error}`);
        res.render('error', { title: 'Error', errorMessage: error.message });
    }
});

// Handle updating public keys
router.post('/pubkeys/update', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const { update_username, pubkey_index } = req.body;
    const userIndex = parseInt(pubkey_index, 10) - 1; // Convert to zero-based index

    try {
        const users = await loadUsers();
        const pubKeys = await loadPubKeys();
        const pubkeyConfirmations = await loadPubkeyConfirmations();

        // Determine which users have not confirmed their pubkeys
        const unconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
        const confirmationsLeft = unconfirmedUsers.length;

        // Determine if multisig wallet is ready to be created
        const multisigCreated = await isMultisigCreated(confirmationsLeft);

        if (userIndex < 0 || userIndex >= users.length) {
            throw new Error('Invalid Pubkey Index');
        }

        // Ensure the logged-in user is updating their own pubkey
        if (users[userIndex].username !== req.session.user.username) {
            throw new Error('Unauthorized action. You can only edit your own pubkey.');
        }

        const newPubKey = req.body[`pubkey${pubkey_index}`] || "";

        // Validate the new public key
        if (!validatePubKey(newPubKey)) {
            return res.render('pubkeys', {
                title: 'Pubkeys Dashboard',
                session: req.session,
                users: users,
                pubKeys: pubKeys,
                pubkeyConfirmations: pubkeyConfirmations,
                confirmationsLeft: confirmationsLeft,
                unconfirmedUsers: unconfirmedUsers,
                multisigCreated: multisigCreated,
                message: '<div class="alert alert-danger">Invalid Public Key Format. Please ensure it starts with "tpub" and is correctly formatted.</div>'
            });
        }

        // Save the valid public key
        pubKeys[userIndex] = newPubKey;
        await savePubKeys(pubKeys);

        // Reset confirmation for this user since the pubkey has changed
        pubkeyConfirmations[userIndex] = false;
        await savePubkeyConfirmation(userIndex, false);

        // Recalculate confirmations
        const updatedUnconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
        const updatedConfirmationsLeft = updatedUnconfirmedUsers.length;

        // Determine if multisig wallet is ready to be created after update
        const updatedMultisigCreated = await isMultisigCreated(updatedConfirmationsLeft);

        res.render('pubkeys', {
            title: 'Pubkeys Dashboard',
            session: req.session,
            users: users,
            pubKeys: pubKeys,
            pubkeyConfirmations: pubkeyConfirmations,
            confirmationsLeft: updatedConfirmationsLeft,
            unconfirmedUsers: updatedUnconfirmedUsers,
            multisigCreated: updatedMultisigCreated,
            message: '<div class="alert alert-success">Public key updated successfully. Please confirm your new pubkey.</div>'
        });
    } catch (error) {
        console.error(`Error updating pubkey: ${error}`);
        res.render('error', { title: 'Error', errorMessage: error.message });
    }
});

// Handle confirmation of individual pubkeys
router.post('/pubkeys/confirm', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const { confirm_username } = req.body;
    const userIndex = parseInt(confirm_username, 10) - 1; // Convert to zero-based index

    try {
        const users = await loadUsers();
        const pubKeys = await loadPubKeys();
        const pubkeyConfirmations = await loadPubkeyConfirmations();

        if (userIndex < 0 || userIndex >= users.length) {
            throw new Error('Invalid User Index');
        }

        // Ensure the logged-in user is confirming their own pubkey
        if (users[userIndex].username !== req.session.user.username) {
            throw new Error('Unauthorized action. You can only confirm your own pubkey.');
        }

        // Ensure the user has provided a pubkey before confirming
        if (pubKeys[userIndex] === "") {
            throw new Error('Cannot confirm without a valid public key.');
        }

        // Update confirmation
        pubkeyConfirmations[userIndex] = true;
        await savePubkeyConfirmation(userIndex, true);

        // Recalculate confirmations
        const updatedUnconfirmedUsers = users.filter((_, index) => !pubkeyConfirmations[index]);
        const updatedConfirmationsLeft = updatedUnconfirmedUsers.length;

        // Determine if multisig wallet is ready to be created after confirmation
        const updatedMultisigCreated = await isMultisigCreated(updatedConfirmationsLeft);

        // If all pubkeys are confirmed, execute the bash script to create the multisig wallet
        if (updatedMultisigCreated) {
            try {
                const { stdout, stderr } = await execPromise('./create_multisig_wallet.sh');
                console.log(`Script output: ${stdout}`);
                if (stderr) {
                    console.error(`Script stderr: ${stderr}`);
                }
            } catch (scriptError) {
                console.error(`Error executing create_multisig_wallet.sh: ${scriptError}`);
                // Optionally, inform the user about the error
                return res.render('pubkeys', {
                    title: 'Pubkeys Dashboard',
                    session: req.session,
                    users: users,
                    pubKeys: pubKeys,
                    pubkeyConfirmations: pubkeyConfirmations,
                    confirmationsLeft: updatedConfirmationsLeft,
                    unconfirmedUsers: updatedUnconfirmedUsers,
                    multisigCreated: updatedMultisigCreated,
                    message: `<div class="alert alert-danger">All pubkeys have been confirmed, but there was an error creating the multisig wallet. Please contact support.</div>`
                });
            }
        }

        res.render('pubkeys', {
            title: 'Pubkeys Dashboard',
            session: req.session,
            users: users,
            pubKeys: pubKeys,
            pubkeyConfirmations: pubkeyConfirmations,
            confirmationsLeft: updatedConfirmationsLeft,
            unconfirmedUsers: updatedUnconfirmedUsers,
            multisigCreated: updatedMultisigCreated,
            message: updatedMultisigCreated
                ? `<div class="alert alert-info">All pubkeys have been confirmed. You can now proceed to <a href="/funding" class="alert-link">Funding Confirmation</a>.</div>`
                : '<div class="alert alert-success">Pubkey confirmation received.</div>'
        });
    } catch (error) {
        console.error(`Error confirming pubkey: ${error}`);
        res.render('error', { title: 'Error', errorMessage: error.message });
    }
});

module.exports = router;
