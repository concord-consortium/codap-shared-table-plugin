
import pkg from "../package.json";

export const kPluginName = "Collaborative Data Sharing";
export const kVersion = pkg.version;
export const kInitialDimensions = {
  width: 420,
  height: 350
};

export const kSharedDimensions = {
  width: 400,
  height: 350
};

export const kShareIdLength = 6;

export const kNewSharedTable = "new-table";
export const kNewDataContextTitle = "Collaborative Table";


export const ALLOW_OTHERS_TO_JOIN = "Allow others to join your table";
export const JOIN_SOMEONE_ELSES_TABLE = "Join someone else's table";
export const ENTER_CODE_TO_JOIN_GROUP = "Enter the code to join another group:";
export const PROVIDE_NAME_OR_LABEL = "Provide a name or label for your data:";
export const MERGE_TABLES = "Merge one of your tables with the table being joined";
export const CREATE_NEW_TABLE = "Create new table";
export const OR = "or";
export const CANCEL = "cancel";
export const SELECT_TABLE_TO_MERGE = "Select a table to merge with the shared group:";
export const ENTER_CODE_OF_GROUP = "Enter the code of the group to join:";
export const BEGIN_COLLABORATION = "Begin Collaboration";
export const ENTER_NAME_FOR_TABLE = "Enter a name for the table:";
