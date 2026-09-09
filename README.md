# WOW

## This is the website

## Pull requests are welcome

## Development fund

The home and mining pages link to `donations.html`, which holds the public fund
addresses and a browser-based BTC, ETH and SOL monitor. No build step is required.
Balances load only when requested. Provider failures show as unavailable, never zero.
WOW and XMR monitoring is not yet connected; wallet keys must never enter this repository.

Run `node --test js/donations.test.cjs` and `git diff --check` before publishing changes
to this feature. Preview with a local static HTTP server and check a narrow viewport.

Provider contracts: [mempool.space](https://mempool.space/docs/api/rest),
[Blockscout](https://docs.blockscout.com/devs/apis/rpc/account),
[Solana balance](https://solana.com/docs/rpc/http/getbalance), and
[Solana activity](https://solana.com/docs/rpc/http/getsignaturesforaddress).
Solana requests use the browser-accessible [PublicNode endpoint](https://solana.publicnode.com/).
