import React from 'react';
import { IState } from '../types';
import { BEGIN_SHARING_TABLE, JOIN_SOMEONE_ELSES_TABLE, OR } from '../constants';

interface FirstPageProps {
  updateState: (state: Partial<IState>) => void;
}

export const FirstPage = ({updateState}: FirstPageProps) => {
  return (
    <div className="form-container button-stack">
      <div className="option-1">
        <button className="option-1" onClick={() => updateState({ allowOthersToJoin: true })}>
          {BEGIN_SHARING_TABLE}
        </button>
      </div>
      <div className="separator">
        <div className="separator-line"/>
        <div>{OR}</div>
        <div className="separator-line"/>
      </div>
      <div className="option-2">
        <button className="option-2" onClick={() => updateState({ joinOtherTable: true })}>
          {JOIN_SOMEONE_ELSES_TABLE}
        </button>
      </div>
    </div>
  )
};
