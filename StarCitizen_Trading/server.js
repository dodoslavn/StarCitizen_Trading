const http_server = require('http');
const functions = require('./functions.js');

global.cachedData = null;
global.profit = [];

functions.refreshData();

const my_server = http_server.createServer(functions.processRequest);

my_server.listen(3000, '0.0.0.0', functions.serverStarted());