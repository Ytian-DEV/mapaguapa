import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cx } from "./cx";
import "./toast.css";

type ToastTone = "success" | "error" | "info";

type ToastItem = { id: number; tone: ToastTone; message: ReactNode };

type ToastApi = {
  show: (message: ReactNode, tone?: ToastTone) => void;
  success: (message: ReactNode) => void;
  error: (message: ReactNode) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const icons = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: ReactNode, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({ show, success: (message) => show(message, "success"), error: (message) => show(message, "error") }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="ui-toasts" role="region" aria-label="Notifications">
        {items.map((item) => {
          const Icon = icons[item.tone];
          return (
            <div className={cx("ui-toast", `ui-toast--${item.tone}`)} key={item.id} role={item.tone === "error" ? "alert" : "status"}>
              <Icon aria-hidden="true" className="ui-toast__icon" />
              <div className="ui-toast__msg">{item.message}</div>
              <button aria-label="Dismiss" className="ui-toast__close" onClick={() => dismiss(item.id)} type="button">
                <X />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return context;
}
