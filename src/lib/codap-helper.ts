import * as randomize from "randomatic";
import codapInterface, { IConfig } from "./CodapInterface";
import {
  Attribute, Collection, DataContext, DataContextCreation, CodapItem, CodapItemValue, CodapRequest,
  CodapRequestResponse, CodapItemValues, CodapRequestHandler, CodapRequests
} from "./types";

export interface ISaveState {
  personalDataKeyPrefix: string;
  lastPersonalDataLabel: string;
  lastSelectedDataContext: string;
}

export interface AttributeMeta {
  name: string;
  collection: string;
  index: number;
  attr: Attribute;
}

const dataContextResource = (contextName: string, subKey?: string) =>
                              `dataContext[${contextName}]${subKey ? `. ${subKey}` : ""}`;
const collectionResource = (contextName: string, collectionName: string, subKey?: string) =>
                              `dataContext[${contextName}].collection[${collectionName}]${subKey ? `. ${subKey}` : ""}`;
const collaboratorsResource = (contextName: string, subKey: string) =>
                              collectionResource(contextName, "Collaborators", subKey);
const attributeResource = (contextName: string, collectionName: string, attributeName: string) =>
                              collectionResource(contextName, collectionName, `attribute[${attributeName}]`);

const kShareLabelName = "shareName";
const kCollaboratorKey = "__collaborator__";
const kEditableAttrName = "__editable__";

function shareAttributeSpec(editable = false) {
  return {
    name: kShareLabelName,
    editable,
    renameable: editable,
    deleteable: editable
  };
}

function collaboratorAttributeSpec(editable = false) {
  return {
    name: kCollaboratorKey,
    editable,
    renameable: editable,
    deleteable: editable,
    hidden: true
  };
}

function editableAttributeSpec(personalDataKey: string, editable = false) {
  return {
    name: kEditableAttrName,
    formula: `${kCollaboratorKey}="${personalDataKey}"`,
    editable,
    renameable: editable,
    deleteable: editable,
    hidden: true
  };
}

function updateAttributeCommands(dataContextName: string, personalDataKey: string, editable = false) {
  return [{
    action: "update",
    resource: attributeResource(dataContextName, "Collaborators", kCollaboratorKey),
    values: collaboratorAttributeSpec(editable)
  }, {
    action: "update",
    resource: attributeResource(dataContextName, "Collaborators", kShareLabelName),
    values: shareAttributeSpec(editable),
  }, {
    action: "update",
    resource: attributeResource(dataContextName, "Collaborators", kEditableAttrName),
    values: editableAttributeSpec(personalDataKey, editable)
  }];
}

export class CodapHelper {

  static async initializePlugin(pluginName: string, version: string,
                          dimensions: {width: number, height: number}) {
    const interfaceConfig: IConfig = {
      name: pluginName,
      version,
      cannotClose: false,
      preventDataContextReorg: false,
      preventTopLevelReorg: true,
      preventAttributeDeletion: false,
      allowEmptyAttributeDeletion: true,
      blockAPIRequestsWhileEditing: true,
      respectEditableItemAttribute: true,
      dimensions
    };
    await codapInterface.init(interfaceConfig);
    return await codapInterface.getInteractiveState() as ISaveState;
  }

  static addDataContextsListListener(callback: CodapRequestHandler) {
    codapInterface.on({
      actionSpec: "notify",
      resourceSpec: "documentChangeNotice",
      handler: callback
    });
  }

  static addDataContextChangeListener(context: DataContext, callback: CodapRequestHandler) {
    codapInterface.on({
      actionSpec: "notify",
      resourceSpec: `dataContextChangeNotice[${context.name}]`,
      handler: callback
    });
  }

  static async getDataContextList() {
    const result = await codapInterface.sendRequest({
      action: "get",
      resource: "dataContextList"
    }) as CodapRequestResponse;
    if (result && result.success) {
      return result.values as DataContext[];
    }
    return [];
  }

  static async createDataContext(dataContextSpec: DataContextCreation): Promise<DataContext | null> {
    const { title, collections } = dataContextSpec;
    const res = await codapInterface.sendRequest({
      action: "create",
      resource: "dataContext",
      values: {
        name: randomize("a0", 10),
        title,
        collections: collections || []
      }
    }) as CodapRequestResponse;
    return res.success ? res.values : null;
  }

  /**
   * This returns a copy of a data context specification that is prepped for sharing.
   *
   * Currently the only difference is that we replace all the collection parent references, which are ids
   * when we get the DC from CODAP, to be the names of the parent collections. These names can be used on
   * collection creation, and will survive sharing between documents.
   */
  static async getSharableDataContext(_dataContext: DataContext | string) {
    let dataContext;
    if (typeof _dataContext === "string") {
      dataContext = await this.getDataContext(_dataContext);
      if (!dataContext) return;
    } else {
      dataContext = _dataContext;
    }

    const cloneDataContext = (context: DataContext) => {
      // list of properties to exclude
      const excludeProps = ["_categoryMap"];
      const str = JSON.stringify(context,
                                  (key: string, value: CodapItemValue) => {
                                    return excludeProps.indexOf(key) >= 0 ? undefined : value;
                                  });
      return JSON.parse(str);
    };

    const sharableDataContext: DataContext = cloneDataContext(dataContext);
    sharableDataContext.collections.forEach(collection => {
      const parentId = collection.parent;
      if (parentId) {
        const parent = sharableDataContext.collections.find(c => c.id === parentId);
        if (parent) {
          collection.parent = parent.name;
        }
      }
      if (collection.attrs) {
        // don't sync the "__editable__" attribute
        collection.attrs = collection.attrs.filter(attr => {
          return attr.name !== kEditableAttrName;
        });
      }
    });
    return sharableDataContext;
  }

  static async addCollections(dataContextName: string, collections: Collection[]) {
    const result = await codapInterface.sendRequest({
      action: "create",
      resource: dataContextResource(dataContextName, "collection"),
      values: collections
    }) as CodapRequestResponse;
    return result && result.success ? result.values : null;
  }

  static async configureUserCase(dataContextName: string, personalDataKey: string,
                                  personalDataLabel: string, newContext = false) {
    const changes: CodapRequest[] = [];
    let userCaseId;
    let unsharedChanges: CodapRequest[] | undefined;
    if (!newContext) {
      // see if we have an existing shared case for this user
      const userCase = await codapInterface.sendRequest({
        action: "get",
        resource: collaboratorsResource(dataContextName, `caseSearch[${kCollaboratorKey}==${personalDataKey}]`)
      });
      userCaseId = userCase.values?.[0]?.id;
      if (!userCaseId) {
        // update existing items with current user information
        unsharedChanges = await this.configureUnsharedCases(dataContextName, personalDataKey, personalDataLabel);
      }
    }
    if (unsharedChanges?.length) {
      changes.push(...unsharedChanges);
    }
    else if (userCaseId) {
      // update the user case, since label may have changed
      changes.push({
        action: "update",
        resource: collaboratorsResource(dataContextName, `caseByID[${userCaseId}]`),
        values: { values: { [kShareLabelName]: personalDataLabel } }
      });
    }
    else {
      // create an empty user case - we create an empty case that contains values for the
      // the sharing attributes but no other attributes so that user-entered items will
      // automatically be grouped appropriately with other items of the same user.
      changes.push({
        action: "create",
        resource: collaboratorsResource(dataContextName, "item"),
        values: [{ values: { [kShareLabelName]: personalDataLabel, [kCollaboratorKey]: personalDataKey } }]
      });
    }
    if (changes.length) {
      await codapInterface.sendRequest(changes);
    }
  }

  static async configureUnsharedCases(dataContextName: string, personalDataKey: string,
                                      personalDataLabel: string) {
    // see if we have existing cases that have not yet been shared
    const result = await codapInterface.sendRequest([
                    { // get this user's items
                      action: "get",
                      resource: dataContextResource(dataContextName,
                                                    `itemSearch[${kCollaboratorKey}==${personalDataKey}]`)
                    },
                    { // get cases not associated with any user
                      action: "get",
                      resource: collaboratorsResource(dataContextName, `caseSearch[${kCollaboratorKey}==]`)
                    }]) as CodapRequestResponse[];
    const [userItemsResult, unsharedResult] = result;
    const userItems: CodapItem[] = userItemsResult && userItemsResult.success &&
                      userItemsResult.values?.length
                        ? userItemsResult.values : [];
    // identify empty user items, i.e. items with only the required sharing values
    const emptyItems = userItems.filter(item => this.isEmptyUserItem(item));
    const nonEmptyItemCount = userItems.length - emptyItems.length;
    const unsharedCases = unsharedResult && unsharedResult.success &&
                          unsharedResult.values?.length
                            ? unsharedResult.values : [];
    const requests: CodapRequest[] = [];
    if (emptyItems.length && (nonEmptyItemCount || unsharedCases.length)) {
      // delete any "empty" user items as long as there are non-empty user items
      if (codapInterface.getCodapVersion()) {
        // Codap v3 (when codapVersion began to be sent) supports batched delete item requests
        requests.push({
          action: "delete",
          resource: collaboratorsResource(dataContextName, `item`),
          values: emptyItems.map(item => ({ id: item.id }))
        })
      } else {
        emptyItems.forEach(item => {
          requests.push({
            action: "delete",
            resource: collaboratorsResource(dataContextName, `itemByID[${item.id}]`),
          });
        });
      }
    }
    // apply required sharing values to currently "unshared" cases.
    // this occurs when items are generated from other plugins, for instance.
    if (unsharedCases.length > 0) {
      const values = { [kShareLabelName]: personalDataLabel, [kCollaboratorKey]: personalDataKey };
      requests.push({
        action: "update",
        resource: collaboratorsResource(dataContextName, `case`),
        values: unsharedCases.map((aCase: CodapItem) => ({
          id: aCase.id,
          values
        }))
      });
    }
    return requests;
  }

  static async getItemCount(dataContextName: string) {
    const result = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemCount`)
    }) as CodapRequestResponse;
    return result && result.success ? result.values : null;
  }

  static async getAllItems(dataContextName: string): Promise<CodapItem[] | null> {
    const result = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemSearch[*]`)
    }) as CodapRequestResponse;
    return result && result.success ? result.values : null;
  }

  static getCreateItemRequest(dataContextName: string, items: CodapItem[]) {
    return {
      action: "create",
      resource: dataContextResource(dataContextName, "item"),
      values: items
    };
  }

  static async createItems(dataContextName: string, items: CodapItem[]) {
    await codapInterface.sendRequest(this.getCreateItemRequest(dataContextName, items));
  }

  static async createOrUpdateItems(dataContextName: string, itemValues: CodapItem[]) {
    // should eventually cache the IDs locally
    const existingItems = await this.getAllItems(dataContextName);
    const existingIdsArray = existingItems?.map(item => item.id);
    const existingIdsSet = new Set(existingIdsArray || []);
    const createItems: CodapItem[] = [];
    const updateItems: CodapItem[] = [];
    itemValues.forEach(item => {
      if (existingIdsSet.has(item.id)) {
        updateItems.push(item);
      } else {
        createItems.push(item);
      }
    })
    const requests: CodapRequest[] = [];
    if (updateItems.length > 0) {
      requests.push({
        action: "update",
        resource: dataContextResource(dataContextName, `item`),
        values: updateItems.map(item => ({ id: item.id, ...item.values }))
      });
    }
    if (createItems.length > 0) {
      requests.push(this.getCreateItemRequest(dataContextName, createItems));
    }
    return codapInterface.sendRequest(requests);
  }

  static async removeItems(dataContextName: string, itemValues: CodapItem[]) {
    if (codapInterface.getCodapVersion()) {
      // Codap v3 (when codapVersion began to be sent) supports batched delete item requests
      return codapInterface.sendRequest({
        action: "delete",
        resource: dataContextResource(dataContextName, `item`),
        values: itemValues.map(item => ({ id: item.id }))
      });
    } else {
      const requests = itemValues.map(item => ({
        action: "delete",
        resource: dataContextResource(dataContextName, `itemByID[${item.id}]`)
      }));
      return codapInterface.sendRequest(requests);
    }
  }

  static async addNewCollaborationCollections(dataContextName: string, personalDataKey: string,
      personalDataLabel: string, addEmptyDataCollection: boolean) {

    const collections: Collection[] = [];

    const collaboratorsCollection = await codapInterface.sendRequest({
                                      action: "get",
                                      resource: collectionResource(dataContextName, "Collaborators")
                                    }) as CodapRequestResponse;

    if (!collaboratorsCollection || !collaboratorsCollection.success) {
      // if we don't have the Collaborators collection then create it
      collections.push({
        name: "Collaborators",
        title: "List of collaborators",
        parent: "_root_",
        labels: {
          singleCase: "name",
          pluralCase: "names"
        },
        attrs: [
          shareAttributeSpec(),
          collaboratorAttributeSpec(),
          editableAttributeSpec(personalDataKey)
        ]
      });
    }
    else {
      // if we already have the Collaborators collection, update the collaborator, share, and __editable__ attributes
      await codapInterface.sendRequest(updateAttributeCommands(dataContextName, personalDataKey));
    }

    if (addEmptyDataCollection) {
      collections.push({
        name: "Data",
        title: "Data",
        parent: "Collaborators",
        attrs: [{name: "NewAttribute", editable: true}]
      });
    }

    await this.addCollections(dataContextName, collections);

    await this.configureUserCase(dataContextName, personalDataKey, personalDataLabel);
  }

  static async addEditableAttribute(dataContext: DataContext, personalDataKey: string) {
    return await codapInterface.sendRequest({
                  action: "create",
                  resource: collectionResource(dataContext.name, "Collaborators", "attribute"),
                  values: editableAttributeSpec(personalDataKey)
                });
  }

  /**
   * Takes an existing dataContext and an incoming shared dataContext, and performs the necessary CODAP
   * requests to transform the existing to match the incoming.
   *
   * In particular, we need to account for the case where both tables may contain an attribute with the
   * same name, but the latter has been moved to a new/different collection.
   *
   * If there are any attributes and collections in the existing dataContext that are not in the shares,
   * this will leave them alone, thus merging both dataContexts together.
   *
   * [Upcoming, this function will take a "delete" flag that will delete collections/attributes in
   * the existing DC that aren't in the new, for synchronization between two already-shared DCs]
   */
  static async syncDataContexts(existingDataContextName: string, sharedDataContext: DataContext, initialJoin: boolean) {
    const dataContext = await this.getDataContext(existingDataContextName);

    // we create a list of all commands needed to modify the DC, and then execute them all at once, to
    // prevent generating change events that are sent to Firebase before the DC is fully-updated
    const changeCommands: CodapRequest[] = [];
    if (dataContext && sharedDataContext) {
      // update title
      if (dataContext.title !== sharedDataContext.title) {
        changeCommands.push({
          action: "update",
          resource: dataContextResource(dataContext.name),
          values: { title: sharedDataContext.title }
        });
      }

      // first run through both DCs and gather the attribute details for each
      const originalAttributes: AttributeMeta[] = [];
      const originalAttrMap: { [cid: string]: AttributeMeta } = {};
      const sharedAttributes: AttributeMeta[] = [];
      const sharedAttrMap: { [cid: string]: AttributeMeta } = {};

      dataContext.collections.forEach(collection => {
        collection.attrs && collection.attrs.forEach((attr, i) => {
          const attrMeta: AttributeMeta = { name: attr.name, collection: collection.name, index: i, attr };
          originalAttributes.push(attrMeta);
          if (attr.cid) {
            originalAttrMap[attr.cid] = attrMeta;
          }
        });
      });

      const lastCollectionName = dataContext.collections[dataContext.collections.length - 1].name;

      sharedDataContext.collections.forEach(sharedCollection => {
        // this is metadata for where each new or updated attributes needs to go.
        sharedCollection.attrs && sharedCollection.attrs.forEach((attr, i) => {
          let collectionForAttribute = sharedCollection.name;
          let index = i;
          if (!dataContext.collections.some(coll => coll.name === collectionForAttribute)) {
            // We may not have the same collections. If so, we will
            // put new attributes at the end of our last collection
            collectionForAttribute = lastCollectionName;
            index = 1000 + i;
          }
          const attrMeta: AttributeMeta = { name: attr.name, collection: collectionForAttribute, index, attr };
          sharedAttributes.push(attrMeta);
          if (attr.cid) {
            sharedAttrMap[attr.cid] = attrMeta;
          }
        });
      });

      // then create any new attributes as necessary
      const newAttributes = sharedAttributes.filter(attrA => {
        const cid = attrA.attr.cid;
        // match by name on initial join (to synchronize cids); by cid after
        return !initialJoin && cid
                ? !originalAttrMap[cid]
                : !originalAttributes.some(attrB => attrA.name === attrB.name);
      });

      if (newAttributes.length > 0) {
        // list of unique collections the new attributes belong to
        const collectionsForNewAttributes = Array.from(new Set(newAttributes.map(a => a.collection)));
        collectionsForNewAttributes.forEach(collectionName => {
          // group the new attributes by collection and create a command to create all the new
          // attributes for that collection
          const newAttributesInCollection = newAttributes
            .filter(a => a.collection === collectionName)
            .map(a => a.attr);
          changeCommands.push({
            action: "create",
            resource: dataContextResource(existingDataContextName, `collection[${collectionName}].attribute`),
            values: newAttributesInCollection
          });
        });
      }

      // synchronize properties of existing attributes
      originalAttributes.forEach(origAttr => {
        const cid = origAttr.attr.cid;
        // match by name on initial join (to synchronize cids); by cid after
        const sharedAttr = !initialJoin && cid
                            ? sharedAttrMap[cid]
                            : sharedAttributes.find(attr => attr.name === origAttr.name);
        if (sharedAttr) {
          const origAttrProps = origAttr.attr as CodapItemValues;
          const defaultAttrProps = { formula: "", description: "", type: "", unit: "" };
          const sharedAttrProps: CodapItemValues = { ...defaultAttrProps, ...sharedAttr.attr };
          const propsToUpdate: CodapItemValues = {};
          let changed = false;
          // tslint:disable-next-line: forin
          for (const prop in sharedAttrProps) {
            const origValue = origAttrProps[prop];
            const sharedValue = sharedAttrProps[prop];
            // ignore distinctions between different forms of empty value
            // to avoid triggering extraneous update notifications
            const isOrigEmpty = (origValue == null) || (origValue === "");
            const isSharedEmpty = (sharedValue == null) || (sharedValue === "");
            const shouldUpdate = isOrigEmpty || isSharedEmpty
                                  ? isOrigEmpty !== isSharedEmpty
                                  : origValue !== sharedValue;
            if (shouldUpdate) {
              propsToUpdate[prop] = sharedValue;
              changed = true;
            }
          }
          if (changed) {
            changeCommands.push({
              action: "update",
              resource: attributeResource(dataContext.name, origAttr.collection, origAttr.name),
              values: propsToUpdate
            });
          }
        }
      });

      // After initial join we allow destructive syncing
      if (!initialJoin) {
        const staleAttributes = originalAttributes
                                  .filter(attrA => {
                                    const cid = attrA.attr.cid;
                                    return cid
                                            ? !sharedAttrMap[cid]
                                            : !sharedAttributes.some(attrB => attrA.name === attrB.name);
                                  })
                                  // don't delete protected attributes (like __editable__)
                                  .filter(attr => attr.attr.deleteable);

        changeCommands.push(...staleAttributes.map(attr => ({
          action: "delete",
          resource: collectionResource(dataContext.name, attr.collection, `attribute[${attr.name}]`)
        })));
      }
      await codapInterface.sendRequest(changeCommands);
    }
  }

  static openTable(dataContextName: string) {
    codapInterface.sendRequest({
      action: "create",
      resource: "component",
      values: {
        type: "caseTable",
        dataContext: dataContextName
      }
    });
  }

  static resizePlugin(width: number, height: number) {
    codapInterface.sendRequest({
      action: "update",
      resource: "interactiveFrame",
      values: {
        dimensions: {
          width,
          height
        }
      }
    });
  }

  static configureForSharing(
    dataContextName: string, controllerId: string, personalDataKey: string, isSharing: boolean
  ) {
    const commands: CodapRequests = [
      {
        action: "update",
        resource: dataContextResource(dataContextName),
        values: {
          managingController: isSharing ? controllerId : "__none__"
        }
      },
      {
        action: "update",
        resource: "interactiveFrame",
        values: {
          cannotClose: isSharing,
          preventAttributeDeletion: isSharing,
          respectEditableItemAttribute: isSharing
        }
      }
    ];
    // If we're unsharing, make the special attributes editable
    if (!isSharing) commands.push(...updateAttributeCommands(dataContextName, personalDataKey, true));
    codapInterface.sendRequest(commands);
  }

  static async getDataContext(dataContextName: string): Promise<DataContext | null> {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName)
    }) as CodapRequestResponse;
    if (res.success) {
      return res.values;
    }
    return null;
  }

  static async getItemsOfCollaborator(dataContextName: string, personalDataKey: string): Promise<CodapItem[]> {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemSearch[${kCollaboratorKey}==${personalDataKey}]`)
    }) as CodapRequestResponse;
    // don't sync "__editable__" attribute
    delete res.values[kEditableAttrName];
    return res.success ? res.values : [];
  }

  static async getCaseForCollaborator(dataContextName: string, personalDataKey: string) {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: collaboratorsResource(dataContextName, `caseSearch[${kCollaboratorKey}==${personalDataKey}]`)
    }) as CodapRequestResponse;
    // there should be only one such case
    return res.success && res.values?.length ? res.values[0] : null;
  }

  static async getCollaboratorCases(dataContextName: string) {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: collaboratorsResource(dataContextName, `caseSearch[*]`)
    }) as CodapRequestResponse;
    return res.success ? res.values : [];
  }

  // Returns all values of the item except from the required sharing attributes
  static getItemOtherValues(item: CodapItem) {
    const { [kShareLabelName]: _shareLabel, [kCollaboratorKey]: _collaborator,
            [kEditableAttrName]: _editable, ...others } = item.values;
    return others;
  }

  static isEmptyUserItem(item: CodapItem) {
    const values = this.getItemOtherValues(item);
    // empty if there are no values besides the required sharing attributes
    return Object.keys(values).length === 0;
  }

  static isValuelessUserItem(item: CodapItem) {
    const values = this.getItemOtherValues(item);
    return !Object.keys(values).some(key => !!values[key]);
  }

  static async moveUserItemsToLast(dataContextName: string, personalDataKey: string) {
    const itemSearchString = `itemSearch[${kCollaboratorKey}==${personalDataKey}]`;
    return await codapInterface.sendRequest({
                  action: "notify",
                  resource: dataContextResource(dataContextName, itemSearchString),
                  values: { itemOrder: "last" }
                });
  }

  static saveState(state: ISaveState) {
    const { personalDataKeyPrefix, lastPersonalDataLabel, lastSelectedDataContext } = state;
    codapInterface.updateInteractiveState({ personalDataKeyPrefix, lastPersonalDataLabel, lastSelectedDataContext });
  }
}
