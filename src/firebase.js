import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBIBAPXRzD-bYUOMeHPSxIWpRLbC1fnv6s",
  authDomain: "villacaterina-8f539.firebaseapp.com",
  databaseURL: "https://villacaterina-8f539-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "villacaterina-8f539",
  storageBucket: "villacaterina-8f539.firebasestorage.app",
  messagingSenderId: "784032642401",
  appId: "1:784032642401:web:48415151afeca5b1f8c120"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, onValue };
