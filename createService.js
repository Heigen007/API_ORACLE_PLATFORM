async function createService(oracledb, data) {
    try {
      console.log(data);
      var connection = await oracledb.getConnection();
      var methodId, methodVersionId, parameterId;
      methodId = await connection.execute("SELECT REST_WEB_METHODS_SEQ.nextval FROM dual");
      methodId = methodId.rows[0].NEXTVAL;
      methodVersionId = await connection.execute("SELECT REST_WEB_METHODS_VERSION_SEQ.nextval FROM dual")
      methodVersionId = methodVersionId.rows[0].NEXTVAL;
      sqlId = await connection.execute("SELECT REST_WEB_METHODS_SQL_SEQ.nextval FROM dual");
      sqlId = sqlId.rows[0].NEXTVAL;
      await connection.execute(`INSERT INTO REST_WEB_METHODS VALUES (${methodId}, '${data.ENDPOINT}', ${data.IS_ENABLED ? 1 : 0})`);
      await connection.execute(`INSERT INTO REST_WEB_METHODS_VERSION VALUES (${methodVersionId}, '${data.VERSION_NAME}', ${methodId}, SYSDATE, '${data.pool.POOL_USER}', '${data.pool.POOL_PASSWORD}', '${data.pool.CONNECT_STRING}', ${data.pool.POOL_MIN}, ${data.pool.POOL_MAX}, ${data.pool.POOL_TIMEOUT}, ${data.pool.POOL_PING_INTERVAL}, ${data.pool.QUEUE_MAX}, ${data.pool.QUEUE_TIMEOUT})`);
      for(let i = 0; i < data.PARAMS.length; i++){
        parameterId = await connection.execute("SELECT REST_WEB_METHODS_PARAMETER_SEQ.nextval FROM dual");
        parameterId = parameterId.rows[0].NEXTVAL;
        await connection.execute(`INSERT INTO REST_WEB_METHODS_PARAMETER VALUES (${parameterId}, '${data.PARAMS[i].NAME}', ${data.PARAMS[i].IS_REQUIRED ? 1 : 0}, ${methodId}, ${methodVersionId}, '${data.PARAMS[i].TYPE}', '${data.PARAMS[i].LOCATION}')`);
      }
      if(data.JSON_CONFIG) await connection.execute(`INSERT INTO REST_WEB_METHODS_SQL VALUES (${sqlId}, ${methodId}, ${methodVersionId}, '${data.SQL_CODE}', '${data.JSON_CONFIG}')`);
      else await connection.execute(`INSERT INTO REST_WEB_METHODS_SQL (ID, METHOD_ID, VERSION_ID, SQL_CODE) VALUES (${sqlId}, ${methodId}, ${methodVersionId}, '${data.SQL_CODE}')`);
      
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