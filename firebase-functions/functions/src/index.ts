import * as functions from 'firebase-functions';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

const admin = require('firebase-admin');
admin.initializeApp();

/**
 * This database triggered function will delete /shared-tables/{shareId} when
 * /shared-tables/{shareId}/connectedUsers is deleted, which happens after the last person leaves the sahe
 */
exports.deleteDataWithNoConnectedUsers = functions.database.ref('/shared-tables/{shareId}/connectedUsers').onDelete(async (change) => {
  const ref = change.ref.parent;
  if (ref) {
    return ref.remove();
  }
});