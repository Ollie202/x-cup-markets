# Xsporty

A sports prediction market built on Arc testnet.

Live at **[xsporty.xyz](https://xsporty.xyz)**.

## What it is

Xsporty lets you stake on real sports outcomes. Markets are USDC-denominated, positions live in your own wallet, and trades settle on Arc testnet. No bookmaker, no custodian, no waiting around for a payout.

## The assistant

Most prediction sites make you dig through tabs to figure out what to bet on. Xsporty has a built-in assistant you can just talk to. Ask it stuff like:

* "What are the odds on Argentina vs Brazil tonight?"
* "Give me a breakdown of the Lakers game, who's the smart pick?"
* "Put 20 USDC on Real Madrid to win."

It answers questions, pulls insight across markets, compares prices, and can load a ready-to-confirm ticket for you. You still sign every trade yourself.

## The Telegram bot

For World Cup matches you don't even need the site open. The Xsporty Telegram bot lets you browse markets, check your portfolio, and place predictions right inside the chat. Same wallet, same settlement, just a faster surface for match day.

## Why Arc testnet

Cheap fees, fast confirmations, USDC-native, and the order book is on-chain via a CLOB exchange. Everything that matters is verifiable, nothing about your money is sitting on our server.

## Status

* Frontend live on xsporty.xyz
* Telegram bot live for World Cup markets
* Running on Arc testnet

## Repo

This repository holds the frontend. The on-site assistant lives in [`Xsporty_Assistant/`](./Xsporty_Assistant).

```bash
npm install
npm run dev
```

## License

Private, all rights reserved.
