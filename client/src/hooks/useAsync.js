import { useCallback, useEffect, useRef, useState } from 'react';

/** Run an async loader whenever `deps` change; exposes { data, error, loading, reload }. Ignores stale responses. */
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useRef(0);

  const load = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return loader()
      .then((data) => { if (id === run.current) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (id === run.current) setState({ data: null, error, loading: false }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
