const express = require('express')
const fs = require('fs')
const path = require('path')
const { bufferFile } = require('./utils')
const { DOMPurify } = require('dompurify')
const { marked } = require('marked')

const app = express()
const port = 3000

app.engine('wiki', function (filePath, options, callback) {
  fs.readFile(filePath, function (err, content) {
    var s
    if (err) return callback(err)
    var rendered = content.toString()
    for (s in options) {
      if (typeof options[s] === 'string') {
        rendered = rendered.replace('##' + s + '##', options[s])
      }
    }
    return callback(null, rendered)
  })
})

app.set('views', './views')
app.set('view engine', 'wiki')

app.get('/', async function (_req, res) {
  const file = bufferFile('/var/www/wiki-web/index.md')
  const fullUrl = 'https://wiki.tomasino.org/'
  const dirty = marked.parse(file)
  const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
  res.render('basic', { content: content, canonical: fullUrl})
})

// Any link to a direct static resource will show it
app.use(express.static(path.join(__dirname, '/static')))

// Any other gopher content directly linked will show as-is
app.use(express.static('/var/gopher'))

// Grab anything that's a .txt and wrap it in .html
app.get('*', function(req, res){
  let error = false
  if (req.path.indexOf('.html') !== -1) {
    const file = path.join('/var/www/wiki-web/', decodeURIComponent(req.path).replace(/\.html/, '.md'))
    fs.exists(file, function(exists) {
      if (exists) {
        const file = bufferFile('/var/www/wiki-web/' + decodeURIComponent(req.path).replace(/\.html/, '.md'))
        const fullUrl = 'https://wiki.tomasino.org' + req.originalUrl
        const dirty = marked.parse(file)
        const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
        res.render('basic', { content: content, canonical: fullUrl})
      } else {
        error = true
      }
    })
  } else {
    error = true
  }

  // If resource isn't found, give the 404
  if (error) {
    const back = '<a href="/"><span class="dim">&lt;&lt;</span> BACK TO HOME</a>'
    const error = 'Entry not found. Please try again.'
    const content = back + '\n\n' + error
    res.status(404)
    const fullUrl = 'https://wiki.tomasino.org' + req.originalUrl
    res.render('basic', { content: content, canonical: fullUrl})
  }
})

app.listen(port, () => console.log(`listening on port ${port}!`))
