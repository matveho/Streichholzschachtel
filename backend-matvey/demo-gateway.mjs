import http from 'node:http'
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { resolve, sep, extname } from 'node:path'
import { readFrontendLocation } from './src/frontend-location.mjs'

const key = readFileSync(
  new URL('./state/session-token.txt', import.meta.url),
  'utf8',
).trim()
const target = process.env.BASIS_GATEWAY_TARGET || 'http://127.0.0.1:8787'
const targetUrl = new URL(target)
if (
  targetUrl.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(targetUrl.hostname)
)
  throw new Error('The demo gateway must target a loopback HTTP API.')
const port = Number(process.env.BASIS_GATEWAY_PORT || 8789)
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, target)
      url.pathname = url.pathname.replace(/^\/local-api(?=\/|$)/, '') || '/'
      if (req.method === 'GET' && url.pathname === '/_basis/gateway') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
        res.end(
          JSON.stringify({
            service: 'basis-gateway',
            version: 6,
            targetPort: Number(targetUrl.port),
          }),
        )
        return
      }
      if (
        req.method === 'GET' &&
        (['/app', '/app/', '/basis.svg'].includes(url.pathname) ||
          /^\/(?:assets|documents)\//.test(url.pathname))
      ) {
        const directory = readFrontendLocation()
        const file = resolve(
          directory,
          url.pathname.startsWith('/app')
            ? 'index.html'
            : decodeURIComponent(url.pathname.slice(1)),
        )
        if (
          !file.startsWith(directory + sep) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        ) {
          res.writeHead(404)
          res.end('Local interface is not built. Use Rebuild interface.')
          return
        }
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript',
          '.mjs': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        }
        res.writeHead(200, {
          'Content-Type': types[extname(file)] || 'application/octet-stream',
          'Content-Length': statSync(file).size,
          'Cache-Control': 'no-cache',
        })
        await pipeline(createReadStream(file), res)
        return
      }
      const allowed =
        (['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method) &&
          /^\/v1\/projects(?:\/[a-zA-Z0-9-]+(?:\/(?:reset|queries(?:\/[a-f0-9-]{36})?|issues\/[a-z0-9-]+|documents\/(?:import|doc-[a-f0-9]+\/file)))?)?$/.test(
            url.pathname,
          )) ||
        (req.method === 'GET' &&
          url.pathname === '/v1/reference-collections') ||
        (req.method === 'GET' &&
          (['/app', '/app/', '/basis.svg'].includes(url.pathname) ||
            /^\/(?:assets|documents)\/[a-zA-Z0-9_./%() -]+$/.test(
              url.pathname,
            ) ||
            url.pathname === '/health' ||
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
        ...(['POST', 'PATCH'].includes(req.method)
          ? { body: req, duplex: 'half' }
          : {}),
        signal: AbortSignal.timeout(
          url.pathname.endsWith('/documents/import')
            ? 300000
            : url.pathname.endsWith('/file')
              ? 120000
              : 30000,
        ),
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
      } else if (upstream.body)
        await pipeline(Readable.fromWeb(upstream.body), res)
      else res.end()
    } catch {
      if (res.headersSent || res.destroyed) {
        res.destroy()
        return
      }
      if (!res.headersSent)
        res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: 'The local backend is unavailable. Please retry shortly.',
        }),
      )
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`Public demo gateway ready on port ${port}`),
  )
