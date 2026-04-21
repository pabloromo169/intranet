const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'push_db';

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
        const { usuario, password, nombre, role, id_profesor } = JSON.parse(event.body);

        if (!usuario || !password || !nombre || !role) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Faltan campos obligatorios' }) };
        }

        const client = await connectToDatabase();
        const db = client.db(MONGODB_DB);
        const users = db.collection('users');

        // Verificar si el usuario ya existe
        const existingUser = await users.findOne({ usuario });
        if (existingUser) {
            return { statusCode: 400, body: JSON.stringify({ error: 'El usuario ya existe' }) };
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            usuario,
            password: hashedPassword,
            nombre,
            role, // 'profesor', 'estudiante' or 'admin'
            createdAt: new Date()
        };

        if (role === 'estudiante') {
            newUser.id_profesor = id_profesor || null;
        } else if (role === 'profesor') {
            newUser.estudiantes_ids = [];
        } else if (role === 'admin') {
            // Admins don't need specific fields for now
        }

        const result = await users.insertOne(newUser);

        return {
            statusCode: 201,
            body: JSON.stringify({
                success: true,
                message: 'Usuario registrado correctamente',
                userId: result.insertedId
            })
        };
    } catch (error) {
        console.error('Error en auth-register:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
        };
    }
};
