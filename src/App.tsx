import React, { Component, ChangeEvent } from "react";
import * as randomize from "randomatic";
import { CodapHelper as Codap, DataContext} from "./lib/codap-helper";
import "./App.css";
import { DB } from "./lib/db";

const kPluginName = "Collaborative Data Sharing";
const kVersion = "0.0.1";
const kInitialDimensions = {
  width: 350,
  height: 400
};
const kSharedDimensions = {
  width: 350,
  height: 200
};

const kNewSharedTable = "new-table";
const kNewDataContextName = "collaborative-table";
const kNewDataContextTitle = "Collaborative Table";

interface IState {
  availableDataContexts: DataContext[];
  selectedDataContext: string;
  personalDataLabel: string;
  shareId?: string;
  joinShareId: string;
}

let database: DB;

class App extends Component {

  public state: IState = {
    availableDataContexts: [],
    selectedDataContext: kNewSharedTable,
    personalDataLabel: "",
    joinShareId: ""
  };

  public componentDidMount() {
    Codap.initializePlugin(kPluginName, kVersion, kInitialDimensions)
      .then(() => Codap.addDataContextsListListener(this.updateAvailableDataContexts))
      .then(this.updateAvailableDataContexts);

    database = new DB();
  }

  public render() {
    if (!this.state.shareId) {
      Codap.resizePlugin(kInitialDimensions.width, kInitialDimensions.height);
      return this.renderForm();
    } else {
      Codap.resizePlugin(kSharedDimensions.width, kSharedDimensions.height);
      return this.renderSharingDialog();
    }
  }

  renderForm() {
    const availableContextOptions = this.state.availableDataContexts.map((dc: DataContext) =>
      <option key={dc.name} value={dc.name}>{dc.title}</option>
    );
    const readyToShare = !!this.state.personalDataLabel;
    const readyToJoinShare = readyToShare && !!this.state.joinShareId;

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
            Invite others to join your table <strong>or</strong> join another group
            <div>
              <div>
                <button onClick={this.initiateShare} disabled={!readyToShare}>Allow others to join your table</button>
              </div>
              <div>
                or
              </div>
              <div>
                Enter code to join another group:
                <input type="text" value={this.state.joinShareId} onChange={this.updateJoinShareId} />
                <button disabled={!readyToJoinShare} onClick={this.joinShare}>Join</button>
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
    );
  }

  updateAvailableDataContexts = async () => {
    const contexts = await Codap.getAllDataContexts();
    const existingListeners = this.state.availableDataContexts.map(c => c.name);
    contexts.forEach((dc) => {
      if (existingListeners.indexOf(dc.name) < 0) {
        Codap.addDataContextChangeListener(dc, this.handleDataContextUpdate);
      }
    });
    this.setState({availableDataContexts: contexts});
  }

  handleDataContextUpdate = async () => {
    this.updateAvailableDataContexts(); // existing dataContext name may have changed

    const { shareId, selectedDataContext, personalDataLabel } = this.state;
    if (shareId) {
      // update data context details
      // note, once we are sharing with other people, we will need to prevent echoes
      const dataContext = await Codap.getDataContext(selectedDataContext);
      if (dataContext) {
        database.set("dataContext", dataContext);
      }

      const items = await Codap.getItemsOfCollaborator(selectedDataContext, personalDataLabel);
      database.setUserItems(personalDataLabel, items);
    }
  }

  updateSelectedDataContext = (event: ChangeEvent<HTMLSelectElement>) => {
    this.setState({selectedDataContext: event.target.value});
  }

  updateDataLabel = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({personalDataLabel: event.target.value});
  }

  updateJoinShareId = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({joinShareId: event.target.value});
  }

  initiateShare = async () => {
    const {selectedDataContext, personalDataLabel} = this.state;
    let dataContextName: string;

    if (selectedDataContext === kNewSharedTable) {
      // create new data context for sharing
      const newContext = await Codap.createUniqueDataContext(kNewDataContextName, kNewDataContextTitle);
      if (newContext) {
        dataContextName = newContext.name;
        this.setState({selectedDataContext: dataContextName});
        await Codap.addNewCollaborationCollections(dataContextName, personalDataLabel);
        Codap.openTable(dataContextName);
      } else {
        throw new Error("failed to create new data context");
      }
    } else {
      // only supporting new contexts right now
      return;
    }

    const shareId = randomize("a0", 6, { exclude: "0oOiIlL1" });
    this.setState({shareId});
    database.setShareId(shareId);

    const updatedNewContext = await Codap.getDataContext(dataContextName);
    if (updatedNewContext) {
      database.set("dataContext", updatedNewContext);
    }
  }

  joinShare = async () => {
    const shareId = this.state.joinShareId;
    this.setState({shareId});
    database.setShareId(shareId);

    const response = await database.getAll();
    const contextData = response && response.val();
    if (contextData) {
      const { dataContext, items } = contextData;

      // fix parent references -- assumes collections are written out in order
      const collectionNames: string[] = [];
      dataContext.collections.forEach((collection: any, index: number) => {
        collectionNames.push(collection.name);
        if (index > 0) {
          collection.parent = collectionNames[index - 1];
        }
      });
      await Codap.createDataContext(dataContext);

      // combine items from all users in a single array
      if (items) {
        const allItems = [];
        // tslint:disable-next-line: forin
        for (const label in items) {
          allItems.push(...items[label]);
        }
        if (allItems.length) {
          await Codap.createItems(dataContext.name, allItems);
        }
      }

      // add collaborator name case if necessary
      if (!items || !items[this.state.personalDataLabel]) {
        Codap.createUserCase(dataContext.name, this.state.personalDataLabel);
      }

      this.updateAvailableDataContexts();
      Codap.openTable(dataContext.name);
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
