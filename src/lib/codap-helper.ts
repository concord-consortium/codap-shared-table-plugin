import codapInterface, { CodapApiResponse } from "./CodapInterface";

export interface DataContext {
  name: string;
  title: string;
  collections?: any[];
}

export async function initializePlugin(pluginName: string, version: string,
    dimensions: {width: number, height: number}) {
  const interfaceConfig = {
    name: pluginName,
    version: version,
    dimensions: dimensions
  };
  return await codapInterface.init(interfaceConfig);
}

const dataSetString = (contextName: string) => `dataContext[${contextName}]`;

export function addDataContextsListListener(callback: () => void) {
  codapInterface.on("notify", "documentChangeNotice", callback);
}

export function addDataContextChangeListener(context: DataContext, callback: () => void) {
  codapInterface.on("notify", `dataContextChangeNotice[${context.name}]`, callback);
}

export async function getAllDataContexts() {
  const result: CodapApiResponse = await codapInterface.sendRequest({
    "action": "get",
    "resource": "dataContextList"
  });
  if (result && result.success) {
    return result.values as DataContext[];
  }
  return [];
}

// if passed "foo" returns "foo-1"
// if passed "foo-bar-23" returns "foo-bar-24"
function incrementName(name: string) {
  if (/-(\d*)$/.test(name)) {
    const count = /-(\d*)$/.exec(name)![1];
    const next = "" + (parseInt(count) + 1)
    return name.replace(/\d*$/, next);
  } else {
    return name + "-1";
  }
}

export async function createUniqueDataContext(dataContextPrefix: string, title: string) {
  const contexts = await getAllDataContexts();
  const contextNames: string[] = contexts.map((c: DataContext) => c.name);
  let newDataContextName = dataContextPrefix;
  while (contextNames.indexOf(newDataContextName) > -1) {
    newDataContextName = incrementName(newDataContextName);
  }
  const newContext = await createDataContext(newDataContextName, title);
  return newContext;
}

export async function createDataContext(dataContextName: string, title: string): Promise<DataContext | null> {
  const res = await codapInterface.sendRequest({
    action: "create",
    resource: "dataContext",
    values: {
      name: dataContextName,
      title,
      collections: []
    }
  });
  if (res.success) {
    return res.values;
  }
  return null;
}

export async function addCollections(dataContextName: string, collections: any[]) {
  await codapInterface.sendRequest({
    action: "create",
    resource: `dataContext[${dataContextName}].collection`,
    values: collections
  });
}

export async function createUserCase(dataContextName: string, personalDataLabel: string) {
  await codapInterface.sendRequest({
    action: "create",
    resource: `dataContext[${dataContextName}].item`,
    values: {
        Name: personalDataLabel
    }
  });
}

export async function addNewCollaborationCollections(dataContextName: string, personalDataLabel: string) {
  await addCollections(dataContextName, [{
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
  await createUserCase(dataContextName, personalDataLabel);
}

export function openTable() {
  codapInterface.sendRequest({
    action: "create",
    resource: "component",
    values: {
      type: "caseTable"
    }
  });
}

export function resizePlugin(width: number, height: number) {
  codapInterface.sendRequest({
    "action": "update",
    "resource": "interactiveFrame",
    "values": {
      "dimensions": {
        "width": width,
        "height": height
      }
    }
  });
}

export async function getDataContext(dataContextName: string): Promise<DataContext | null> {
  const res = await codapInterface.sendRequest({
    "action": "get",
    "resource": `dataContext[${dataContextName}]`
  });
  if (res.success) {
    return res.values;
  }
  return null;
}

export async function getItemsOfCollaborator(dataContextName: string, name: string): Promise<any[]> {
  const res = await codapInterface.sendRequest({
    "action": "get",
    "resource": `dataContext[${dataContextName}].itemSearch[Name==${name}]`
  });
  if (res.success) {
    return res.values;
  }
  return [];
}