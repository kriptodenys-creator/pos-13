// Имена кэшей с новой версией
const STATIC_CACHE = 'static-cache-v2'
const IMAGE_CACHE = 'image-cache-v2'
const API_CACHE = 'api-cache-v2'

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Установка')
  // Кэшируем основные статические ресурсы
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll([
        '/',
        '/offline.html',
        '/manifest.json'
      ])
    })
  )
})

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Активация')
  // Удаляем старые кэши
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => {
          return name !== STATIC_CACHE && 
                 name !== IMAGE_CACHE && 
                 name !== API_CACHE
        }).map(name => caches.delete(name))
      )
    })
  )
})

self.addEventListener('fetch', (event) => {
  // Кешируем только GET запросы
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Изображения - cache first с длительным хранением
  if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) return response
          
          // Добавляем заголовок для идентификации Service Worker запросов
          const fetchOptions = { 
            redirect: 'follow',
            headers: {
              'Service-Worker': 'script'
            }
          };
          
          return fetch(event.request, fetchOptions).then(networkResponse => {
            // Проверяем, является ли ответ перенаправлением
            if (networkResponse.type === 'opaqueredirect') {
              // Для непрозрачных перенаправлений возвращаем то, что есть
              return networkResponse;
            }
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone())
            }
            return networkResponse
          }).catch(() => {
            // Return cached response if available, even if stale
            return response
          })
        })
      })
    )
    return
  }

  // API запросы - stale-while-revalidate с коротким TTL
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // Добавляем заголовок для идентификации Service Worker запросов
          const fetchOptions = { 
            redirect: 'follow',
            headers: {
              'Service-Worker': 'script'
            }
          };
          
          const fetchPromise = fetch(event.request, fetchOptions).then(networkResponse => {
            // Проверяем, является ли ответ перенаправлением
            if (networkResponse.type === 'opaqueredirect') {
              // Для непрозрачных перенаправлений возвращаем то, что есть
              return networkResponse;
            }
            if (networkResponse.ok) {
              // Кэшируем API ответы на 5 минут
              const clonedResponse = networkResponse.clone();
              clonedResponse.headers.set('X-Cache-Timestamp', Date.now().toString());
              cache.put(event.request, clonedResponse)
            }
            return networkResponse
          }).catch((error) => {
            console.warn('[SW] API fetch failed:', error);
            // Return cached response if available, otherwise let the error propagate
            if (cachedResponse) {
              return cachedResponse
            }
            // Не возвращаем undefined - пробрасываем ошибку дальше
            throw error
          })
          
          // Возвращаем кеш если есть, иначе ждем сеть
          return cachedResponse || fetchPromise
        })
      })
    )
    return
  }

  // Статические ресурсы и страницы - cache first
  event.respondWith(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.match(event.request).then(response => {
        // Если есть кешированный ответ, возвращаем его
        if (response) return response
        
        // Для навигационных запросов обрабатываем редиректы правильно
        if (event.request.mode === 'navigate') {
          // Добавляем заголовок для идентификации Service Worker запросов
          const fetchOptions = { 
            redirect: 'follow',
            headers: {
              'Service-Worker': 'script'
            }
          };
          
          return fetch(event.request, fetchOptions).then(networkResponse => {
            // Проверяем, является ли ответ перенаправлением
            if (networkResponse.type === 'opaqueredirect') {
              // Для непрозрачных перенаправлений возвращаем то, что есть
              return networkResponse;
            }
            // Кешируем только успешные ответы без редиректов
            if (networkResponse.ok && networkResponse.type === 'basic') {
              cache.put(event.request, networkResponse.clone())
            }
            return networkResponse
          }).catch((error) => {
            console.warn('Navigation fetch failed:', error);
            // Fallback для офлайн режима
            return caches.match('/offline.html') || 
                   caches.match('/') || 
                   new Response('Offline', { status: 503 })
          })
        }
        
        // Для других запросов
        // Добавляем заголовок для идентификации Service Worker запросов
        const fetchOptions = { 
          redirect: 'follow',
          headers: {
            'Service-Worker': 'script'
          }
        };
        
        return fetch(event.request, fetchOptions).then(networkResponse => {
          // Проверяем, является ли ответ перенаправлением
          if (networkResponse.type === 'opaqueredirect') {
            // Для непрозрачных перенаправлений возвращаем то, что есть
            return networkResponse;
          }
          if (networkResponse.ok && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone())
          }
          return networkResponse
        }).catch(() => {
          // Возвращаем кешированный ответ если есть
          return response
        })
      })
    })
  )
})