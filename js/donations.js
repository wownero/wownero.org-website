/* Public addresses live in donations.html. No wallet keys are used here. */
'use strict';

function units(value, decimals) {
    if (!/^-?\d+$/.test(String(value)) ||
        (typeof value === 'number' && !Number.isSafeInteger(value))) {
        throw new Error('Provider returned an invalid amount');
    }
    const amount = BigInt(value);
    const digits = (amount < 0n ? -amount : amount).toString().padStart(decimals + 1, '0');
    const fraction = digits.slice(-decimals).replace(/0+$/, '');
    return (amount < 0n ? '-' : '') + digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}

async function request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal,
            credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Provider returned HTTP ' + response.status);
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function solana(method, address, extra = {}) {
    const data = await request('https://solana-rpc.publicnode.com', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method,
            params: [address, { commitment: 'finalized', ...extra }] })
    });
    if (data.error || !Object.hasOwn(data, 'result')) throw new Error('Solana RPC request failed');
    return data.result;
}

const providers = {
    btc: {
        async balance(address) {
            const data = await request('https://mempool.space/api/address/' + address);
            const chain = data.chain_stats;
            const pending = data.mempool_stats;
            // Validate each integer before arithmetic; never coerce missing data to zero.
            [chain.funded_txo_sum, chain.spent_txo_sum, pending.funded_txo_sum,
                pending.spent_txo_sum].forEach(value => units(value, 8));
            return units(BigInt(chain.funded_txo_sum) - BigInt(chain.spent_txo_sum), 8) +
                ' BTC confirmed; pending net change ' +
                units(BigInt(pending.funded_txo_sum) - BigInt(pending.spent_txo_sum), 8) + ' BTC';
        },
        async activity(address) {
            const data = await request('https://mempool.space/api/address/' + address + '/txs');
            return data.slice(0, 10).map(tx => {
                const received = tx.vout.filter(out => out.scriptpubkey_address === address)
                    .reduce((sum, out) => sum + BigInt(out.value), 0n);
                const spent = tx.vin.filter(input => input.prevout?.scriptpubkey_address === address)
                    .reduce((sum, input) => sum + BigInt(input.prevout.value), 0n);
                return { id: tx.txid, url: 'https://mempool.space/tx/' + encodeURIComponent(tx.txid),
                    label: units(received - spent, 8) + ' BTC net change, ' +
                        (tx.status.confirmed ? 'confirmed' : 'pending') };
            });
        },
        note: 'Latest 10 transactions. Net change includes change outputs and fees on outgoing transactions.'
    },
    eth: {
        async balance(address) {
            const data = await request('https://eth.blockscout.com/api?module=account&action=balance&address=' + address);
            if (data.status !== '1') throw new Error('Ethereum balance provider could not return a balance');
            return units(data.result, 18) + ' ETH (latest indexed balance)';
        },
        async activity(address) {
            const data = await request('https://eth.blockscout.com/api/v2/addresses/' + address + '/transactions');
            return data.items.slice(0, 10).map(tx => {
                const from = tx.from?.hash?.toLowerCase() === address.toLowerCase();
                const to = tx.to?.hash?.toLowerCase() === address.toLowerCase();
                return { id: tx.hash, url: 'https://eth.blockscout.com/tx/' + encodeURIComponent(tx.hash),
                    label: (from && to ? 'Self-transfer' : from ? 'Outgoing' : 'Incoming') +
                        ' ' + units(tx.value, 18) + ' ETH, ' +
                        (tx.status === 'ok' ? 'successful' : tx.status === 'error' ? 'failed' : 'pending or unconfirmed') };
            });
        },
        note: 'Latest 10 regular transactions. Transfer values exclude fees. Internal transfers and tokens are available in the explorer.'
    },
    sol: {
        async balance(address) {
            const data = await solana('getBalance', address);
            return units(data.value, 9) + ' SOL finalized';
        },
        async activity(address) {
            const data = await solana('getSignaturesForAddress', address, { limit: 10 });
            return data.map(tx => ({ id: tx.signature,
                url: 'https://explorer.solana.com/tx/' + encodeURIComponent(tx.signature),
                label: (tx.err ? 'Failed' : 'Finalized') + ' transaction referencing this account' }));
        },
        note: 'Latest 10 account transactions. Open a transaction for incoming and outgoing transfer details; account activity is not necessarily a donation.'
    }
};

async function refreshCard(card) {
    const provider = providers[card.dataset.chain];
    const address = card.querySelector('.address').textContent.trim();
    const balance = card.querySelector('.balance');
    const status = card.querySelector('.status');
    const activity = card.querySelector('.activity');
    balance.textContent = 'Loading balance…';
    status.textContent = 'Loading activity…';
    activity.replaceChildren();
    const results = await Promise.allSettled([provider.balance(address), provider.activity(address)]);
    const checked = new Date().toLocaleString();
    balance.textContent = results[0].status === 'fulfilled' ? results[0].value :
        'Balance unavailable. Try again or use the explorer below.';
    if (results[1].status === 'fulfilled') {
        for (const tx of results[1].value) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = tx.url;
            link.rel = 'noreferrer';
            link.textContent = tx.label + ' (' + tx.id.slice(0, 12) + '…)';
            item.append(link);
            activity.append(item);
        }
        status.textContent = (results[1].value.length ? provider.note : 'No recent activity returned by the provider.') +
            ' Checked ' + checked + '.';
    } else {
        status.textContent = 'Activity unavailable. Try again or use the explorer below. Checked ' + checked + '.';
    }
    if (results[0].status === 'fulfilled') balance.textContent += '. Retrieved ' + checked + '.';
}

if (typeof document !== 'undefined') {
    const button = document.getElementById('refresh');
    button.hidden = false;
    button.addEventListener('click', async () => {
        button.disabled = true;
        const status = document.getElementById('refresh-status');
        status.textContent = 'Checking public providers…';
        try {
            await Promise.allSettled([...document.querySelectorAll('[data-chain]')].map(refreshCard));
            status.textContent = 'Check finished. Each coin shows its result below.';
        } finally {
            button.textContent = 'Refresh balances and activity';
            // A short cooldown avoids accidental bursts against public providers.
            setTimeout(() => { button.disabled = false; }, 10000);
        }
    });
}

if (typeof module !== 'undefined') module.exports = { units, providers };
