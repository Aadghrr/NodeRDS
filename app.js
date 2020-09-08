//Requirements
const AWS = require('aws-sdk');
const express = require('express');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");

//Setting system variables TODO store as env var where appropriate, and use better crypto token
var urlencodedParser = bodyParser.urlencoded({extended: false});
var jsonParser = bodyParser.json();
var tok = 'fixThisDumbTokenTODO'
var port = process.env.PORT || 3000;
AWS.config.region = process.env.REGION
AWS.config.update({ region: "us-east-1" });
var ddb = new AWS.DynamoDB();
var ddbTable = "dt-test";
const salt = bcrypt

var app = express();
app.use(cookieParser());

//DB Things
const mysql = require('mysql');

//Utility functions
var log = function(entry) {
    fs.appendFileSync('/tmp/app.log', new Date().toISOString() + ' - ' + entry + '\n');
};

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function authenticateToken(req, res, next) {
  jwt.verify(req.cookies['token'], tok, (err, user) => {
    console.log(err)
    if (err) return res.redirect('/')
    req.user = user
    next()}
    )
}

function openConn(){
    console.log("Opening connection. Connection details:",process.env.rdswriter,process.env.rdsuser,process.env.rdspassword)
    const con = mysql.createConnection({
    host: process.env.rdswriter,
    user: process.env.rdsuser,
    password: process.env.rdspassword,
    port: process.env.rdsport,
    ssl: true
   });
  return con
}

app.get('/', function(req,res){
  con = openConn()
  con.connect(function(err) {
    if (err) {
      console.log('error',err)
    }
    else{
      console.log("Connected. Performing data sanity check.");
      con.query('CREATE DATABASE IF NOT EXISTS main;');
      con.query('USE main;');
      con.query('CREATE TABLE IF NOT EXISTS users(id int NOT NULL AUTO_INCREMENT, username varchar(30), email varchar(255), PRIMARY KEY(id), password_hash varchar(255));', function(error, result, fields){
        console.log("erf:", error, result, fields);
      });
    }
    con.end();
});
    res.sendFile('index.html', {root: __dirname });
});

app.get('/users', (req, res) => {
  con = openConn()
    con.connect(function(err) {
        con.query(`SELECT * FROM main.users`, function(err, result, fields) {
            if (err) res.send(err);
            if (result) res.send(result);
        });
    });
});

async function queryDBIndex(indexval){
    try {
        var item = {
            Key: { "index": {"S": indexval} }, 
            TableName: "dt-test"
        };
        var x = await ddb.getItem(item).promise()
        return x
    } catch (error) {
        console.error(error);
    }};

//Routes TODO: organise these into directories
//TODO Figure out how to serve this as a static file in EB nginx/no need to route through the app
app.get('/css/styles.css', function(req,res){
    res.sendFile('css/styles.css', {root: __dirname });
});

app.get('/main',authenticateToken, function(req,res){
        res.sendFile('main.html', {root: __dirname });
});

app.get('/main.js', function(req,res){
        res.sendFile('main.js', {root: __dirname });
});

app.get('/index.js', function(req,res){
        res.sendFile('index.js', {root: __dirname });
});

app.post('/login', urlencodedParser, function(req, res) {
    queryDBIndex(req.body.user).then(passHash => {
        if (Object.keys(passHash).length == 0) {
            res.send('User not found')
        }
          console.log('Login Attempt:')
          console.log(JSON.stringify(req.headers));
        bcrypt.compare(req.body.pass, passHash['Item']['value']['S']).then( (isMatch)=>{
       if(isMatch) {
        console.log('login successful, generating JWT')
        const accessToken =jwt.sign({user:req.body.user}, tok, { expiresIn: '1h' })
        res.cookie('token',accessToken)
        res.redirect('/main')
       } else {
        console.log("no match")
        res.send("Login Failed")
       }
        }).catch(console.log("there was an error")); 
    })
});

app.get('/create', function(req,res){
    res.sendFile('create.html', {root: __dirname });
});

app.post('/create', urlencodedParser, function(req, res) { 
  if (req.body.user && req.body.email && req.body.pass){       
  bcrypt
    .genSalt(10)
    .then(salt => {
      console.log(`Salt: ${salt}`);
    return bcrypt.hash(req.body.pass, salt);
  })
  .then(hash => {
    con = openConn()}).then((hash, con) => {
    console.log("Request recieved:",req.body.user)
    con.connect(function(err){
        con.query(`INSERT INTO main.users (username, email, password_hash) VALUES ('${req.body.user}', '${req.body.email}', '${hash}')`, function(err, result, fields) {
                if (err) res.send(err);
                if (result) res.send({username: req.query.username, email: req.query.email, hash: hash});
                if (fields) console.log(fields);
            });
        con.end()
    })
  })
  .catch(err => console.error(err.message));
  }
  res.send("User created")
});

//Run the app
app.listen(port, function(){
    console.log("App is running on port" + port);
})
