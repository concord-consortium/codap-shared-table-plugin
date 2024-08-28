import React from "react";
import { BEGIN_COLLABORATION, BACK, PROVIDE_NAME_OR_LABEL,
  ENTER_CODE_OF_GROUP, SELECT_TABLE_TO_MERGE} from "../constants";
import { IState } from "../types";

interface MergeTablePageProps {
  selectedContextOption: string;
  availableContextOptions: JSX.Element[];
  joinShareId: string;
  personalDataLabel: string;
  lastPersonalDataLabel: string;
  handleDataContextChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleJoinShareIdChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDataLabelChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  joinShare: () => void;
  updateState: (state: Partial<IState>) => void;
}

export const JoinAndMergeTableForm = (props: MergeTablePageProps) => {
  const { selectedContextOption, availableContextOptions, personalDataLabel,
    lastPersonalDataLabel, handleDataContextChange, handleDataLabelChange,
    joinShare, joinShareId, updateState, handleJoinShareIdChange } = props;
  return (
    <div className="form-container">
      <div className="select-stack">
        <div>{SELECT_TABLE_TO_MERGE}</div>
        <select value={selectedContextOption} onChange={handleDataContextChange}>
          {availableContextOptions}
        </select>
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
          onClick={() => updateState({ joinAndMergeTable: false })}>
          {BACK}
        </button>
        <button
          disabled={!selectedContextOption || !personalDataLabel}
          onClick={joinShare}>{BEGIN_COLLABORATION}
        </button>
      </div>
    </div>
  )
};
