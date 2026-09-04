// auth.js - Login real con Firebase Authentication (multiempresa)
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const btnLogin = document.getElementById('btn-login');
const errorDiv = document.getElementById('login-error');

btnLogin.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  errorDiv.textContent = '';

  if (!email || !password) {
    errorDiv.textContent = 'Completá todos los campos';
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Entrando...';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const tokenResult = await cred.user.getIdTokenResult(true);
    const { role, empresaId } = tokenResult.claims;

    if (!role || (role !== 'superadmin' && !empresaId)) {
      errorDiv.textContent = 'Esta cuenta no tiene una empresa asignada. Contactá al administrador.';
      await signOut(auth);
      return;
    }

    let destino = '/pages/dashboard-driver.html';
    if (role === 'superadmin') destino = '/pages/superadmin.html';
    else if (role === 'owner') destino = '/pages/dashboard-owner.html';
    else if (role === 'manager') destino = '/pages/dashboard-manager.html';
    else if (role === 'cliente') destino = '/pages/dashboard-client.html';

    window.location.href = destino;

  } catch (error) {
    console.error('Error login:', error);
    if (error.code === 'auth/user-disabled') {
      errorDiv.textContent = 'Esta cuenta fue desactivada';
    } else {
      errorDiv.textContent = 'Email o contraseña incorrectos';
    }
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Iniciar Sesión';
  }
});

// Botón mostrar/ocultar contraseña
document.addEventListener('click', e => {
  const btn = e.target.closest('.ver-contrasena');
  if (!btn) return;
  const campo = document.getElementById(btn.dataset.target);
  if (!campo) return;
  campo.type = campo.type === 'password' ? 'text' : 'password';
  btn.textContent = campo.type === 'password' ? '👁' : '🙈';
});

// Recuperar contraseña
document.getElementById('btn-forgot-password')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();

  if (!email) {
    errorDiv.style.color = '';
    errorDiv.textContent = 'Escribí tu email arriba y volvé a tocar el link';
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    errorDiv.style.color = '#28A745';
    errorDiv.textContent = 'Te enviamos un email para restablecer tu contraseña.';
  } catch (error) {
    console.error('Error al enviar email de recuperación:', error);
    errorDiv.style.color = '';
    errorDiv.textContent = 'No pudimos enviar el email. Revisá que esté bien escrito.';
  }
});
