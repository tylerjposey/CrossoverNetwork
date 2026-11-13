import assert from 'node:assert/strict';
import { createDictation, type Recognition } from '../src/lib/dictation';

class FakeRecognition implements Recognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: Recognition['onstart'] = null;
  onend: Recognition['onend'] = null;
  onerror: Recognition['onerror'] = null;
  onresult: Recognition['onresult'] = null;
  stopped = false;
  aborted = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.onstart?.(); }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}

let text = 'I study geography.';
let active = false;
let message = '';
const dictation = createDictation({
  RecognitionClass: FakeRecognition,
  getText: () => text,
  setText: (next) => { text = next; },
  setActive: (next) => { active = next; },
  setMessage: (next) => { message = next; },
  maxLength: 1000,
});
const last = () => FakeRecognition.instances.at(-1)!;
const result = (transcript: string, isFinal = true) => ({ isFinal, 0: { transcript } });

dictation.start();
assert.equal(active, true);
assert.match(message, /Listening/);
assert.equal(last().lang, 'en-US');
dictation.start();
assert.equal(FakeRecognition.instances.length, 1, 'double clicks must not start another microphone');
last().onresult?.({ resultIndex: 0, results: [result('I want to work in climate.', false)] });
assert.equal(text, 'I study geography.', 'interim text must not replace existing input');
last().onresult?.({ resultIndex: 0, results: [result('I want to work in climate.')] });
last().onresult?.({ resultIndex: 0, results: [result('I want to work in climate.')] });
assert.equal(text, 'I study geography. I want to work in climate.', 'final results append exactly once');
dictation.stop();
assert.equal(last().stopped, true);
last().onresult?.({ resultIndex: 1, results: [result('I want to work in climate.'), result('I enjoy hiking.')] });
last().onend?.();
assert.equal(active, false);
assert.match(text, /I enjoy hiking\.$/, 'the final result after Stop must be preserved');

dictation.start();
const beforeFailure = text;
last().onerror?.({ error: 'not-allowed' });
assert.equal(active, false);
assert.equal(text, beforeFailure);
assert.match(message, /Microphone access was not allowed/);
assert.equal(last().aborted, true);

dictation.start();
last().onerror?.({ error: 'network' });
assert.match(message, /could not connect/);
assert.equal(text, beforeFailure);
dictation.start();
last().onerror?.({ error: 'no-speech' });
assert.match(message, /No speech was detected/);

text = 'a'.repeat(995);
dictation.start();
last().onresult?.({ resultIndex: 0, results: [result('longer than remaining room')] });
assert.equal(text.length, 1000);
assert.equal(last().stopped, true);
last().onend?.();
assert.match(message, /1,000-character limit/);
const count = FakeRecognition.instances.length;
dictation.start();
assert.equal(FakeRecognition.instances.length, count, 'full inputs cannot start recording');

text = 'Keep this text';
dictation.start();
const staleResult = last().onresult!;
dictation.dispose();
assert.equal(last().aborted, true);
assert.equal(last().onresult, null);
staleResult({ resultIndex: 0, results: [result('must not be appended')] });
assert.equal(text, 'Keep this text', 'unmount must ignore late recognition results');
dictation.start();
assert.equal(FakeRecognition.instances.length, count + 1, 'disposed controllers cannot restart');

class BrokenRecognition extends FakeRecognition {
  start() { throw new Error('Browser disallowed speech recognition'); }
}
const broken = createDictation({
  RecognitionClass: BrokenRecognition, getText: () => text, setText: () => {},
  setActive: (next) => { active = next; }, setMessage: (next) => { message = next; }, maxLength: 1000,
});
broken.start();
assert.equal(active, false);
assert.match(message, /could not start/);
console.log('Dictation checks passed: append, deduplication, stop/final result, errors, limit, cleanup, and start failure.');
