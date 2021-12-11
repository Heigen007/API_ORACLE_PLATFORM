function createLog(endpoint, status, msg, host) {
    var str = "Endpoint: " + endpoint + " || Status: " + status + " || Message: " + msg
    if(host) str += " || Host: " + host
    console.log(str);
    str = null
}

module.exports = createLog