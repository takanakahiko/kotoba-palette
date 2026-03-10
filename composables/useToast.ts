import { ref } from "vue";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

export function useToast() {
  function show(message: string, type: Toast["type"] = "info", duration = 4000) {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, duration);
  }

  return {
    toasts,
    error: (message: string) => show(message, "error"),
    success: (message: string) => show(message, "success"),
    info: (message: string) => show(message, "info"),
  };
}
