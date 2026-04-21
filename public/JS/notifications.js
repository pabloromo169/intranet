/**
 * Push Notifications Logic for Intranet
 */

const VAPID_PUBLIC_KEY = 'BJNruf9PNl_9KsXy-yMWdYY_Z8hXySxS1q30vyDtrXhvOr4Fb1LLlincKfGsuSSAT4blFtWsiA24B2nPEN4qUo0';

/**
 * Convierte la clave VAPID de base64 a Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Función principal para activar/desactivar notificaciones
 */
async function togglePushSubscription() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToast('Error', 'Tu navegador no soporta notificaciones push.', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Permiso Denegado', 'No has permitido las notificaciones.', 'warning');
            return;
        }

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            // Si ya está suscrito, podríamos preguntar si desea desactivar
            // Por ahora, refrescamos la suscripción
            console.log('Ya suscrito:', subscription);
            showToast('Info', 'Ya estás suscrito a las notificaciones.', 'info');
        } else {
            // Suscribir
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            await guardarSuscripcionEnBackend(subscription);
            showToast('Éxito', '¡Notificaciones activadas correctamente!', 'success');
        }
    } catch (error) {
        console.error('Error en suscripción push:', error);
        showToast('Error', 'Hubo un problema al activar las notificaciones.', 'error');
    }
}

/**
 * Envía la suscripción al backend (Netlify Functions)
 */
async function guardarSuscripcionEnBackend(subscription) {
    const token = localStorage.getItem('authToken');

    // Asumimos que la intranet se despliega en el mismo dominio que las funciones de Netlify
    // o que las funciones están accesibles en esta ruta relativa.
    const url = '/.netlify/functions/save-sub';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(subscription)
    });

    if (!response.ok) {
        throw new Error('Error al guardar la suscripción en el servidor');
    }

    return await response.json();
}

/**
 * Utilidad para mostrar notificaciones tipo Toast
 * Usa el toastManager si está disponible, o un fallback
 */
function showToast(title, message, type) {
    if (window.toastManager) {
        window.toastManager.show(title, message, type);
    } else {
        alert(`${title}: ${message}`);
    }
}

// Inicializar el Service Worker al cargar
document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registrado para notificaciones:', reg.scope))
            .catch(err => console.error('Error al registrar SW:', err));
    }
});

// Exponer la función globalmente para el onclick del HTML
window.togglePushSubscription = togglePushSubscription;
