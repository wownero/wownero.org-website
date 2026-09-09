'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { units, providers } = require('./donations.js');

test('native amounts retain precision and represent negative net changes', () => {
    assert.equal(units('1000000000000000001', 18), '1.000000000000000001');
    assert.equal(units(1, 8), '0.00000001');
    assert.equal(units(-123456789, 8), '-1.23456789');
    assert.equal(units(0, 9), '0');
    for (const invalid of [null, undefined, '', '1.5', NaN, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => units(invalid, 8));
    }
});

test('provider failures never become zero balances', async () => {
    const original = global.fetch;
    try {
        global.fetch = async () => ({ ok: false, status: 429 });
        for (const provider of Object.values(providers)) {
            await assert.rejects(provider.balance('address'));
        }
        global.fetch = async () => ({ ok: true, json: async () => ({ status: '0', result: '0' }) });
        await assert.rejects(providers.eth.balance('address'));
        global.fetch = async () => ({ ok: true, json: async () => ({ error: { code: -32000 } }) });
        await assert.rejects(providers.sol.balance('address'));
    } finally { global.fetch = original; }
});

test('Bitcoin net activity accounts for change and preserves pending status', async () => {
    const original = global.fetch;
    try {
        global.fetch = async () => ({ ok: true, json: async () => [{ txid: 'abc',
            vin: [{ prevout: { scriptpubkey_address: 'fund', value: 100000000 } }],
            vout: [{ scriptpubkey_address: 'fund', value: 70000000 },
                { scriptpubkey_address: 'other', value: 29000000 }],
            status: { confirmed: false } }] });
        const [activity] = await providers.btc.activity('fund');
        assert.match(activity.label, /-0\.3 BTC/);
        assert.match(activity.label, /pending/);
    } finally { global.fetch = original; }
});

test('Ethereum failed transfers are marked failed', async () => {
    const original = global.fetch;
    try {
        global.fetch = async () => ({ ok: true, json: async () => ({ items: [{
            hash: 'abc', from: { hash: 'FUND' }, to: { hash: 'other' },
            value: '1000000000000000001', status: 'error'
        }] }) });
        const [activity] = await providers.eth.activity('fund');
        assert.match(activity.label, /Outgoing/);
        assert.match(activity.label, /failed/);
        assert.match(activity.label, /1\.000000000000000001/);
    } finally { global.fetch = original; }
});
