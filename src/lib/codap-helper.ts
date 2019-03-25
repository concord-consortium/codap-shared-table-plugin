import * as randomize from "randomatic";
import codapInterface, { CodapApiResponse, ClientHandler, Collection } from "./CodapInterface";

export interface DataContextCreation {
  title: string;
  collections?: any[];
}

export interface DataContext extends DataContextCreation {
  name: string;
}

const dataContextResource = (contextName: string, subKey?: string) =>
                              `dataContext[${contextName}]${subKey ? "." + subKey : ""}`;
const collaboratorsResource = (contextName: string, subKey: string) =>
                                `dataContext[${contextName}].collection[Collaborators].${subKey}`;

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
        action: "notify",
        resource: collaboratorsResource(dataContextName, `caseByID[${aCase.id}]`),
        values: { caseOrder: "last" }
      });
      return res.success;
    }
    return false;
  }
}
