import * as firebase from "firebase/app";
import "firebase/database";
import { ClientItemsHandlers, FirebaseItemHandlers } from "./firebase-handlers";
import { CodapItem, CodapItemValues, CodapObject, DBData } from "./types";

const config = {
  apiKey: atob("QUl6YVN5QVNDR2k5ZldDVVgzb3JKVkI5ZDZzdkpieERIZlNSSlZB"),
  authDomain: "codap-shared-table-plugin.firebaseapp.com",
  databaseURL: "https://codap-shared-table-plugin.firebaseio.com"
};

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
function removeLocalDocumentIds(obj: CodapObject | CodapObject[]) {
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
  listeners: Array<{path: string; callback: (data: DBData) => void; }> = [];

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

  getAllUsersRef() {
    return this.shareRef?.child("allUsers");
  }

  getUserItemDataRef(user: string) {
    const itemsRef = this.shareRef?.child("itemData");
    return itemsRef?.child(user);
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
    const allUsers = await this.getAllUsers();
    if (allUsers?.val()) {
      this.registerPresence(userLabel);
      return true;
    }
    this.shareRef = undefined;
    return false;
  }

  leaveSharedTable() {
    this.removeUserItemListeners();
    if (this.unregisterPresence) {
      this.unregisterPresence();
    }
    if (this.shareRef) {
      this.listeners.forEach(listener => this.shareRef!.child(listener.path).off("value", listener.callback));
    }
    this.shareRef = undefined;
  }

  // retrieves data from `shared-tables/${shareId}`
  async getAll() {
    return this.shareRef?.once("value");
  }

  writeUserItems(userLabel: string, items: CodapItem[]) {
    const userItemDataRef = this.getUserItemDataRef(userLabel);
    const userItemData = {
            items: items.reduce((itemMap, item) => {
                    const { __editable__, ...others } = item.values;
                    itemMap[item.id] = others;
                    return itemMap;
                  }, {} as CodapItemValues),
            order: items.map(item => item.id)
          };
    userItemDataRef?.set(userItemData);
  }

  async getAllUsers() {
    const allUsersRef = this.getAllUsersRef();
    return allUsersRef?.once("value");
  }

  installUserItemListeners() {
    const allUsersRef = this.getAllUsersRef();
    allUsersRef?.on("child_added", userData => {
      const user = userData?.key;
      if (user) {
        const userItemDataRef = this.getUserItemDataRef(user);
        if (userItemDataRef && (user !== this.userLabel)) {
          this.firebaseItemHandlers[user] = new FirebaseItemHandlers(user, userItemDataRef, this.clientItemsHandlers);
        }
      }
    });
    allUsersRef?.on("child_removed", userData => {
      const user = userData?.key;
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
    const allUsersRef = this.shareRef?.child("allUsers");
    const connectedRef = this.shareRef?.child("connectedUsers");
    if (allUsersRef && connectedRef) {
      const time = Date.now();
      allUsersRef.child(userLabel).set(time);
      const userPresence = connectedRef.child(userLabel);
      userPresence.set(time);

      this.unregisterPresence = () => {
        userPresence.remove();
      };
      userPresence.onDisconnect().remove();
    }
  }

  /**
   * Listens to data at `shared-tables/${shareId}/${path}`
   * Listeners will be removed on leaveSharedTable
   */
  addListener(path: string, callback: (data: DBData) => void) {
    if (this.shareRef) {
      this.listeners.push({path, callback});
      this.shareRef.child(path).on("value", (response) => {
        const val = response?.val();
        callback(val);
      });
    }
  }

  // adds data at `shared-tables/${shareId}/${path}`
  set(path: string, data: DBData) {
    if (this.shareRef) {
      removeLocalDocumentIds(data);
      this.shareRef.child(path).set(data);
    }
  }
}
