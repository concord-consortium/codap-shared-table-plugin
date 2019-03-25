import React, { Component, ChangeEvent } from "react";
import * as randomize from "randomatic";
import { CodapHelper as Codap, DataContext} from "./lib/codap-helper";
import { ClientNotification } from "./lib/CodapInterface";
import { DB } from "./lib/db";
const pkg = require("../package.json");
import "./App.css";

const kPluginName = "Collaborative Data Sharing";
const kVersion = pkg.version;
const kInitialDimensions = {
  width: 350,
  height: 400
};
const kSharedDimensions = {
  width: 350,
  height: 200
};

const kShareIdLength = 6;

const kNewSharedTable = "new-table";
const kNewDataContextTitle = "Collaborative Table";

interface IState {
  availableDataContexts: DataContext[];
  selectedDataContext: string;
  personalDataLabel: string;
  shareId?: string;
  joinShareId: string;
  isInProcessOfSharing: boolean;
  showJoinShareError: boolean;
}

let database: DB;

class App extends Component {

  public state: IState = {
    availableDataContexts: [],
    selectedDataContext: kNewSharedTable,
    personalDataLabel: "",
    joinShareId: "",
    isInProcessOfSharing: false,
    showJoinShareError: false
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
    const { availableDataContexts, selectedDataContext, personalDataLabel, joinShareId,
            isInProcessOfSharing } = this.state;
    const availableContextOptions = availableDataContexts.map((dc: DataContext) =>
      <option key={dc.name} value={dc.name}>{dc.title}</option>
    );
    const readyToInitiateShare = !!personalDataLabel && !isInProcessOfSharing;
    const readyToJoinShare = readyToInitiateShare && (joinShareId.length === kShareIdLength);

    return (
      <div className="App">
        To create or join a collaborative table
        <ol>
          <li>
            Select a table to share <strong>or</strong> create a new one
            <div>
              <select value={selectedDataContext} onChange={this.updateSelectedDataContext}>
                { availableContextOptions }
                <option value={kNewSharedTable}>Create new table</option>
              </select>
            </div>
          </li>
          <li>
            Provide a name or label for grouping
            <div>
              <input type="text" value={personalDataLabel} onChange={this.updateDataLabel} />
            </div>
          </li>
          <li>
            Invite others to join your table <strong>or</strong> join another group
            <div>
              <div>
                <button onClick={this.initiateShare} disabled={!readyToInitiateShare}>
                  Allow others to join your table
                </button>
              </div>
              <div>
                or
              </div>
              <div>
                Enter code to join another group:
                <input type="text" value={joinShareId} onChange={this.updateJoinShareId} />
                <button disabled={!readyToJoinShare} onClick={this.joinShare}>Join</button>
              </div>
            </div>
          </li>
        </ol>
        {this.renderErrorMessage()}
      </div>
    );
  }

  renderErrorMessage() {
    if (!this.state.showJoinShareError) return null;
    return (
      <div className="error-message">
        Failed to join designated share. Please check the code and try again.
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
    const contexts = await Codap.getDataContextList();
    const existingListeners = this.state.availableDataContexts.map(c => c.name);
    contexts.forEach((dc) => {
      if (existingListeners.indexOf(dc.name) < 0) {
        Codap.addDataContextChangeListener(dc, this.handleDataContextUpdate);
      }
    });
    this.setState({availableDataContexts: contexts});
  }

  handleDataContextUpdate = async (notification: ClientNotification) => {
    const { action, resource, values } = notification;

    this.updateAvailableDataContexts(); // existing dataContext name may have changed

    const { shareId, selectedDataContext, personalDataLabel } = this.state;
    if (shareId) {
      // update data context details
      // note, once we are sharing with other people, we will need to prevent echoes
      const dataContext = await Codap.getDataContext(selectedDataContext);
      if (dataContext) {
        database.set("dataContext", dataContext);
      }

      this.writeUserItems(selectedDataContext, personalDataLabel);
    }
  }

  async writeUserItems(selectedDataContext: string, personalDataLabel: string) {
    const items = await Codap.getItemsOfCollaborator(selectedDataContext, personalDataLabel);
    database.setUserItems(personalDataLabel, items);
  }

  updateSelectedDataContext = (event: ChangeEvent<HTMLSelectElement>) => {
    this.setState({selectedDataContext: event.target.value});
  }

  updateDataLabel = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({personalDataLabel: event.target.value});
  }

  updateJoinShareId = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({joinShareId: event.target.value, showJoinShareError: false});
  }

  initiateShare = async () => {
    const {selectedDataContext, personalDataLabel} = this.state;
    let dataContextName: string;

    this.setState({ isInProcessOfSharing: true });
    try {
      if (selectedDataContext === kNewSharedTable) {
        // create new data context for sharing
        const newContext = await Codap.createDataContext({title: kNewDataContextTitle});
        if (newContext) {
          dataContextName = newContext.name;
          this.setState({selectedDataContext: dataContextName});
          await Codap.addNewCollaborationCollections(dataContextName, personalDataLabel, true);
          Codap.openTable(dataContextName);
        } else {
          throw new Error("failed to create new data context");
        }
      } else {
        const newContext = await Codap.getDataContext(selectedDataContext);
        if (newContext) {
          dataContextName = newContext.name;
          this.setState({selectedDataContext: dataContextName});
          await Codap.addNewCollaborationCollections(dataContextName, personalDataLabel, false);
          this.writeUserItems(selectedDataContext, personalDataLabel);
        } else {
          throw new Error("failed to update data context");
        }
      }

      const shareId = randomize("a0", kShareIdLength, { exclude: "0oOiIlL1" });
      this.setState({shareId});
      database.createSharedTable(shareId, personalDataLabel);

      const updatedNewContext = await Codap.getDataContext(dataContextName);
      if (updatedNewContext) {
        const sharableDataContext = Codap.getSharableDataContext(updatedNewContext);
        database.set("dataContext", sharableDataContext);
      }
    }
    finally {
      this.setState({ isInProcessOfSharing: false });
    }
  }

  joinShare = async () => {
    const {joinShareId: shareId, personalDataLabel, selectedDataContext } = this.state;

    this.setState({ isInProcessOfSharing: true });
    try {
      if (!await database.joinSharedTable(shareId, personalDataLabel)) {
        this.setState({ showJoinShareError: true });
        return;
      }
      this.setState({shareId});

      const response = await database.getAll();
      const sharedContextData = response && response.val();
      let ownDataContextName;
      if (sharedContextData) {
        const { dataContext: sharedDataContext, items } = sharedContextData;
        const existingDataContext = (selectedDataContext !== kNewSharedTable) &&
                                    await Codap.getDataContext(selectedDataContext);

        if (!existingDataContext) {
          const newDataContext = await Codap.createDataContext(sharedDataContext);
          if (newDataContext) {
            ownDataContextName = newDataContext.name;
            this.setState({ selectedDataContext: ownDataContextName });
          } else {
            throw new Error("failed to create data context");
          }
        }
        else {
          ownDataContextName = selectedDataContext;
          await Codap.addNewCollaborationCollections(selectedDataContext, personalDataLabel, false);
        }

        // combine items from all users in a single array
        if (items) {
          const allItems = [];
          // tslint:disable-next-line: forin
          for (const label in items) {
            allItems.push(...items[label]);
          }
          if (allItems.length) {
            await Codap.createItems(ownDataContextName, allItems);
          }
        }

        if (!existingDataContext) {
          // add collaborator name case if necessary
          if (!items || !items[this.state.personalDataLabel]) {
            Codap.configureUserCase(ownDataContextName, this.state.personalDataLabel, true);
          }
        }
        else {
          Codap.moveUserCaseToLast(selectedDataContext, personalDataLabel);
          this.writeUserItems(selectedDataContext, personalDataLabel);
        }

        this.updateAvailableDataContexts();
        Codap.openTable(ownDataContextName);
      }
    }
    finally {
      this.setState({ isInProcessOfSharing: false });
    }
  }

  leaveShare = () => {
    this.setState({
      shareId: null,
      selectedDataContext: kNewSharedTable,
      personalDataLabel: ""
    });
    database.leaveSharedTable();
  }
}

export default App;
