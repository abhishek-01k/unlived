// Letter display helpers (safe for the browser).

export const SIGNATURE = "You, a year from now";

// A sign-off the model added: "— Future You", "- You, October 2027", "You".
const SIGN_OFF =
  /\n+\s*(?:[-–—]\s*(?:future\s+)?(?:you|me)\b[^\n]{0,40}|(?:future\s+)?(?:you|me)\s*(?:,[^\n]{0,30})?)\s*$/i;

// Display-time clean-up for rules models sometimes ignore: no sign-off line
// (the app adds its own) and no em dashes.
export function tidyLetter(text: string) {
  return text
    .replace(SIGN_OFF, "")
    .replace(/\s*—\s*/g, ", ")
    .trim();
}
