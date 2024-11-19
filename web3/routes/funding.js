// Filename: routes/funding.js

const express = require('express');
const router = express.Router();
const path = require('path');

const { users, dataFolder } = require('../config');

// Import helper functions
const { loadTxids, saveTxids, loadFundingConfirmations, saveFundingConfirmation } = require('../utils/funding');
const { renderFundingDashboard } = require('../utils/render');

const fs = require('fs').promises;

// Handle GET /funding
router.get('/funding', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    // Read the multisig address
    const multisigAddressPath = path.join(dataFolder, 'multisig_address.txt');
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
    const fundingConfirmations = await loadFundingConfirmations();

    const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
    const fundingConfirmationsLeft = unconfirmedFunds.length;

    res.send(renderFundingDashboard(multisigAddress, txids, req.session.user.username, fundingConfirmations, fundingConfirmationsLeft));
});

// Handle updating txids
router.post('/funding/update', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

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
    const multisigAddressPath = path.join(dataFolder, 'multisig_address.txt');
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
router.post('/funding/confirm', async (req, res) => {
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
    const multisigAddressPath = path.join(dataFolder, 'multisig_address.txt');
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

module.exports = router;
