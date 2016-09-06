var config = require('config');
var promise = require("bluebird");
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

var conn = mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.dbName,
    port: dbConfig.port
});
conn.connect();

var rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("Start Execution ...");
QueryActivities(conn,function(datas){
    QueryTender(conn,datas,function(tenderDatas){
        console.log("data query done ==>");
        var projectDatas = buildPayPlan(tenderDatas);
        console.log("build plan done ==>");

        var sqlData = generateSql(projectDatas);
        console.log("generate sql done ==>");

        var payPlanArr = generateStr(sqlData["payPlan"]);
        var receivePlanArr = generateStr(sqlData["receivePlan"]);

        var fileStr = payPlanArr.join("\n");
        fileStr += "\n" + receivePlanArr.join("\n");

        rd.question('Save Or Print? ', (answer) => {
            // TODO: Log the answer in a database
            if(answer == "save"){
                fs.open("build/buildPlan.sql","w",0644,function(e,fd){
                    fs.writeSync(fd,fileStr);
                    fs.closeSync(fd);
                });
            }else{
                console.log(fileStr);
            }

            rd.close();
        });
        conn.end();
    });
});

function generateStr(sqlData){
    var sqlArr = [];
    for(var i in sqlData){
        sqlArr.push(sqlData[i]);
    }

    return sqlArr;
}

function generateSql(projectDatas){
    var interestPayName = tableConfig["prefix"] + tableConfig["interest_pay"];
    var interestReceiveName = tableConfig["prefix"] + tableConfig["interest_receive"];

    var payPlanSqls = [];
    var receivePlanSqls = [];
    for(var borrowNid in projectDatas){
        var projectItem = projectDatas[borrowNid];
        var activityData = projectItem["activity"];
        var tenderRecords = projectItem["tenders"];
        
        var payPlan = projectItem["payPlan"];
        var receivePlan = projectItem["receivePlan"];
    
        for(var payPlanDate in payPlan){
            var payPlanData = payPlan[payPlanDate];

            var keys = [];
            var values = [];
            for(var key in payPlanData){
                var value = payPlanData[key];

                keys.push(key);
                values.push("'"+ value +"'");
            }
            var insertSql = "INSERT INTO "+ interestPayName +"(" + keys.join(",") + ") VALUES (" + values.join(",") + ");";
            payPlanSqls.push(insertSql);
        }

        for(var i in receivePlan){
            var receivePlanData = receivePlan[i];

            var keys = [];
            var values = [];
            for(var key in receivePlanData){
                var value = receivePlanData[key];

                keys.push(key);
                values.push("'"+ value +"'");
            }
            var insertSql = "INSERT INTO "+ interestReceiveName +"(" + keys.join(",") + ") VALUES (" + values.join(",") + ");";
            receivePlanSqls.push(insertSql);
        }
    }

    return {
        "payPlan":payPlanSqls,
        "receivePlan":receivePlanSqls
    };
}

function buildPayPlan(projectDatas){
    for(var borrowNid in projectDatas){
        var projectItem = projectDatas[borrowNid];
        var activityData = projectItem["activity"];
        var tenderRecords = projectItem["tenders"];
        var interestRate = activityData["interest_rate"]*1;
        var interestPeriod = activityData["interest_period"]*1;
        var reverifyTime = activityData["reverify_time"];
        var startCountDate = moment(new Date(reverifyTime*1000));
        
        var payPlan = {};
        var receiveRecord = [];

        for(var curPeriod = 1; curPeriod <= interestPeriod; curPeriod++){
            var payAccount = 0;
            startCountDate.add(1, 'M');
            
            var payPlanDate = startCountDate.format('YYYY-MM-DD');
            for(var itr in tenderRecords){
                var tenderData = tenderRecords[itr];
                var tenderAccount = tenderData["account"]*1;
                var tenderNid = tenderData["nid"];
                var tenderUserId = tenderData["user_id"];

                var tenderInterest = calcInterest(tenderAccount , interestRate);
                tenderInterest= Math.floor(tenderInterest * 100)/100;
                payAccount += tenderInterest;

                receiveRecord.push({
                    "borrow_nid":borrowNid,
                    "tender_nid":tenderNid,
                    "tender_userid":tenderUserId,
                    "tender_account":tenderAccount,
                    "interest_account":tenderInterest,
                    "interest_account_yes":0,
                    "interest_account_wait":tenderInterest,
                    "interest_plan_date":payPlanDate,
                    "receive_status":0,
                    "create_date":moment().format('YYYY-MM-DD'),
                    "create_user":0,
                    "interest_period":curPeriod
                });
            }
 
            payPlan[payPlanDate] = {
                "borrow_nid":borrowNid,
                "interest_account":payAccount,
                "interest_account_wait":payAccount,
                "interest_account_yes":0,
                "interest_plan_date":payPlanDate,
                "pay_status":0,
                "interest_period":curPeriod,
                "create_user":0,
                "create_date":moment().format('YYYY-MM-DD')
            };
        }
        projectDatas[borrowNid]["payPlan"] = payPlan;
        projectDatas[borrowNid]["receivePlan"] = receiveRecord;
    }
    return projectDatas;
}

function QueryActivities(conn,callback){
    var selectSQL = sqlConfig["select_interest_activity"];
    conn.query(selectSQL, function (err, rows) {
        if (err) console.log(err);

        console.log("项目数量 ==> " + rows.length);
        callback(rows);
    }); 
}

function QueryTender(conn,datas,callback){
    var selectTenderSQLBase = sqlConfig["select_tender_borrow_nid"];
    var borrowNids = [];
    var projectDatas = {};
    for(var i in datas){
        var activityItem = datas[i];
        var borrowNid = activityItem["borrow_nid"];
        borrowNids.push("'"+ activityItem["borrow_nid"] +"'");
        projectDatas[borrowNid] = {"activity":activityItem,"tenders":[],"payPlan":{},"receivePlan":[]};
    }
    var selectTenderSQL = util.format(selectTenderSQLBase,borrowNids.join(","));

    conn.query(selectTenderSQL, function (err, rows) {
        if (err) console.log(err);

        console.log("投资记录数量 ==> " + rows.length);
        for (var i in rows) {
            var tenderItem = rows[i];
            var borrowNid = tenderItem["borrow_nid"];
            var investAccount = tenderItem["account"];

            projectDatas[borrowNid]["tenders"].push(tenderItem);
        }
        callback(projectDatas);
    });
}

function calcInterest(balance,rate){
    var number = balance * rate/12;
    var str = number + "";
    var strArr = str.split(".");
    return strArr[0]*1 / 100;
}
//conn.end();