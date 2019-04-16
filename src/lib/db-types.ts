import { CodapItemValues, DataContext } from "./types";

export interface DBUsers {
  [user: string]: string;
}

export interface DBItemData {
  items: { [id: string]: CodapItemValues };
  order: string[];
}

export interface DBItemDataMap {
  [user: string]: DBItemData;
}

export interface DBSharedTable {
  connectedUsers: DBUsers;
  allUsers: DBUsers;
  dataContext: DataContext;
  itemData?: DBItemDataMap;
}
