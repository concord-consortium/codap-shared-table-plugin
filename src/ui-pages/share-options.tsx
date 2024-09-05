import React from "react";
import { BACK, CREATE_NEW_TABLE, SHARE_EXISTING_TABLE, OR } from "../constants";
import { IState } from "../types";

interface ShareOptionsProps {
  updateState: (state: Partial<IState>) => void;
}

export const ShareOptions = ({updateState}: ShareOptionsProps) => {
  return (
    <div className="form-container button-stack">
      <div className="option-1">
        <button onClick={() => updateState({ shareExistingTable: true })}>
          {SHARE_EXISTING_TABLE}
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
          onClick={() => updateState({ shareTable: false, shareExistingTable: false, createNewTable: false })}>
          {BACK}
        </button>
      </div>
    </div>
  )
};
