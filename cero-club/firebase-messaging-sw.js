/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBQERXx9ZEXRiYrhrWp4v2CX36p2bbn8vU',
  authDomain: 'cero-club.firebaseapp.com',
  projectId: 'cero-club',
  storageBucket: 'cero-club.firebasestorage.app',
  messagingSenderId: '411019935482',
  appId: '1:411019935482:web:32b4ffd87b83598aa3d343',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'CERO Club';
  const options = {
    body: payload.notification?.body || '',
    icon: '/app/favicon.ico',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('https://cero-club.web.app/app/'));
});
