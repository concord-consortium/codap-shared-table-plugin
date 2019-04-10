export interface ClientItemValues {
  id: string;
  values: { [attr: string]: any };
}
export type ClientItemsHandler = (user: string, items: ClientItemValues[]) => void;
export interface ClientItemsHandlers {
  itemsAdded: ClientItemsHandler;
  itemsChanged: ClientItemsHandler;
  itemsRemoved: ClientItemsHandler;
}

export class FirebaseItemHandlers {
  user: string;
  userItemsRef: firebase.database.Reference;
  clientHandlers: ClientItemsHandlers;
  hasReceivedInitialItems: boolean;

  constructor(user: string, userItemsRef: firebase.database.Reference, clientHandlers: ClientItemsHandlers) {
    this.user = user;
    this.userItemsRef = userItemsRef;
    this.clientHandlers = clientHandlers;
    this.hasReceivedInitialItems = false;

    this.installHandlers();
  }

  installHandlers() {
    // cf. https://stackoverflow.com/a/18283441 for this technique of distinguishing
    // the initial batch of items from items added after the initial batch.
    this.userItemsRef.on('child_added', this.handleItemAdded);
    this.userItemsRef.once('value', this.handleInitialItems);
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
    const items = data && data.val() as ClientItemValues[];
    if (items) {
      this.clientHandlers.itemsAdded(this.user, items);
    }
  }

  handleItemAdded = (data: firebase.database.DataSnapshot | null) => {
    if (!this.hasReceivedInitialItems) return;
    const item = data && data.val() as ClientItemValues;
    if (item) {
      this.clientHandlers.itemsAdded(this.user, [item]);
    }
  }

  handleItemChanged = (data: firebase.database.DataSnapshot | null) => {
    const item = data && data.val() as ClientItemValues;
    if (item) {
      this.clientHandlers.itemsChanged(this.user, [item]);
    }
  }

  handleItemRemoved = (data: firebase.database.DataSnapshot | null) => {
    const item = data && data.val() as ClientItemValues;
    if (item) {
      this.clientHandlers.itemsRemoved(this.user, [item]);
    }
  }
}
