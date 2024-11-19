// Filename: utils/fundingConfirmations.js

const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

// Function to load funding confirmations from a file
async function loadFundingConfirmations() {
    const confirmationsPath = path.join(config.dataFolder, 'funding_confirmations.json');
    try {
        const data = await fs.readFile(confirmationsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading funding confirmations file: ${error}`);
        // Initialize with false for each user if file doesn't exist or error occurs
        const users = await loadUsers();
        const initializedConfirmations = users.map(() => false);
        await saveFundingConfirmations(initializedConfirmations);
        return initializedConfirmations;
    }
}

// Function to save funding confirmations to a file
async function saveFundingConfirmations(confirmations) {
    const confirmationsPath = path.join(config.dataFolder, 'funding_confirmations.json');
    try {
        await fs.writeFile(confirmationsPath, JSON.stringify(confirmations, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing funding confirmations file: ${error}`);
        throw error;
    }
}

// Function to update a specific user's funding confirmation status
async function saveFundingConfirmation(userIndex, confirmationStatus) {
    try {
        const confirmations = await loadFundingConfirmations();
        confirmations[userIndex] = confirmationStatus;
        await saveFundingConfirmations(confirmations);
    } catch (error) {
        console.error(`Error saving funding confirmation: ${error}`);
        throw error;
    }
}

// Function to load users from users.json (reuse from other utils)
async function loadUsers() {
    try {
        const usersData = await fs.readFile(config.usersFile, 'utf-8');
        return JSON.parse(usersData);
    } catch (error) {
        console.error(`Error reading users file: ${error}`);
        return [];
    }
}

module.exports = {
    loadFundingConfirmations,
    saveFundingConfirmation,
    saveFundingConfirmations
};
