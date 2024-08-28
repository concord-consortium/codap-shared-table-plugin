
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


export const OR = "or";
export const BACK = "back";

export const BEGIN_SHARING_TABLE = "Begin sharing a table";
export const JOIN_SOMEONE_ELSES_TABLE = "Join someone else's table";

export const SHARE_EXISTING_TABLE = "Share an existing table";
export const CREATE_NEW_TABLE = "Create a new table to share";

export const SELECT_TABLE_TO_SHARE = "Select a table to share:";
export const ENTER_NAME_FOR_TABLE = "Enter a name for the table:";

export const JOIN_AND_MERGE = "Join and merge an existing table";
export const JOIN_WITHOUT_MERGING = "Join without merging an existing table";

export const SELECT_TABLE_TO_MERGE = "Select a table to merge:";
export const ENTER_CODE_OF_GROUP = "Enter the code of the group to join:";

export const PROVIDE_NAME_OR_LABEL = "Provide a name or label for your data:";

export const BEGIN_COLLABORATION = "Begin Collaboration";
