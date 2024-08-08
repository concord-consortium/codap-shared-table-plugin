// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CodapObject = any;

export interface Attribute {
  name: string;
  formula?: string;
  description?: string;
  type?: string;
  cid?: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CodapItemValue = any;
export interface CodapItemValues {
  [attr: string]: CodapItemValue;
}

export interface CodapItem {
  id: string;
  values: CodapItemValues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DBData = any;

export type CodapRequestAction = "create" | "delete" | "get" | "notify" | "update" | string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CodapRequestValues = any;
export interface CodapRequest {
  action: CodapRequestAction;
  resource: string;
  values?: CodapRequestValues;
}
export type CodapRequests = CodapRequest | CodapRequest[]
export type CodapRequestHandler = (notification: CodapRequest) => CodapRequestResponse | Promise<CodapRequestResponse>;

export interface CodapRequestResponse {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values?: any;
}
export type CodapRequestResponses = CodapRequestResponse | CodapRequestResponse[];
export type CodapRequestCallback = (response: CodapRequestResponses, request?: CodapRequests) => void;

export interface CodapResource {
  [type: string]: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteractiveFrame = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteractiveState = any;
