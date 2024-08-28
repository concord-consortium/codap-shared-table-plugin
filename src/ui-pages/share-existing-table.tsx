import React from "react";
import { BEGIN_COLLABORATION, BACK, PROVIDE_NAME_OR_LABEL, SELECT_TABLE_TO_SHARE } from "../constants";
import { IState } from "../types";

interface ShareExistingTableProps {
  selectedContextOption: string;
  availableContextOptions: JSX.Element[];
  personalDataLabel: string;
  lastPersonalDataLabel: string;
  handleDataContextChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleDataLabelChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  initiateShare: () => void;
  updateState: (state: Partial<IState>) => void;
}

export const ShareExistingTable = (props: ShareExistingTableProps) => {
  const { selectedContextOption, availableContextOptions, personalDataLabel,
    lastPersonalDataLabel, handleDataContextChange, handleDataLabelChange,
    initiateShare, updateState } = props;
  return (
    <div className="form-container">
      <div className="select-stack">
        <div>{SELECT_TABLE_TO_SHARE}</div>
        <select value={selectedContextOption} onChange={handleDataContextChange}>
          {availableContextOptions}
        </select>
      </div>
      <div className="input-stack">
        <div>{PROVIDE_NAME_OR_LABEL}</div>
        <input type="text" value={personalDataLabel} placeholder={lastPersonalDataLabel}
          onChange={handleDataLabelChange} />
      </div>
      <div className="button-row">
        <button
          className="cancel-button"
          onClick={() => updateState({ shareExistingTable: false })}>
          {BACK}
        </button>
        <button
          disabled={!selectedContextOption || !personalDataLabel}
          onClick={initiateShare}>{BEGIN_COLLABORATION}
        </button>
      </div>
    </div>
  )
};
