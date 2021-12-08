var express = require('express');
var app = express();
var compression = require('compression')
const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [ oracledb.CLOB ];
const mypw = "(DESCRIPTION =(ADDRESS_LIST =(LOAD_BALANCE = yes)(FAILOVER = on)(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.155)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.154)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.153)(PORT = 1521)))(CONNECT_DATA =(SERVER = DEDICATED)(SERVICE_NAME = ars)(FAILOVER_MODE =(TYPE = SELECT)(METHOD = BASIC)(RETRIES = 5)(DELAY = 15))))"
const port = 3000
const createService = require("./createService")
const createNewVersion = require("./createNewVersion")
const getServices = require("./getServices.js")
const getServiceInfo = require("./getServiceInfo")
const updateVersion = require("./updateService");
const createLog = require("./createLog")
var cors = require('cors')
app.use(cors())
app.use(express.json());
app.set('view engine', 'ejs');
app.set('view cache', true);
app.use(compression())
async function init() {
    try {
      await oracledb.createPool({
        user          : "ARADMIN_CUSTOM_REST",
        password      : "ARS_REST_55pw",
        connectString : mypw,
        poolMax       : 3,
        poolMin       : 3
      });
  // "192.168.1.4",
      app.listen(port, () => {
        createLog('MAIN_PROCESS_CONNECTION', 'SUCCESS', 'Server started!')
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
app.get('/getServices', async function(req, res) {
  var result = await getServices(oracledb)
  if(result) {
    return res.send(result.rows);
  }
  res.status(500).send('Error with getServices part')
});
app.post('/createService', async function(req, res) {
    var result = await createService(oracledb, req.body)
    if(result[0]) {
      createLog('createService(' + req.body.VERSION_NAME + ')', 'SUCCESS', 'Service and version have been created')
      return res.send();
    }
    res.status(500).send('Error with createService part(' + result[1] + ')')
    createLog('getServiceInfo', 'ERROR', 'Error with createService part')

});
app.post('/getServiceInfo', async function(req, res) {
  var result = await getServiceInfo(oracledb, req.body)
  if(result[0]) {
    return res.send(result[1].rows[0]);
  }
  res.status(500).send('Error with createService part(' + result[1] + ')')
  createLog('getServiceInfo', 'ERROR', 'Error with getServiceInfo')
});
app.post('/createNewVersion', async function(req, res) {
  var result = await createNewVersion(oracledb, req.body)
  if(result[0]) {
    createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'SUCCESS', 'Version has been created')
    return res.send();
  }
  res.status(500).send('Error with createNewVersion part(' + result[1] + ')')
  createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'ERROR', 'Error with createNewVersion part')
});
app.post('/updateVersion', async function(req, res) {
  var result = await updateVersion(oracledb, req.body)
  if(result[0]) {
    createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'SUCCESS', 'Version has been updated')
    return res.send();
  }
  res.status(500).send('Error with updateVersion part(' + result[1] + ')')
  createLog('updateVersion(' + req.body.VERSION_NAME + ')', 'ERROR', 'Error with updateVersion part')
});
app.get('/updateHttpListener', async function(req, res) {
  if(!req.query.methodId) {
    createLog('updateHttpListener', 'ERROR', 'methodId has not been sent')
    return res.sendStatus(400)
  }
  var result = await updateHttpListener(req.query.methodId)
  if(result && result == "methodId") {
    createLog('updateHttpListener', 'ERROR', 'methodId(' + req.query.methodId + ') is incorrect')
    return res.sendStatus(400)
  }
  if(result) {
    createLog('updateHttpListener', 'SUCCESS', 'methodId(' + req.query.methodId + ') has been updated')
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
    var el = lastMethodsVersions[0]
    el.SQL_CODE = el.SQL_CODE.replace(/"/g, "'");
    var params = await connection.execute(`
      SELECT
        NAME,
        IS_REQUIRED,
        TYPE,
        rwmp.ID as PARAMETER_ID,
        LOCATION
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
    var poolRes = await createDBPool(el)
    if(!poolRes) return false
    var additionalPathString = findAdditionalPathString(params)
    app._router.stack = app._router.stack.filter(el2 => {
      return el2.route?.path != `/${el.ENDPOINT}${additionalPathString}`
    });
    if(!lastMethodsVersions[0].IS_ENABLED) return 1
    app.get("/" + el.ENDPOINT + additionalPathString, async function(req,res) {
      
      var result;
      var sqlString = el.SQL_CODE
      if(params){
        var paramsArr = []
        var parMap = []
        var isErr = [0,0]
        params.forEach(el2 => {
          result = checkParameter(req,el2)
          if(!result[0]) {isErr[1] = result[1]; return isErr[0] = 1}
          if(result[1] != "NOT_GIVEN"){
            paramsArr.push(el2.NAME)
            parMap.push({name: el2.NAME, type: el2.TYPE, result: result[1]})
          }
        })
        if(isErr[0]) return res.status(400).send(isErr[1])
        if(sqlString.includes("<if testParameter=")) sqlString = parseSql(sqlString,paramsArr,parMap)
        try {
          var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
        }
        catch (err) {
          createLog(el.ENDPOINT, 'ERROR', err)
          return res.status(500).send("Connection to the database is impossible")
        }
        try{
          var result = await connection2.execute(sqlString);
          await connection2.close()
          if(el.JSON_CONFIG){
            eval(el.JSON_CONFIG)
            createLog(el.ENDPOINT, 'Success', 'Response was returned successfully with custom json format')
          } else {
            createLog(el.ENDPOINT, 'Success', 'Response was returned successfully(' + result.rows.length +' records)')
            return res.send(result)
          }
        } catch (err) {
          createLog(el.ENDPOINT, 'ERROR', err)
          return res.status(500).send("sql query is incorrect: " + err)
        }
      } else {
        try{
          var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
        }
        catch (err) {
          createLog(el.ENDPOINT, 'ERROR', err)
          return res.status(500).send("Connection to the database is impossible")
        }
        var result = await connection2.execute(sqlString);
        await connection2.close();
        if(el.JSON_CONFIG){
          eval(el.JSON_CONFIG)
          createLog(el.ENDPOINT, 'Success', 'Response was returned successfully with custom json format')
        } else {
          createLog(el.ENDPOINT, 'Success', 'Response was returned successfully(' + result.rows.length +' records)')
          return res.send(result)
        }
      }
      sqlString = null
    })
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

function findAdditionalPathString(params) {
  var string = ""
  if(!params) return string
  params.forEach(el => {
    if(el.LOCATION == 'Path'){
      string += "/:"+el.NAME
    }
  })
  return string
}

function checkParameter(req,el) {
  try {
    var param;
    if(el.LOCATION == 'URL'){
      param = req.query[el.NAME]
    } else if(el.LOCATION == 'Header'){
      param = req.headers[el.NAME.toLowerCase()]
    } else if(el.LOCATION == 'Path'){
      param = req.params[el.NAME]
    }
    if(el.IS_REQUIRED && !param) return [0, el.NAME + ' is required']
    if(!param) return [1,"NOT_GIVEN"]
    if(el.TYPE == "Integer"){
      if(!Number(param) || param?.includes('e') || param.length > 20 || param.includes('.')) return [0,el.NAME + ' should have INTEGER type']
      return [1,param]
    }
    if(el.TYPE == "Number"){
      if(!Number(param) || param?.includes('e') || param.length > 20) return [0,el.NAME + ' should have NUMBER type']
      return [1,param]
    }
    return [1,"'" + param + "'"]
  }
  catch (err) {
    createLog('CHECK_PARAMETER', 'ERROR', err)
    return [0]
  }
}

async function createDBPool(el){
  try{
    try{
      var closingPool = await oracledb.getPool("endpoint" + el.ENDPOINT)
      if(closingPool) {
        await closingPool.reconfigure({
          user            : el.POOL_USER,
          password        : el.POOL_PASSWORD,
          connectString   : el.CONNECT_STRING,
          poolMax         : el.POOL_MAX,
          poolMin         : el.POOL_MIN,
          poolTimeout     : el.POOL_TIMEOUT,
          poolPingInterval: el.POOL_PING_INTERVAL,
          queueMax        : el.QUEUE_MAX,
          queueTimeout    : el.QUEUE_TIMEOUT,
          poolAlias       : "endpoint" + el.ENDPOINT
        });
      }
      return true
    }
    catch{
      await oracledb.createPool({
        user            : el.POOL_USER,
        password        : el.POOL_PASSWORD,
        connectString   : el.CONNECT_STRING,
        poolMax         : el.POOL_MAX,
        poolMin         : el.POOL_MIN,
        poolTimeout     : el.POOL_TIMEOUT,
        poolPingInterval: el.POOL_PING_INTERVAL,
        queueMax        : el.QUEUE_MAX,
        queueTimeout    : el.QUEUE_TIMEOUT,
        poolAlias       : "endpoint" + el.ENDPOINT
      });
      return true
    }
  }
  catch (err){
    createLog('CREATE_DB_POOL', 'ERROR', err)
    return false
  }
  
}

function parseSql(sqlCode, params, parMap){
  var par
  var smth
  var finalSql = ""
  var sql = sqlCode
  const separators = ['<if', '</if>']
  const paramSeparators = ['testParameter=\'', '\'>']
  
  const result = sql.split(new RegExp(separators.join('|'), 'g'));
  for(let i = 0; i < result.length; i++){
    if(!result[i].includes('testParameter')) finalSql += result[i]
    else{
      par = result[i].split(new RegExp(paramSeparators.join('|'), 'g'));

      for (let index = 0; index < params.length; index++) {
        if(params[index] == par[1]) {
          finalSql += par[2]
        }
      }
    }
  }
  finalSql = finalSql.split("${")
  var g
  finalSql = finalSql.map(el => {
    smth = el.split("}", 2)
    if(smth.length > 1){
      g = parMap.find(el => el.name == smth[0])
      if(g.type != "String") return g.result + smth[1]
      else return "'" + g.result + "'" + smth[1]
    } else return el
  })
  return finalSql.join("")
}


async function makeMAINHttpListeners(){
  var connectionM = await oracledb.getConnection();
  var lastMethodsVersions = await connectionM.execute(`
  SELECT
    ENDPOINT,
    IS_ENABLED,
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
  for(let indexM = 0; indexM < lastMethodsVersions.length; indexM ++){
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
        LOCATION
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
    var poolRes = await createDBPool(el)
    if(!poolRes) return false
    var additionalPathString = findAdditionalPathString(params)
    app._router.stack = app._router.stack.filter(el2 => {
      return el2.route?.path != `/${el.ENDPOINT}${additionalPathString}`
    });
    app.get("/" + el.ENDPOINT + additionalPathString, async function(req,res) {
      var result;
      var sqlString = el.SQL_CODE
      if(params){
        var paramsArr = []
        var parMap = []
        var isErr = [0,0]
        params.forEach(el2 => {
          result = checkParameter(req,el2)
          if(!result[0]) {isErr[1] = result[1]; return isErr[0] = 1}
          if(result[1] != "NOT_GIVEN"){
            paramsArr.push(el2.NAME)
            parMap.push({name: el2.NAME, type: el2.TYPE, result: result[1]})
          }
        })
        if(isErr[0]) return res.status(400).send(isErr[1])
        if(sqlString.includes("<if testParameter=")){
          sqlString = parseSql(sqlString,paramsArr,parMap)
        }
        try{
          var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
        }
        catch (err) {
          createLog(el.ENDPOINT, 'ERROR', err)
          return res.status(500).send("Connection to the database is impossible")
        }
        try{
          var result = await connection2.execute(sqlString);
          await connection2.close()
          if(el.JSON_CONFIG){
            eval(el.JSON_CONFIG)
            createLog(el.ENDPOINT, 'Success', 'Response was returned successfully with custom json format')
          } else {
            createLog(el.ENDPOINT, 'Success', 'Response was returned successfully(' + result.rows.length +' records)')
            return res.send(result)
          }
        } catch (err){
          createLog(el.ENDPOINT, 'ERROR', err)
          return res.status(500).send("sql query is incorrect: " + err)
        }
      } else {
        try{
          var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
        }
        catch (err) {
          createLog(el.ENDPOINT, 'ERROR', err)
          return res.status(500).send("Connection to the database is impossible")
        }
        try{
          var result = await connection2.execute(sqlString);
          await connection2.close();
          if(el.JSON_CONFIG){
            eval(el.JSON_CONFIG)
            createLog(el.ENDPOINT, 'Success', 'Response was returned successfully with custom json format')
          } else {
            createLog(el.ENDPOINT, 'Success', 'Response was returned successfully(' + result.rows.length +' records)')
            return res.send(result)
          }
        } catch (err){
          createLog(el.ENDPOINT, 'ERROR', err)
          return res.status(500).send("sql query is incorrect: " + err)
        }
      }
      sqlString = null
    })
}

//http://localhost:8080/updateHttpListener?methodId=27
//http://localhost:8080/endpoint1/12?name=h
