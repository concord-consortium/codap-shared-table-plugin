import React from "react";
import { IState } from "../types";
import { CANCEL, PROVIDE_NAME_OR_LABEL, BEGIN_COLLABORATION, ENTER_CODE_TO_JOIN_GROUP } from "../constants";

interface JoinOtherTableProps {
  joinShareId: string;
  personalDataLabel: string;
  lastPersonalDataLabel: string;
  handleJoinShareIdChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDataLabelChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  joinShare: () => void;
  updateState: (state: Partial<IState>) => void;
}

export const JoinOtherTablePage = (props: JoinOtherTableProps) => {
  const { joinShareId, personalDataLabel, lastPersonalDataLabel, handleJoinShareIdChange,
    handleDataLabelChange, joinShare, updateState } = props;
  return (
    <div className="form-container">
      <div className="input-stack">
        <div>{ENTER_CODE_TO_JOIN_GROUP}</div>
        <input type="text" value={joinShareId} onChange={handleJoinShareIdChange} />
      </div>
      <div className="input-stack">
        <div>{PROVIDE_NAME_OR_LABEL}</div>
        <input type="text" value={personalDataLabel} placeholder={lastPersonalDataLabel}
          onChange={handleDataLabelChange} />
      </div>
      <div className="button-row">
        <button
          className="cancel-button"
          onClick={() => updateState({ joinOtherTable: false })}>
            {CANCEL}
        </button>
        <button onClick={joinShare}>{BEGIN_COLLABORATION}</button>
      </div>
    </div>
  )
};
