import React from "react";
import { BEGIN_COLLABORATION, BACK, ENTER_NAME_FOR_TABLE, PROVIDE_NAME_OR_LABEL } from "../constants";
import { IState } from "../types";

interface ShareNewTableProps {
  newTableName: string;
  updateState: (state: Partial<IState>) => void;
  personalDataLabel: string;
  lastPersonalDataLabel: string;
  handleDataLabelChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  initiateShare: (selectedContextOption?: string) => void;
}

export const ShareNewTable = (props: ShareNewTableProps) => {
  const { newTableName, updateState, personalDataLabel, lastPersonalDataLabel,
    handleDataLabelChange, initiateShare} = props;
  return (
    <div className="form-container">
      <div className="input-stack">
        <div>{ENTER_NAME_FOR_TABLE}</div>
        <input
          type="text" value={newTableName}
          onChange={(e) => updateState({ newTableName: e.target.value })}
        />
      </div>
      <div className="input-stack">
        <div>{PROVIDE_NAME_OR_LABEL}</div>
        <input type="text" value={personalDataLabel} placeholder={lastPersonalDataLabel}
          onChange={handleDataLabelChange} />
      </div>
      <div className="button-row">
        <button
          className="cancel-button"
          onClick={() => updateState({ createNewTable: false })}>
          {BACK}
        </button>
        <button
          disabled={(!personalDataLabel && !lastPersonalDataLabel) || !newTableName}
          onClick={() => initiateShare()}
        >
          {BEGIN_COLLABORATION}
        </button>
      </div>
    </div>
  )
};
