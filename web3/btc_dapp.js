const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const port = 3000;

// Generic password for all users
const genericPassword = "bitcoin123";
const users = [
    "Participant 1",
    "Participant 2",
    "Participant 3",
    "Participant 4",
    "Participant 5",
    "Participant 6"
];

// Configurar body-parser para procesar datos del formulario
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para servir archivos estáticos (CSS)
app.use(express.static('public'));

// Load current public keys from individual files
function loadPubKeys() {
    return users.map((_, index) => {
        const filePath = `tpub${index + 1}.txt`;
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8').trim();
        }
        return "";
    });
}

// Save individual public keys to separate files
function savePubKeys(pubKeys) {
    pubKeys.forEach((key, index) => {
        fs.writeFileSync(`tpub${index + 1}.txt`, key);
    });
}

// Serve the login page
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Multisig Login</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        text-align: center;
                        padding-top: 50px;
                    }
                </style>
            </head>
            <body>
                <h1>Login to Access Public Keys</h1>
                <form action="/dashboard" method="POST">
                    <select name="username" required>
                        ${users.map(user => `<option value="${user}">${user}</option>`).join('')}
                    </select><br><br>
                    <input type="password" name="password" placeholder="Enter password" required>
                    <button type="submit">Login</button>
                </form>
            </body>
        </html>
    `);
});

// Handle login request
app.post('/dashboard', (req, res) => {
    const password = req.body.password;
    const username = req.body.username;
    if (password === genericPassword && users.includes(username)) {
        const pubKeys = loadPubKeys();
        res.send(renderDashboard(pubKeys, username));
    } else {
        res.send(`<h1>Incorrect Username or Password</h1><a href="/">Go back</a>`);
    }
});

// Handle updating public keys
app.post('/update', (req, res) => {
    const pubKeys = loadPubKeys();
    const username = req.body.username;
    const userIndex = users.indexOf(username);
    if (userIndex !== -1) {
        pubKeys[userIndex] = req.body[`pubkey${userIndex + 1}`] || "";
        savePubKeys(pubKeys);
    }
    res.send(renderDashboard(pubKeys, username));
});

// Render the dashboard page with the public keys
function renderDashboard(pubKeys, username) {
    const userIndex = users.indexOf(username);
    let formInputs = pubKeys.map((key, index) => {
        if (index === userIndex) {
            return `
                <div>
                    <label>${users[index]} Master Public Key:</label><br>
                    <input type="text" name="pubkey${index + 1}" value="${key}" style="width: 80%;"><br><br>
                </div>
            `;
        } else {
            return `
                <div>
                    <label>${users[index]} Master Public Key:</label><br>
                    <input type="text" value="${key}" style="width: 80%;" readonly><br><br>
                </div>
            `;
        }
    }).join('');

    return `
        <html>
            <head>
                <title>Multisig Dashboard</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        text-align: center;
                        padding-top: 20px;
                    }
                    input[type="text"] {
                        padding: 8px;
                        font-size: 1em;
                    }
                    button {
                        padding: 10px 20px;
                        font-size: 1em;
                    }
                </style>
            </head>
            <body>
                <h1>Welcome, ${username}</h1>
                <h2>Multisig Public Keys Dashboard</h2>
                <form action="/update" method="POST">
                    ${formInputs}
                    <input type="hidden" name="username" value="${username}">
                    <button type="submit">Update Your Public Key</button>
                </form>
                <br>
                <a href="/">Logout</a>
            </body>
        </html>
    `;
}

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Multisig dApp server running at http://localhost:${port}`);
});
