# 🎮 SkinPeek — VALORANT Daily Shop & DM Automation

[![Node.js](https://img.shields.io/badge/Node.js-v16.6+-green.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14.11-blue.svg)](https://discord.js.org/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-yellow.svg)](LICENSE)

An automated tool & Discord bot to fetch your **VALORANT Daily Shop**, extract weapon skins, prices, and high-resolution skin preview images, and automatically DM them to your personal Discord account every day using scheduled one-shot jobs (e.g., **Render Cron Jobs**).

---

## 🌟 Key Features

### 📬 Automated Daily Shop DM (One-Shot Cron)
- **Multi-Account Support**: Automatically check and fetch daily shops for up to **3 Riot/VALORANT accounts** in a single execution.
- **Rich Visual Cards**: Direct weapon render images from the official Valorant CDN, color-coded by rarity tier (*Select, Deluxe, Premium, Exclusive, Ultra*).
- **Direct DM Delivery**: Sends a combined daily shop digest directly to your personal Discord account via DM.
- **Serverless / Cron Ready**: Designed for one-shot execution (`dailyShopCheck.js`) on platforms like **Render**, **GitHub Actions**, or local schedulers—no 24/7 server needed.
- **Riot Cookie Authentication**: Uses persistent Riot cookies for reliable headless authentication without triggering CAPTCHA blocks.
- **Reset Countdown**: Live relative countdown (`<t:timestamp:R>`) indicating when the daily shop resets.
- **Isolated & Fault-Tolerant**: An authentication error on one account will not interrupt shop retrieval for remaining accounts.

### 🤖 Classic SkinPeek Discord Bot Features
- Interactive slash commands (`/shop`, `/balance`, `/bundles`, `/nightmarket`).
- Wishlist skin alerts to notify you when specific skins appear.
- Multi-account switcher and server deployment options.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v16.6 or higher
- A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- Your personal Discord User ID

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/PrabhuM143/skinpeek_valorant.git
cd skinpeek_valorant
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_USER_ID=your_discord_user_id_here

# Riot Account Cookies (obtain from Valorant web login session)
RIOT_ACCOUNT_1_COOKIES=your_account_1_cookies_here
RIOT_ACCOUNT_2_COOKIES=your_account_2_cookies_here
RIOT_ACCOUNT_3_COOKIES=your_account_3_cookies_here
```

> ⚠️ **Security Notice**: Never share or commit your `.env` or `config.json` file. All sensitive credentials are included in `.gitignore`.

---

## 🛠️ Usage

### Running Daily Shop Automation

- **Perform Live Daily Shop Check & Send DM**:
  ```bash
  node dailyShopCheck.js
  ```

- **Dry-Run Mode (Preview output without sending Discord DM)**:
  ```bash
  node dailyShopCheck.js --dry-run
  ```

- **Test a Specific Account**:
  ```bash
  node dailyShopCheck.js --account 1
  node dailyShopCheck.js --account 2
  node dailyShopCheck.js --account 3
  ```

### Running the Interactive 24/7 Bot (Optional)

If you want the persistent slash-command Discord bot running on a server:

```bash
node SkinPeek.js
```

---

## ☁️ Deployment (Render Cron Job)

This repository includes a [`render.yaml`](render.yaml) blueprint for deploying as a **Render Cron Job** running once per day:

1. Connect your repository on [Render Dashboard](https://dashboard.render.com/).
2. Create a new **Cron Job** using this repository.
3. Configure the settings:
   - **Command**: `node dailyShopCheck.js`
   - **Schedule**: `30 18 * * *` *(18:30 UTC = 00:00 IST / Daily Shop Reset)*
4. Set the Environment Variables under **Environment**:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_USER_ID`
   - `RIOT_ACCOUNT_1_COOKIES`
   - `RIOT_ACCOUNT_2_COOKIES` (optional)
   - `RIOT_ACCOUNT_3_COOKIES` (optional)

---

## 📋 Example DM Output

```text
🎮 VALORANT Daily Shop
📅 August 18, 2026
⏰ Next shop reset: in 12 hours (12:00 AM)

━━━━━━━━━━━━━━━━━━━━
👤 Account 1 (Ironfist#Dead)
━━━━━━━━━━━━━━━━━━━━
• ORA by OneTap Phantom — 2,475 VP
• Kuronami Spectre — 2,375 VP
• Mystbloom Ghost — 2,175 VP
• Bolt Knife — 4,350 VP
```

*Accompanied by individual rich embeds displaying transparent weapon renders and rarity badges.*

---

## 🔒 Cookie Retrieval Guide

To extract your Riot cookies:
1. Log into [playvalorant.com](https://playvalorant.com).
2. Open Developer Tools (`F12` or `Ctrl+Shift+I`) -> **Application / Storage** -> **Cookies** -> `https://playvalorant.com` and `https://auth.riotgames.com`.
3. Copy all cookie key-value pairs (formatted as `cookie1=val1; cookie2=val2; ...`).

---

## 📜 License & Acknowledgements

- Original SkinPeek project by [giorgi-o](https://github.com/giorgi-o/SkinPeek).
- Skin names & weapon assets provided by [Valorant-API](https://valorant-api.com/).
- Licensed under [GNU General Public License v3.0](LICENSE).
