import * as firebase from "firebase/app";
import "firebase/database";

var config = {
  apiKey: "AIzaSyASCGi9fWCUX3orJVB9d6svJbxDHfSRJVA",
  authDomain: "codap-shared-table-plugin.firebaseapp.com",
  databaseURL: "https://codap-shared-table-plugin.firebaseio.com"
};

export class DB {
  shareRef?: firebase.database.Reference;

  constructor() {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
  }

  setShareId(shareId: string) {
    const rootRef = firebase.database().ref();
    this.shareRef = rootRef.child(`shared-tables/${shareId}`);
  }

  // adds data at `shared-tables/${shareId}/${key}`
  set(key: string, data: any) {
    if (this.shareRef) {
      this.shareRef.child(key).set(data);
    }
  }
}