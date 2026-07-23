import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastFn = (msg: string) => void;
const Ctx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </Ctx.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(Ctx);
}
