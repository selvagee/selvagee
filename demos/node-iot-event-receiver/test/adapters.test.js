import test from 'node:test';
import assert from 'node:assert/strict';
import { decode, availableAdapters } from '../src/adapters.js';
import { retryCount, retryProperties } from '../src/retry.js';
test('both synthetic protocols produce equivalent events', () => {
 const csv = decode('@,device1,evt1,23.5,1,#');
 const json = decode('{"version":1,"deviceId":"device1","eventId":"evt1","temperature":23.5,"alarm":true}', 'json-v1');
 assert.equal(csv.hash,json.hash);
 assert.equal(csv.alarm,json.alarm);
 assert.deepEqual(availableAdapters(),['csv-v1','json-v1']);
});
test('rejects unsupported and malformed packets', () => {
 assert.throws(()=>decode('anything','unknown'));
 assert.throws(()=>decode('{"version":2}', 'json-v1'));
});
test('retry metadata increments predictably', () => {
 const msg = {properties:{messageId:'evt1',headers:{'x-demo-retry':2}}};
 assert.equal(retryCount(msg),2);
 assert.equal(retryProperties(msg,3).headers['x-demo-retry'],3);
});
