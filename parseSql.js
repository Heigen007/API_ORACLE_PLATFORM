const createLog = require("./createLog")

function parseSql(sqlCode, params, parMap){
    try {
        var par
        var smth
        var finalSql = ""
        var sql = sqlCode
        const separators = ['<if', '</if>']
        const paramSeparators = ['testParameter=\'', '\'>']
        
        const result = sql.split(new RegExp(separators.join('|'), 'g'));
        for(let i = 0; i < result.length; i++){
        if(!result[i].includes('testParameter')) finalSql += result[i]
        else{
            par = result[i].split(new RegExp(paramSeparators.join('|'), 'g'));
    
            for (let index = 0; index < params.length; index++) {
            if(params[index] == par[1]) {
                finalSql += par[2]
            }
            }
        }
        }
        finalSql = finalSql.split("${")
        var g
        finalSql = finalSql.map(el => {
        smth = el.split("}", 2)
        if(smth.length > 1){
            g = parMap.find(el => el.name == smth[0])
            if(g.type != "String") return g.result + smth[1]
            else return "'" + g.result + "'" + smth[1]
        } else return el
        })
        return finalSql.join("")
    }
    catch (err) {
        createLog('parseSql', 'ERROR', err)
    }
}

module.exports = parseSql