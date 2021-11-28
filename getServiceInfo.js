const createLog = require("./createLog")

async function createService(oracledb, data) {
    try {
      var connection = await oracledb.getConnection();
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
            rwm.ENDPOINT = '${data.ENDPOINT}'
        AND
            rwmv.ID = '${data.VERSION_ID}'
      `)
      var result = await connection.execute(`
        SELECT
          rwm.ENDPOINT,
          rwm.ID AS METHOD_ID,
          rwm.IS_ENABLED,
          rwmc.SQL_CODE,
          rwmc.JSON_CONFIG,
          rwmc.ID as SQLID,
          rwmv.VERSION_NAME,
          rwmv.ID as REST_WEB_METHOD_VERSION,
          rwmv.CONNECT_STRING,
          rwmv.POOL_USER,
          rwmv.POOL_PASSWORD,
          rwmv.POOL_MAX,
          rwmv.POOL_MIN,
          rwmv.POOL_TIMEOUT,
          rwmv.POOL_PING_INTERVAL,
          rwmv.QUEUE_MAX,
          rwmv.QUEUE_TIMEOUT,
          rwmv.ID AS VERSION_ID,
          rwmv.DESCRIPTION
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
          rwm.ENDPOINT = '${data.ENDPOINT}'
        AND
          rwmv.ID = '${data.VERSION_ID}'
      `);
      result.rows[0].PARAMS = params.rows
      return result
    }
    catch (err) {
      createLog('GET_SERVICE_INFO', 'ERROR', err)
      return 0
    }
    finally {
      if (connection) {
        await connection.close();
      } else {
        createLog('GET_SERVICE_INFO', 'ERROR', 'Connection doesn`t exist')
      }
    }
}

module.exports = createService