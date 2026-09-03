// api/register-client.js
// El cliente ya se creó su cuenta con Firebase Auth desde el navegador
// (createUserWithEmailAndPassword). Acá solo le asignamos el rol "cliente"
// y lo vinculamos a la empresa correspondiente (viene del link de invitación,
// ej: /registro-cliente.html?empresa=abc123).
import { adminAuth, adminDb, verifyCaller } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const caller = await verifyCaller(req);
    const { empresaId, nombre, apellido } = req.body || {};
    if (!empresaId || !nombre || !apellido) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const empresaDoc = await adminDb.collection('empresas').doc(empresaId).get();
    if (!empresaDoc.exists) return res.status(404).json({ error: 'Empresa no encontrada' });

    await adminAuth.setCustomUserClaims(caller.uid, { role: 'cliente', empresaId });

    await adminDb
      .collection('empresas').doc(empresaId)
      .collection('usuarios').doc(caller.uid)
      .set({
        nombre, apellido,
        email: caller.email || null,
        role: 'cliente', activo: true, createdAt: new Date()
      });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
