// Text limits shared by the forms (maxlength) and the server (validation). A card is a
// 3×5 card, so the limits keep it to a short thought.
export const MAX_CAPTURE_LENGTH = 1000;
export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTES_LENGTH = 1000;
export const MAX_PILE_NAME_LENGTH = 40;
export const MAX_SUBTASKS = 50;
export const MAX_PASSWORD_LENGTH = 200;
// The longest address RFC 5321 allows.
export const MAX_EMAIL_LENGTH = 254;
export const MAX_SEARCH_LENGTH = 200;
// An admin-only reminder of who an invite link is for.
export const MAX_INVITE_LABEL_LENGTH = 60;

// Claude sorts per non-admin user per UTC day; past it, captures fall back to picking a pile.
export const DAILY_PARSE_LIMIT = 20;

// Most steps one Break it down press can propose or add.
export const MAX_BREAKDOWN_STEPS = 8;

// Sign-ups without an invite (SIGNUP_DOMAINS) across everyone in any 24 hours. Those addresses aren't
// verified, so this caps how many new accounts, and so Claude sorts, one domain can bring in a day.
export const DAILY_OPEN_SIGNUP_LIMIT = 20;
