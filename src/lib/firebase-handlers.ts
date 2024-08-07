import { CodapItem, CodapItemValues } from "./types";
import { DBItemData } from "./db-types";

export type ClientItemsHandler = (user: string, items: CodapItem[]) => void;
export interface ClientItemsHandlers {
  itemsAdded: ClientItemsHandler;
  itemsChanged: ClientItemsHandler;
  itemsRemoved: ClientItemsHandler;
}

export class FirebaseItemHandlers {
  user: string;
  userItemDataRef: firebase.database.Reference;
  userItemOrderRef: firebase.database.Reference;
  userItemsRef: firebase.database.Reference;
  clientHandlers: ClientItemsHandlers;
  hasReceivedInitialItems: boolean = false;
  orderedItemIds: string[] = [];
  itemIds: Set<string> = new Set();
  queuedItems: CodapItem[] = [];

  constructor(user: string, userItemDataRef: firebase.database.Reference, clientHandlers: ClientItemsHandlers) {
    this.user = user;
    this.userItemDataRef = userItemDataRef;
    this.userItemOrderRef = userItemDataRef?.child("order");
    this.userItemsRef = userItemDataRef?.child("items");
    this.clientHandlers = clientHandlers;

    this.installHandlers();
  }

  installHandlers() {
    // cf. https://stackoverflow.com/a/18283441 for this technique of distinguishing
    // the initial batch of items from items added after the initial batch.
    this.userItemsRef.on("child_added", this.handleItemAdded);
    this.userItemDataRef.once("value", this.handleInitialItems);
    this.userItemsRef.on("child_changed", this.handleItemChanged);
    this.userItemsRef.on("child_removed", this.handleItemRemoved);
    this.userItemOrderRef.on("value", this.handleOrderChanged);
  }

  removeHandlers() {
    this.userItemOrderRef.off("value", this.handleOrderChanged);
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

      this.orderedItemIds = itemData.order;
      items.forEach(item => this.itemIds.add(item.id));
    }
  };

  sortedQueuedItems = () => {
    if (this.queuedItems.length <= 1) return this.queuedItems;
    const idIndexMap: { [id: string]: number } = {};
    this.orderedItemIds.forEach((id, index) => idIndexMap[id] = index);
    this.queuedItems.sort((a, b) => idIndexMap[a.id] - idIndexMap[b.id]);
    return this.queuedItems;
  };

  // When a batch of cases are added at once, we get multiple child_added
  // notifications and a single update to the ordered IDs array in some order.
  // We queue the new items until we have the number of items that matches the
  // ordered IDs array and then add the new items in the correct order as a batch.
  addQueuedItemsIfSynced = () => {
    if (this.queuedItems.length &&
        (this.itemIds.size + this.queuedItems.length === this.orderedItemIds.length)) {
      const items = this.sortedQueuedItems();
      this.clientHandlers.itemsAdded(this.user, items);
      items.forEach(item => this.itemIds.add(item.id));
      this.queuedItems = [];
    }
  };

  handleItemAdded = (data: firebase.database.DataSnapshot | null) => {
    if (!this.hasReceivedInitialItems) return;
    const itemValues = data && data.val() as CodapItemValues;
    if (data && itemValues) {
      const item: CodapItem = { id: data.key as string, values: itemValues };
      this.queuedItems.push(item);
      this.addQueuedItemsIfSynced();
    }
  };

  handleItemChanged = (data: firebase.database.DataSnapshot | null) => {
    const itemValues = data && data.val() as CodapItemValues;
    if (data && itemValues) {
      const item: CodapItem = { id: data.key as string, values: itemValues };
      this.clientHandlers.itemsChanged(this.user, [item]);
    }
  };

  handleItemRemoved = (data: firebase.database.DataSnapshot | null) => {
    const itemValues = data && data.val() as CodapItemValues;
    if (data && itemValues) {
      const item: CodapItem = { id: data.key as string, values: itemValues };
      this.clientHandlers.itemsRemoved(this.user, [item]);
      this.itemIds.delete(item.id);
    }
  };

  handleOrderChanged = (data: firebase.database.DataSnapshot | null) => {
    const order = data?.val();
    if (order) {
      this.orderedItemIds = order;
      this.addQueuedItemsIfSynced();
    }
  };
}
