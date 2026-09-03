// api/create-user.js
// Crea un chofer o un admin dentro de la MISMA empresa del que hace el pedido.
// Esto tiene que pasar por el backend porque solo el Admin SDK puede asignar
// los custom claims (empresaId, role) que después usan las Firestore Rules.
import { adminAuth, adminDb, verifyCaller } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const caller = await verifyCaller(req);
    const { nombre, apellido, email, password, role } = req.body || {};

    if (!nombre || !apellido || !email || !password || !role) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    if (!['driver', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    if (!['owner', 'manager'].includes(caller.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    // Un manager (admin) solo puede crear choferes, no otros admins.
    if (caller.role === 'manager' && role !== 'driver') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const empresaId = caller.empresaId;
    if (!empresaId) return res.status(403).json({ error: 'Tu cuenta no tiene empresa asignada' });

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: `${nombre} ${apellido}`
    });

    await adminAuth.setCustomUserClaims(userRecord.uid, { role, empresaId });

    await adminDb
      .collection('empresas').doc(empresaId)
      .collection('usuarios').doc(userRecord.uid)
      .set({ nombre, apellido, email, role, activo: true, createdAt: new Date() });

    return res.status(200).json({ uid: userRecord.uid });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
