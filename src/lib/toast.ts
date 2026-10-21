/**
 * ForgeState — lightweight toast pub/sub.
 * Any client component can call showToast(); ToastContainer renders them.
 */

import { generateUuidV4 } from "./uuid";

export type ToastVariant = "success" | "info" | "alert";

export interface Toast {
  id: string;
  title: string;
  variant: ToastVariant;
  duration?: number;
}

let listeners: Array<(t: Toast) => void> = [];

export function showToast(toast: Omit<Toast, "id">): void {
  const t: Toast = {
    id: generateUuidV4(),
    duration: 3000,
    ...toast,
  };
  listeners.forEach((fn) => fn(t));
}

export function onToast(fn: (t: Toast) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

declare global {
  interface Window {
    showToast?: typeof showToast;
  }
}
