import pDebounce from "p-debounce";
import React, { Component, ChangeEvent } from "react";
import randomize from "randomatic";
import "./App.css";
import { CodapHelper as Codap,  } from "./lib/codap-helper";
import codapInterface from "./lib/CodapInterface";
import { DB } from "./lib/db";
import { DBSharedTable } from "./lib/db-types";
import { DataContext, CodapItem, CodapRequest } from "./lib/types";
import { kInitialDimensions, kPluginName, kSharedDimensions, kVersion, kNewDataContextTitle,
  kShareIdLength } from "./constants";
import { IState } from "./types";
import { FirstPage } from "./ui-pages/first-page";
import { JoinAndMergeTable } from "./ui-pages/join-and-merge-table";
import { ShareOptions } from "./ui-pages/share-options";
import { ShareExistingTable } from "./ui-pages/share-existing-table";
import { ShareNewTable } from "./ui-pages/share-new-table"
import { JoinOptions } from "./ui-pages/join-options";
import { JoinWithoutMerging } from "./ui-pages/join-without-merging";

let database: DB;

export default class App extends Component {

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
    showJoinShareError: false,
  };


  public componentDidMount() {
    Codap.initializePlugin(kPluginName, kVersion, kInitialDimensions)
      .then(loadState => {
        const interactiveFrame = codapInterface.getInitialInteractiveFrame();
        const selectedDataContext = (loadState?.lastSelectedDataContext) || "";
        this.setState({ id: interactiveFrame.id, selectedDataContext, ...loadState });
        Codap.addDataContextsListListener(this.updateAvailableDataContexts);
        this.updateAvailableDataContexts();
      });

    database = new DB({
      itemsAdded: this.itemsAdded,
      itemsChanged: this.itemsChanged,
      itemsRemoved: this.itemsRemoved
    });
  }

  public componentDidUpdate(prevProps: IState, prevState: IState) {
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

  renderFormPage() {
    const { availableDataContexts, shareTable, joinTable, selectedDataContext, lastSelectedDataContext,
      shareExistingTable, joinAndMergeTable, createNewTable, joinWithoutMerging } = this.state;
    const showFirstStep = !shareTable && !joinTable;
    const noSelectedSubOptions = !shareExistingTable && !createNewTable && !joinAndMergeTable && !joinWithoutMerging;
    const showShareTableOptions = shareTable && !joinTable && noSelectedSubOptions;
    const showJoinTableOptions = !shareTable && joinTable && noSelectedSubOptions;
    const selectedContextOption = selectedDataContext || lastSelectedDataContext || availableDataContexts[0]?.name;

    const setState = (state: Partial<IState>) => this.setState(state);
    const handleJoinShareIdChange = (event: ChangeEvent<HTMLInputElement>) => this.handleJoinShareIdChange(event);
    const handleDataLabelChange = (event: ChangeEvent<HTMLInputElement>) => this.handleDataLabelChange(event);
    const handleDataContextChange = (event: ChangeEvent<HTMLSelectElement>) => this.handleDataContextChange(event);
    const initiateShare = (selectedContext?: string) => {
      if (selectedContext) this.setState({ selectedDataContext: selectedContext });
      this.initiateShare()
    };
    const joinShare = (selectedContext?: string) => {
      if (selectedContext) this.setState({ selectedDataContext: selectedContext });
      this.joinShare()
    }

    const availableContextOptions = availableDataContexts.map((dc: DataContext) =>
      <option key={dc.name} value={dc.name}>{dc.title ?? dc.name}</option>
    );

    if (showFirstStep) {
      return (
        <FirstPage updateState={setState} />
      )
    } else if (showJoinTableOptions) {
      return (
        <JoinOptions
          updateState={setState}
        />
      )
    } else if (showShareTableOptions) {
      return (
        <ShareOptions
          updateState={setState}
        />
      )
    } else if (joinAndMergeTable) {
      return (
        <JoinAndMergeTable
          joinShareId={this.state.joinShareId}
          personalDataLabel={this.state.personalDataLabel}
          lastPersonalDataLabel={this.state.lastPersonalDataLabel}
          handleJoinShareIdChange={handleJoinShareIdChange}
          handleDataLabelChange={handleDataLabelChange}
          handleDataContextChange={handleDataContextChange}
          joinShare={joinShare}
          updateState={setState}
          selectedContextOption={selectedContextOption}
          availableContextOptions={availableContextOptions}
          />
       )
    } else if (joinWithoutMerging) {
      return (
        <JoinWithoutMerging
          joinShareId={this.state.joinShareId}
          personalDataLabel={this.state.personalDataLabel}
          lastPersonalDataLabel={this.state.lastPersonalDataLabel}
          handleJoinShareIdChange={handleJoinShareIdChange}
          handleDataLabelChange={handleDataLabelChange}
          joinShare={joinShare}
          updateState={setState}
        />
      )
    } else if (shareExistingTable) {
      return (
        <ShareExistingTable
          selectedContextOption={selectedContextOption}
          availableContextOptions={availableContextOptions}
          personalDataLabel={this.state.personalDataLabel}
          lastPersonalDataLabel={this.state.lastPersonalDataLabel}
          handleDataContextChange={handleDataContextChange}
          handleDataLabelChange={handleDataLabelChange}
          initiateShare={initiateShare}
          updateState={setState}
        />
      )
    } else if (createNewTable) {
      return (
        <ShareNewTable
          newTableName={this.state.newTableName || ""}
          updateState={setState}
          personalDataLabel={this.state.personalDataLabel}
          lastPersonalDataLabel={this.state.lastPersonalDataLabel}
          handleDataLabelChange={handleDataLabelChange}
          initiateShare={initiateShare}
        />
      )
    }
  }

  renderForm() {
    return (
      <div className="App">
        {this.renderFormPage()}
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
        <div className="text-stack">
          Table collaboration enabled for:
          <div className="callout">
            {tableName}
          </div>
        </div>
        <div className="text-stack">
          Others can join this table by using the code:
          <div className="callout shareId">
            {shareId}
          </div>
        </div>
        <div className="leave-collaboration">
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
    return { success: true };
  };

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
      if (!items?.length) {
        this.debounceConfigUserCase(dataContext, personalDataKey, personalDataLabel);
      }
      else {
        return await Codap.moveUserItemsToLast(dataContext, personalDataKey);
      }
    }
    return false;
  }, 100);

  handleDataContextUpdate = async (notification: CodapRequest) => {
    // const { action, resource } = notification;
    const { values } = notification;
    const operation = values?.operation;
    const skipOperations = ["selectCases"];

    if (!operation || skipOperations.indexOf(operation) >= 0) return { success: true };

    this.updateAvailableDataContexts(); // existing dataContext name may have changed

    this.handleCreatedItems(notification);

    const { isInProcessOfSharing, shareId, selectedDataContext, personalDataKey, personalDataLabel } = this.state;

    if (!isInProcessOfSharing && shareId) {
      this.debounceDataContextResponse(shareId, selectedDataContext, personalDataKey, personalDataLabel);
    }

    return { success: true };
  };

  handleCreatedItems = async (notification: CodapRequest) => {
    const { values } = notification;
    const operation = values?.operation;
    if (["createCases", "createItems"].indexOf(operation) >= 0) {
      const { shareId, selectedDataContext, personalDataKey, personalDataLabel } = this.state;
      if (shareId && selectedDataContext) {
        const changes = await Codap.configureUnsharedCases(selectedDataContext, personalDataKey, personalDataLabel);
        if (changes?.length) {
          await codapInterface.sendRequest(changes);
        }
      }
    }
  };

  async writeDataContext(dataContext: DataContext | string | null) {
    const sharableDataContext = dataContext && await Codap.getSharableDataContext(dataContext);
    sharableDataContext && database.set("dataContext", sharableDataContext);
  }

  async writeUserItems(selectedDataContext: string, personalDataKey: string) {
    const items = await Codap.getItemsOfCollaborator(selectedDataContext, personalDataKey);

    // Remove the first item if it has no values, i.e. the placeholder item for this user
    if (items.length > 1 && Codap.isValuelessUserItem(items[0])) {
      await Codap.removeItems(selectedDataContext, [items[0]]);
      items.shift();
    }

    // write non-empty user items to firebase
    database.writeUserItems(personalDataKey, items.filter(item => !Codap.isEmptyUserItem(item)));
    return items;
  }

  handleDataContextChange = (event: ChangeEvent<HTMLSelectElement>) => {
    this.updateSelectedDataContext(event.target.value);
  };

  handleDataLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({personalDataLabel: event.target.value});
  };

  handleJoinShareIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({joinShareId: event.target.value, showJoinShareError: false});
  };

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
      }, () => resolve(null));
    });
  }

  updateSelectedDataContext(selectedDataContext: string) {
    this.setState({ selectedDataContext, lastSelectedDataContext: selectedDataContext });
  }

  initiateShare = async () => {
    await this.updatePersonalDataLabelAndKey();
    const {selectedDataContext, personalDataKey, personalDataLabel, createNewTable, newTableName } = this.state;

    let dataContextName: string;

    this.setState({ isInProcessOfSharing: true });
    try {
      if (createNewTable) {
        // create new data context for sharing
        const newContext = await Codap.createDataContext({title: newTableName ?? kNewDataContextTitle});
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
      Codap.configureForSharing(dataContextName, this.state.id, this.state.personalDataKey, true);

      const updatedNewContext = await Codap.getDataContext(dataContextName);
      await this.writeDataContext(updatedNewContext);

      database.addListener("dataContext", this.synchronizeDataContext);
    }
    finally {
      this.setState({ isInProcessOfSharing: false });
    }
  };

  joinShare = async () => {
    await this.updatePersonalDataLabelAndKey();
    const {
      joinShareId: shareId, personalDataKey, personalDataLabel, joinAndMergeTable, selectedDataContext
    } = this.state;

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

        const existingDataContext = joinAndMergeTable && selectedDataContext &&
                                      await Codap.getDataContext(selectedDataContext);

        if (!existingDataContext) {
          const newDataContext = sharedDataContext &&
                                  await Codap.createDataContext(sharedDataContext);
          if (newDataContext) {
            await Codap.addEditableAttribute(newDataContext, personalDataKey);
            ownDataContextName = newDataContext.name;
            this.updateSelectedDataContext(ownDataContextName);
          } else {
            throw new Error("failed to create data context");
          }
        } else {
          ownDataContextName = selectedDataContext;
          await Codap.addNewCollaborationCollections(selectedDataContext, personalDataKey, personalDataLabel, false);
          await Codap.syncDataContexts(selectedDataContext, sharedDataContext, true);

          await this.writeDataContext(selectedDataContext);
        }
        Codap.configureForSharing(ownDataContextName, this.state.id, personalDataKey, true);

        // listeners must be added after data context is configured
        database.installUserItemListeners();

        if (!existingDataContext) {
          // add collaborator name case if necessary
          if (!itemData?.[personalDataKey]) {
            Codap.configureUserCase(ownDataContextName, personalDataKey, personalDataLabel, true);
          }
        } else {
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
  };

  synchronizeDataContext = (val: DataContext) => {
    Codap.syncDataContexts(this.state.selectedDataContext, val, false);
  };

  leaveShare = () => {
    Codap.configureForSharing(this.state.selectedDataContext, this.state.id, this.state.personalDataKey, false);
    this.setState({
      shareId: null,
      personalDataLabel: "",
      joinShareId: "",
      shareTable: undefined,
      joinTable: undefined,
      shareExistingTable: undefined,
      createNewTable: undefined,
      joinAndMergeTable: undefined,
      joinWithoutMerging: undefined,
      newTableName: undefined
    });
    database.leaveSharedTable();
  };

  itemsAdded = async (user: string, items: CodapItem[]) => {
    const { selectedDataContext, personalDataKey } = this.state;
    await Codap.createOrUpdateItems(selectedDataContext, items);
    Codap.moveUserItemsToLast(selectedDataContext, personalDataKey);
  };

  itemsChanged = async (user: string, items: CodapItem[]) => {
    const { selectedDataContext, personalDataKey } = this.state;
    await Codap.createOrUpdateItems(selectedDataContext, items);
    Codap.moveUserItemsToLast(selectedDataContext, personalDataKey);
  };

  itemsRemoved = async (user: string, items: CodapItem[]) => {
    const { selectedDataContext, personalDataKey } = this.state;
    await Codap.removeItems(selectedDataContext, items);
    Codap.moveUserItemsToLast(selectedDataContext, personalDataKey);
  };
}
