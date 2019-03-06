import React, { Component, ChangeEvent } from 'react';
import { initializePlugin, openTable, addData, createDataContext, getAllDataContexts, addDataContextsListListener, DataContext, addDataContextChangeListener } from './lib/codap-helper';
import './App.css';

const kPluginName = "Collaborative Data Sharing";
const kVersion = "0.0.1";
const kInitialDimensions = {
  width: 350,
  height: 400
}

const kNewSharedTable = "new-table";

interface IState {
  availableDataContexts: any[]
  selectedDataContext: string
}

class App extends Component {

  public state: IState = {
    availableDataContexts: [],
    selectedDataContext: kNewSharedTable
  };

  public componentWillMount() {
    initializePlugin(kPluginName, kVersion, kInitialDimensions)
      .then(() => addDataContextsListListener(this.updateDataContexts))
      .then(this.updateDataContexts)
  }

  public render() {
    const availableContextOptions = this.state.availableDataContexts.map((dc: DataContext) =>
      <option key={dc.name} value={dc.name}>{dc.title}</option>
    );
    return (
      <div className="App">
        To create or join a collaborative table
        <ol>
          <li>
            Select a table to share <strong>or</strong> create a new one
            <div>
              <select value={this.state.selectedDataContext} onChange={this.updateSelectedDataContext}>
                { availableContextOptions }
                <option value={kNewSharedTable}>Create new table</option>
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

  updateDataContexts = () => {
    getAllDataContexts().then((res: any) => {
      const contexts = res.values;
      const existingListeners = this.state.availableDataContexts.map(c => c.name);
      contexts.forEach((context: DataContext) => {
        if (existingListeners.indexOf(context.name) < 0) {
          addDataContextChangeListener(context, this.updateDataContexts);
        }
      });
      this.setState({availableDataContexts: (res as any).values});
    })
  }

  updateSelectedDataContext = (event: ChangeEvent<HTMLSelectElement>) => {
    this.setState({selectedDataContext: event.target.value});
  }
}

export default App;
