var express = require('express');
var app = express();
var compression = require('compression')
var cors = require('cors');

const mypw = "(DESCRIPTION =(ADDRESS_LIST =(LOAD_BALANCE = yes)(FAILOVER = on)(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.155)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.154)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.153)(PORT = 1521)))(CONNECT_DATA =(SERVER = DEDICATED)(SERVICE_NAME = ars)(FAILOVER_MODE =(TYPE = SELECT)(METHOD = BASIC)(RETRIES = 5)(DELAY = 15))))"
const port = 3000
const pass = "dfc09073e0bfd69aadbcc433386d5575"

const oracledb = require('oracledb');
const createService = require("./createService")
const createNewVersion = require("./createNewVersion")
const getServices = require("./getServices")
const getServiceInfo = require("./getServiceInfo")
const updateVersion = require("./updateService");
const createLog = require("./createLog")
const findAdditionalPathString = require("./findAdditionalPathString")
const createDBPool = require("./createDBPool");
const method = require("./method")

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [ oracledb.CLOB ];

app.set('view engine', 'ejs');
app.set('view cache', true);
app.use(compression())
app.use(cors())
app.use(express.json());

async function init() {
  try {
    await oracledb.createPool({
      user          : "ARADMIN_CUSTOM_REST",
      password      : "ARS_REST_55pw",
      connectString : mypw,
      poolMax       : 3,
      poolMin       : 3
    });
    app.listen(port, () => {
      createLog('MAIN_PROCESS_CONNECTION', 'SUCCESS', 'Server started')
      makeMAINHttpListeners()
    })
  } catch (err) {
    createLog('MAIN_PROCESS_CONNECTION', 'ERROR', err)
  }
}

init()

app.get('/', function(req, res) {
  res.render('page/index');
});

app.get('/checkPassword', function(req, res) {
  if(req.query.pas && req.query.pas == pass) return res.sendStatus(200)
  return res.sendStatus(300)
});

app.get('/getServices', async function(req, res) {
  var result = await getServices(oracledb)
  if(result) return res.send(result.rows);
  createLog('getServices', 'ERROR', 'Error with getServices part')
  res.status(500).send('Error with getServices part')
});

app.post('/createService', async function(req, res) {
  var result = await createService(oracledb, req.body)
  if(result[0]) {
    createLog('createService(' + req.body.VERSION_NAME + ')', 'SUCCESS', 'Service and version have been created')
    return res.send();
  }
  res.status(500).send('Error with createService part(' + result[1] + ')')
  createLog('getServiceInfo', 'ERROR', 'Error with createService part(' + result[1] + ')')
});

app.post('/getServiceInfo', async function(req, res) {
  var result = await getServiceInfo(oracledb, req.body)
  if(result[0]) return res.send(result[1].rows[0]);
  res.status(500).send('Error with createService part(' + result[1] + ')')
  createLog('getServiceInfo', 'ERROR', 'Error with createService part(' + result[1] + ')')
});

app.post('/createNewVersion', async function(req, res) {
  var result = await createNewVersion(oracledb, req.body)
  if(result[0]) {
    createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'SUCCESS', 'Version has been created')
    return res.send();
  }
  res.status(500).send('Error with createNewVersion part(' + result[1] + ')')
  createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'ERROR', 'Error with createNewVersion part(' + result[1] + ')')
});

app.post('/updateVersion', async function(req, res) {
  var result = await updateVersion(oracledb, req.body)
  if(result[0]) {
    createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'SUCCESS', 'Version has been updated')
    return res.send();
  }
  res.status(500).send('Error with updateVersion part(' + result[1] + ')')
  createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'ERROR', 'Error with updateVersion part(' + result[1] + ')')
});

app.get('/updateHttpListener', async function(req, res) {
  if(!req.query.methodId) {
    createLog('updateHttpListener', 'ERROR', 'methodId has not been sent')
    return res.sendStatus(400)
  }
  var result = await updateHttpListener(req.query.methodId)
  if(result && result == "methodId") {
    createLog('updateHttpListener', 'ERROR', 'methodId(' + req.query.methodId + ') is incorrect. Maybe it is not the last version(only last version can work)')
    return res.sendStatus(400)
  }
  if(result && result == "notEnabled") {
    createLog('updateHttpListener', 'ERROR', 'method is not enabled')
    return res.sendStatus(400)
  }
  if(result) {
    createLog('updateHttpListener', 'SUCCESS', 'version with id = ' + req.query.methodId + ' has been updated')
    return res.send()
  }
  res.status(500).send("Connection to the database is impossible")
  createLog('updateHttpListener', 'ERROR', 'Connection to the database is impossible')
});

async function updateHttpListener(methodId){
  try{
    var connection = await oracledb.getConnection();
    var lastMethodsVersions = await connection.execute(`
    SELECT
      ENDPOINT,
      IS_ENABLED,
      HTTP_METHOD,
      rwmv.ID AS VERSION_ID,
      rwmc.SQL_CODE,
      rwmc.JSON_CONFIG,
      POOL_USER,
      POOL_PASSWORD,
      CONNECT_STRING,
      POOL_MIN,
      POOL_MAX,
      POOL_TIMEOUT,
      POOL_PING_INTERVAL,
      QUEUE_MAX,
      QUEUE_TIMEOUT
    FROM
      REST_WEB_METHODS rwm,
      REST_WEB_METHODS_VERSION rwmv,
      REST_WEB_METHODS_SQL rwmc
    WHERE
      rwm.ID = rwmv.METHOD_ID
    AND
      rwm.ID = rwmc.METHOD_ID
    AND
      rwmc.VERSION_ID = rwmv.ID
    AND
      START_DATE = (
        SELECT max(START_DATE)
        FROM
          REST_WEB_METHODS rwm2,
          REST_WEB_METHODS_VERSION rwmv2
        WHERE
          rwm2.ID = rwmv2.METHOD_ID
        AND
          rwmv2.START_DATE < SYSDATE
        AND
          rwm2.ID = rwm.ID
      )
    AND
      rwmv.ID = ${methodId}
    `)
    lastMethodsVersions = lastMethodsVersions.rows
    if(lastMethodsVersions.length == 0) return "methodId"
    if(!lastMethodsVersions[0].IS_ENABLED) return "notEnabled"
    var el = lastMethodsVersions[0]
    el.SQL_CODE = el.SQL_CODE.replace(/"/g, "'");
    var params = await connection.execute(`
      SELECT
        NAME,
        IS_REQUIRED,
        TYPE,
        rwmp.ID as PARAMETER_ID,
        LOCATION,
        JSON_PATH
      FROM
        REST_WEB_METHODS rwm,
        REST_WEB_METHODS_VERSION rwmv,
        REST_WEB_METHODS_PARAMETER rwmp
      WHERE
        rwm.ID = rwmp.METHOD_ID
      AND
        rwm.ID = rwmv.METHOD_ID
      AND
        rwmp.VERSION_ID = rwmv.ID
      AND
        rwm.ENDPOINT = '${el.ENDPOINT}'
      AND
        rwmv.ID = '${el.VERSION_ID}'
    `)
    params = params.rows
    var poolRes = await createDBPool(oracledb,el)
    if(!poolRes) return false
    var additionalPathString = findAdditionalPathString(params)
    app._router.stack = app._router.stack.filter(el2 => {
      return !(el2.route?.path.split("/:")[0] == '/' + el.ENDPOINT)
    });
    app._router.stack = app._router.stack.filter(el2 => {
      return true
    });
    if(el.HTTP_METHOD == "GET") {
      app.get("/" + el.ENDPOINT + additionalPathString, async function(req,res) {
        await method(req, res, el, params, oracledb)
      })      
    } else if (el.HTTP_METHOD == "POST") {
      app.post("/" + el.ENDPOINT + additionalPathString, async function(req,res) {
        await method(req, res, el, params, oracledb)
      })     
    }
    return 1
  }
  catch (err) {
    createLog('UPDATE_HTTP_LISTENER', 'ERROR', err)
    return 0
  }
  finally {
    if (connection) {
      await connection.close();
    } else {
      createLog('UPDATE_HTTP_LISTENER', 'ERROR', 'Connection doesn`t exist')
    }
  }
}

async function makeMAINHttpListeners(){
  var connectionM = await oracledb.getConnection();
  var lastMethodsVersions = await connectionM.execute(`
  SELECT
    ENDPOINT,
    IS_ENABLED,
    HTTP_METHOD,
    rwmv.ID AS VERSION_ID,
    rwmc.SQL_CODE,
    rwmc.JSON_CONFIG,
    POOL_USER,
    POOL_PASSWORD,
    CONNECT_STRING,
    POOL_MIN,
    POOL_MAX,
    POOL_TIMEOUT,
    POOL_PING_INTERVAL,
    QUEUE_MAX,
    QUEUE_TIMEOUT
  FROM
    REST_WEB_METHODS rwm,
    REST_WEB_METHODS_VERSION rwmv,
    REST_WEB_METHODS_SQL rwmc
  WHERE
    rwm.ID = rwmv.METHOD_ID
  AND
    rwm.ID = rwmc.METHOD_ID
  AND
    rwmc.VERSION_ID = rwmv.ID
  AND
    START_DATE = (
      SELECT max(START_DATE)
      FROM
        REST_WEB_METHODS rwm2,
        REST_WEB_METHODS_VERSION rwmv2
      WHERE
        rwm2.ID = rwmv2.METHOD_ID
      AND
        rwmv2.START_DATE < SYSDATE
      AND
        rwm2.ID = rwm.ID
    )
  `)
  await connectionM.close();
  lastMethodsVersions = lastMethodsVersions.rows
  if(lastMethodsVersions.length == 0) return
  for(let indexM = 0; indexM < lastMethodsVersions.length; indexM ++) {
    await forLoopClosure(lastMethodsVersions, indexM)
  }
  return true
}

async function forLoopClosure(lastMethodsVersions, indexM){
  if(!lastMethodsVersions[indexM].IS_ENABLED) return;
    var connection = await oracledb.getConnection();
    var el = lastMethodsVersions[indexM]
    el.SQL_CODE = el.SQL_CODE.replace(/"/g, "'");
    var params = await connection.execute(`
      SELECT
        NAME,
        IS_REQUIRED,
        TYPE,
        rwmp.ID as PARAMETER_ID,
        LOCATION,
        JSON_PATH
      FROM
        REST_WEB_METHODS rwm,
        REST_WEB_METHODS_VERSION rwmv,
        REST_WEB_METHODS_PARAMETER rwmp
      WHERE
        rwm.ID = rwmp.METHOD_ID
      AND
        rwm.ID = rwmv.METHOD_ID
      AND
        rwmp.VERSION_ID = rwmv.ID
      AND
        rwm.ENDPOINT = '${el.ENDPOINT}'
      AND
        rwmv.ID = '${el.VERSION_ID}'
    `)
    await connection.close()
    params = params.rows
    var poolRes = await createDBPool(oracledb,el)
    if(!poolRes) return false
    var additionalPathString = findAdditionalPathString(params)
    if(el.HTTP_METHOD == "GET") {
      app.get("/" + el.ENDPOINT + additionalPathString, async function(req,res) {
        await method(req, res, el, params, oracledb)
      })      
    } else if (el.HTTP_METHOD == "POST") {
      app.post("/" + el.ENDPOINT + additionalPathString, async function(req,res) {
        await method(req, res, el, params, oracledb)
      })     
    }
}

//http://localhost:8080/updateHttpListener?methodId=27
//http://localhost:8080/endpoint1/12?name=h
