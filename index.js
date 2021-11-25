var express = require('express');
var app = express();
const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [ oracledb.CLOB ];
const mypw = "(DESCRIPTION =(ADDRESS_LIST =(LOAD_BALANCE = yes)(FAILOVER = on)(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.155)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.154)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 10.8.70.153)(PORT = 1521)))(CONNECT_DATA =(SERVER = DEDICATED)(SERVICE_NAME = ars)(FAILOVER_MODE =(TYPE = SELECT)(METHOD = BASIC)(RETRIES = 5)(DELAY = 15))))"
const port = 8080
const createService = require("./createService")
const createNewVersion = require("./createNewVersion")
const getServices = require("./getServices.js")
const getServiceInfo = require("./getServiceInfo")
const updateVersion = require("./updateService");
app.use(express.json());
app.set('view engine', 'ejs');

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
        console.log("Server started!");
        makeMAINHttpListeners()
      })
  
    } catch (err) {
      console.log(err.message)
    }
}

init()

app.get('/', function(req, res) {
    res.render('page/index');
});
app.get('/getServices', async function(req, res) {
  var result = await getServices(oracledb)
  res.send(result.rows);
});
app.post('/createService', async function(req, res) {
    var result = await createService(oracledb, req.body)
    res.status(result ? 200 : 500).send()
});
app.post('/getServiceInfo', async function(req, res) {
  var result = await getServiceInfo(oracledb, req.body)
  res.send(result.rows[0])
});
app.post('/createNewVersion', async function(req, res) {
  var result = await createNewVersion(oracledb, req.body)
  res.status(result ? 200 : 500).send()
});
app.post('/updateVersion', async function(req, res) {
  var result = await updateVersion(oracledb, req.body)
  res.status(result ? 200 : 500).send()
});
app.get('/makeHttpListeners', async function(req, res) {
  var param = req.query.methodId
  var result = await makeHttpListeners(param)
  if(result) res.status(200).send()
  res.status(500).send()
});

async function makeHttpListeners(methodId){
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
  if(!lastMethodsVersions) return false
  if(!lastMethodsVersions[0].IS_ENABLED) return false;
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
  app.get("/" + el.ENDPOINT + additionalPathString, async function(req,res) {
    
    var result;
    if(params){
      var paramsStr = ""
      var paramsArr = []
      var parMap = []
      params.forEach(el2 => {
        result = checkParameter(req,el2)
        if(!result) res.status(401).send()
        if(result != "NOT_GIVEN"){
          paramsStr+=`var ${el2.NAME} = ${result};\n`
          paramsArr.push(el2.NAME)
          parMap.push({name: el2.NAME, type: el2.TYPE})
        }
      })
      eval(paramsStr)
      if(el.SQL_CODE.includes("<if testParameter="))
      var sqlCopyStr = parseSql(el.SQL_CODE,paramsArr,parMap)
      var sqlString = eval('`'+sqlCopyStr+'`')
      var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
      var result = await connection2.execute(sqlString);
      await connection2.close();
      if(el.JSON_CONFIG){
        eval(el.JSON_CONFIG)
      } else {
        res.status(200).send(result)
      }
    } else {
      var sqlString = eval('`'+el.SQL_CODE+'`')
      var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
      var result = await connection2.execute(sqlString);
      await connection2.close();
      if(el.JSON_CONFIG){
        eval(el.JSON_CONFIG)
      } else {
        res.status(200).send(result)
      }
    }
  })
  await connection.close();
  return true
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
  var param;
  if(el.LOCATION == 'URL'){
    param = req.query[el.NAME]
  } else if(el.LOCATION == 'Header'){
    param = req.headers[el.NAME.toLowerCase()]
  } else if(el.LOCATION == 'Path'){
    param = req.params[el.NAME]
  }
  if(el.IS_REQUIRED && !param) return false
  if(!param) return "NOT_GIVEN"
  if(el.TYPE == "Integer"){
    if(!Number(param) || param?.includes('e') || param.length > 20 || param.includes('.')) return false
    return param
  }
  if(el.TYPE == "Number"){
    if(!Number(param) || param?.includes('e') || param.length > 20) return false
    return param
  }
  return "'" + param + "'"
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
    console.dir(err);
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
      if(g.type != "String") return "${" + el
      else return "'${" +smth[0] + "}'" + smth[1]
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
  if(!lastMethodsVersions) return false
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
      if(params){
        var paramsStr = ""
        var paramsArr = []
        var parMap = []
        params.forEach(el2 => {
          result = checkParameter(req,el2)
          if(!result) res.status(401).send()
          if(result != "NOT_GIVEN"){
            paramsStr+=`var ${el2.NAME} = ${result};\n`
            paramsArr.push(el2.NAME)
            parMap.push({name: el2.NAME, type: el2.TYPE})
          }
        })
        eval(paramsStr)
        console.log(el.SQL_CODE);
        var sqlCodeCopy = el.SQL_CODE
        if(sqlCodeCopy.includes("<if testParameter=")){
          var sqlCopyStr = parseSql(sqlCodeCopy,paramsArr,parMap)
          sqlCodeCopy = eval('`'+sqlCopyStr+'`')
        }
        var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
        
        var result = await connection2.execute(sqlCodeCopy);
        await connection2.close();
        if(el.JSON_CONFIG){
          eval(el.JSON_CONFIG)
        } else {
          res.status(200).send(result)
        }
      } else {
        var sqlString = eval('`'+el.SQL_CODE+'`')
        var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
        var result = await connection2.execute(sqlString);
        await connection2.close();
        if(el.JSON_CONFIG){
          eval(el.JSON_CONFIG)
        } else {
          res.status(200).send(result)
        }
      }
    })
}



// part = sql[index].split("</if>")
// part = part[0].split("\">", 1)
// console.log(part,"|||");
//http://localhost:8080/makeHttpListeners?methodId=27
//http://localhost:8080/endpoint1/12?name=h
