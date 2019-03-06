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
export function createDataContext(dataContextName: string) {
  // Determine if CODAP already has the Data Context we need.
  // If not, create it.
  return codapInterface.sendRequest({
      action:'get',
      resource: dataSetString(dataContextName)
      }, function (result: { success: any; }) {
      if (result && !result.success) {
        codapInterface.sendRequest({
          action: 'create',
          resource: 'dataContext',
          values: {
            name: dataContextName,
            collections: [
              {
                name: 'items',
                labels: {
                  pluralCase: "items",
                  setOfCasesWithArticle: "an item"
                },
                attrs: [{name: "value"}]
              }
            ]
          }
        });
      }
    }
  );
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