async function createService(oracledb, data) {
    try {
      var connection = await oracledb.getConnection();

      await connection.execute(`UPDATE REST_WEB_METHODS_VERSION SET VERSION_NAME = '${data.VERSION_NAME}', POOL_USER = '${data.pool.POOL_USER}', POOL_PASSWORD = '${data.pool.POOL_PASSWORD}', CONNECT_STRING = '${data.pool.CONNECT_STRING}', POOL_MIN = ${data.pool.POOL_MIN}, POOL_MAX = ${data.pool.POOL_MAX}, POOL_TIMEOUT = ${data.pool.POOL_TIMEOUT}, POOL_PING_INTERVAL = ${data.pool.POOL_PING_INTERVAL}, QUEUE_MAX = ${data.pool.QUEUE_MAX}, QUEUE_TIMEOUT = ${data.pool.QUEUE_TIMEOUT} WHERE ID = ${data.VERSION_ID}`);
      for(let i = 0; i < data.PARAMS.length; i++){
          if(data.PARAMS[i].PARAMETER_ID) { var s = await connection.execute(`UPDATE REST_WEB_METHODS_PARAMETER SET NAME = '${data.PARAMS[i].NAME}', IS_REQUIRED = ${data.PARAMS[i].IS_REQUIRED ? 1 : 0}, TYPE = '${data.PARAMS[i].TYPE}', LOCATION = '${data.PARAMS[i].LOCATION}' WHERE ID = ${data.PARAMS[i].PARAMETER_ID}`);
            console.log(s);
          }
          else {
            var parameterId = await connection.execute("SELECT REST_WEB_METHODS_PARAMETER_SEQ.nextval FROM dual");
            parameterId = parameterId.rows[0].NEXTVAL;
            await connection.execute(`INSERT INTO REST_WEB_METHODS_PARAMETER VALUES (${parameterId}, '${data.PARAMS[i].NAME}', ${data.PARAMS[i].IS_REQUIRED ? 1 : 0}, ${data.METHOD_ID}, ${data.VERSION_ID}, '${data.PARAMS[i].TYPE}', '${data.PARAMS[i].LOCATION}')`);
          }
      }
      data.SQL_CODE = data.SQL_CODE.replace(/'/g, "\"");
      if(data.JSON_CONFIG) await connection.execute(`UPDATE REST_WEB_METHODS_SQL SET SQL_CODE = '${data.SQL_CODE}', JSON_CONFIG = '${data.JSON_CONFIG}'  WHERE ID = ${data.SQLID}`);
      else await connection.execute(`UPDATE REST_WEB_METHODS_SQL SET SQL_CODE = '${data.SQL_CODE}' WHERE ID = ${data.SQLID}`);
      console.log(2);
      
      connection.commit();
      return 1
  
    } catch (err) {
      console.log(err);
      return 0
    } finally {
      if (connection) {
        await connection.close();
      }
    }
}

module.exports = createService