console.log("INFO: Node.js version -", process.version);

const http_server = require('http');
const cron = require('node-cron');
const functions = require('./functions.js');

global.config = functions.loadConfig();

global.cachedData = null;
global.profit = [];

functions.refreshData();
cron.schedule('* * * * *', functions.refreshData );

const my_server = http_server.createServer(functions.processRequest);

my_server.listen(config.http_server.port_listen, config.http_server.ip_listen, functions.serverStarted());
