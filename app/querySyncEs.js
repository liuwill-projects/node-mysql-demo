//var config = require('config');
import config from 'config';

import mysql from 'mysql';
import util from 'util';
import moment from 'moment';
import fs from "fs";
import readline from 'readline';

//相关配置文件
const dbConfig = config.get('Site.dbConfig');
const sqlConfig = config.get('Site.sql');
const tableConfig = config.get('Site.table');

//Promise
const Promise = require("bluebird");
const using = Promise.using;
Promise.promisifyAll(require('mysql/lib/Connection').prototype);
Promise.promisifyAll(require('mysql/lib/Pool').prototype);

let pool = mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.dbName,
    port: dbConfig.port,
    connectionLimit: 10
});

let rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getSqlConnection() {
    return pool.getConnectionAsync().disposer((connection) => {
        connection.release();
    });
}

// If the using block completes successfully, the transaction is automatically committed
// Any error or rejection will automatically roll it back
using(getSqlConnection(), (conn) => {
    // use connection here and _return the promise_
    return conn.queryAsync("select * from hr_users where username='soda'")
    .then((result) => {
        console.log(result);
        return conn.queryAsync("select * from hr_users where username='soda'")
    }).then((result) => {
        return new Promise(function(resolve, reject){
            rd.question('$Print User Column? ', (answer) => {
                // TODO: Log the answer in a database
                if(result.length > 0 && answer in result[0]){
                    result.forEach(v => {
                        if (answer in v){
                            console.log("[ " + v[answer] + " ]");
                        }
                    });
                }
                resolve(answer);
                
                rd.close();
            });
        });
    }).then((answer) => {
        console.log(`$Show Column:[ ${answer} ]`);
        return conn;
    });
}).then((conn) => {
    return conn.queryAsync("select * from hr_areas where province='1'")
    .then((result) => {
        if(result && result.length > 0){
            result.forEach(v => {
                console.log(`[ ${v['name']} ==> ${v['nid']} ]`);
            });
        }
    });
});
console.log("1 level");
