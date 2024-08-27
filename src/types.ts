import { ISaveState } from "./lib/codap-helper";
import { DataContext } from "./lib/types";

export interface IState extends ISaveState {
  id: string;
  availableDataContexts: DataContext[];
  selectedDataContext: string;
  personalDataLabel: string;
  personalDataKey: string;
  shareId?: string;
  joinShareId: string;
  isInProcessOfSharing: boolean;
  showJoinShareError: boolean;
  allowOthersToJoin?: boolean;
  joinOtherTable?: boolean;
  mergeTable?: boolean;
  createNewTable?: boolean;
  newTableName?: string;
}
