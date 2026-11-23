import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePacket, ack } from '../src/protocol.js';
test('parses valid synthetic packet',()=>{const e=parsePacket('@,device01,evt42,24.5,1,#');assert.equal(e.deviceId,'device01');assert.equal(e.alarm,true);assert.equal(e.temperature,24.5);assert.equal(ack(e.eventId),'ACK,evt42\n');});
test('stable idempotency hash',()=>assert.equal(parsePacket('@,d1,e1,24,0,#').hash,parsePacket('@,d1,e1,25,1,#').hash));
test('rejects malformed packets',()=>{for(const s of ['bad','@,d1,e1,NaN,0,#','@,d1,e1,24,2,#','@,../x,e1,24,0,#'])assert.throws(()=>parsePacket(s));});
