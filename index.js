const express = require('express')
const fs = require('fs')
const path = require('path')
const findInFiles = require('find-in-files')
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
  .use(require('markdown-it-underline'))
  .use(require('markdown-it-prism'))

const rootURL = 'https://wiki.tomasino.org'
const app = express()
const port = 3000

// Engine for simple variable replacement in views
app.engine('wiki', function (filePath, options, callback) {
  fs.readFile(filePath, function (err, content) {
    let s
    if (err) return callback(err)
    let rendered = content.toString()
    for (s in options) {
      if (typeof options[s] === 'string') {
        rendered = rendered.replace('##' + s + '##', options[s])
      }
    }
    return callback(null, rendered)
  })
})

// Set up paths to views
app.set('views', './views')
app.set('view engine', 'wiki')

// Homepage
app.get('/', function (_req, res) {
  const fullUrl = rootURL + '/'
  try {
    const buffer = fs.readFileSync('/var/www/wiki-web/index.wiki', { encoding: 'utf8' })
    const dirty = md.render(buffer)
    const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
    res.render('basic', { title: 'Tomasino Wiki', content: content, canonical: fullUrl})
  } catch (_e) {
    const content = '<p>There was a problem loading the website. Please try again later.</p>'
    res.status(404)
    res.render('basic', { title: 'Error: Problem loading site', content: content, canonical: fullUrl})
  }
})

app.get('/search/:query', async function (req, res) {
  const fullUrl = rootURL + '/search/'
  const query = DOMPurify.sanitize(req.params.query)
  try {
    let buffer = ''
    const results = await findInFiles.find({'term': query, 'flags': 'ig'}, '/var/www/wiki-web/', '.wiki$')
    buffer += '# Found ' + Object.keys(results).length + ' matches\n'
    for (const result in results) {
      const match = results[result]
      const link = result.replace(/\/var\/www\/wiki-web\//, '').replace(/\.wiki$/, '')
      if (link !== 'index') {
        buffer += '* [' + link.replace(/-/g, ' ').replace(/ {3}/g, ' - ') + '](/' + link + ') (' + match.count + ')\n'
      }
    }
    const dirty = md.render(buffer)
    const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
    res.render('basic', { title: 'Tomasino Wiki - Search', content: content, canonical: fullUrl})
  } catch (_e) {
    const content = '<p>There was a problem loading the website. Please try again later.</p>'
    res.status(404)
    res.render('basic', { title: 'Error: Problem loading site', content: content, canonical: fullUrl})
  }
})

// Any link to a direct static resource will show it
app.use(express.static(path.join(__dirname, '/static')))

// Any other content directly linked will show as-is
app.use(express.static('/var/www/wiki-web'))

// Try anything else as a markdown file or show error page
app.get('*', function(req, res){
  const fullUrl = rootURL + req.originalUrl
  try {
    const file = path.join('/var/www/wiki-web/', decodeURIComponent(req.path)) + '.wiki'
    const buffer = fs.readFileSync(file, { encoding: 'utf8' })
    const env = {}
    const dirty = md.render(buffer, env)
    const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
    const title = env.title + ' | Tomasino Wiki'
    res.render('basic', { title: title, content: content, canonical: fullUrl})
  } catch (_e) {
    // Check if we have an unnecessary end slash and redirect
    fs.stat(path.join('/var/www/wiki-web/', decodeURIComponent(req.path)).replace(/\/$/, '') + '.wiki', (error) => {
      if (error) {
        const back = '<a href="/">&lt;&lt; BACK TO HOME</a>'
        const error = '<p>Entry not found. Please try again.</p>'
        const content = back + '<br><br>' + error
        res.status(404)
        res.render('basic', { title: 'Error: Content not found', content: content, canonical: fullUrl})
      } else {
        res.redirect(301, 'https://wiki.tomasino.org' + req.originalUrl.replace(/\/$/, ''))
      }
    })
  }
})

app.listen(port, () => console.log(`listening on port ${port}!`))
