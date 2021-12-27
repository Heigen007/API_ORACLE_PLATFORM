const createLog = require("./createLog")
const parseSql = require("./parseSql");
const checkParameter = require("./checkParameter")

async function method(req, res, el, params, oracledb){
    var result;
    var sqlString = el.SQL_CODE
    if(params){
      var paramsArr = []
      var parMap = []
      var isErr = [0,0]
      params.forEach(el2 => {
        result = checkParameter(req,el2)
        if(!result[0]) {isErr[1] = result[1]; return isErr[0] = 1}
        if(result[1] != "NOT_GIVEN") {
          paramsArr.push(el2.NAME)
          parMap.push({name: el2.NAME, type: el2.TYPE, result: result[1]})
        }
      })
      if(isErr[0]) return res.status(400).send(isErr[1])
      sqlString = parseSql(sqlString,paramsArr,parMap)
      try {
        var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
      }
      catch (err) {
        createLog(req.originalUrl, 'ERROR', err, req.headers.host)
        return res.status(500).send("Connection to the database is impossible")
      }
      try {
        var result = await connection2.execute(sqlString);
        await connection2.close()
      } catch (err) {
        createLog(req.originalUrl, 'ERROR', err)
        return res.status(500).send("sql query is incorrect: " + err)
      }
      try{
        if(el.JSON_CONFIG){
          eval(el.JSON_CONFIG)
          createLog(req.originalUrl, 'Success', 'Response was returned successfully with custom json format', req.headers.host)
        } else {
          createLog(req.originalUrl, 'Success', 'Response was returned successfully(' + result.rows.length +' records)', req.headers.host)
          return res.send(result)
        }
      } catch (err) {
        createLog(req.originalUrl, 'ERROR', err)
        return res.status(500).send("JSON code is incorrect: " + err)
      }
    } else {
      try {
        var connection2 = await oracledb.getConnection("endpoint"+el.ENDPOINT);
      }
      catch (err) {
        createLog(req.originalUrl, 'ERROR', err, req.headers.host)
        return res.status(500).send("Connection to the database is impossible")
      }
      try {
        var result = await connection2.execute(sqlString);
        await connection2.close()
      } catch (err) {
        createLog(req.originalUrl, 'ERROR', err)
        return res.status(500).send("sql query is incorrect: " + err)
      }
      try{
        if(el.JSON_CONFIG){
          eval(el.JSON_CONFIG)
          createLog(req.originalUrl, 'Success', 'Response was returned successfully with custom json format', req.headers.host)
        } else {
          createLog(req.originalUrl, 'Success', 'Response was returned successfully(' + result.rows.length +' records)', req.headers.host)
          return res.send(result)
        }
      } catch (err) {
        createLog(req.originalUrl, 'ERROR', err)
        return res.status(500).send("JSON code is incorrect: " + err)
      }
    }
    sqlString = null
}
module.exports = method