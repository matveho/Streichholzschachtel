// Test-only bridge: no proxy or listener is exposed outside this machine.
import assert from 'node:assert/strict'
export function integrationOrigin(fallback) {
  if (process.env.BASIS_VERCEL_UI !== '1') return fallback
  assert.equal(process.env.BASIS_FRONTEND_URL, 'http://127.0.0.1:8842/app')
  assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
  return 'https://streichholzschachtel.vercel.app'
}
export async function launchIntegrationBrowser(chromium) {
  const browser = await chromium.launch({
    ...(process.env.BASIS_BROWSER_CHANNEL ? { channel: process.env.BASIS_BROWSER_CHANNEL } : {}), headless: true,
  })
  if (process.env.BASIS_VERCEL_UI !== '1') return browser
  integrationOrigin(process.env.BASIS_FRONTEND_URL)
  // Route at context level so cleanup pages and popups cannot mutate production.
  browser.newPage = async options => {
    const context = await browser.newContext({ ...options, serviceWorkers: 'block' })
    await context.route('**/local-api/**', async route => {
      const req = route.request(), url = new URL(req.url())
      assert.equal(url.origin, 'https://streichholzschachtel.vercel.app')
      const response = await fetch(new URL(url.pathname + url.search, 'http://127.0.0.1:8842'), {
        method: req.method(), headers: {
          ...(req.headers()['range'] ? {Range:req.headers()['range']} : {}),
          ...(req.headers()['content-type'] ? {'Content-Type':req.headers()['content-type']} : {}),
        },
        ...(['POST', 'PATCH'].includes(req.method()) ? {body:req.postDataBuffer()} : {}),
        signal: AbortSignal.timeout(300000),
      })
      const headers = Object.fromEntries(response.headers)
      for (const key of ['content-encoding','transfer-encoding','content-length']) delete headers[key]
      await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())})
    })
    return context.newPage()
  }
  return browser
}
