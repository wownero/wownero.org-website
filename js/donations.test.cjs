'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { amount, describe } = require('./donations.js');

test('server amounts keep their precision and lose only trailing zeros', () => {
    assert.equal(amount('1.000000000000000001'), '1.000000000000000001');
    assert.equal(amount('0.00027878'), '0.00027878');
    assert.equal(amount('5.637709531'), '5.637709531');
    assert.equal(amount('0.000000000000000000'), '0');
    assert.equal(amount('12'), '12');
    for (const invalid of [null, undefined, '', '1.5e3', 'NaN', 1.5, '1.']) {
        assert.throws(() => amount(invalid));
    }
});

test('a source that cannot be read is never shown as zero', () => {
    const never = describe('ETH', { status: 'unavailable', error: 'OSError: no route', source: 'x' });
    assert.equal(never.balance, 'Balance unavailable.');
    const stale = describe('ETH', { status: 'stale', balance: '0.5', checked_at: '2026-10-05T00:00:00Z', source: 'x' });
    assert.match(stale.balance, /^0\.5 ETH \(last read .+unreachable\)$/);
    assert.equal(describe('XMR', undefined).balance, 'Not monitored yet.');
});

test('a view-only wallet says what its balance does and does not show', () => {
    const base = { status: 'ok', balance: '10', total_received: '10', incoming_transfers: 2,
        wallet_height: 100, chain_height: 100, checked_at: '2026-10-05T00:00:00Z', source: 'our node' };
    const unsynced = describe('WOW', { ...base, total_received: '90', balance: '90' });
    assert.equal(unsynced.balance, 'Received so far: 90 WOW (balance pending key-image sync)');
    assert.match(unsynced.details.join(' '), /incoming funds only/);
    const synced = describe('WOW', { ...base, total_received: '90', key_images_synced_at: '2026-10-05T00:00:00Z' });
    assert.equal(synced.balance, '10 WOW');
    assert.match(synced.details.join(' '), /Received in total: 90 WOW over 2 incoming transfers/);
    assert.match(synced.details.join(' '), /Spending is reflected as of/);
    const scanning = describe('WOW', { ...base, scanning: true, wallet_height: 40 }).details.join(' ');
    assert.match(scanning, /still scanning the chain \(60 blocks to go\)/);
});
