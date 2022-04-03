const express = require('express')
const fs = require('fs')
const path = require('path')
const { bufferFile } = require('./utils')
const createDOMPurify = require('dompurify')
const { JSDOM } = require('jsdom')
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)
const md = require('markdown-it')()
  .use(require('markdown-it-anchor'))
  .use(require('markdown-it-table-of-contents'), { 'includeLevel': [1,2,3] })
  .use(require('markdown-it-title'))
  .use(require('markdown-it-footnote'))
  .use(require('markdown-it-checkbox'))

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
  const buffer = bufferFile('/var/www/wiki-web/index.md')
  const fullUrl = 'https://wiki.tomasino.org/'
  const dirty = md.render(buffer)
  const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
  res.render('basic', { title: 'Tomasino Wiki', content: content, canonical: fullUrl})
})

// Any link to a direct static resource will show it
app.use(express.static(path.join(__dirname, '/static')))

// Any other content directly linked will show as-is
app.use(express.static('/var/www/wiki-web'))

// Try anything else as a markdown file or show error page
app.get('*', function(req, res){
  const file = path.join('/var/www/wiki-web/', decodeURIComponent(req.path)) + '.md'
  fs.exists(file, function(exists) {
    console.log('exists:', exists)
    if (exists) {
      const buffer = bufferFile(file)
      const fullUrl = 'https://wiki.tomasino.org' + req.originalUrl
      const env = {}
      const dirty = md.render(buffer, env)
      const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
      const title = env.title + ' | Tomasino Wiki'
      res.render('basic', { title: title, content: content, canonical: fullUrl})
    } else {
      console.log('error!')
      const back = '<a href="/">&lt;&lt; BACK TO HOME</a>'
      const error = '<p>Entry not found. Please try again.</p>'
      const content = back + '<br><br>' + error
      res.status(404)
      const fullUrl = 'https://wiki.tomasino.org' + req.originalUrl
      res.render('basic', { title: 'Error: Content not found', content: content, canonical: fullUrl})
    }
  })
})

app.listen(port, () => console.log(`listening on port ${port}!`))
