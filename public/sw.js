// InvoiceUI Service Worker
// Privacy guarantee: strictly precaches application shell assets only.
// Zero private data or PDF caching: all /api/* routes and PDF streams bypass the cache.

const CACHE_NAME = 'invoiceui-shell-v1'

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/manifest.webmanifest',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS)
    })
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // Hard privacy boundary: strictly bypass cache for all API routes and PDF files
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/pdf') ||
    url.pathname.endsWith('.pdf') ||
    url.searchParams.has('download')
  ) {
    return
  }

  // Handle navigation requests: network first with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match('/')
      })
    )
    return
  }

  // Handle static assets (JS, CSS, fonts, SVG)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          return cached
        }
        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache)
          })
          return response
        })
      })
    )
    return
  }
})
