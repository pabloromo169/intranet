'use strict';

// Escucha eventos PUSH del servidor
self.addEventListener('push', function(event) {
  console.log('Push recibido:', event);
  
  // Extrae datos de la notificación (JSON del servidor)
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Notificación', body: event.data ? event.data.text() : 'Nueva notificación' };
  }
  
  const options = {
    body: payload.body || 'Nueva notificación en la Intranet',
    icon: './assets/logoFacultad.jpg',
    badge: './assets/logoFacultad.jpg',
    image: payload.image || '',
    tag: 'intranet-notificacion',
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || './index_alumno.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Intranet Alumnado', options)
  );
});

// Maneja clicks en la notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (let client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Activa el Service Worker
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
