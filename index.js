const express = require('express')
const fs = require('fs')
const path = require('path')
const findInFiles = require('find-in-files')
const createDOMPurify = require('dompurify')
const { JSDOM } = require('jsdom')
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)
const { parse } = require('csv-parse')
const md = require('markdown-it')({typographer: true})
  .use(require('markdown-it-anchor'))
  .use(require('markdown-it-table-of-contents'), { 'includeLevel': [1,2,3] })
  .use(require('markdown-it-title'))
  .use(require('markdown-it-footnote'))
  .use(require('markdown-it-checkbox'))
  .use(require('markdown-it-underline'))
  .use(require('markdown-it-prism'))
  .use(require('@jamestomasino/markdown-it-vimwikitags'))

const rootURL = 'https://wiki.tomasino.org'
const rootFolder = '/var/www/wiki-web/'
const trackFolder = '/var/www/track/'
const sourceFileExt = '.md'
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
    const file = path.join(rootFolder, 'index' + sourceFileExt)
    const buffer = fs.readFileSync(file, { encoding: 'utf8' })
    const dirty = md.render(buffer)
    const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
    res.render('index', { title: 'Tomasino Wiki', content: content, canonical: fullUrl})
  } catch (_e) {
    const content = '<p>There was a problem loading the website. Please try again later.</p>'
    res.status(404)
    res.render('basic', { title: 'Error: Problem loading site', content: content, canonical: fullUrl})
  }
})

app.get('/search/', async function (req, res) {
  const fullUrl = rootURL + '/search/'
  const query = DOMPurify.sanitize(req.query.q)
  try {
    let buffer = ''
    const results = await findInFiles.find({'term': query, 'flags': 'ig'}, rootFolder, sourceFileExt + '$')
    buffer += '# Found ' + Object.keys(results).length + ' matches\n'
    const resultsFormatted = []
    for (const result in results) {
      const match = results[result]
      const link = result.replace(rootFolder, '').replace(sourceFileExt, '')
      if (link !== 'index') {
        resultsFormatted.push('* [' + link.replace(/-/g, ' ').replace(/ {3}/g, ' - ') + '](/' + link + ') (' + match.count + ')\n')
      }
    }
    const resultsSorted = resultsFormatted.sort()
    buffer += resultsSorted.join('')
    const dirty = md.render(buffer)
    const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
    res.render('basic', { title: 'Tomasino Wiki - Search', content: content, canonical: fullUrl})
  } catch (_e) {
    const content = '<p>There was a problem loading the website. Please try again later.</p>'
    res.status(404)
    res.render('basic', { title: 'Error: Problem loading site', content: content, canonical: fullUrl})
  }
})

app.get('/track/:id', function(req, res){
  const fullUrl = rootURL + req.originalUrl
  const file = path.join(trackFolder, req.params.id) + '.csv'
  let buffer = ''

  try {
    const readstream = fs.createReadStream(file)
    const csvparse = readstream.pipe(parse({ delimiter: ',', from_line: 2 }))

    csvparse.on('data', (row) => {
      const date = row[0] + '/' + row[1] + '/' + row[2]
      const num = row[3]
      buffer += '{ x: new Date("' + date + '"), y:' + num + '},'
    })

    csvparse.on('finish', () => {
      buffer = buffer.slice(0, -1)
      let data = '{ name: "' + req.params.id + '", data: [ ' + buffer + ' ] }'
      res.render('track', { title: 'Tracking: ' + req.params.id, content: data, canonical: fullUrl})
    })

    readstream.on('error', () => {
      const error = '<p>Entry not found. Please try again.</p>'
      const content = error
      res.status(404)
      res.render('basic', { title: 'Error: Content not found', content: content, canonical: fullUrl})
    })

  } catch (_e) {
    const error = '<p>Entry not found. Please try again.</p>'
    const content = error
    res.status(404)
    res.render('basic', { title: 'Error: Content not found', content: content, canonical: fullUrl})
  }
})

// Any link to a direct static resource will show it
app.use(express.static(path.join(__dirname, '/static')))

// Any other content directly linked will show as-is
app.use(express.static(rootFolder))

// Try anything else as a markdown file or show error page
app.get('*', function(req, res){
  const fullUrl = rootURL + req.originalUrl
  try {
    const file = path.join(rootFolder, decodeURIComponent(req.path)) + sourceFileExt
    const buffer = fs.readFileSync(file, { encoding: 'utf8' })
    renderFile(buffer, fullUrl, res)
  } catch (_e) {
    try {
      const file = path.join(rootFolder, decodeURIComponent(req.path), 'index') + sourceFileExt
      const buffer = fs.readFileSync(file, { encoding: 'utf8' })
      renderFile(buffer, fullUrl, res)
    } catch (_e) {
      fs.stat(path.join(rootFolder, decodeURIComponent(req.path)).replace(/\/$/, '') + sourceFileExt, (error) => {
        if (error) {
          const error = '<p>Entry not found. Please try again.</p>'
          const content = error
          res.status(404)
          res.render('basic', { title: 'Error: Content not found', content: content, canonical: fullUrl})
        } else {
          res.redirect(301, req.originalUrl.replace(/\/$/, ''))
        }
      })
    }
  }
})

function renderFile(buffer, fullUrl, res) {
  const env = {}
  const dirty = md.render(buffer, env)
  const content = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
  const title = env.title + ' | Tomasino Wiki'
  res.render('basic', { title: title, content: content, canonical: fullUrl})
}

app.listen(port, () => console.log(`listening on port ${port}!`))
