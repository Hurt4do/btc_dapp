// Filename: utils/pubkeyConfirmations.js

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

// Function to load pubkey confirmations from a file
async function loadPubkeyConfirmations() {
    const confirmationsPath = path.join(config.dataFolder, 'pubkey_confirmations.json');
    try {
        const data = await fs.readFile(confirmationsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading pubkey confirmations file: ${error}`);
        // Initialize with false for each user if file doesn't exist or error occurs
        const users = await loadUsers();
        const initializedConfirmations = users.map(() => false);
        await savePubkeyConfirmations(initializedConfirmations);
        return initializedConfirmations;
    }
}

// Function to save pubkey confirmations to a file
async function savePubkeyConfirmations(confirmations) {
    const confirmationsPath = path.join(config.dataFolder, 'pubkey_confirmations.json');
    try {
        await fs.writeFile(confirmationsPath, JSON.stringify(confirmations, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing pubkey confirmations file: ${error}`);
        throw error;
    }
}

// Function to update a specific user's pubkey confirmation status
async function savePubkeyConfirmation(userIndex, confirmationStatus) {
    try {
        const confirmations = await loadPubkeyConfirmations();
        confirmations[userIndex] = confirmationStatus;
        await savePubkeyConfirmations(confirmations);
    } catch (error) {
        console.error(`Error saving pubkey confirmation: ${error}`);
        throw error;
    }
}

// Function to check if all pubkeys are confirmed
async function areAllPubkeysConfirmed() {
    const confirmations = await loadPubkeyConfirmations();
    return confirmations.every(confirmed => confirmed === true);
}

module.exports = {
    loadPubkeyConfirmations,
    savePubkeyConfirmation,
    savePubkeyConfirmations,
    areAllPubkeysConfirmed
};
