const createLog = require("./createLog")

async function createDBPool(oracledb,el){
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

module.exports = createDBPool