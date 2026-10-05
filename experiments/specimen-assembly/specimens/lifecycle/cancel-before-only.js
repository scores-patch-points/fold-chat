export function cancelPolicy(signal, phase) {
  return signal.aborted && phase === "before-charge";
}
