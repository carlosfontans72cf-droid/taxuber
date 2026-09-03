// api/create-superadmin.js
// Lo llamás UNA SOLA VEZ para crear tu propia cuenta de superadmin (la tuya,
// la del dueño de Taxuber como negocio de alquiler — no la de una empresa
// que te alquila la app). Protegido con el mismo SUPERADMIN_SECRET que ya
// tenés en Vercel.
import { adminAuth } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-superadmin-secret'];
  if (!secret || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  try {
    const { nombre, email, password } = req.body || {};
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const user = await adminAuth.createUser({ email, password, displayName: nombre });
    await adminAuth.setCustomUserClaims(user.uid, { role: 'superadmin' });

    return res.status(200).json({ uid: user.uid });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
