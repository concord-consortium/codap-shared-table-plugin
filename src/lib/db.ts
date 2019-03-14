import * as firebase from "firebase/app";
import "firebase/database";

const config = {
  apiKey: "AIzaSyASCGi9fWCUX3orJVB9d6svJbxDHfSRJVA",
  authDomain: "codap-shared-table-plugin.firebaseapp.com",
  databaseURL: "https://codap-shared-table-plugin.firebaseio.com"
};

export class DB {
  shareRef?: firebase.database.Reference;

  unregisterPresence?: () => void;

  constructor() {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
  }

  createSharedTable(shareId: string, userLabel: string) {
    const rootRef = firebase.database().ref();
    this.shareRef = rootRef.child(`shared-tables/${shareId}`);
    this.registerPresence(userLabel);
  }

  async joinSharedTable(shareId: string, userLabel: string) {
    const rootRef = firebase.database().ref();
    this.shareRef = rootRef.child(`shared-tables/${shareId}`);
    const connectedUsers = await this.getConnectedUsers();
    if (connectedUsers && connectedUsers.val()) {
      this.registerPresence(userLabel);
      return true;
    }
    this.shareRef = undefined;
    return false;
  }

  leaveSharedTable() {
    this.shareRef = undefined;
    if (this.unregisterPresence) {
      this.unregisterPresence();
    }
  }

  // retrieves data from `shared-tables/${shareId}`
  async getAll() {
    return this.shareRef && this.shareRef.once("value");
  }

  // retrieves data from `shared-tables/${shareId}/items`
  async getAllItems() {
    const itemsRef = this.shareRef && this.shareRef.child("items");
    return itemsRef && itemsRef.once("value");
  }

  async getUserItems(userLabel: string) {
    const itemsRef = this.shareRef && this.shareRef.child("items");
    const userItemsRef = itemsRef && itemsRef.child(userLabel);
    return userItemsRef && userItemsRef.once("value");
  }

  setUserItems(userLabel: string, items: any) {
    const itemsRef = this.shareRef && this.shareRef.child("items");
    const userItemsRef = itemsRef && itemsRef.child(userLabel);
    if (userItemsRef && items) {
      userItemsRef.set(items);
    }
  }

  async getConnectedUsers() {
    const connectedRef = this.shareRef && this.shareRef.child("connectedUsers");
    return connectedRef && connectedRef.once("value");
  }

  registerPresence(userLabel: string) {
    const connectedRef = this.shareRef && this.shareRef.child("connectedUsers");
    if (connectedRef) {
      const userPresence = connectedRef.child(userLabel);
      userPresence.set(Date.now());

      this.unregisterPresence = () => {
        userPresence.remove();
      };
      userPresence.onDisconnect().remove();
    }
  }

  // adds data at `shared-tables/${shareId}/${key}`
  set(key: string, data: any) {
    if (this.shareRef) {
      this.shareRef.child(key).set(data);
    }
  }
}
