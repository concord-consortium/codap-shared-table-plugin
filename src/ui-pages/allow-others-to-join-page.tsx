import React from "react";
import { CANCEL, CREATE_NEW_TABLE, MERGE_TABLES, OR } from "../constants";
import { IState } from "../types";

interface AllowOthersToJoinPageProps {
  updateState: (state: Partial<IState>) => void;
}

export const AllowOthersToJoinPage = ({updateState}: AllowOthersToJoinPageProps) => {
  return (
    <div className="form-container button-stack">
      <div className="option-1">
        <button onClick={() => updateState({ mergeTable: true })}>
          {MERGE_TABLES}
        </button>
      </div>
      <div className="separator">
        <div className="separator-line" />
        <div>{OR}</div>
        <div className="separator-line" />
      </div>
      <div className="option-2">
        <button onClick={() => updateState({ createNewTable: true })}>
          {CREATE_NEW_TABLE}
        </button>
      </div>
      <div className="button-row">
        <button
          className="cancel-button"
          onClick={() => updateState({ allowOthersToJoin: false })}>
          {CANCEL}
        </button>
      </div>
    </div>
  )
};
