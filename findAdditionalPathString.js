function findAdditionalPathString(params) {
    var string = ""
    if(!params) return string
    params.forEach(el => {
      if(el.LOCATION == 'Path'){
        string += "/:"+el.NAME
      }
    })
    return string
}

module.exports = findAdditionalPathString