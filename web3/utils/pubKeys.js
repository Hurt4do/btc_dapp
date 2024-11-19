// Filename: utils/pubKeys.js

const fs = require('fs').promises;
const path = require('path');
const { users, dataFolder } = require('../config');

// Pub Key Management
async function loadPubKeys() {
    return await Promise.all(users.map(async (_, index) => {
        const filePath = path.join(dataFolder, 'pubkeys', `tpub${index + 1}.txt`);
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
            const filePath = path.join(dataFolder, 'pubkeys', `tpub${index + 1}.txt`);
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

module.exports = {
    loadPubKeys,
    savePubKeys,
    validatePubKey
};
