function createLog(endpoint, status, msg) {
    process.stdout.write(endpoint + " || " + status + " || " + msg + ".");
}

module.exports = createLog