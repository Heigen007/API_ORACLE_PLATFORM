async function createService(oracledb) {
    try {
      var connection = await oracledb.getConnection();
      var result = await connection.execute("SELECT ENDPOINT, VERSION_NAME, v.ID as VERSION_ID FROM REST_WEB_METHODS m, REST_WEB_METHODS_VERSION v WHERE m.ID = v.METHOD_ID");
      return result
    }
    catch (err) {
      console.log(err);
      return 0
    }
    finally {
      if (connection) {
        await connection.close();
      }
    }
}

module.exports = createService