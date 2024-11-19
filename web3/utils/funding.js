// Filename: utils/funding.js

const fs = require('fs').promises;
const path = require('path');
const { users, dataFolder } = require('../config');

// Funding Txid Management
async function loadTxids() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(dataFolder, 'txids', `txid${index + 1}.txt`);
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
            const filePath = path.join(dataFolder, 'txids', `txid${index + 1}.txt`);
            await fs.writeFile(filePath, txid);
            console.log(`Saved txid for user ${index + 1}`);
        }));
    } catch (error) {
        console.error(`Error saving txids: ${error}`);
    }
}

// Funding Confirmation Management
async function loadFundingConfirmations() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(dataFolder, 'funding_confirmations', `confirm_fund${index + 1}.txt`);
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
    const filePath = path.join(dataFolder, 'funding_confirmations', `confirm_fund${userIndex + 1}.txt`);
    try {
        await fs.writeFile(filePath, status ? 'true' : 'false');
        console.log(`Saved funding confirmation for user ${userIndex + 1}: ${status}`);
    } catch (error) {
        console.error(`Error saving funding confirmation for user ${userIndex + 1}: ${error}`);
    }
}

module.exports = {
    loadTxids,
    saveTxids,
    loadFundingConfirmations,
    saveFundingConfirmation
};
