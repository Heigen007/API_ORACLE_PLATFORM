const createLog = require("./createLog")

async function getServices(oracledb) {
    try {
      var connection = await oracledb.getConnection();
      var result = await connection.execute("SELECT ENDPOINT, VERSION_NAME, v.ID as VERSION_ID FROM REST_WEB_METHODS m, REST_WEB_METHODS_VERSION v WHERE m.ID = v.METHOD_ID");
      return result
    }
    catch (err) {
      createLog('GET_SERVICES', 'ERROR', err)
      return 0
    }
    finally {
      if (connection) {
        await connection.close();
      } else {
        createLog('GET_SERVICES', 'ERROR', 'Connection doesn`t exist')
      }
    }
}


module.exports = getServices