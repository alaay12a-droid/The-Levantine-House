import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCbRg9JwOn9drBx-NbgW71ZX96_sQeLSv8",
  authDomain: "rawabialmandi-4d78f.firebaseapp.com",
  projectId: "rawabialmandi-4d78f",
  storageBucket: "rawabialmandi-4d78f.firebasestorage.app",
  messagingSenderId: "339669786522",
  appId: "1:339669786522:web:23a3f273e54519b4d0a423",
  measurementId: "G-R7DSG4FXL4",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export default app;
