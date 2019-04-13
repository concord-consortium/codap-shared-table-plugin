export interface Attribute {
  name: string;
  formula?: string;
  description?: string;
  type?: string;
  precision?: string;
  unit?: string;
  editable?: boolean;
  renameable?: boolean;
  deleteable?: boolean;
  hidden?: boolean;
}

export interface Collection {
  name: string;
  title: string;
  id?: number;
  parent?: string | number;
  description?: string;
  labels?: {
    singleCase?: string;
    pluralCase?: string;
    singleCaseWithArticle?: string;
    setOfCases?: string;
    setOfCasesWithArticle?: string;
  };
  attrs: Attribute[];
}

export interface DataContextCreation {
  title: string;
  collections?: Collection[];
}

export interface DataContext extends DataContextCreation {
  name: string;
  collections: Collection[];
}

export interface CodapItemValues {
  [attr: string]: any;
}

export interface CodapItem {
  id: string;
  values: CodapItemValues;
}

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
