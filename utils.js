var fs = require('fs')

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
