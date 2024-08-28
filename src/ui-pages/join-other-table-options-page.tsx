import React from "react";
import { BACK, JOIN_AND_MERGE, OR, JOIN_WITHOUT_MERGING } from "../constants";
import { IState } from "../types";

interface AllowOthersToJoinPageProps {
  updateState: (state: Partial<IState>) => void;
}

export const JoinOtherTableOptionsPage = ({updateState}: AllowOthersToJoinPageProps) => {
  return (
    <div className="form-container button-stack">
      <div className="option-1">
        <button onClick={() => updateState({ joinAndMergeTable: true })}>
          {JOIN_AND_MERGE}
        </button>
      </div>
      <div className="separator">
        <div className="separator-line" />
        <div>{OR}</div>
        <div className="separator-line" />
      </div>
      <div className="option-2">
        <button onClick={() => updateState({ joinWithoutMerging: true })}>
          {JOIN_WITHOUT_MERGING}
        </button>
      </div>
      <div className="button-row">
        <button
          className="cancel-button"
          onClick={() => updateState({ joinOtherTable: false, joinAndMergeTable: false, joinWithoutMerging: false })}>
          {BACK}
        </button>
      </div>
    </div>
  )
};
