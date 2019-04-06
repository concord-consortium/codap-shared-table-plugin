import * as randomize from "randomatic";
import codapInterface, { CodapApiResponse, ClientHandler, Collection, Attribute, IConfig } from "./CodapInterface";
import { ClientItemValues } from "./firebase-handlers";

export interface ISaveState {
  personalDataKeyPrefix: string;
  lastPersonalDataLabel: string;
}

export interface DataContextCreation {
  title: string;
  collections?: Collection[];
}

export interface DataContext extends DataContextCreation {
  name: string;
  collections: Collection[];
}

interface AttributeMeta {
  name: string;
  collection: string;
  index: number;
  attr: Attribute;
}

export interface CodapItem {
  id: string;
  values: { [prop: string]: any };
}

const dataContextResource = (contextName: string, subKey?: string) =>
                              `dataContext[${contextName}]${subKey ? "." + subKey : ""}`;
const collectionResource = (contextName: string, collectionName: string, subKey?: string) =>
                              `dataContext[${contextName}].collection[${collectionName}]${subKey ? "." + subKey : ""}`;
const collaboratorsResource = (contextName: string, subKey: string) =>
                              collectionResource(contextName, "Collaborators", subKey);

const kCollaboratorKey = "CollaboratorKey";

export class CodapHelper {

  static async initializePlugin(pluginName: string, version: string,
                          dimensions: {width: number, height: number}) {
    const interfaceConfig: IConfig = {
      name: pluginName,
      version,
      preventDataContextReorg: false,
      preventTopLevelReorg: true,
      dimensions
    };
    await codapInterface.init(interfaceConfig);
    return await codapInterface.getInteractiveState() as ISaveState;
  }

  static addDataContextsListListener(callback: ClientHandler) {
    codapInterface.on("notify", "documentChangeNotice", callback);
  }

  static addDataContextChangeListener(context: DataContext, callback: ClientHandler) {
    codapInterface.on("notify", `dataContextChangeNotice[${context.name}]`, callback);
  }

  static async getDataContextList() {
    const result: CodapApiResponse = await codapInterface.sendRequest({
      action: "get",
      resource: "dataContextList"
    });
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
    });
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
    const sharableDataContext: DataContext = JSON.parse(JSON.stringify(dataContext));
    sharableDataContext.collections.forEach(collection => {
      const parentId = collection.parent;
      if (parentId) {
        const parent = sharableDataContext.collections.find(c => c.id === parentId);
        if (parent) {
          collection.parent = parent.name;
        }
      }
    });
    return sharableDataContext;
  }

  static async addCollections(dataContextName: string, collections: Collection[]) {
    const result = await codapInterface.sendRequest({
      action: "create",
      resource: dataContextResource(dataContextName, "collection"),
      values: collections
    });
    return result && result.success ? result.values : null;
  }

  static async configureUserCase(dataContextName: string, personalDataKey: string, personalDataLabel: string,
      alwaysCreate = false) {
    // see if we have an existing case
    const userCase = await codapInterface.sendRequest({
      action: "get",
      resource: collaboratorsResource(dataContextName, `caseSearch[${kCollaboratorKey}==${personalDataKey}]`)
    });
    const userCaseId = userCase && userCase.values && userCase.values[0] && userCase.values[0].id;
    if (alwaysCreate || !userCaseId) {
      await codapInterface.sendRequest({
        action: "create",
        resource: collaboratorsResource(dataContextName, "case"),
        values: [{ values: {
          Name: personalDataLabel,
          [kCollaboratorKey]: personalDataKey
        } }]
      });
    }
    else {
      await codapInterface.sendRequest({
        action: "update",
        resource: collaboratorsResource(dataContextName, `caseByID[${userCaseId}]`),
        values: { values: { Name: personalDataLabel } }
      });
    }
  }

  static async getItemCount(dataContextName: string) {
    const result = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemCount`)
    });
    return result && result.success ? result.values : null;
  }

  static async getAllItems(dataContextName: string): Promise<CodapItem[] | null> {
    const result = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemSearch[*]`)
    });
    return result && result.success ? result.values : null;
  }

  static async createItems(dataContextName: string, items: any) {
    await codapInterface.sendRequest({
      action: "create",
      resource: dataContextResource(dataContextName, "item"),
      values: items
    });
  }

  static async createOrUpdateItems(dataContextName: string, itemValues: ClientItemValues[]) {
    // should eventually cache the IDs locally
    const existingItems = await this.getAllItems(dataContextName);
    const existingIdsArray = existingItems && existingItems.map(item => item.id);
    const existingIdsSet = new Set(existingIdsArray || []);
    const requests = itemValues.map(item => {
                      return existingIdsSet.has(item.id)
                        ? {
                            action: "update",
                            resource: dataContextResource(dataContextName, `itemByID[${item.id}]`),
                            values: item.values
                          }
                        : {
                            action: "create",
                            resource: dataContextResource(dataContextName, "item"),
                            values: { id: item.id, values: item.values }
                          };
                      });
    return codapInterface.sendRequest(requests);
  }

  static async removeItems(dataContextName: string, itemValues: ClientItemValues[]) {
    const requests = itemValues.map(item => ({
            action: "delete",
            resource: dataContextResource(dataContextName, `itemByID[${item.id}]`)
          }));
    return codapInterface.sendRequest(requests);
  }

  static async addNewCollaborationCollections(dataContextName: string, personalDataKey: string,
      personalDataLabel: string, addEmptyDataCollection: boolean) {

    const collections: Collection[] = [
      {
        name: "Collaborators",
        title: "List of collaborators",
        parent: "_root_",
        labels: {
          singleCase: "name",
          pluralCase: "names"
        },
        attrs: [
          {name: "Name", editable: false},
          {name: kCollaboratorKey, editable: false, hidden: true}
        ]
      }
    ];

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
    const changeCommands: any[] = [];
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
      const sharedAttributes: AttributeMeta[] = [];

      dataContext.collections.forEach(collection => {
        collection.attrs && collection.attrs.forEach((attr, i) => {
          originalAttributes.push({name: attr.name, collection: collection.name, index: i, attr});
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
          sharedAttributes.push({name: attr.name, collection: collectionForAttribute, index, attr});
        });
      });

      // then create any new attributes as necessary
      const newAttributes = sharedAttributes.filter(attrA => {
        return !originalAttributes.some(attrB => attrA.name === attrB.name);
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

      // After initial join we allow destructive syncing
      if (!initialJoin) {
        const staleAttributes = originalAttributes.filter(attrA => {
          return !sharedAttributes.some(attrB => attrA.name === attrB.name);
        });

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

  static async getDataContext(dataContextName: string): Promise<DataContext | null> {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName)
    });
    if (res.success) {
      return res.values;
    }
    return null;
  }

  static async getItemsOfCollaborator(dataContextName: string, personalDataKey: string): Promise<any[]> {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemSearch[${kCollaboratorKey}==${personalDataKey}]`)
    });
    if (res.success) {
      return res.values;
    }
    return [];
  }

  static async getCaseForCollaborator(dataContextName: string, personalDataKey: string) {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: collaboratorsResource(dataContextName, `caseSearch[${kCollaboratorKey}==${personalDataKey}]`)
    });
    // there should be only one such case
    return res.success && res.values && res.values.length ? res.values[0] : null;
  }

  static async getCollaboratorCases(dataContextName: string) {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: collaboratorsResource(dataContextName, `caseSearch[*]`)
    });
    return res.success ? res.values : [];
  }

  static async moveUserCaseToLast(dataContextName: string, personalDataKey: string) {
    const cases: any[] = await this.getCollaboratorCases(dataContextName);
    const selfIndex = cases.findIndex(aCase => aCase.values[kCollaboratorKey] === personalDataKey);
    const selfId = selfIndex >= 0 ? cases[selfIndex].id : undefined;
    if (selfId && (selfIndex !== cases.length - 1)) {
      const res = await codapInterface.sendRequest({
        action: "notify",
        resource: collaboratorsResource(dataContextName, `caseByID[${selfId}]`),
        values: { caseOrder: "last" }
      });
      return res.success;
    }
    return false;
  }

  static saveState(state: ISaveState) {
    codapInterface.updateInteractiveState(state);
  }
}
