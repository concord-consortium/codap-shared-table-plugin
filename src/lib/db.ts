import * as firebase from "firebase/app";
import "firebase/database";
import { ClientItemsHandlers, FirebaseItemHandlers } from "./firebase-handlers";
import { DataContext } from "./codap-helper";

const config = {
  apiKey: "AIzaSyASCGi9fWCUX3orJVB9d6svJbxDHfSRJVA",
  authDomain: "codap-shared-table-plugin.firebaseapp.com",
  databaseURL: "https://codap-shared-table-plugin.firebaseio.com"
};

export interface SharedTableEntry {
  connectedUsers: string[];
  dataContext: DataContext;
  items?: {[key: string]: any[]};
}

/**
 * Recursively traverses objects and arrays to remove any properties with
 * the key `id` or `guid`. This mutates the original object.
 *
 * For objects such as DataContexts and Collections, these properties only make sense
 * within the context of an individual's own CODAP document, and cause problems when
 * shared between different documents.
 *
 * If the IDs are needed for references even across shares this function should not
 * be used.
 *
 * @param obj
 */
function removeLocalDocumentIds(obj: any) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(removeLocalDocumentIds);
  } else if (typeof obj === "object") {
    delete obj.id;
    delete obj.guid;
    for (const prop of Object.keys(obj)) {
      removeLocalDocumentIds(obj[prop]);
    }
  }
}

export class DB {
  userLabel?: string;
  shareRef?: firebase.database.Reference;
  firebaseItemHandlers: { [user: string]: FirebaseItemHandlers } = {};
  clientItemsHandlers: ClientItemsHandlers;

  unregisterPresence?: () => void;

  constructor(clientHandlers: ClientItemsHandlers) {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    this.clientItemsHandlers = clientHandlers;
  }

  setShareRef(shareId: string) {
    const rootRef = firebase.database().ref();
    this.shareRef = rootRef.child(`shared-tables/${shareId}`);
  }

  getConnectedUsersRef() {
    return this.shareRef && this.shareRef.child("connectedUsers");
  }

  getItemsRef() {
    return this.shareRef && this.shareRef.child("items");
  }

  getItemsRefForUser(user: string) {
    const itemsRef = this.getItemsRef();
    return itemsRef && itemsRef.child(user);
  }

  createSharedTable(shareId: string, userLabel: string) {
    this.userLabel = userLabel;
    this.setShareRef(shareId);
    this.installUserItemListeners();
    this.registerPresence(userLabel);
  }

  async joinSharedTable(shareId: string, userLabel: string) {
    this.userLabel = userLabel;
    this.setShareRef(shareId);
    const connectedUsers = await this.getConnectedUsers();
    if (connectedUsers && connectedUsers.val()) {
      this.registerPresence(userLabel);
      return true;
    }
    this.shareRef = undefined;
    return false;
  }

  leaveSharedTable() {
    this.removeUserItemListeners();
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
    const itemsRef = this.getItemsRef();
    return itemsRef && itemsRef.once("value");
  }

  async getUserItems(userLabel: string) {
    const userItemsRef = this.getItemsRefForUser(userLabel);
    return userItemsRef && userItemsRef.once("value");
  }

  setUserItems(userLabel: string, items: any) {
    const userItemsRef = this.getItemsRefForUser(userLabel);
    if (userItemsRef && items) {
      userItemsRef.set(items);
    }
  }

  async getConnectedUsers() {
    const connectedRef = this.getConnectedUsersRef();
    return connectedRef && connectedRef.once("value");
  }

  installUserItemListeners() {
    const connectedRef = this.getConnectedUsersRef();
    connectedRef && connectedRef.on("child_added", userData => {
      const user = userData && userData.key;
      const userItemsRef = user ? this.getItemsRefForUser(user) : undefined;
      if (user && userItemsRef && (user !== this.userLabel)) {
        this.firebaseItemHandlers[user] = new FirebaseItemHandlers(user, userItemsRef, this.clientItemsHandlers);
      }
    });
    connectedRef && connectedRef.on("child_removed", userData => {
      const user = userData && userData.key;
      user && this.removeItemHandlersForUser(user);
    });
  }

  removeUserItemListeners() {
    Object.keys(this.firebaseItemHandlers)
          .forEach(user => this.removeItemHandlersForUser(user));
  }

  removeItemHandlersForUser(user: string) {
    if (user) {
      const handlers = this.firebaseItemHandlers[user];
      if (handlers) {
        handlers.removeHandlers();
        delete this.firebaseItemHandlers[user];
      }
    }
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
      removeLocalDocumentIds(data);
      this.shareRef.child(key).set(data);
    }
  }
}
