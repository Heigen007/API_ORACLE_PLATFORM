const createLog = require("./createLog")
const jp = require('jsonpath');

function checkParameter(req,el) {
    try {
      var param;
      if (el.LOCATION == 'URL') {
        param = req.query[el.NAME]
      } else if (el.LOCATION == 'Header') {
        param = req.headers[el.NAME.toLowerCase()]
      } else if (el.LOCATION == 'Path') {
        param = req.params[el.NAME]
      } else if (el.LOCATION == 'Body') {
        var temp = jp.query(req.body, el.JSON_PATH);
        if(temp.length == 1){
          param = temp[0]
        } 
      }
      if(el.IS_REQUIRED && !param) return [0, el.NAME + ' is required']
      if(!param) return [1,"NOT_GIVEN"]
      if(el.TYPE == "Integer"){
        if(!Number(param) || param.length > 20 || param % 1 != 0) return [0,el.NAME + ' should have INTEGER type']
        return [1,param]
      }
      if(el.TYPE == "Number"){
        if(!Number(param) || param.length > 20) return [0,el.NAME + ' should have NUMBER type']
        return [1,param]
      }
      return [1,"'" + param + "'"]
    }
    catch (err) {
      createLog('CHECK_PARAMETER', 'ERROR', err)
      return [0, err]
    }
}

module.exports = checkParameter