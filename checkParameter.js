const createLog = require("./createLog")

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

module.exports = checkParameter