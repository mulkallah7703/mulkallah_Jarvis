/** Local wake-phrase helpers. Never call the LLM from here. */

export const WAKE_PHRASE = "Mulk Allah";
/**
 * Stable-interim flush. Chrome often waits ~0.7–1.2s to mark a result final;
 * submitting the latest interim after a short quiet beats that without cutting
 * off mid-phrase (80ms was short enough to fire on gaps between interim events).
 * Final results still submit immediately.
 */
export const COMMAND_SILENCE_MS = 280;

const MULK = "mulk|milk|mulck|molk|merca|merka|merk|mulc|\u0645\u0644\u0643";
/** Bare wake. Close mishears of "mulk" only — not common words like milk/merk. */
const BARE_MULK = "mulk|mulck|molk|mulc|\u0645\u0644\u0643";
const ALLAH = "allah|alla|ellah|alah|ullah|\u0627\u0644\u0644\u0647";
const JARVIS = "jarvis|jervis|jarvess|jarves|gervis|\u062c\u0627\u0631\u0641\u064a\u0633|\u062c\u0627\u0631\u0641\u0633";
const GLUED =
  "mulkallah|mulkalah|mulkalla|milkallah|milkalah|mercallah|mercalla|merkalla|mulcalla|mulkalla";

const WAKE_FIND = new RegExp(
  `(?:${GLUED})|(?:${MULK})\\s+(?:${ALLAH})|(?:^|\\s)(?:${BARE_MULK})(?=\\s|$)`,
);
const WAKE_STRIP = new RegExp(
  `(?:${GLUED}|(?:${MULK})\\s+(?:${ALLAH})|(?:${BARE_MULK}))\\s*[,،]?\\s*(?:${JARVIS})?\\s*[,،.!?…]*`,
  "i",
);

export const WAKE_GREETING = "Hi Mulk Allah!";

export function normalizeSpeech(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[.,!?;:"()[\]{}،؟…\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripWake(raw: string): { hit: boolean; command: string; atStart: boolean } {
  const norm = normalizeSpeech(raw);
  if (!norm || !WAKE_FIND.test(norm)) return { hit: false, command: "", atStart: false };
  const found = raw.match(WAKE_STRIP);
  if (!found || found.index == null) return { hit: true, command: "", atStart: true };
  const command = raw
    .slice(found.index + found[0].length)
    .replace(/\s+/g, " ")
    .trim();
  const prefix = normalizeSpeech(raw.slice(0, found.index));
  return { hit: true, command, atStart: prefix.length === 0 };
}

export function matchWake(text: string): { hit: boolean; command: string } {
  const first = stripWake(text.trim());
  if (!first.hit) return { hit: false, command: "" };
  let command = first.command;
  if (first.atStart) {
    for (let i = 0; i < 4 && command; i++) {
      const next = stripWake(command);
      if (!next.hit || !next.atStart) break;
      command = next.command;
    }
  }
  return { hit: true, command };
}

/** Wake phrase only when it leads the utterance. Keeps "tell me about mulk" intact. */
export function leadingWake(text: string): { hit: boolean; command: string } {
  let command = text.trim();
  let hit = false;
  for (let i = 0; i < 4 && command; i++) {
    const next = stripWake(command);
    if (!next.hit || !next.atStart) break;
    hit = true;
    command = next.command;
  }
  return hit ? { hit: true, command } : { hit: false, command: "" };
}

/** Finals append; current interim replaces. Matches Chrome SpeechRecognition. */
export function createWakeBuffer(maxChars = 240, maxAgeMs = 4000) {
  let committed = "";
  let interim = "";
  let at = 0;

  const text = () => `${committed} ${interim}`.replace(/\s+/g, " ").trim();

  return {
    pushFinal(piece: string) {
      const now = Date.now();
      if (now - at > maxAgeMs) committed = "";
      at = now;
      committed = `${committed} ${piece}`.replace(/\s+/g, " ").trim().slice(-maxChars);
      interim = "";
      return text();
    },
    setInterim(piece: string) {
      const now = Date.now();
      if (now - at > maxAgeMs) committed = "";
      at = now;
      interim = piece.trim();
      return text();
    },
    text,
    reset() {
      committed = "";
      interim = "";
      at = 0;
    },
  };
}

export function selfCheckWakePhrase(): string[] {
  const fails: string[] = [];
  const expect = (name: string, input: string, hit: boolean, command: string) => {
    const got = matchWake(input);
    if (got.hit !== hit || got.command !== command) {
      fails.push(`${name}: got ${JSON.stringify(got)} expected ${JSON.stringify({ hit, command })}`);
    }
  };

  expect("canonical", "Mulk Allah", true, "");
  expect("lower", "mulk allah", true, "");
  expect("punct", "Mulk Allah!", true, "");
  expect("concat", "MulkAllah", true, "");
  expect("mulkalah", "mulkalah", true, "");
  expect("mulkalla", "mulkalla", true, "");
  expect("milk", "milk allah", true, "");
  expect("mulk alla", "mulk alla", true, "");
  expect("merca allah", "merca allah", true, "");
  expect("mercalla", "mercalla", true, "");
  expect("same utterance", "Mulk Allah what is the weather", true, "what is the weather");
  expect("optional jarvis", "Mulk Allah Jarvis what is the weather", true, "what is the weather");
  expect("arabic comma", "Mulk Allah، ما هو الوقت الآن؟", true, "ما هو الوقت الآن؟");
  expect("mixed", "Mulk Allah، افتح الـdashboard.", true, "افتح الـdashboard.");
  expect("prefix junk", "hey there Mulk Allah Hello, how are you?", true, "Hello, how are you?");
  expect("mulk only", "Mulk", true, "");
  expect("mulk bang", "mulk!", true, "");
  expect("bare command", "Mulk, what time is it", true, "what time is it");
  expect("bare jarvis", "Mulk Jarvis open the map", true, "open the map");
  expect("repeated", "mulk mulk", true, "");
  expect("hey mulk", "hey mulk", true, "");
  expect("arabic bare", "\u0645\u0644\u0643", true, "");
  expect("milk alone", "milk", false, "");
  expect("merk alone", "merk", false, "");
  expect("allah only", "Allah", false, "");
  expect("jarvis only", "Jarvis", false, "");
  expect("hello jarvis", "Hello Jarvis", false, "");
  expect("how are you", "How are you?", false, "");
  expect("unrelated", "open my dashboard", false, "");

  const buf = createWakeBuffer();
  buf.setInterim("mulk");
  if (!matchWake(buf.text()).hit) fails.push("interim mulk should wake");
  const progressive = matchWake(buf.setInterim("mulk allah"));
  if (!progressive.hit || progressive.command) fails.push("rolling interim buffer failed");

  return fails;
}
