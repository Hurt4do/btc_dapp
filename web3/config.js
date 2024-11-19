// Filename: config.js

const path = require('path');

module.exports = {
    genericPassword: "1234",
    users: [
        "Participant 1",
        "Participant 2",
        "Participant 3"
    ],
    dataFolder: path.join(__dirname, 'data')
};
