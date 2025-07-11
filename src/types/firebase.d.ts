// src/types/firebase.d.ts
import firebase from 'firebase/compat/app';

declare global {
  // Re-export Firebase types for easier use
  type FirebaseUser = firebase.User;
  type FirebaseAuth = firebase.auth.Auth;
  type FirebaseFirestore = firebase.firestore.Firestore;
  type FirebaseDatabase = firebase.database.Database;
  type FirebaseUnsubscribe = firebase.Unsubscribe;
  
  // Auth types
  type UserCredential = firebase.auth.UserCredential;
  type AuthError = firebase.auth.Error;
  
  // Firestore types
  type DocumentReference = firebase.firestore.DocumentReference;
  type CollectionReference = firebase.firestore.CollectionReference;
  type QuerySnapshot = firebase.firestore.QuerySnapshot;
  type DocumentSnapshot = firebase.firestore.DocumentSnapshot;
}

export {};