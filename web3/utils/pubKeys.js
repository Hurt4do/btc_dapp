// Filename: utils/pubKeys.js

const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

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

// Function to load pubkeys from a file
async function loadPubKeys() {
    const pubkeysPath = path.join(config.dataFolder, 'pubkeys.json');
    try {
        const data = await fs.readFile(pubkeysPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading pubkeys file: ${error}`);
        // Initialize with empty strings for each user if file doesn't exist or error occurs
        const users = await loadUsers();
        const initializedPubKeys = users.map(() => "");
        await savePubKeys(initializedPubKeys);
        return initializedPubKeys;
    }
}

// Function to save pubkeys to a file
async function savePubKeys(pubKeys) {
    const pubkeysPath = path.join(config.dataFolder, 'pubkeys.json');
    try {
        await fs.writeFile(pubkeysPath, JSON.stringify(pubKeys, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing pubkeys file: ${error}`);
        throw error;
    }
}

// Function to validate pubkey format
function validatePubKey(pubKey) {
    // Example validation: starts with "tpub" and is 111 characters long
    const pubKeyRegex = /^tpub[a-zA-Z0-9]{107}$/;
    return pubKeyRegex.test(pubKey);
}

// Function to check if all pubkeys are confirmed
async function areAllPubkeysConfirmed() {
    // This function is now handled in pubkeyConfirmations.js
    // It can be removed or kept for consistency
    return true;
}

module.exports = {
    loadPubKeys,
    savePubKeys,
    validatePubKey,
    areAllPubkeysConfirmed
};
