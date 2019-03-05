import React, { Component } from 'react';
import { initializePlugin, openTable, addData, createDataContext } from './lib/codap-helper';
import './App.css';

const kPluginName = "Collaborative Data Sharing";
const kVersion = "0.0.1";
const kInitialDimensions = {
  width: 350,
  height: 400
}
const kDataContextName = "collaborative tables";

class App extends Component {
  public componentWillMount() {
    initializePlugin(kPluginName, kVersion, kInitialDimensions);
      // .then(() => createDataContext(kDataContextName));
  }

  public render() {
    return (
      <div className="App">
        To create or join a collaborative table
        <ol>
          <li>
            Select a table to share <strong>or</strong> create a new one
            <div>
              <select value={"new-table"}>
                <option value="new-table">Create new table</option>
              </select>
            </div>
          </li>
          <li>
            Provide a name or label for grouping
            <div>
              <input type="text" value={""} />
            </div>
          </li>
          <li>
            Invite others to join you your table <strong>or</strong> join another group
            <div>
              <div>
                <button>Allow others to join your table</button>
              </div>
              <div>
                or
              </div>
              <div>
                Enter code to join another group: <input type="text" value={""} />
                <button>Join</button>
              </div>
            </div>
          </li>
        </ol>
      </div>
    );
  }
}

export default App;
