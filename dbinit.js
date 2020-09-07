const mysql = require('mysql');

const con = mysql.createConnection({
    host: process.env.rdswriter,
    user: process.env.rdsuser,
    password: process.env.rdspassword
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
    con.end();
});
