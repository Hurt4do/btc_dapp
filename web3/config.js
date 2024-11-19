// Filename: config.js

const path = require('path');

module.exports = {
    usersFile: path.join(__dirname, 'data', 'users.json'),
    dataFolder: path.join(__dirname, 'data'),
    sessionSecret: 'your-strong-session-secret', // Replace with a strong secret in production
};
