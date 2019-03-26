import * as randomize from "randomatic";
import codapInterface, { CodapApiResponse, ClientHandler, Collection, Attribute } from "./CodapInterface";

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

const dataContextResource = (contextName: string, subKey?: string) =>
                              `dataContext[${contextName}]${subKey ? "." + subKey : ""}`;
const collectionResource = (contextName: string, collectionName: string, subKey?: string) =>
                              `dataContext[${contextName}].collection[${collectionName}]${subKey ? "." + subKey : ""}`;
const collaboratorsResource = (contextName: string, subKey: string) =>
                              collectionResource(contextName, "Collaborators", subKey);

export class CodapHelper {

  static async initializePlugin(pluginName: string, version: string,
                          dimensions: {width: number, height: number}) {
    const interfaceConfig = {
      name: pluginName,
      version,
      dimensions
    };
    return await codapInterface.init(interfaceConfig);
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

  static async configureUserCase(dataContextName: string, personalDataLabel: string, alwaysCreate = false) {
    const existingItemCount = await this.getItemCount(dataContextName);
    if (alwaysCreate || (existingItemCount === 0)) {
      await codapInterface.sendRequest({
        action: "create",
        resource: collaboratorsResource(dataContextName, "case"),
        values: [{ values: { Name: personalDataLabel } }]
      });
    }
    else {
      await codapInterface.sendRequest({
        action: "update",
        resource: collaboratorsResource(dataContextName, "caseByIndex[0]"),
        values: { values: { Name: personalDataLabel } }
      });
    }
  }

  static async createItems(dataContextName: string, items: any) {
    await codapInterface.sendRequest({
      action: "create",
      resource: dataContextResource(dataContextName, "item"),
      values: items
    });
  }

  static async getItemCount(dataContextName: string) {
    const result = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemCount`)
    });
    return result && result.success ? result.values : null;
  }

  static async addNewCollaborationCollections(dataContextName: string, personalDataLabel: string,
      addEmptyDataCollection: boolean) {

    const collections: Collection[] = [
      {
        name: "Collaborators",
        title: "List of collaborators",
        parent: "_root_",
        labels: {
          singleCase: "name",
          pluralCase: "names"
        },
        attrs: [{name: "Name", editable: false}]
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

    await this.configureUserCase(dataContextName, personalDataLabel);
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
  static async mergeDataContexts(existingDataContextName: string, sharedDataContext: DataContext) {
    const dataContext = await this.getDataContext(existingDataContextName);
    if (dataContext) {
      // first run through both DCs and gather the attribute details for each
      const originalAttributes: AttributeMeta[] = [];
      const sharedAttributes: AttributeMeta[] = [];

      dataContext.collections.forEach(collection => {
        collection.attrs.forEach((attr, i) => {
          originalAttributes.push({name: attr.name, collection: collection.name, index: i, attr});
        });
      });

      sharedDataContext.collections.forEach(collection => {
        collection.attrs.forEach((attr, i) => {
          sharedAttributes.push({name: attr.name, collection: collection.name, index: i, attr});
        });
      });

      // If we have any new collections, create them in our existing DC without attributes
      const newCollections = sharedDataContext.collections.filter(collA => {
        return !dataContext.collections.some(collB => collA.name === collB.name);
      });

      if (newCollections.length > 0) {
        newCollections.forEach(collection => collection.attrs = []);
        await this.addCollections(existingDataContextName, newCollections);
      }

      // then create any new attributes as necessary
      const newAttributes = sharedAttributes.filter(attrA => {
        return !originalAttributes.some(attrB => attrA.name === attrB.name);
      });

      if (newAttributes.length > 0) {
        const attributeCreationCommands: any[] = [];
        // list of unique collections the new attributes belong to
        const collectionsForNewAttributes = Array.from(new Set(newAttributes.map(a => a.collection)));
        collectionsForNewAttributes.forEach(collectionName => {
          // group the new attributes by collection and create a command to create all the new
          // attributes for that collection
          const newAttributesInCollection = newAttributes
            .filter(a => a.collection === collectionName)
            .map(a => a.attr);
          attributeCreationCommands.push({
            action: "create",
            resource: dataContextResource(existingDataContextName, `collection[${collectionName}].attribute`),
            values: newAttributesInCollection
          });
        });
        // create all new attributes at once
        await codapInterface.sendRequest(attributeCreationCommands);
      }

      // then move any existing attributes as necessary
      const movedAttributes = originalAttributes.filter(attrA => {
        const attrB = sharedAttributes.find(a => a.name === attrA.name);
        return attrB && (attrA.collection !== attrB.collection || attrA.index !== attrB.index);
      });

      if (movedAttributes.length > 0) {
        const attributeMoveCommands = movedAttributes.map(attr => {
          const newLocation = sharedAttributes.find(a => a.name === attr.name);
          if (newLocation) {
            return {
              action: "update",
              resource: collectionResource(existingDataContextName, attr.collection, `attributeLocation[${attr.name}]`),
              values: {
                collection: newLocation.collection,
                position: newLocation.index
              }
            };
          }
        });

        await codapInterface.sendRequest(attributeMoveCommands);
      }
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

  static async getItemsOfCollaborator(dataContextName: string, name: string): Promise<any[]> {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: dataContextResource(dataContextName, `itemSearch[Name==${name}]`)
    });
    if (res.success) {
      return res.values;
    }
    return [];
  }

  static async getCaseForCollaborator(dataContextName: string, name: string): Promise<any> {
    const res = await codapInterface.sendRequest({
      action: "get",
      resource: collaboratorsResource(dataContextName, `caseSearch[Name==${name}]`)
    });
    // there should be only one such case
    return res.success && res.values && res.values.length ? res.values[0] : null;
  }

  static async moveUserCaseToLast(dataContextName: string, name: string): Promise<boolean> {
    const aCase = await this.getCaseForCollaborator(dataContextName, name);
    if (aCase && aCase.id) {
      const res = await codapInterface.sendRequest({
        action: "update",
        resource: collaboratorsResource(dataContextName, `caseByID[${aCase.id}]`),
        values: { caseOrder: "last" }
      });
      return res.success;
    }
    return false;
  }
}
