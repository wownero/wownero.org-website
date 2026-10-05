/* Development fund balances, read by wownero.org from its own nodes once a minute
   and published as /donations/balances.json. The browser contacts only this site.
   Public addresses and view keys live in donations.html and in that file; no
   spending credential is involved anywhere. */
'use strict';

const BALANCES_URL = '/donations/balances.json';

/* Server amounts are exact decimal strings. Show them without trailing zeros and
   refuse anything else rather than guess. */
function amount(value) {
    if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) {
        throw new Error('Invalid amount in balances.json');
    }
    if (!value.includes('.')) return value;
    const trimmed = value.replace(/0+$/, '').replace(/\.$/, '');
    return trimmed === '-0' ? '0' : trimmed;
}

function when(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? 'an unknown time' : date.toLocaleString();
}

/* Lines for one coin. A coin whose source could not be read keeps its last good
   value, marked stale; one never read says so. Neither is ever shown as zero. */
function describe(symbol, coin) {
    if (!coin) return { balance: 'Not monitored yet.', details: ['Monitoring starts when this view key is published.'] };
    const details = [];
    let balance;
    if (coin.balance === undefined) {
        balance = 'Balance unavailable.';
        details.push('Not read yet' + (coin.error ? ': the source could not be reached.' : '.'));
    } else {
        /* A view key sees incoming funds only. Until the fund imports key images
           its "balance" is really the received total, which overstates a wallet
           that has spent; call it what it is. */
        const viewOnly = coin.total_received !== undefined && !coin.key_images_synced_at;
        balance = viewOnly
            ? 'Received so far: ' + amount(coin.total_received) + ' ' + symbol + ' (balance pending key-image sync)'
            : amount(coin.balance) + ' ' + symbol;
        if (coin.status === 'stale') {
            balance += ' (last read ' + when(coin.checked_at) + '; the source is currently unreachable)';
        }
    }
    if (coin.total_received !== undefined) {
        details.push((coin.key_images_synced_at ? 'Received in total: ' + amount(coin.total_received) + ' ' + symbol + ' over ' : 'Over ') +
            coin.incoming_transfers + ' incoming transfer' + (coin.incoming_transfers === 1 ? '' : 's') + '.');
    }
    if (coin.scanning) {
        details.push('The view-only wallet is still scanning the chain (' +
            Math.max(0, coin.chain_height - coin.wallet_height) + ' blocks to go), so these figures are partial.');
    } else if (coin.total_received !== undefined) {
        details.push(coin.key_images_synced_at
            ? 'Spending is reflected as of ' + when(coin.key_images_synced_at) + '.'
            : 'A view key shows incoming funds only; the balance appears once the fund imports key images from its spending wallet.');
    }
    if (coin.unconfirmed !== undefined && amount(coin.unconfirmed) !== '0') {
        details.push('Unconfirmed: ' + amount(coin.unconfirmed) + ' ' + symbol + '.');
    }
    if (coin.status === 'ok' && coin.checked_at) {
        details.push('Read ' + when(coin.checked_at) + ' from ' + coin.source + '.');
    }
    return { balance, details };
}

async function load() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(BALANCES_URL, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const doc = await response.json();
        if (doc.schema !== 'devfund-balances/v1') throw new Error('Unknown balances format');
        return doc;
    } finally {
        clearTimeout(timeout);
    }
}

function render(doc) {
    for (const card of document.querySelectorAll('[data-coin]')) {
        const symbol = card.dataset.coin;
        const balance = card.querySelector('.balance');
        const status = card.querySelector('.status');
        try {
            const view = describe(symbol, doc.coins[symbol]);
            balance.textContent = view.balance;
            status.textContent = view.details.join(' ');
        } catch (error) {
            balance.textContent = 'Balance unavailable.';
            status.textContent = 'The published balance could not be read.';
        }
    }
}

if (typeof document !== 'undefined') {
    const button = document.getElementById('refresh');
    const status = document.getElementById('refresh-status');
    const refresh = async () => {
        button.disabled = true;
        status.textContent = 'Loading balances…';
        try {
            const doc = await load();
            render(doc);
            status.textContent = 'Balances published ' + when(doc.generated_at) + '.';
        } catch (error) {
            for (const card of document.querySelectorAll('[data-coin] .balance')) {
                card.textContent = 'Balance unavailable.';
            }
            status.textContent = 'Balances could not be loaded. Use the explorer links below.';
        } finally {
            button.disabled = false;
        }
    };
    button.hidden = false;
    button.addEventListener('click', refresh);
    refresh();
}

if (typeof module !== 'undefined') module.exports = { amount, describe };
