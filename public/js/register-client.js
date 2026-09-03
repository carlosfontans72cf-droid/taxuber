// register-client.js - Registro público de clientes (vinculado a una empresa por URL)
import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const params = new URLSearchParams(window.location.search);
const empresaId = params.get('empresa');

const btn = document.getElementById('btn-register');
const errorDiv = document.getElementById('reg-error');

if (!empresaId) {
  errorDiv.textContent = 'Falta el identificador de la empresa en el enlace. Pedile a la empresa el link correcto.';
  if (btn) btn.disabled = true;
}

btn?.addEventListener('click', async () => {
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  errorDiv.textContent = '';

  if (!nombre || !apellido || !email || !password) {
    errorDiv.textContent = 'Completá todos los campos';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creando cuenta...';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: `${nombre} ${apellido}` });

    const idToken = await cred.user.getIdToken();
    const res = await fetch('/api/register-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ empresaId, nombre, apellido })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo completar el registro');
    }

    window.location.href = '/pages/dashboard-client.html';
  } catch (err) {
    console.error(err);
    errorDiv.textContent = (err.code === 'auth/email-already-in-use')
      ? 'Ese email ya está registrado'
      : 'No se pudo crear la cuenta';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear cuenta';
  }
});
