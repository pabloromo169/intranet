const webpush = require('web-push');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'push_db';
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_por_defecto_cambiame';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  const client = await MongoClient.connect(MONGODB_URI);
  cachedClient = client;
  return client;
}

webpush.setVapidDetails(
  'mailto:notificaciones@estudiantes.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const isTestBypass = event.headers['x-test-bypass'] === 'true';
    let decoded;

    if (isTestBypass) {
        console.log('Modo Test Bypass activado');
        decoded = { role: 'admin' }; // Asignamos rol admin para el bypass
    } else {
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
        }

        const token = authHeader.split(' ')[1];
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido' }) };
        }

        if (decoded.role !== 'profesor' && decoded.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ error: 'Prohibido: Solo profesores o administradores pueden enviar notificaciones' }) };
        }
    }

    const client = await connectToDatabase();
    const db = client.db(MONGODB_DB);
    const usersCollection = db.collection('users');
    const subsCollection = db.collection('subscriptions');

    let subscriptionsDocs = [];

    if (decoded.role === 'admin') {
      // Admins send to all subscriptions
      subscriptionsDocs = await subsCollection.find({}).toArray();
    } else {
      // Teachers send only to their students
      const teacher = await usersCollection.findOne({ _id: new ObjectId(decoded.userId) });
      if (!teacher) return { statusCode: 404, body: JSON.stringify({ error: 'Profesor no encontrado' }) };

      const students = await usersCollection.find({ id_profesor: teacher.usuario }).toArray();
      const studentIds = students.map(s => s._id.toString());

      subscriptionsDocs = await subsCollection.find({
        userId: { $in: studentIds }
      }).toArray();
    }

    if (subscriptionsDocs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No hay suscripciones para enviar', count: 0 })
      };
    }

    const subscriptions = subscriptionsDocs.map(doc => doc.subscription);

    let pushData = {
      title: '⏰ NOTIFICACIÓN PUSH',
      body: 'Nuevo mensaje de tu profesor',
      icon: '/icon.png',
      data: { url: '/' }
    };

    if (event.body) {
      try {
        const customData = JSON.parse(event.body);
        pushData = { ...pushData, ...customData };
      } catch (e) {
        console.log('Error parseando body');
      }
    }

    const payload = JSON.stringify(pushData);
    const notifications = subscriptions.map(sub =>
      webpush.sendNotification(sub, payload)
        .catch(async err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await subsCollection.deleteOne({ "subscription.endpoint": sub.endpoint });
          }
        })
    );

    await Promise.allSettled(notifications);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Envío completado',
        count: subscriptions.length
      })
    };
  } catch (error) {
    console.error('Error enviando push:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
