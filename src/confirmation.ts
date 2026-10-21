import { shallowRef } from "vue";

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmText: string;
  tone: "primary" | "error";
}

export const confirmation = shallowRef<ConfirmationRequest | null>(null);
let resolvePending: ((confirmed: boolean) => void) | null = null;

export function confirmAction(request: ConfirmationRequest): Promise<boolean> {
  answerConfirmation(false);
  return new Promise(resolve => {
    resolvePending = resolve;
    confirmation.value = request;
  });
}

export function answerConfirmation(confirmed: boolean): void {
  const resolve = resolvePending;
  resolvePending = null;
  confirmation.value = null;
  resolve?.(confirmed);
}
