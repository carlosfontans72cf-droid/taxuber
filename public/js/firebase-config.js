// Configuración de Firebase - Taxuber
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWzY66N1mvUZSB0XBlEjgl4F3o2oMwP6U",
  authDomain: "taxuber-98094.firebaseapp.com",
  projectId: "taxuber-98094",
  storageBucket: "taxuber-98094.firebasestorage.app",
  messagingSenderId: "834415144097",
  appId: "1:834415144097:web:d3bd054d029238499a94e0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

auth.setPersistence(browserLocalPersistence).catch(() => {});