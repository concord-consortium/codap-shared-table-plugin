// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds.
// tslint:disable-next-line:ban-types
export function debounce(fn: Function, time: number): Function {
  let timeout: NodeJS.Timeout;

  return (...args: any[]) => {
    const functionCall = () => fn.apply(null, args);

    clearTimeout(timeout);
    timeout = setTimeout(functionCall, time);
  };
}
