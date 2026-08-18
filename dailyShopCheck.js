import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { loadConfig } from "./misc/config.js";
import { fetch, fetchRiotVersionData } from "./misc/util.js";
import { fetchData, getSkin } from "./valorant/cache.js";
import { redeemUsernamePassword, redeemCookies, getUser } from "./valorant/auth.js";
import { getOffers } from "./valorant/shop.js";

// Global timeout guard (5 minutes)
const TIMEOUT_MS = 5 * 60 * 1000;
const timeoutTimer = setTimeout(() => {
    console.error("[ERROR] Daily shop check timed out after 5 minutes!");
    process.exit(1);
}, TIMEOUT_MS);
timeoutTimer.unref();

const isDryRun = process.argv.includes("--dry-run");

// Parse optional --account <1|2|3> argument
const getAccountArgument = () => {
    const accIndex = process.argv.indexOf("--account");
    if (accIndex !== -1 && process.argv[accIndex + 1]) {
        const num = parseInt(process.argv[accIndex + 1], 10);
        if (!isNaN(num) && num >= 1 && num <= 3) return num;
    }
    return null;
};

const specificAccountNum = getAccountArgument();

function sanitizeErrorMessage(err) {
    if (!err) return "Unknown error";
    const msg = (typeof err === "string" ? err : err.message || "").toString();
    if (msg.includes("RSO token") || msg.includes("Cloudflare") || msg.includes("location") || msg.includes("auth")) {
        return "Authentication failed (cookies may be expired or invalid)";
    }
    if (msg.includes("Rate Limited") || msg.includes("rate limit")) {
        return "Rate limited by Riot servers";
    }
    if (msg.includes("Maintenance") || msg.includes("maintenance")) {
        return "VALORANT scheduled maintenance / downtime";
    }
    return msg || "Authentication / API error";
}

const RARITY_COLORS = {
    '0cebb8be-46d7-c12a-d306-e9907bfc5a25': 0x009984, // Select (Blue-green)
    'e046854e-406c-37f4-6607-19a9ba8426fc': 0xf99358, // Deluxe (Orange)
    '60bca009-4182-7998-dee7-b8a2558dc369': 0xd1538c, // Premium (Pink)
    '12683d76-48d7-84a3-4e09-6985794f0445': 0x5a9fe1, // Exclusive (Cyan)
    '411e4a55-4e59-7757-41f0-86a53f101bb5': 0xf9d563, // Ultra (Gold)
};

async function sendDirectMessage(botToken, userId, textContent, allEmbeds) {
    console.log(`[INFO] Connecting to Discord bot to deliver DM to user ${userId}...`);
    const tempClient = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
        partials: ["CHANNEL"]
    });

    await new Promise((resolve, reject) => {
        const loginTimer = setTimeout(() => reject(new Error("Discord client login timed out after 20 seconds")), 20000);
        tempClient.once("ready", () => {
            clearTimeout(loginTimer);
            console.log(`[INFO] Connected as ${tempClient.user.tag}`);
            resolve();
        });
        tempClient.login(botToken).catch(reject);
    });

    try {
        const targetUser = await tempClient.users.fetch(userId);
        if (!targetUser) throw new Error(`User with ID ${userId} could not be found`);

        try {
            // Discord limits messages to 10 embeds per payload
            const CHUNK_SIZE = 10;
            for (let i = 0; i < allEmbeds.length; i += CHUNK_SIZE) {
                const chunk = allEmbeds.slice(i, i + CHUNK_SIZE);
                await targetUser.send({
                    embeds: chunk
                });
            }
        } catch (embedErr) {
            console.warn(`[WARN] Failed to send embed, attempting plain text fallback...`);
            await targetUser.send({
                content: textContent
            });
        }
        console.log(`[INFO] ✅ Successfully sent daily shop DM to ${targetUser.tag}!`);
    } finally {
        await tempClient.destroy();
    }
}

async function runDailyShopCheck() {
    console.log("[INFO] Initializing SkinPeek Daily Shop Checker...");
    const config = loadConfig();

    // Fetch latest Riot client version headers & skin assets
    try {
        await fetchRiotVersionData();
        await fetchData();
        console.log("[INFO] Valorant skin database and version data loaded successfully.");
    } catch (err) {
        console.error("[ERROR] Failed to initialize Valorant metadata:", err.message || err);
    }

    const configuredAccounts = [
        {
            id: "daily_acc_1",
            label: "Account 1",
            index: 1,
            username: process.env.RIOT_ACCOUNT_1_USERNAME,
            password: process.env.RIOT_ACCOUNT_1_PASSWORD,
            cookies: process.env.RIOT_ACCOUNT_1_COOKIES,
        },
        {
            id: "daily_acc_2",
            label: "Account 2",
            index: 2,
            username: process.env.RIOT_ACCOUNT_2_USERNAME,
            password: process.env.RIOT_ACCOUNT_2_PASSWORD,
            cookies: process.env.RIOT_ACCOUNT_2_COOKIES,
        },
        {
            id: "daily_acc_3",
            label: "Account 3",
            index: 3,
            username: process.env.RIOT_ACCOUNT_3_USERNAME,
            password: process.env.RIOT_ACCOUNT_3_PASSWORD,
            cookies: process.env.RIOT_ACCOUNT_3_COOKIES,
        },
    ];

    let accountsToProcess = configuredAccounts;
    if (specificAccountNum !== null) {
        accountsToProcess = configuredAccounts.filter(a => a.index === specificAccountNum);
        console.log(`[INFO] Running check exclusively for Account ${specificAccountNum}`);
    }

    const results = [];
    let nextShopResetTimestamp = null;

    for (const acc of accountsToProcess) {
        const hasCookies = Boolean(acc.cookies && acc.cookies.trim());
        const hasUserPass = Boolean(acc.username && acc.password);

        if (!hasCookies && !hasUserPass) {
            console.log(`[INFO] No credentials configured for ${acc.label}. Skipping.`);
            continue;
        }

        console.log(`\n[INFO] ========================================`);
        console.log(`[INFO] Processing ${acc.label}...`);

        try {
            let authResult;
            if (hasCookies) {
                console.log(`[INFO] Authenticating ${acc.label} using saved cookies...`);
                authResult = await redeemCookies(acc.id, acc.cookies.trim());
            } else {
                console.log(`[INFO] Authenticating ${acc.label} using username/password...`);
                authResult = await redeemUsernamePassword(acc.id, acc.username.trim(), acc.password);
            }

            if (!authResult || !authResult.success) {
                const reason = authResult?.mfa 
                    ? `2FA Required (${authResult.method || "Email/App"})`
                    : (authResult?.rateLimit ? `Rate Limited (${authResult.rateLimit})` : "Authentication failed (cookies may be expired or invalid)");

                console.error(`[ERROR] ${acc.label} failed: ${reason}`);
                results.push({
                    account: acc,
                    success: false,
                    error: reason
                });
                continue;
            }

            const user = getUser(acc.id);
            const playerTag = user?.username || acc.username || acc.label;
            console.log(`[INFO] Logged in as ${playerTag}. Fetching daily shop...`);

            const shopResult = await getOffers(acc.id);
            if (!shopResult || !shopResult.success || !shopResult.offers) {
                const errReason = shopResult?.maintenance 
                    ? "VALORANT Scheduled Downtime / Maintenance" 
                    : "Failed to fetch store offers";

                console.error(`[ERROR] ${acc.label} store error: ${errReason}`);
                results.push({
                    account: acc,
                    username: playerTag,
                    success: false,
                    error: errReason
                });
                continue;
            }

            if (shopResult.expires && (!nextShopResetTimestamp || shopResult.expires < nextShopResetTimestamp)) {
                nextShopResetTimestamp = shopResult.expires;
            }

            const items = [];

            for (const offerUuid of shopResult.offers) {
                const skin = await getSkin(offerUuid, false);
                const skinName = (skin && (skin.names?.["en-US"] || skin.name)) || "Unknown Skin";

                // Resolve VP cost from direct store offer or skin cache
                const storeOffer = (shopResult.storeOffers || []).find(so => so.OfferID === offerUuid);
                const rawCost = storeOffer?.Cost?.[Object.keys(storeOffer.Cost)[0]] || skin?.price;
                const price = (typeof rawCost === "number") ? `${rawCost.toLocaleString()} VP` : "Price N/A";
                const icon = (skin && skin.icon) || null;
                const rarity = (skin && skin.rarity) || null;
                const color = RARITY_COLORS[rarity] || 0x5865F2;

                console.log(`[INFO] • ${skinName} — ${price}`);

                items.push({
                    uuid: offerUuid,
                    name: skinName,
                    price,
                    icon,
                    rarity,
                    color
                });
            }

            results.push({
                account: acc,
                username: playerTag,
                success: true,
                items
            });

        } catch (err) {
            const sanitized = sanitizeErrorMessage(err);
            console.error(`[ERROR] Exception processing ${acc.label}: ${sanitized}`);
            results.push({
                account: acc,
                success: false,
                error: sanitized
            });
        }
    }

    console.log(`\n[INFO] ========================================`);
    console.log(`[INFO] All accounts processed. Preparing single combined DM...`);

    const dateFormatted = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    const resetCountdownText = nextShopResetTimestamp
        ? `\n⏰ **Next shop reset:** <t:${nextShopResetTimestamp}:R> (<t:${nextShopResetTimestamp}:t>)`
        : `\n⏰ **Next shop reset:** ~24 hours`;

    // Format plain text fallback & clean DM layout
    let textReport = `🎮 **VALORANT Daily Shop**\n📅 *${dateFormatted}*\n\n`;

    if (results.length === 0) {
        textReport += `⚠️ *No accounts configured. Please check your environment variables or Render secrets.*`;
    } else {
        for (const r of results) {
            const accHeader = r.username ? `${r.account.label} (${r.username})` : r.account.label;
            textReport += `━━━━━━━━━━━━━━━━━━━━\n👤 **${accHeader}**\n━━━━━━━━━━━━━━━━━━━━\n\n`;

            if (!r.success) {
                textReport += `❌ *Error: ${r.error}*\n\n`;
            } else if (r.items.length === 0) {
                textReport += `*No items returned in daily store.*\n\n`;
            } else {
                for (const item of r.items) {
                    textReport += `• **${item.name}** — ${item.price}\n`;
                }
                textReport += `\n`;
            }
        }
        textReport += `${resetCountdownText}\n`;
    }

    // Determine embed status color
    const successCount = results.filter(r => r.success).length;
    let embedColor = 0x5865F2; // Default Blurple
    if (results.length > 0) {
        if (successCount === results.length) {
            embedColor = 0x57F287; // Discord Green
        } else if (successCount > 0) {
            embedColor = 0xFEE75C; // Discord Yellow (Partial)
        } else {
            embedColor = 0xED4245; // Discord Red (All failed)
        }
    }

    // Build rich Embed for modern Discord client display
    const embedFields = results.map(r => {
        const title = r.username ? `${r.account.label} (${r.username})` : r.account.label;
        if (!r.success) {
            return {
                name: `👤 ${title}`,
                value: `❌ *${r.error}*`,
                inline: false
            };
        }

        const lines = r.items.map(item => `• **${item.name}** — \`${item.price}\``);
        return {
            name: `👤 ${title}`,
            value: lines.join("\n") || "No items returned",
            inline: false
        };
    });

    const headerEmbed = {
        title: `🎮 VALORANT Daily Shop`,
        description: `📅 **${dateFormatted}**${resetCountdownText}\n\nHere is your daily shop report for all configured accounts:`,
        color: embedColor,
        fields: embedFields,
        timestamp: new Date().toISOString(),
        footer: {
            text: "SkinPeek Daily Checker • One-Shot Cron Job"
        }
    };

    // Build individual item embeds with weapon image thumbnails
    const skinEmbeds = [];
    for (const r of results) {
        if (!r.success || !r.items) continue;
        const accLabel = r.username ? `${r.account.label} (${r.username})` : r.account.label;
        for (const item of r.items) {
            skinEmbeds.push({
                title: item.name,
                description: `💰 **${item.price}** • *${accLabel}*`,
                color: item.color,
                thumbnail: item.icon ? { url: item.icon } : undefined,
                url: item.icon || undefined
            });
        }
    }

    const allEmbeds = [headerEmbed, ...skinEmbeds];

    const discordBotToken = process.env.DISCORD_BOT_TOKEN || config?.token;
    const discordUserId = process.env.DISCORD_USER_ID;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (isDryRun) {
        console.log(`[INFO] [DRY RUN] Generated Notification Text:\n`);
        console.log(textReport);
        console.log(`[INFO] [DRY RUN] Generated Embed Structure (Total: ${allEmbeds.length} embeds):`);
        console.log(JSON.stringify(allEmbeds, null, 2));
    } else if (discordBotToken && discordUserId) {
        try {
            await sendDirectMessage(discordBotToken, discordUserId, textReport, allEmbeds);
        } catch (dmErr) {
            console.error(`[ERROR] Failed to send Discord DM:`, dmErr.message || dmErr);
            // Fallback to webhook if configured
            if (discordWebhookUrl && discordWebhookUrl.startsWith("http")) {
                console.log(`[INFO] Attempting fallback delivery via DISCORD_WEBHOOK_URL...`);
                await fetch(discordWebhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "SkinPeek Daily", embeds: allEmbeds.slice(0, 10) })
                });
            }
        }
    } else if (discordWebhookUrl && discordWebhookUrl.startsWith("http")) {
        console.log(`[INFO] DISCORD_USER_ID not set; dispatching to DISCORD_WEBHOOK_URL...`);
        await fetch(discordWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "SkinPeek Daily", embeds: allEmbeds.slice(0, 10) })
        });
    } else {
        console.log(`[WARN] Neither (DISCORD_BOT_TOKEN + DISCORD_USER_ID) nor DISCORD_WEBHOOK_URL are configured.`);
        console.log(`[INFO] Message that would have been sent:\n\n${textReport}`);
    }

    console.log(`\n[INFO] Daily shop check finished. Exiting.`);

    if (results.length > 0 && successCount === 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runDailyShopCheck().catch(err => {
    console.error("[FATAL] Unhandled error during daily shop check:", err);
    process.exit(1);
});
