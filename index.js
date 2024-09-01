//
//Coded by Trizzey (Discord: .trizzey)
//

const { Client, Intents } = require("discord.js");
const { token, guildId } = require("./config");

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES,
  ],
  partials: ['CHANNEL'], // Required for DMs to work
});

client.on("ready", async () => {
  console.log(`${client.user.tag} is Online !!`);

  let guild = client.guilds.cache.get(guildId);
  if (guild) {
    guild.commands.set([
      {
        name: "ping",
        description: `Check ping of bot`,
        type: "CHAT_INPUT",
      },
      {
        name: "setup",
        description: `Setup the verification system`,
        type: "CHAT_INPUT",
      },
    ]);
  }
  // Loading
  require("./verify")(client);
});

client.login(token);

//
//Coded by Trizzey (Discord: .trizzey)
//