console.log("INFO: Node.js version - ", process.version);

const http_server = require('http');
const cron = require('node-cron');
const functions = require('./functions.js');

global.cachedData = null;
global.cachedTerminals = [];
global.profit = [];
global.refreshInfo = [];

functions.refreshData();

const my_server = http_server.createServer(functions.processRequest);

my_server.listen(3000, '0.0.0.0', functions.serverStarted());

cron.schedule('*/10 * * * *', functions.refreshData );