import http from 'node:http'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'

const key = readFileSync(
  new URL('./state/session-token.txt', import.meta.url),
  'utf8',
).trim()
const target = 'http://127.0.0.1:8787'
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, target)
      const allowed =
        (req.method === 'GET' &&
          (url.pathname === '/health' ||
            url.pathname === '/v1/documents' ||
            /^\/v1\/documents\/doc-[a-f0-9]+\/file$/.test(url.pathname) ||
            /^\/v1\/queries\/[a-f0-9-]{36}$/.test(url.pathname))) ||
        (req.method === 'POST' && url.pathname === '/v1/queries') ||
        (req.method === 'DELETE' &&
          /^\/v1\/queries\/[a-f0-9-]{36}$/.test(url.pathname))
      if (!allowed) {
        res.writeHead(404)
        res.end()
        return
      }
      url.searchParams.delete('token')
      const headers = { Authorization: 'Bearer ' + key }
      if (req.headers.range) headers.Range = req.headers.range
      if (req.headers['content-type'])
        headers['Content-Type'] = req.headers['content-type']
      const upstream = await fetch(url, {
        method: req.method,
        headers,
        ...(req.method === 'POST' ? { body: req, duplex: 'half' } : {}),
        signal: AbortSignal.timeout(30000),
      })
      res.statusCode = upstream.status
      res.setHeader('Cache-Control', 'no-store')
      for (const name of ['content-type', 'content-range', 'accept-ranges'])
        if (upstream.headers.has(name))
          res.setHeader(name, upstream.headers.get(name))
      if (upstream.headers.get('content-type')?.includes('application/json')) {
        const data = await upstream.json()
        const rewrite = (value) => {
          if (!value || typeof value !== 'object') return
          if (typeof value.file === 'string') {
            const file = new URL(value.file, target)
            value.file = '/local-api' + file.pathname
          }
          for (const child of Object.values(value)) rewrite(child)
        }
        rewrite(data)
        res.end(JSON.stringify(data))
      } else if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
      else res.end()
    } catch {
      if (!res.headersSent)
        res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: 'The local backend is unavailable. Please retry shortly.',
        }),
      )
    }
  })
  .listen(8789, '127.0.0.1', () =>
    console.log('Public demo gateway ready on port 8789'),
  )
