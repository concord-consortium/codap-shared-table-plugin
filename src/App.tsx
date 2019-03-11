import React, { Component, ChangeEvent } from 'react';
import * as randomize from 'randomatic';
import { initializePlugin, openTable, getAllDataContexts, addDataContextsListListener, DataContext,
  addDataContextChangeListener, createUniqueDataContext, addNewCollaborationCollections, addCollaborationParentToExistingCollection, resizePlugin, getDataContext } from './lib/codap-helper';
import './App.css';
import { DB } from './lib/db';

const kPluginName = "Collaborative Data Sharing";
const kVersion = "0.0.1";
const kInitialDimensions = {
  width: 350,
  height: 400
}
const kSharedDimensions = {
  width: 350,
  height: 200
}

const kNewSharedTable = "new-table";
const kNewDataContextName = "collaborative-table";
const kNewDataContextTitle = "Collaborative Table";

interface IState {
  availableDataContexts: DataContext[]
  selectedDataContext: string
  personalDataLabel: string
  shareId?: string
}

let database: DB;

class App extends Component {

  public state: IState = {
    availableDataContexts: [],
    selectedDataContext: kNewSharedTable,
    personalDataLabel: ""
  };

  public componentWillMount() {
    initializePlugin(kPluginName, kVersion, kInitialDimensions)
      .then(() => addDataContextsListListener(this.updateDataContexts))
      .then(this.updateDataContexts);

    database = new DB();
  }

  public render() {
    if (!this.state.shareId) {
      resizePlugin(kInitialDimensions.width, kInitialDimensions.height);
      return this.renderForm();
    } else {
      resizePlugin(kSharedDimensions.width, kSharedDimensions.height);
      return this.renderSharingDialog();
    }
  }

  renderForm() {
    const availableContextOptions = this.state.availableDataContexts.map((dc: DataContext) =>
      <option key={dc.name} value={dc.name}>{dc.title}</option>
    );
    const readyToShare = !!this.state.personalDataLabel;

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
              <input type="text" value={this.state.personalDataLabel} onChange={this.updateDataLabel} />
            </div>
          </li>
          <li>
            Invite others to join you your table <strong>or</strong> join another group
            <div>
              <div>
                <button onClick={this.initiateShare} disabled={!readyToShare}>Allow others to join your table</button>
              </div>
              <div>
                or
              </div>
              <div>
                Enter code to join another group: <input type="text" />
                <button disabled={true}>Join</button>
              </div>
            </div>
          </li>
        </ol>
      </div>
    );
  }

  renderSharingDialog() {
    const {selectedDataContext, shareId, availableDataContexts} = this.state;
    const dataContext = availableDataContexts.find((dc: DataContext) => dc.name === selectedDataContext);
    const tableName = dataContext ? dataContext.title : selectedDataContext;
    return (
      <div className="App sharing">
        <div>
          Table collaboration enabled for
        </div>
        <div className="callout">
          {tableName}
        </div>
        <div>
          Others can join this table by using the code
        </div>
        <div className="callout shareId">
          {shareId}
        </div>
        <div>
          <button onClick={this.leaveShare}>Leave collaboration or join a different table</button>
        </div>
      </div>
    )
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

  updateDataLabel = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({personalDataLabel: event.target.value});
  }

  initiateShare = () => {
    const {selectedDataContext, personalDataLabel} = this.state;
    let dataContextName: string;
    if (selectedDataContext === kNewSharedTable) {
      // create new data context for sharing
      createUniqueDataContext(kNewDataContextName, kNewDataContextTitle)
        .then((res: any) => {
          if (res && res.success) {
            dataContextName = res.values.name;
            this.setState({selectedDataContext: dataContextName});
            return addNewCollaborationCollections(dataContextName, personalDataLabel);
          } else {
            return Promise.reject(new Error('failed to create data context'));
          }
        })
        .then(openTable)
        // FIXME: move to outside if-statement once existing table option is working
        .then(() => {
          const shareId = randomize('a0', 6, { exclude: '0oOiIlL1' });
          this.setState({shareId});
          database.setShareId(shareId);
          getDataContext(dataContextName).then((res: any) => {
            database.set("dataContext", res.values);
          });
        })
    }
  }

  leaveShare = () => {
    this.setState({
      shareId: null,
      selectedDataContext: kNewSharedTable,
      personalDataLabel: ""
    });
  }
}

export default App;
