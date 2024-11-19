// Filename: utils/render.js

const { users } = require('../config');

function renderPubkeys(pubKeys, username, confirmationsLeft = null, unconfirmedUsers = [], pubkeyConfirmations, message = '') {
    const userIndex = users.indexOf(username);
    const formInputs = pubKeys.map((key, index) => {
        const isConfirmed = pubkeyConfirmations[index];
        if (index === userIndex) {
            return `
                <div>
                    <label>${users[index]} Master Public Key:</label><br>
                    <!-- Update Public Key Form -->
                    <form action="/update" method="POST" style="display: inline;">
                        <input type="text" name="pubkey${index + 1}" value="${key}" style="width: 80%;" ${isConfirmed ? 'disabled' : ''}><br><br>
                        <input type="hidden" name="update_username" value="${username}">
                        <button type="submit" ${isConfirmed ? 'disabled' : ''}>Edit Public Key</button>
                    </form>
                    <!-- Confirm Multisig Creation Form -->
                    <form action="/confirm" method="POST" style="display: inline;">
                        <input type="hidden" name="confirm_username" value="${username}">
                        <button type="submit" ${isConfirmed ? 'disabled' : ''}>
                            ${isConfirmed ? '✔️ Confirmed' : 'Confirm Multisig Creation'}
                        </button>
                    </form>
                </div>
            `;
        } else {
            return `
                <div>
                    <label>${users[index]} Master Public Key:</label><br>
                    <input type="text" value="${key}" style="width: 80%;" readonly><br><br>
                    <button type="button" disabled>Edit Public Key</button>
                    <button type="button" disabled>${isConfirmed ? '✔️ Confirmed' : 'Awaiting Confirmation'}</button>
                </div>
            `;
        }
    }).join('');

    const confirmationsInfo = (confirmationsLeft !== null && confirmationsLeft > 0) ? `
        <h3>${confirmationsLeft} confirmation(s) left</h3>
        <p>Waiting for: ${unconfirmedUsers.join(', ')}</p>
    ` : '';

    return `
        <html>
            <head>
                <title>Multisig Pubkeys</title>
                <link rel="stylesheet" href="/styles.css">
            </head>
            <body>
                <h1>Welcome, ${username}</h1>

                <div class="navigation">
                    <a href="/pubkeys">Pubkeys</a> |
                    <a href="/funding">Funding Confirmation</a>
                </div>
                
                ${confirmationsInfo}

                ${message}

                ${formInputs}
                <br>
                <a href="/logout">Logout</a>
            </body>
        </html>
    `;
}

function renderFundingDashboard(multisigAddress, txids = null, username = null, fundingConfirmations = null, fundingConfirmationsLeft = null, message = '') {
    const formInputs = users.map((user, index) => {
        const txid = txids ? txids[index] : "";
        const isConfirmed = fundingConfirmations ? fundingConfirmations[index] : false;

        return `
            <div>
                <label>${user} Funding Transaction ID (TxID):</label><br>
                <!-- Update TxID Form -->
                <form action="/funding/update" method="POST" style="display: inline;">
                    <input type="text" name="txid${index + 1}" value="${txid}" style="width: 80%;" ${isConfirmed ? 'disabled' : ''}><br><br>
                    <input type="hidden" name="update_fund_username" value="${user}">
                    <button type="submit" ${isConfirmed ? 'disabled' : ''}>Edit TxID</button>
                </form>
                <!-- Confirm Funding Form -->
                <form action="/funding/confirm" method="POST" style="display: inline;">
                    <input type="hidden" name="confirm_fund_username" value="${user}">
                    <button type="submit" ${isConfirmed ? 'disabled' : ''}>
                        ${isConfirmed ? '✔️ Confirmed' : 'Confirm Funding'}
                    </button>
                </form>
            </div>
        `;
    }).join('');

    const confirmationsInfo = (fundingConfirmationsLeft !== null && fundingConfirmationsLeft > 0) ? `
        <h3>${fundingConfirmationsLeft} funding confirmation(s) left</h3>
        <p>Waiting for: ${users.filter((_, index) => !fundingConfirmations[index]).join(', ')}</p>
    ` : '';

    return `
        <html>
            <head>
                <title>Funding Confirmation</title>
                <link rel="stylesheet" href="/styles.css">
            </head>
            <body>
                <h1>Funding Confirmation</h1>

                <div class="navigation">
                    <a href="/pubkeys">Pubkeys</a> |
                    <a href="/funding">Funding Confirmation</a>
                </div>

                <div class="multisig-address">
                    <strong>🔗 Multisig Address to Fund:</strong><br>
                    <p>${multisigAddress}</p>
                </div>
                
                ${confirmationsInfo}

                ${message}

                ${formInputs}
                <br>
                <a href="/logout">Logout</a>
            </body>
        </html>
    `;
}

module.exports = {
    renderPubkeys,
    renderFundingDashboard
};
