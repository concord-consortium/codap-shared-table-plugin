import { CodapItem, CodapItemValues, DBItemData } from "./types";

export type ClientItemsHandler = (user: string, items: CodapItem[]) => void;
export interface ClientItemsHandlers {
  itemsAdded: ClientItemsHandler;
  itemsChanged: ClientItemsHandler;
  itemsRemoved: ClientItemsHandler;
}

export class FirebaseItemHandlers {
  user: string;
  userItemDataRef: firebase.database.Reference;
  userItemsRef: firebase.database.Reference;
  clientHandlers: ClientItemsHandlers;
  hasReceivedInitialItems: boolean;

  constructor(user: string, userItemDataRef: firebase.database.Reference, clientHandlers: ClientItemsHandlers) {
    this.user = user;
    this.userItemDataRef = userItemDataRef;
    this.userItemsRef = userItemDataRef && userItemDataRef.child("items");
    this.clientHandlers = clientHandlers;
    this.hasReceivedInitialItems = false;

    this.installHandlers();
  }

  installHandlers() {
    // cf. https://stackoverflow.com/a/18283441 for this technique of distinguishing
    // the initial batch of items from items added after the initial batch.
    this.userItemsRef.on('child_added', this.handleItemAdded);
    this.userItemDataRef.once('value', this.handleInitialItems);
    this.userItemsRef.on('child_changed', this.handleItemChanged);
    this.userItemsRef.on('child_removed', this.handleItemRemoved);
  }

  removeHandlers() {
    this.userItemsRef.off("child_removed", this.handleItemRemoved);
    this.userItemsRef.off("child_changed", this.handleItemChanged);
    this.userItemsRef.off("child_added", this.handleItemAdded);
  }

  handleInitialItems = (data: firebase.database.DataSnapshot | null) => {
    this.hasReceivedInitialItems = true;
    const itemData = data && data.val() as DBItemData;
    if (itemData) {
      const items = itemData.order
                      .map(id => ({ id, values: itemData.items[id] }))
                      .filter(item => !!item);
      this.clientHandlers.itemsAdded(this.user, items);
    }
  }

  handleItemAdded = (data: firebase.database.DataSnapshot | null) => {
    if (!this.hasReceivedInitialItems) return;
    const itemValues = data && data.val() as CodapItemValues;
    if (data && itemValues) {
      const item: CodapItem = { id: data.key as string, values: itemValues };
      this.clientHandlers.itemsAdded(this.user, [item]);
    }
  }

  handleItemChanged = (data: firebase.database.DataSnapshot | null) => {
    const itemValues = data && data.val() as CodapItemValues;
    if (data && itemValues) {
      const item: CodapItem = { id: data.key as string, values: itemValues };
      this.clientHandlers.itemsChanged(this.user, [item]);
    }
  }

  handleItemRemoved = (data: firebase.database.DataSnapshot | null) => {
    const itemValues = data && data.val() as CodapItemValues;
    if (data && itemValues) {
      const item: CodapItem = { id: data.key as string, values: itemValues };
      this.clientHandlers.itemsRemoved(this.user, [item]);
    }
  }
}
