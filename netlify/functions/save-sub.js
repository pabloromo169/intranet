const { MongoClient } = require('mongodb');
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    const subscription = JSON.parse(event.body);
    if (!subscription || !subscription.endpoint) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Suscripción inválida' }) };
    }

    const client = await connectToDatabase();
    const db = client.db(MONGODB_DB);
    const collection = db.collection('subscriptions');

    // Asociar con el userId
    await collection.updateOne(
      { endpoint: subscription.endpoint },
      {
        $set: {
          subscription,
          userId: decoded.userId,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ success: true, message: 'Suscripción guardada' })
    };
  } catch (error) {
    console.error('Error en save-sub:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
    };
  }
};