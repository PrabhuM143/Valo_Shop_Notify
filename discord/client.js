import { Client, GatewayIntentBits } from "discord.js";

export const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildEmojisAndStickers],
    partials: ["CHANNEL"], // required to receive DMs
    //shards: "auto" // uncomment this to use internal sharding instead of sharding.js
});
