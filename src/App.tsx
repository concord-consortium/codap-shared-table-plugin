import React, { Component, ChangeEvent } from "react";
import randomize from "randomatic";
import { CodapHelper as Codap, ISaveState} from "./lib/codap-helper";
import codapInterface, { ClientNotification } from "./lib/CodapInterface";
import { DB } from "./lib/db";
import { DBSharedTable } from "./lib/db-types";
import { DataContext, CodapItem } from "./lib/types";
import pDebounce from "p-debounce";
import * as pkg from "../package.json";
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

interface IState extends ISaveState {
  id: string;
  availableDataContexts: DataContext[];
  selectedDataContext: string;
  personalDataLabel: string;
  personalDataKey: string;
  shareId?: string;
  joinShareId: string;
  isInProcessOfSharing: boolean;
  showJoinShareError: boolean;
}

let database: DB;

class App extends Component {

  public state: IState = {
    id: "",
    availableDataContexts: [],
    selectedDataContext: "",
    personalDataKeyPrefix: randomize("a0", 10),
    personalDataLabel: "",
    personalDataKey: "",
    lastPersonalDataLabel: "",
    lastSelectedDataContext: "",
    joinShareId: "",
    isInProcessOfSharing: false,
    showJoinShareError: false
  };

  public componentDidMount() {
    Codap.initializePlugin(kPluginName, kVersion, kInitialDimensions)
      .then(loadState => {
        const interactiveFrame = codapInterface.getInitialInteractiveFrame();
        this.setState({ id: interactiveFrame.id, ...loadState });
        Codap.addDataContextsListListener(this.updateAvailableDataContexts);
        this.updateAvailableDataContexts();
      });

    database = new DB({
      itemsAdded: this.itemsAdded,
      itemsChanged: this.itemsChanged,
      itemsRemoved: this.itemsRemoved
    });
  }

  public componentDidUpdate(prevProps: {}, prevState: IState) {
    if ((prevState.personalDataKey !== this.state.personalDataKey) ||
        (prevState.lastPersonalDataLabel !== this.state.lastPersonalDataLabel) ||
        (prevState.lastSelectedDataContext !== this.state.lastSelectedDataContext)) {
      Codap.saveState(this.state);
    }
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
    const { availableDataContexts, selectedDataContext, lastSelectedDataContext,
            personalDataLabel, lastPersonalDataLabel, joinShareId, isInProcessOfSharing } = this.state;
    const availableContextOptions = availableDataContexts.map((dc: DataContext) =>
      <option key={dc.name} value={dc.name}>{dc.title}</option>
    );
    const selectedContextOption = selectedDataContext || lastSelectedDataContext || kNewSharedTable;
    const readyToInitiateShare = (!!personalDataLabel || !!lastPersonalDataLabel) && !isInProcessOfSharing;
    const readyToJoinShare = readyToInitiateShare && (joinShareId.length === kShareIdLength);

    return (
      <div className="App">
        To create or join a collaborative table
        <ol>
          <li>
            Select a table to share <strong>or</strong> create a new one
            <div>
              <select value={selectedContextOption} onChange={this.handleDataContextChange}>
                { availableContextOptions }
                <option value={kNewSharedTable}>Create new table</option>
              </select>
            </div>
          </li>
          <li>
            Provide a name or label for grouping
            <div>
              <input type="text" value={personalDataLabel} placeholder={lastPersonalDataLabel}
                onChange={this.handleDataLabelChange} />
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
                <input type="text" value={joinShareId} onChange={this.handleJoinShareIdChange} />
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

  debounceConfigUserCase = pDebounce(async (dataContext: string,
                                            personalDataKey: string, personalDataLabel: string) => {
    await Codap.configureUserCase(dataContext, personalDataKey, personalDataLabel);
    return await Codap.moveUserItemsToLast(dataContext, personalDataKey);
  }, 250);

  // debounce so we don't send up partially-updated data contexts while syncing
  debounceDataContextResponse = pDebounce(async (shareId: string, dataContext: string,
                                                 personalDataKey: string, personalDataLabel: string) => {
    if (shareId) {
      // update data context details
      await this.writeDataContext(dataContext);

      const items = await this.writeUserItems(dataContext, personalDataKey);
      // last items/cases may have been deleted
      if (!items || !items.length) {
        this.debounceConfigUserCase(dataContext, personalDataKey, personalDataLabel);
      }
      else {
        return await Codap.moveUserItemsToLast(dataContext, personalDataKey);
      }
    }
    return false;
  }, 100);

  handleDataContextUpdate = async (notification: ClientNotification) => {
    // const { action, resource } = notification;
    const { values } = notification;
    const operation = values && values.operation;
    const skipOperations = ["selectCases"];

    if (!operation || skipOperations.indexOf(operation) >= 0) return;

    this.updateAvailableDataContexts(); // existing dataContext name may have changed

    const { shareId, selectedDataContext, personalDataKey, personalDataLabel } = this.state;

    if (shareId) {
      this.debounceDataContextResponse(shareId, selectedDataContext, personalDataKey, personalDataLabel);
    }
  }

  async writeDataContext(dataContext: DataContext | string | null) {
    const sharableDataContext = dataContext && await Codap.getSharableDataContext(dataContext);
    sharableDataContext && database.set("dataContext", sharableDataContext);
  }

  async writeUserItems(selectedDataContext: string, personalDataKey: string) {
    const items = await Codap.getItemsOfCollaborator(selectedDataContext, personalDataKey);
    database.writeUserItems(personalDataKey, items);
    return items;
  }

  handleDataContextChange = (event: ChangeEvent<HTMLSelectElement>) => {
    this.updateSelectedDataContext(event.target.value);
  }

  handleDataLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({personalDataLabel: event.target.value});
  }

  handleJoinShareIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({joinShareId: event.target.value, showJoinShareError: false});
  }

  /**
   * Should only be called after share is initiated or joined. This will shift over the lastPersonalDataLabel
   * to the currentPersonalDataLabel if necessary, and this method will only return after state has been set,
   * in case there are other functions after it that expect state.personalDataLabel to be up-to-date.
   */
  async updatePersonalDataLabelAndKey() {
    const { personalDataKeyPrefix, personalDataLabel, lastPersonalDataLabel } = this.state;
    const currentPersonalDataLabel = personalDataLabel || lastPersonalDataLabel;

    await new Promise((resolve) => {
      this.setState({
        personalDataLabel: currentPersonalDataLabel,
        lastPersonalDataLabel: currentPersonalDataLabel,
        personalDataKey: `${personalDataKeyPrefix}-${currentPersonalDataLabel}`
      }, resolve);
    });
  }

  updateSelectedDataContext(selectedDataContext: string) {
    this.setState({ selectedDataContext, lastSelectedDataContext: selectedDataContext });
  }

  initiateShare = async () => {
    await this.updatePersonalDataLabelAndKey();
    const {selectedDataContext, personalDataKey, personalDataLabel } = this.state;

    let dataContextName: string;

    this.setState({ isInProcessOfSharing: true });
    try {
      if (!selectedDataContext || (selectedDataContext === kNewSharedTable)) {
        // create new data context for sharing
        const newContext = await Codap.createDataContext({title: kNewDataContextTitle});
        if (newContext) {
          dataContextName = newContext.name;
          this.updateSelectedDataContext(dataContextName);
          await Codap.addNewCollaborationCollections(dataContextName, personalDataKey, personalDataLabel, true);
          Codap.openTable(dataContextName);
        } else {
          throw new Error("failed to create new data context");
        }
      } else {
        const newContext = await Codap.getDataContext(selectedDataContext);
        if (newContext) {
          dataContextName = newContext.name;
          this.updateSelectedDataContext(dataContextName);
          await Codap.addNewCollaborationCollections(dataContextName, personalDataKey, personalDataLabel, false);
          this.writeUserItems(selectedDataContext, personalDataKey);
        } else {
          throw new Error("failed to update data context");
        }
      }

      const shareId = randomize("a0", kShareIdLength, { exclude: "0oOiIlL1" });
      this.setState({shareId});
      database.createSharedTable(shareId, personalDataKey);
      Codap.configureForSharing(dataContextName, this.state.id, true);

      const updatedNewContext = await Codap.getDataContext(dataContextName);
      await this.writeDataContext(updatedNewContext);

      database.addListener("dataContext", this.synchronizeDataContext);
    }
    finally {
      this.setState({ isInProcessOfSharing: false });
    }
  }

  joinShare = async () => {
    await this.updatePersonalDataLabelAndKey();
    const {joinShareId: shareId, personalDataKey, personalDataLabel, selectedDataContext } = this.state;

    this.setState({ isInProcessOfSharing: true });
    try {
      if (!await database.joinSharedTable(shareId, personalDataKey)) {
        this.setState({ showJoinShareError: true });
        return;
      }
      this.setState({shareId});

      const response = await database.getAll();
      const sharedContextData = response && response.val() as DBSharedTable | undefined;
      let ownDataContextName;
      if (sharedContextData) {
        const { dataContext: sharedDataContext, itemData } = sharedContextData;
        const existingDataContext = selectedDataContext && (selectedDataContext !== kNewSharedTable) &&
                                    await Codap.getDataContext(selectedDataContext);

        if (!existingDataContext) {
          const newDataContext = await Codap.createDataContext(sharedDataContext);
          if (newDataContext) {
            await Codap.addEditableAttribute(newDataContext, personalDataKey);
            ownDataContextName = newDataContext.name;
            this.updateSelectedDataContext(ownDataContextName);
          } else {
            throw new Error("failed to create data context");
          }
        }
        else {
          ownDataContextName = selectedDataContext;
          await Codap.addNewCollaborationCollections(selectedDataContext, personalDataKey, personalDataLabel, false);
          await Codap.syncDataContexts(selectedDataContext, sharedDataContext, true);

          await this.writeDataContext(selectedDataContext);
        }
        Codap.configureForSharing(ownDataContextName, this.state.id, true);

        // listeners must be added after data context is configured
        database.installUserItemListeners();

        if (!existingDataContext) {
          // add collaborator name case if necessary
          if (!itemData || !itemData[personalDataKey]) {
            Codap.configureUserCase(ownDataContextName, personalDataKey, personalDataLabel, true);
          }
        }
        else {
          Codap.moveUserItemsToLast(selectedDataContext, personalDataKey);
          this.writeUserItems(selectedDataContext, personalDataKey);
        }

        database.addListener("dataContext", this.synchronizeDataContext);

        this.updateAvailableDataContexts();
        Codap.openTable(ownDataContextName);
      }
    }
    finally {
      this.setState({ isInProcessOfSharing: false });
    }
  }

  synchronizeDataContext = (val: any) => {
    Codap.syncDataContexts(this.state.selectedDataContext, val, false);
  }

  leaveShare = () => {
    Codap.configureForSharing(this.state.selectedDataContext, this.state.id, false);
    this.setState({
      shareId: null,
      personalDataLabel: "",
      joinShareId: ""
    });
    database.leaveSharedTable();
  }

  itemsAdded = async (user: string, items: CodapItem[]) => {
    const { selectedDataContext, personalDataKey } = this.state;
    await Codap.createOrUpdateItems(selectedDataContext, items);
    Codap.moveUserItemsToLast(selectedDataContext, personalDataKey);
  }

  itemsChanged = async (user: string, items: CodapItem[]) => {
    const { selectedDataContext, personalDataKey } = this.state;
    await Codap.createOrUpdateItems(selectedDataContext, items);
    Codap.moveUserItemsToLast(selectedDataContext, personalDataKey);
  }

  itemsRemoved = async (user: string, items: CodapItem[]) => {
    const { selectedDataContext, personalDataKey } = this.state;
    await Codap.removeItems(selectedDataContext, items);
    Codap.moveUserItemsToLast(selectedDataContext, personalDataKey);
  }
}

export default App;
