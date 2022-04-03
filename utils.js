var fs = require('fs')
const readline = require('readline')
const { once } = require('events')
var exec = require('child_process').exec

function bufferFile(path) {
  try {
    return fs.readFileSync(path, { encoding: 'utf8' })
  } catch (_e) {
    return ''
  }
}

module.exports = {
  bufferFile: bufferFile
}
