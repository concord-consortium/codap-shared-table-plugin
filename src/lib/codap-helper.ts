import codapInterface from "./CodapInterface";

export interface DataContext {
  name: string;
  title: string;
}

export function initializePlugin(pluginName: string, version: string, dimensions: {width: number, height: number}) {
  const interfaceConfig = {
    name: pluginName,
    version: version,
    dimensions: dimensions
  };
  return codapInterface.init(interfaceConfig);
}

const dataSetString = (contextName: string) => `dataContext[${contextName}]`;

export function addDataContextsListListener(callback: () => void) {
  codapInterface.on("notify", "documentChangeNotice", callback);
}

export function addDataContextChangeListener(context: DataContext, callback: () => void) {
  codapInterface.on("notify", `dataContextChangeNotice[${context.name}]`, callback);
}

export function getAllDataContexts() {
  return codapInterface.sendRequest({
    "action": "get",
    "resource": "dataContextList"
  }, function(result: { success: any; values: any[]}) {
    if (result && result.success) {
      return result.values;
    }
    return [];
  });
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

export function createUniqueDataContext(dataContextPrefix: string, title: string) {
  return getAllDataContexts()
    .then((res: any) => {
      const contexts = res.values;
      const contextNames: string[] = contexts.map((c: DataContext) => c.name);
      let newDataContextName = dataContextPrefix;
      while (contextNames.indexOf(newDataContextName) > -1) {
        newDataContextName = incrementName(newDataContextName);
      }
      return createDataContext(newDataContextName, title);
    });
}

export function createDataContext(dataContextName: string, title: string) {
  return codapInterface.sendRequest({
    action: 'create',
    resource: 'dataContext',
    values: {
      name: dataContextName,
      title,
      collections: []
    }
  });
}

export function addCollections(dataContextName: string, collections: any[]) {
  return codapInterface.sendRequest({
    action: "create",
    resource: `dataContext[${dataContextName}].collection`,
    values: collections
  });
}

export function createUserCase(dataContextName: string, personalDataLabel: string) {
  return codapInterface.sendRequest({
    action: "create",
    resource: `dataContext[${dataContextName}].item`,
    values: {
        Name: personalDataLabel
    }
  });
}

export function addNewCollaborationCollections(dataContextName: string, personalDataLabel: string) {
  return addCollections(dataContextName, [{
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
      attrs: [{name: "NewAttribute"}]
    }
  ]).then(() => {
    createUserCase(dataContextName, personalDataLabel);
  });
}

export function openTable() {
  codapInterface.sendRequest({
    action: 'create',
    resource: 'component',
    values: {
      type: 'caseTable'
    }
  });
}

export function addData(dataContextName: string, data: number[]) {
  const values = data.map(d => ({value: d}));
  codapInterface.sendRequest({
    action: 'create',
    resource: `${dataSetString(dataContextName)}.item`,
    values
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