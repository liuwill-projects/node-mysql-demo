var config = require('config');
var Promise = require("bluebird");
var mysql = require('mysql');
var util = require('util');
var moment = require('moment');
var fs = require("fs");
var readline = require('readline');
//...
var dbConfig = config.get('Site.dbConfig');
var sqlConfig = config.get('Site.sql');
var tableConfig = config.get('Site.table');
//console.log(dbConfig);
var using = Promise.using;
Promise.promisifyAll(require('mysql/lib/Connection').prototype);
Promise.promisifyAll(require('mysql/lib/Pool').prototype);

var pool = mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.dbName,
    port: dbConfig.port,
    connectionLimit: 10
});

var rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getSqlConnection() {
    return pool.getConnectionAsync().disposer(function(connection) {
        connection.release();
    });
}

// If the using block completes successfully, the transaction is automatically committed
// Any error or rejection will automatically roll it back
using(getSqlConnection(), function(conn) {
    // use connection here and _return the promise_
    return conn.queryAsync("select * from hr_users where username='soda'")
    .then(function(result) {
        console.log(result);
        return conn.queryAsync("select * from hr_users where username='soda'")
    }).then(function(result){
        return new Promise(function(resolve, reject){
            rd.question('Print User Column? ', (answer) => {
                // TODO: Log the answer in a database
                if(result.length > 0 && answer in result[0]){
                    console.log("[ " + result[0][answer] + " ]");
                }
                resolve(answer);
                
                rd.close();
            });
        });
    }).then(function(answer){
        console.log(answer);
        return conn;
    });
}).then(function(conn){
    return conn.queryAsync("select * from hr_areas where nid='beijing'")
    .then(function(result) {
        console.log(result);
    });
});
console.log("1 level");
