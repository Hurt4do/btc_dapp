// Filename: utils/pubkeyConfirmations.js

const fs = require('fs').promises;
const path = require('path');
const { users, dataFolder } = require('../config');

// PubKey Confirmation Management
async function loadPubkeyConfirmations() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(dataFolder, 'pubkey_confirmations', `confirm_pubkey${index + 1}.txt`);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const status = data.trim() === 'true';
            console.log(`Loaded pubkey confirmation for user ${index + 1}: ${status}`);
            return status;
        } catch {
            await fs.writeFile(filePath, 'false');
            console.log(`Pubkey confirmation file for user ${index + 1} did not exist, created with false`);
            return false;
        }
    }));
}

async function savePubkeyConfirmation(userIndex, status) {
    const filePath = path.join(dataFolder, 'pubkey_confirmations', `confirm_pubkey${userIndex + 1}.txt`);
    try {
        await fs.writeFile(filePath, status ? 'true' : 'false');
        console.log(`Saved pubkey confirmation for user ${userIndex + 1}: ${status}`);
    } catch (error) {
        console.error(`Error saving pubkey confirmation for user ${userIndex + 1}: ${error}`);
    }
}

module.exports = {
    loadPubkeyConfirmations,
    savePubkeyConfirmation
};
