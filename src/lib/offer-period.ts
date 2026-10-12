export const OFFER_PERIOD_ERROR = "Bitte vervollständigen Sie den gewünschten Zeitraum oder lassen Sie beide optionalen Felder leer.";

// Inspect the native controls: a partially typed date can have value="" and badInput=true.
export function validateOfferPeriod(start: HTMLInputElement, end: HTMLInputElement) {
  start.setCustomValidity(""); end.setCustomValidity("");
  const partial = start.validity.badInput || end.validity.badInput || Boolean(start.value) !== Boolean(end.value);
  const reversed = Boolean(start.value && end.value && start.value > end.value);
  const message = partial ? OFFER_PERIOD_ERROR : reversed ? "Das gewünschte Ende darf nicht vor dem gewünschten Start liegen." : "";
  if (message) { start.setCustomValidity(message); end.setCustomValidity(message); }
  return message;
}
