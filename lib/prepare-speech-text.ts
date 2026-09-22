/**
 * Prepare AI text for speech. Does not change the displayed chat message.
 */
export function prepareSpeechText(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n").trim();
  if (!s) return "";

  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/^#{1,6}\s+(.+)$/gm, "$1.");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|[^\w])\*([^*\n]+)\*(?!\w)/g, "$1$2");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/https?:\/\/\S+/gi, " ");
  s = s.replace(/www\.\S+/gi, " ");
  s = s.replace(/^[>]+\s?/gm, "");

  if (/^\s*[{\[]/.test(s)) {
    s = s.replace(/["'`]/g, " ");
    s = s.replace(/[{}\[\]]/g, " ");
  }

  const lines = s.split("\n");
  const spoken: string[] = [];
  let n = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      n = 0;
      continue;
    }
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (numbered) {
      n += 1;
      const rest = numbered[2];
      const ar = /[\u0600-\u06FF]/.test(rest);
      if (n === 1) spoken.push(ar ? `أولاً، ${rest}` : `First, ${rest}`);
      else if (n === 2) spoken.push(ar ? `ثم، ${rest}` : `Then, ${rest}`);
      else spoken.push(rest);
      continue;
    }
    if (bullet) {
      spoken.push(bullet[1]);
      continue;
    }
    n = 0;
    spoken.push(trimmed);
  }

  s = spoken.join(". ");
  s = s.replace(/[*_~#|<>\\]/g, " ");
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/([.!?،])\s*\1+/g, "$1");
  s = s.replace(/\.\s+\./g, ".");
  return s.trim();
}
