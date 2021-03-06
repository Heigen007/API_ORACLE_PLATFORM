const createLog = require("./createLog")

async function createNewVersion(oracledb, data) {
    try {
      var connection = await oracledb.getConnection();
      var methodId, methodVersionId, parameterId;
      methodId = await connection.execute(`SELECT ID FROM REST_WEB_METHODS WHERE ENDPOINT = '${data.ENDPOINT}'`);
      methodId = methodId.rows[0].ID;
      methodVersionId = await connection.execute("SELECT REST_WEB_METHODS_VERSION_SEQ.nextval FROM dual")
      methodVersionId = methodVersionId.rows[0].NEXTVAL;
      sqlId = await connection.execute("SELECT REST_WEB_METHODS_SQL_SEQ.nextval FROM dual");
      sqlId = sqlId.rows[0].NEXTVAL;

      await connection.execute(`INSERT INTO REST_WEB_METHODS_VERSION VALUES (${methodVersionId}, '${data.VERSION_NAME}', ${methodId}, SYSDATE, '${data.pool.POOL_USER}', '${data.pool.POOL_PASSWORD}', '${data.pool.CONNECT_STRING}', ${data.pool.POOL_MIN}, ${data.pool.POOL_MAX}, ${data.pool.POOL_TIMEOUT}, ${data.pool.POOL_PING_INTERVAL}, ${data.pool.QUEUE_MAX}, ${data.pool.QUEUE_TIMEOUT}, '${data.DESCRIPTION}')`);
      for(let i = 0; i < data.PARAMS.length; i++){
        parameterId = await connection.execute("SELECT REST_WEB_METHODS_PARAMETER_SEQ.nextval FROM dual");
        parameterId = parameterId.rows[0].NEXTVAL;
        await connection.execute(`INSERT INTO REST_WEB_METHODS_PARAMETER VALUES (${parameterId}, '${data.PARAMS[i].NAME}', ${data.PARAMS[i].IS_REQUIRED ? 1 : 0}, ${methodId}, ${methodVersionId}, '${data.PARAMS[i].TYPE}', '${data.PARAMS[i].LOCATION}', '${data.PARAMS[i].JSON_PATH}')`);
      }
      await connection.execute(`INSERT INTO REST_WEB_METHODS_SQL VALUES (${sqlId}, ${methodId}, ${methodVersionId}, '${data.SQL_CODE}'${data.JSON_CONFIG ? ",'" + data.JSON_CONFIG + "'" : ",''"})`);
      
      connection.commit();
      return [1,1]
  
    } catch (err) {
      createLog('CREATE_NEW_VERSION', 'ERROR', err)
      return [0,err]
    } finally {
      if (connection) {
        await connection.close();
      } else {
        createLog('CREATE_NEW_VERSION', 'ERROR', 'Connection doesn`t exist')
      }
    }
}

module.exports = createNewVersion