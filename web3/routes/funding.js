// Filename: routes/funding.js

const express = require('express');
const router = express.Router();
const path = require('path');
const { exec } = require('child_process');

const config = require('../config');

// Import helper functions
const {
    loadTxids,
    saveTxids,
    loadFundingConfirmations,
    saveFundingConfirmation,
    loadUsers
} = require('../utils/funding');

// Import Pubkey Confirmations
const {
    loadPubkeyConfirmations
} = require('../utils/pubkeyConfirmations'); // Ensure this path is correct

const fs = require('fs').promises;

/**
 * Function to check if multisig wallet is ready for funding.
 * It's considered ready if all pubkeys are confirmed (confirmationsLeft === 0).
 */
async function isMultisigReadyForFunding() {
    const users = await loadUsers();
    const pubkeyConfirmations = await loadPubkeyConfirmations(); // Function from utils/pubkeyConfirmations.js
    const confirmationsLeft = pubkeyConfirmations.filter(confirmed => !confirmed).length;
    return confirmationsLeft === 0;
}

// Handle GET /funding
router.get('/funding', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    try {
        const users = await loadUsers();
        const txids = await loadTxids();
        const fundingConfirmations = await loadFundingConfirmations();

        // Determine if multisig is ready for funding
        const multisigReadyForFunding = await isMultisigReadyForFunding();

        // If multisig is ready, retrieve the multisig address
        let multisigAddress = '';
        if (multisigReadyForFunding) {
            // Read the multisig_address.json file
            const multisigAddressPath = path.join(config.dataFolder, 'funding', 'multisig_address.json');
            try {
                const multisigData = await fs.readFile(multisigAddressPath, 'utf-8');
                const multisigJson = JSON.parse(multisigData);
                multisigAddress = multisigJson.multisig_address.trim();
            } catch (readError) {
                console.error(`Error reading multisig_address.json: ${readError}`);
                multisigAddress = 'Unable to retrieve multisig address.';
            }
        }

        // Determine which users have not confirmed their funding TxIDs
        const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
        const fundingConfirmationsLeft = unconfirmedFunds.length;

        res.render('funding', {
            title: 'Funding Confirmation',
            session: req.session,
            users: users,
            txids: txids,
            fundingConfirmations: fundingConfirmations,
            fundingConfirmationsLeft: fundingConfirmationsLeft,
            unconfirmedFunds: unconfirmedFunds,
            multisigAddress: multisigAddress,
            multisigReadyForFunding: multisigReadyForFunding,
            psbt: null,
            message: null
        });
    } catch (error) {
        console.error(`Error loading funding data: ${error}`);
        res.render('error', { title: 'Error', errorMessage: error.message });
    }
});

// Handle updating TxIDs
router.post('/funding/update', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const { update_fund_username, txid_index } = req.body;
    const userIndex = parseInt(txid_index, 10) - 1; // Convert to zero-based index

    try {
        const users = await loadUsers();

        // Check if multisig is ready for funding
        const multisigReadyForFunding = await isMultisigReadyForFunding();

        if (!multisigReadyForFunding) {
            // If multisig wallet is not ready, render with error message
            const txids = await loadTxids();
            const fundingConfirmations = await loadFundingConfirmations();

            const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
            const fundingConfirmationsLeft = unconfirmedFunds.length;

            return res.render('funding', {
                title: 'Funding Confirmation',
                session: req.session,
                users: users,
                txids: txids,
                fundingConfirmations: fundingConfirmations,
                fundingConfirmationsLeft: fundingConfirmationsLeft,
                unconfirmedFunds: unconfirmedFunds,
                multisigAddress: 'Multisig wallet not ready for funding.',
                multisigReadyForFunding: multisigReadyForFunding,
                psbt: null,
                message: '<div class="alert alert-danger">Multisig wallet is not ready for funding yet. Please ensure all pubkeys are confirmed.</div>'
            });
        }

        if (userIndex < 0 || userIndex >= users.length) {
            throw new Error('Invalid TxID Index');
        }

        // Ensure the logged-in user is updating their own TxID
        if (users[userIndex].username !== req.session.user.username) {
            throw new Error('Unauthorized action. You can only edit your own TxID.');
        }

        const newTxid = req.body[`txid${txid_index}`] || "";

        // Simple TxID validation (exactly 64 hexadecimal characters)
        const txidRegex = /^[A-Fa-f0-9]{64}$/;
        if (!txidRegex.test(newTxid)) {
            const txids = await loadTxids();
            const fundingConfirmations = await loadFundingConfirmations();
            const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
            const fundingConfirmationsLeft = unconfirmedFunds.length;

            return res.render('funding', {
                title: 'Funding Confirmation',
                session: req.session,
                users: users,
                txids: txids,
                fundingConfirmations: fundingConfirmations,
                fundingConfirmationsLeft: fundingConfirmationsLeft,
                unconfirmedFunds: unconfirmedFunds,
                multisigAddress: 'Multisig wallet ready but unable to retrieve address.',
                multisigReadyForFunding: multisigReadyForFunding,
                psbt: null,
                message: '<div class="alert alert-danger">Invalid TxID Format. Transaction ID must be exactly 64 hexadecimal characters.</div>'
            });
        }

        // Load existing TxIDs
        const txids = await loadTxids();

        // Ensure the txids array has enough entries
        while (txids.length < users.length) {
            txids.push("");
        }

        // Save the TxID
        txids[userIndex] = newTxid;
        await saveTxids(txids);

        // Reset funding confirmation for this user since the TxID has changed
        await saveFundingConfirmation(userIndex, false);

        // Reload data
        const updatedTxids = await loadTxids();
        const fundingConfirmations = await loadFundingConfirmations();
        const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
        const fundingConfirmationsLeft = unconfirmedFunds.length;

        // Since TxID has changed, update multisig readiness
        const updatedMultisigReadyForFunding = await isMultisigReadyForFunding();

        let multisigAddress = 'Multisig wallet ready but unable to retrieve address.';
        if (updatedMultisigReadyForFunding) {
            // Retrieve the multisig address again
            const multisigAddressPath = path.join(config.dataFolder, 'funding', 'multisig_address.json');
            try {
                const multisigData = await fs.readFile(multisigAddressPath, 'utf-8');
                const multisigJson = JSON.parse(multisigData);
                multisigAddress = multisigJson.multisig_address.trim();
            } catch (readError) {
                console.error(`Error reading multisig_address.json: ${readError}`);
                multisigAddress = 'Unable to retrieve multisig address.';
            }
        }

        res.render('funding', {
            title: 'Funding Confirmation',
            session: req.session,
            users: users,
            txids: updatedTxids,
            fundingConfirmations: fundingConfirmations,
            fundingConfirmationsLeft: fundingConfirmationsLeft,
            unconfirmedFunds: unconfirmedFunds,
            multisigAddress: multisigAddress,
            multisigReadyForFunding: updatedMultisigReadyForFunding,
            psbt: null,
            message: '<div class="alert alert-success">TxID updated successfully.</div>'
        });
    } catch (error) {
        console.error(`Error updating TxID: ${error}`);
        res.render('error', { title: 'Error', errorMessage: error.message });
    }
});

// Handle funding confirmation
router.post('/funding/confirm', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }

    const { confirm_fund_username } = req.body;
    const userIndex = parseInt(confirm_fund_username, 10) - 1; // Convert to zero-based index

    try {
        const users = await loadUsers();

        // Check if multisig is ready for funding
        const multisigReadyForFunding = await isMultisigReadyForFunding();

        if (!multisigReadyForFunding) {
            // If multisig wallet is not ready, render with error message
            const txids = await loadTxids();
            const fundingConfirmations = await loadFundingConfirmations();

            const unconfirmedFunds = users.filter((_, index) => !fundingConfirmations[index]);
            const fundingConfirmationsLeft = unconfirmedFunds.length;

            return res.render('funding', {
                title: 'Funding Confirmation',
                session: req.session,
                users: users,
                txids: txids,
                fundingConfirmations: fundingConfirmations,
                fundingConfirmationsLeft: fundingConfirmationsLeft,
                unconfirmedFunds: unconfirmedFunds,
                multisigAddress: 'Multisig wallet is not ready for funding.',
                multisigReadyForFunding: multisigReadyForFunding,
                psbt: null,
                message: '<div class="alert alert-danger">Multisig wallet is not ready for funding yet. Please ensure all pubkeys are confirmed.</div>'
            });
        }

        if (userIndex < 0 || userIndex >= users.length) {
            throw new Error('Invalid User Index');
        }

        // Ensure the logged-in user is confirming their own funding
        if (users[userIndex].username !== req.session.user.username) {
            throw new Error('Unauthorized action. You can only confirm your own funding.');
        }

        const txids = await loadTxids();
        const fundingConfirmations = await loadFundingConfirmations();

        // Ensure the user has provided a TxID before confirming
        if (txids[userIndex] === "") {
            throw new Error('Cannot confirm funding without a valid TxID.');
        }

        // Update confirmation
        fundingConfirmations[userIndex] = true;
        await saveFundingConfirmation(userIndex, true);

        // Reload confirmations
        const updatedFundingConfirmations = await loadFundingConfirmations();

        const unconfirmedFunds = users.filter((_, index) => !updatedFundingConfirmations[index]);
        const fundingConfirmationsLeft = unconfirmedFunds.length;

        // Retrieve the multisig address again
        let multisigAddress = 'Multisig wallet ready but unable to retrieve address.';
        if (multisigReadyForFunding) {
            const multisigAddressPath = path.join(config.dataFolder, 'funding', 'multisig_address.json');
            try {
                const multisigData = await fs.readFile(multisigAddressPath, 'utf-8');
                const multisigJson = JSON.parse(multisigData);
                multisigAddress = multisigJson.multisig_address.trim();
            } catch (readError) {
                console.error(`Error reading multisig_address.json: ${readError}`);
                multisigAddress = 'Unable to retrieve multisig address.';
            }
        }

        // Check if all funding confirmations are done
        if (updatedFundingConfirmations.every((confirmed, index) => confirmed && txids[index] !== "")) {
            // All funding confirmations are done
            // Execute create_psbt.sh
            exec('./create_psbt.sh', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing create_psbt.sh: ${error}`);
                    res.render('funding', {
                        title: 'Funding Confirmation',
                        session: req.session,
                        users: users,
                        txids: txids,
                        fundingConfirmations: updatedFundingConfirmations,
                        fundingConfirmationsLeft: null,
                        unconfirmedFunds: null,
                        multisigAddress: multisigAddress,
                        multisigReadyForFunding: multisigReadyForFunding,
                        psbt: null, // No PSBT to display
                        message: '<div class="alert alert-danger">Error generating PSBT. Please try again later.</div>'
                    });
                } else {
                    // Read the PSBT from data/unsigned_psbt.json
                    const psbtPath = path.join(config.dataFolder, 'unsigned_psbt.json');
                    fs.readFile(psbtPath, 'utf-8')
                        .then(psbtData => {
                            const psbtJson = JSON.parse(psbtData);
                            res.render('funding', {
                                title: 'Funding Confirmation',
                                session: req.session,
                                users: users,
                                txids: txids,
                                fundingConfirmations: updatedFundingConfirmations,
                                fundingConfirmationsLeft: null,
                                unconfirmedFunds: null,
                                multisigAddress: multisigAddress,
                                multisigReadyForFunding: multisigReadyForFunding,
                                psbt: psbtJson.psbt,
                                message: '<div class="alert alert-success">🎉 All funding transactions confirmed! PSBT generated successfully.</div>'
                            });
                        })
                        .catch(err => {
                            console.error(`Error reading unsigned_psbt.json: ${err}`);
                            res.render('funding', {
                                title: 'Funding Confirmation',
                                session: req.session,
                                users: users,
                                txids: txids,
                                fundingConfirmations: updatedFundingConfirmations,
                                fundingConfirmationsLeft: null,
                                unconfirmedFunds: null,
                                multisigAddress: multisigAddress,
                                multisigReadyForFunding: multisigReadyForFunding,
                                psbt: null,
                                message: '<div class="alert alert-danger">Error reading PSBT. Please try again later.</div>'
                            });
                        });
                }
            });
        } else {
            res.render('funding', {
                title: 'Funding Confirmation',
                session: req.session,
                users: users,
                txids: txids,
                fundingConfirmations: updatedFundingConfirmations,
                fundingConfirmationsLeft: fundingConfirmationsLeft,
                unconfirmedFunds: unconfirmedFunds,
                multisigAddress: multisigAddress,
                multisigReadyForFunding: multisigReadyForFunding,
                psbt: null,
                message: '<div class="alert alert-success">Funding confirmation received.</div>'
            });
        }
    } catch (error) {
        console.error(`Error confirming funding: ${error}`);
        res.render('error', { title: 'Error', errorMessage: error.message });
    }
});

// Optional: Handle PSBT download
router.get('/download_psbt', (req, res) => {
    const psbtFilePath = path.join(config.dataFolder, 'unsigned_psbt.json');
    res.download(psbtFilePath, 'unsigned_psbt.json', (err) => {
        if (err) {
            console.error(`Error downloading PSBT file: ${err}`);
            res.status(500).send('Error downloading PSBT file.');
        }
    });
});

module.exports = router;
