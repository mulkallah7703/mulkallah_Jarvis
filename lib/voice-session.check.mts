import { selfCheckWakePhrase } from "./wake-phrase.ts";
import { runVoiceSession, type SessionTrace } from "./voice-session.ts";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

function same(trace: SessionTrace, expect: Partial<SessionTrace>, label: string) {
  if (expect.mode != null) assert(trace.mode === expect.mode, `${label} mode ${trace.mode}`);
  if (expect.listening != null) assert(trace.listening === expect.listening, `${label} listening`);
  if (expect.greets != null) assert(trace.greets === expect.greets, `${label} greets ${trace.greets}`);
  if (expect.micClicks != null) assert(trace.micClicks === expect.micClicks, `${label} clicks`);
  if (expect.commands) {
    assert(
      trace.commands.join("|") === expect.commands.join("|"),
      `${label} commands ${JSON.stringify(trace.commands)}`,
    );
  }
}

const wakeFails = selfCheckWakePhrase();
assert(wakeFails.length === 0, wakeFails.join("\n"));

const beforeArm = runVoiceSession([{ type: "transcript", text: "mulk" }]);
same(beforeArm, { greets: 0, commands: [], listening: false, mode: "wake", micClicks: 0 }, "before arm");

const ignored = runVoiceSession([
  { type: "arm" },
  { type: "transcript", text: "what time is it" },
]);
same(ignored, { greets: 0, commands: [], listening: true, mode: "wake", micClicks: 0 }, "no wake yet");

const multi = runVoiceSession([
  { type: "arm" },
  { type: "transcript", text: "mulk" },
  { type: "transcript", text: "what time is it" },
  { type: "reply-done" },
  { type: "transcript", text: "Hi Mulk Allah!" },
  { type: "transcript", text: "what is the weather" },
  { type: "reply-done" },
  { type: "transcript", text: "hi" },
  { type: "transcript", text: "tell me a joke" },
]);
same(
  multi,
  {
    mode: "session",
    listening: true,
    greets: 1,
    micClicks: 0,
    commands: ["what time is it", "what is the weather", "tell me a joke"],
  },
  "multi-turn",
);

const sameBreath = runVoiceSession([
  { type: "arm" },
  { type: "transcript", text: "mulk what is the weather" },
]);
same(
  sameBreath,
  { mode: "session", greets: 0, commands: ["what is the weather"], micClicks: 0, listening: true },
  "same breath",
);

const about = runVoiceSession([
  { type: "arm" },
  { type: "transcript", text: "mulk" },
  { type: "transcript", text: "tell me about mulk allah" },
]);
same(about, { commands: ["tell me about mulk allah"], greets: 1, mode: "session" }, "wake inside question");

const again = runVoiceSession([
  { type: "arm" },
  { type: "transcript", text: "hey mulk" },
  { type: "transcript", text: "mulk" },
]);
same(again, { greets: 2, commands: [], mode: "session", listening: true, micClicks: 0 }, "regreet");

const muted = runVoiceSession([
  { type: "arm" },
  { type: "transcript", text: "mulk" },
  { type: "transcript", text: "first question" },
  { type: "mute" },
  { type: "transcript", text: "should not send" },
]);
same(muted, { listening: false, mode: "wake", commands: ["first question"], greets: 1 }, "muted");

const unmute = runVoiceSession([
  { type: "arm" },
  { type: "transcript", text: "mulk" },
  { type: "mute" },
  { type: "unmute" },
  { type: "transcript", text: "still need the wake word" },
  { type: "transcript", text: "mulk" },
  { type: "transcript", text: "now it hears me" },
]);
same(
  unmute,
  {
    listening: true,
    mode: "session",
    micClicks: 0,
    greets: 2,
    commands: ["now it hears me"],
  },
  "unmute needs wake",
);

console.log("voice session check ok");
