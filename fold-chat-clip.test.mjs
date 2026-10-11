import test from 'node:test';
import assert from 'node:assert/strict';
import { clipAsk, timeToSec, youtubeIdFrom } from './fold-chat-clip.js';

test('one span + id + name is a snip', () => {
  const s = clipAsk('clip 2:28:00-2:29:35 from https://www.youtube.com/watch?v=wNHXllwtgBk named evanssegall');
  assert.equal(s.kind, 'clip');
  assert.equal(s.id, 'wNHXllwtgBk');
  assert.equal(s.name, 'evanssegall');
  assert.deepEqual(s.segments, [{ start: 8880, end: 8975 }]);
});

test('a short form and a bare id after "from"', () => {
  const s = clipAsk('snip 2:28-2:29:35 from wNHXllwtgBk as quote');
  assert.equal(s.kind, 'clip');
  assert.equal(s.id, 'wNHXllwtgBk');
  assert.equal(s.segments[0].start, 148);
  assert.equal(s.segments[0].end, 8975);
});

test('two spans stitch even under a clip verb', () => {
  const s = clipAsk('clip 0:30-0:45 and 2:00-2:10 from https://youtu.be/wNHXllwtgBk as undercroft');
  assert.equal(s.kind, 'stitch');
  assert.deepEqual(s.segments.map(x => x.start), [30, 120]);
});

test('seconds-only spans and a join verb', () => {
  const s = clipAsk('join 10-20, 30-40 from wNHXllwtgBk titled microcuts');
  assert.equal(s.kind, 'stitch');
  assert.deepEqual(s.segments, [{ start: 10, end: 20 }, { start: 30, end: 40 }]);
});

test('every span must be well formed, or the sentence is not a clip', () => {
  assert.equal(clipAsk('clip 5:00-4:00 from wNHXllwtgBk'), null);
  assert.equal(clipAsk('clip 2:00 from wNHXllwtgBk'), null);
  assert.equal(clipAsk('clip 1:00-2:00 from notanid'), null);
  assert.equal(clipAsk('trim 1:00-2:00'), null);
});

test('an ordinary question never becomes a clip', () => {
  assert.equal(clipAsk('what quote did Evans Segall give at 2:28, from the video before?'), null);
  assert.equal(clipAsk('could you clip the audio for me please'), null);
  assert.equal(clipAsk(''), null);
});

test('timeToSec accepts only real clock shapes', () => {
  assert.equal(timeToSec('2:28:00'), 8880);
  assert.equal(timeToSec('97'), 97);
  assert.equal(timeToSec('5:61'), null);
  assert.equal(timeToSec('::'), null);
});

test('youtubeIdFrom finds urls and bare ids after "from"', () => {
  assert.equal(youtubeIdFrom('from wNHXllwtgBk named x'), 'wNHXllwtgBk');
  assert.equal(youtubeIdFrom('see https://youtu.be/wNHXllwtgBk ok'), 'wNHXllwtgBk');
  assert.equal(youtubeIdFrom('plain text with no id'), null);
});