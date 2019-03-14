import codapInterface, { CodapApiResponse, ClientHandler } from "./CodapInterface";

export interface DataContext {
  name: string;
  title: string;
  collections?: any[];
}

const dataContextResource = (contextName: string, subKey?: string) =>
                              `dataContext[${contextName}]${subKey ? "." + subKey : ""}`;

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

  static async getAllDataContexts() {
    const result: CodapApiResponse = await codapInterface.sendRequest({
      action: "get",
      resource: "dataContextList"
    });
    if (result && result.success) {
      return result.values as DataContext[];
    }
    return [];
  }

  // if passed "foo" returns "foo-1"
  // if passed "foo-bar-23" returns "foo-bar-24"
  static incrementName(name: string) {
    if (/-(\d*)$/.test(name)) {
      const count = /-(\d*)$/.exec(name)![1];
      const next = "" + (parseInt(count, 10) + 1);
      return name.replace(/\d*$/, next);
    } else {
      return name + "-1";
    }
  }

  static async createUniqueDataContext(dataContextPrefix: string, title: string) {
    const contexts = await this.getAllDataContexts();
    const contextNames: string[] = contexts.map((c: DataContext) => c.name);
    let newDataContextName = dataContextPrefix;
    while (contextNames.indexOf(newDataContextName) > -1) {
      newDataContextName = this.incrementName(newDataContextName);
    }
    const newContext = await this.createDataContext({ name: newDataContextName, title });
    return newContext;
  }

  static async createDataContext(dataContextSpec: DataContext): Promise<DataContext | null> {
    const { name, title, collections } = dataContextSpec;
    const res = await codapInterface.sendRequest({
      action: "create",
      resource: "dataContext",
      values: {
        name,
        title,
        collections: collections || []
      }
    });
    return res.success ? res.values : null;
  }

  static async addCollections(dataContextName: string, collections: any[]) {
    await codapInterface.sendRequest({
      action: "create",
      resource: dataContextResource(dataContextName, "collection"),
      values: collections
    });
  }

  static async createUserCase(dataContextName: string, personalDataLabel: string) {
    await codapInterface.sendRequest({
      action: "create",
      resource: dataContextResource(dataContextName, "item"),
      values: {
        Name: personalDataLabel
      }
    });
  }

  static async createItems(dataContextName: string, items: any) {
    await codapInterface.sendRequest({
      action: "create",
      resource: dataContextResource(dataContextName, "item"),
      values: items
    });
  }

  static async addNewCollaborationCollections(dataContextName: string, personalDataLabel: string) {
    await this.addCollections(dataContextName, [
      {
        name: "Collaborators",
        title: "List of collaborators",
        labels: {
          singleCase: "name",
          pluralCase: "names"
        },
        attrs: [{name: "Name"}]
      },
      {
        name: "Data",
        title: "Data",
        parent: "Collaborators",
        attrs: [{name: "NewAttribute", editable: true}]
      }
    ]);
    await this.createUserCase(dataContextName, personalDataLabel);
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
}
