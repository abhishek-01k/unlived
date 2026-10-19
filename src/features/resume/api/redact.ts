// Strip personal details from resume text before it goes to any model.
// Heuristic by design: catch the common cases (contact lines, links,
// addresses, the name header) and leave the career content intact.

export type RedactionResult = {
  text: string;
  removed: { emails: number; phones: number; urls: number; addresses: number; names: number };
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com)\/\S*/gi;
// Bare personal domains like "jane.dev" or "abc.xyz". Tech names such as
// "Next.js" or "Node.js" are not on this TLD list, so they survive.
const DOMAIN = /(?<![@\w.])[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]+)*\.(?:com|dev|io|me|xyz|app|in|co|ai|org|net|site|tech|page|link|bio)(?:\/\S*)?(?![\w.])/gi;
// +91 98765 43210, (415) 555-0132, 415.555.0132, +44 20 7946 0958 …
const PHONE = /(?<![\w.])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,5}(?:[\s.-]?\d{2,5}){1,3}(?![\w.])/g;
const STREET =
  /\b\d{1,5}\s+(?:[A-Z][A-Za-z]+\s){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Boulevard|Blvd|Drive|Dr|Nagar|Marg|Colony|Sector)\b\.?[^\n]*/g;
// Indian PIN after a place name ("Bengaluru 560001") or US ZIP after a state
// code ("CA 94107"). Bare numbers like "40000 lines" are left alone.
const POSTAL = /(?<=\b[A-Z][a-z]+,?\s)\d{6}\b|\b[A-Z]{2}\s\d{5}(?:-\d{4})?\b/g;

function countAndReplace(text: string, re: RegExp, token: string, filter?: (m: string) => boolean) {
  let count = 0;
  const out = text.replace(re, (m) => {
    if (filter && !filter(m)) return m;
    count++;
    return token;
  });
  return { out, count };
}

// A phone number has 8–15 digits. Shorter runs are years, metrics, ranges.
const looksLikePhone = (m: string) => {
  const digits = m.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15 && !/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(m.trim());
};

// The name is usually a short Title Case line at the very top.
function redactNameHeader(text: string) {
  const lines = text.split("\n");
  let count = 0;
  let seen = 0;
  for (let i = 0; i < lines.length && seen < 3; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    seen++;
    if (/^(?:[A-Z][a-zA-Z'’-]+|[A-Z]\.)(?:\s+(?:[A-Z][a-zA-Z'’-]+|[A-Z]\.)){1,3}$/.test(line) && !/resume|curriculum|vitae/i.test(line)) {
      lines[i] = "[NAME]";
      count++;
      break;
    }
  }
  return { out: lines.join("\n"), count };
}

export function redactPII(input: string): RedactionResult {
  let text = input.replace(/\r\n?/g, "\n");

  const emails = countAndReplace(text, EMAIL, "[EMAIL]");
  text = emails.out;
  const urls = countAndReplace(text, URL, "[URL]");
  text = urls.out;
  const domains = countAndReplace(text, DOMAIN, "[URL]");
  text = domains.out;
  const phones = countAndReplace(text, PHONE, "[PHONE]", looksLikePhone);
  text = phones.out;
  const streets = countAndReplace(text, STREET, "[ADDRESS]");
  text = streets.out;
  const postal = countAndReplace(text, POSTAL, "[ADDRESS]");
  text = postal.out;
  const names = redactNameHeader(text);
  text = names.out;

  return {
    text,
    removed: {
      emails: emails.count,
      phones: phones.count,
      urls: urls.count + domains.count,
      addresses: streets.count + postal.count,
      names: names.count,
    },
  };
}
