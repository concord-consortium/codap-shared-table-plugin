import React from "react";
import { BEGIN_COLLABORATION, BACK, PROVIDE_NAME_OR_LABEL,
  ENTER_CODE_OF_GROUP, SELECT_TABLE_TO_MERGE,
  NO_TABLES_TO_MERGE} from "../constants";
import { IState } from "../types";

interface JoinAndMergeTableProps {
  selectedContextOption: string;
  availableContextOptions: JSX.Element[];
  joinShareId: string;
  personalDataLabel: string;
  lastPersonalDataLabel: string;
  handleDataContextChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleJoinShareIdChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDataLabelChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  joinShare: (selectedContext?: string) => void;
  updateState: (state: Partial<IState>) => void;
}

export const JoinAndMergeTable = (props: JoinAndMergeTableProps) => {
  const { selectedContextOption, availableContextOptions, personalDataLabel,
    lastPersonalDataLabel, handleDataContextChange, handleDataLabelChange,
    joinShare, joinShareId, updateState, handleJoinShareIdChange } = props;
  return (
    <div className="form-container">
      <div className="select-stack">
        <div>{SELECT_TABLE_TO_MERGE}</div>
        {availableContextOptions.length > 0
          ? <select value={selectedContextOption} onChange={handleDataContextChange}>
              {availableContextOptions}
            </select>
          : <div className="warning">
              {NO_TABLES_TO_MERGE}
            </div>
        }
      </div>
      <div className="input-stack">
        <div>{PROVIDE_NAME_OR_LABEL}</div>
        <input type="text" value={personalDataLabel} placeholder={lastPersonalDataLabel}
          onChange={handleDataLabelChange} />
      </div>
      <div className="input-stack">
        <div>{ENTER_CODE_OF_GROUP}</div>
        <input type="text" value={joinShareId} onChange={handleJoinShareIdChange} />
      </div>
      <div className="button-row">
        <button
          className="cancel-button"
          onClick={() => updateState({ joinAndMergeTable: false, showJoinShareError: false })}>
          {BACK}
        </button>
        <button
          disabled={!selectedContextOption || !joinShareId || (!personalDataLabel && !lastPersonalDataLabel)}
          onClick={() => joinShare(selectedContextOption)}
        >
            {BEGIN_COLLABORATION}
        </button>
      </div>
    </div>
  )
};
