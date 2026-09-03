// api/_firebaseAdmin.js
// Inicializa Firebase Admin SDK una sola vez por instancia serverless.
// Requiere la variable de entorno FIREBASE_SERVICE_ACCOUNT_BASE64 en Vercel:
// el JSON de la cuenta de servicio de Firebase, codificado en base64.
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
  );
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

// Verifica el ID token que manda el cliente en el header Authorization: Bearer <token>
// y devuelve el token decodificado, que incluye uid, email y los custom claims
// (role, empresaId) que ya tenga asignados.
export async function verifyCaller(req) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) throw new Error('No autenticado');
  return adminAuth.verifyIdToken(idToken);
}
