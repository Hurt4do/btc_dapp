// Filename: utils/funding.js

const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

/**
 * Load TxIDs from JSON file.
 * @returns {Promise<Array>} Array of TxIDs.
 */
async function loadTxids() {
    const txidsPath = path.join(config.dataFolder, 'funding', 'txids.json');
    try {
        const data = await fs.readFile(txidsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading TxIDs from JSON: ${error}`);
        // Initialize with empty array if file doesn't exist
        const initialTxids = [];
        await saveTxids(initialTxids);
        return initialTxids;
    }
}

/**
 * Save TxIDs to JSON file.
 * @param {Array} txids - Array of TxIDs.
 * @returns {Promise<void>}
 */
async function saveTxids(txids) {
    const txidsPath = path.join(config.dataFolder, 'funding', 'txids.json');
    try {
        await fs.writeFile(txidsPath, JSON.stringify(txids, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing TxIDs to JSON: ${error}`);
        throw error;
    }
}

/**
 * Load Funding Confirmations from JSON file.
 * @returns {Promise<Array>} Array of confirmation statuses (true/false).
 */
async function loadFundingConfirmations() {
    const confirmationsPath = path.join(config.dataFolder, 'funding', 'funding_confirmations.json');
    try {
        const data = await fs.readFile(confirmationsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading funding confirmations from JSON: ${error}`);
        // Initialize with false for each user if file doesn't exist
        const users = await loadUsers();
        const initialConfirmations = users.map(() => false);
        await saveFundingConfirmations(initialConfirmations);
        return initialConfirmations;
    }
}

/**
 * Save Funding Confirmations to JSON file.
 * @param {Array} confirmations - Array of confirmation statuses.
 * @returns {Promise<void>}
 */
async function saveFundingConfirmations(confirmations) {
    const confirmationsPath = path.join(config.dataFolder, 'funding', 'funding_confirmations.json');
    try {
        await fs.writeFile(confirmationsPath, JSON.stringify(confirmations, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing funding confirmations to JSON: ${error}`);
        throw error;
    }
}

/**
 * Save Funding Confirmation for a specific user.
 * @param {number} userIndex - Zero-based index of the user.
 * @param {boolean} status - Confirmation status.
 * @returns {Promise<void>}
 */
async function saveFundingConfirmation(userIndex, status) {
    const confirmations = await loadFundingConfirmations();
    if (userIndex < 0 || userIndex >= confirmations.length) {
        throw new Error('Invalid User Index for Funding Confirmation');
    }
    confirmations[userIndex] = status;
    await saveFundingConfirmations(confirmations);
}

/**
 * Load Multisig Address from JSON file.
 * @returns {Promise<string>} Multisig Address.
 */
async function loadMultisigAddress() {
    const multisigAddressPath = path.join(config.dataFolder, 'funding', 'multisig_address.json');
    try {
        const data = await fs.readFile(multisigAddressPath, 'utf-8');
        const json = JSON.parse(data);
        return json.multisig_address || '';
    } catch (error) {
        console.error(`Error reading multisig address from JSON: ${error}`);
        return '';
    }
}

/**
 * Save Multisig Address to JSON file.
 * @param {string} address - Multisig Address.
 * @returns {Promise<void>}
 */
async function saveMultisigAddress(address) {
    const multisigAddressPath = path.join(config.dataFolder, 'funding', 'multisig_address.json');
    try {
        await fs.writeFile(multisigAddressPath, JSON.stringify({ multisig_address: address }, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing multisig address to JSON: ${error}`);
        throw error;
    }
}

/**
 * Load Users from users.json
 * @returns {Promise<Array>} Array of user objects.
 */
async function loadUsers() {
    const usersPath = path.join(config.dataFolder, 'users.json');
    try {
        const data = await fs.readFile(usersPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading users from JSON: ${error}`);
        return [];
    }
}

module.exports = {
    loadTxids,
    saveTxids,
    loadFundingConfirmations,
    saveFundingConfirmations,
    saveFundingConfirmation,
    loadMultisigAddress,
    saveMultisigAddress,
    loadUsers
};
