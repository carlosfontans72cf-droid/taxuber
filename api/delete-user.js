// api/delete-user.js
import { adminAuth, adminDb, verifyCaller } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const caller = await verifyCaller(req);
    if (!['owner', 'manager'].includes(caller.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'Falta el id del usuario' });

    const empresaId = caller.empresaId;
    const targetRef = adminDb.collection('empresas').doc(empresaId).collection('usuarios').doc(uid);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'Usuario no encontrado en tu empresa' });

    await adminAuth.deleteUser(uid);
    await targetRef.delete();

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
