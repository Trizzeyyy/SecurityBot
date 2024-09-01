//
//Coded by Trizzey (Discord: .trizzey)
//

const { Client, MessageEmbed, MessageButton, MessageActionRow, MessageAttachment, DiscordAPIError } = require("discord.js");
const config = require("./config");
const { Captcha } = require("captcha-canvas");

const rateLimit = {
    lastRequest: 0,
    timeout: 5000 // Zeit in ms, um die nächste Anfrage zu ermöglichen
};

async function makeRequest(func, interaction) {
    const now = Date.now();
    if (now - rateLimit.lastRequest < rateLimit.timeout) {
        const waitTime = rateLimit.timeout - (now - rateLimit.lastRequest);
        console.log(`Rate limit hit. Waiting for ${waitTime} ms`);
        try {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            await func(); // Versuche es erneut nach der Wartezeit
        } catch (error) {
            console.error('Error making API request:', error);
            if (interaction) {
                await interaction.reply({
                    content: 'Due to high server load, your request is being delayed. Please try again later.',
                    ephemeral: true
                });
            }
        }
    } else {
        rateLimit.lastRequest = Date.now();
        try {
            await func(); // Führe die API-Anfrage aus
        } catch (error) {
            console.error('Error making API request:', error);
            if (interaction) {
                await interaction.reply({
                    content: 'An unexpected error occurred. Please try again later.',
                    ephemeral: true
                });
            }
        }
    }
}

module.exports = async (client) => {
    client.once("ready", () => {
        console.log(`Bot is ready as ${client.user.tag}`);
    });

    client.on("interactionCreate", async (interaction) => {
        if (interaction.isCommand()) {
            switch (interaction.commandName) {
                case "ping":
                    return interaction.reply({
                        content: `Pong :: ${client.ws.ping}ms`,
                        ephemeral: true
                    });

                case "setup":
                    if (!interaction.member.permissions.has("MANAGE_ROLES")) {
                        return interaction.reply({
                            content: "You don't have permissions to run this command.",
                            ephemeral: true
                        });
                    }

                    const verifyChannel = interaction.guild.channels.cache.get(config.verifyChannel);
                    const verifyRole = interaction.guild.roles.cache.get(config.verifyRole);

                    if (!verifyChannel || !verifyRole) {
                        return interaction.reply({
                            content: "Verify channel or verify role is not found. Please check the configuration.",
                            ephemeral: true
                        });
                    }

                    const messages = await verifyChannel.messages.fetch({ limit: 100 });
                    const existingSetup = messages.find(msg => msg.embeds[0] && msg.embeds[0].title === `Verification System of ${interaction.guild.name}`);

                    if (existingSetup) {
                        return interaction.reply({
                            content: "The verification system has already been set up in this channel.",
                            ephemeral: true
                        });
                    }

                    const embed = new MessageEmbed()
                        .setColor("#ffee00")
                        .setTitle(`Verification System of ${interaction.guild.name}`)
                        .setDescription("**Click the button below to verify yourself through a captcha and gain the Role <@&1278943711681576990> to access the full server! Make sure you're enabled Direct Messages from others and server members!**")
                        .setFooter({ text: 'The Lux Club Security System' });

                    const btnrow = new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("v_verify")
                            .setLabel("Verify")
                            .setStyle("SUCCESS")
                            .setEmoji("📑")
                    );

                    await makeRequest(async () => {
                        await verifyChannel.send({
                            embeds: [embed],
                            components: [btnrow]
                        });
                    }, interaction);

                    return interaction.reply({
                        content: `Verification system set up in ${verifyChannel}. Verify role is ${verifyRole}.`,
                        ephemeral: true
                    });

                default:
                    await interaction.reply({
                        content: `The command ${interaction.commandName} is not valid.`,
                        ephemeral: true
                    });
                    break;
            }
        }

        if (interaction.isButton() && interaction.customId === "v_verify") {
            const verifyRole = interaction.guild.roles.cache.get(config.verifyRole);

            if (!verifyRole) {
                return interaction.reply({
                    content: "Verification role not found. Please contact an administrator.",
                    ephemeral: true
                });
            }

            if (interaction.member.roles.cache.has(verifyRole.id)) {
                return interaction.reply({
                    content: "You are already verified.",
                    ephemeral: true
                });
            }

            if (!interaction.guild.members.me.permissions.has("MANAGE_ROLES")) {
                return interaction.reply({
                    content: "I don't have permission to manage roles.",
                    ephemeral: true
                });
            }

            const captcha = new Captcha();
            captcha.async = true;
            captcha.addDecoy();
            captcha.drawTrace();
            captcha.drawCaptcha();
            const captchaImage = new MessageAttachment(await captcha.png, "captcha.png");

            try {
                const dmChannel = await interaction.user.createDM();
                const cmsg = await dmChannel.send({
                    embeds: [
                        new MessageEmbed()
                            .setColor("#ffee00")
                            .setTitle("Captcha Verification")
                            .setImage('attachment://captcha.png')
                            .setTimestamp()
                            .setFooter({ text: 'The Lux Club Security System' })
                    ],
                    files: [captchaImage]
                });

                await interaction.reply({
                    content: "Check your DMs for the captcha.",
                    ephemeral: true
                });

                const filter = m => m.author.id === interaction.user.id;
                const collected = await dmChannel.awaitMessages({
                    filter,
                    max: 1,
                    time: 20000,
                    errors: ['time']
                });

                if (collected.first().content.trim().toLowerCase() === captcha.text.trim().toLowerCase()) {
                    try {
                        await interaction.member.roles.add(verifyRole);
                        await interaction.user.send({
                            content: "You are now verified and have been granted the role! 🎉"
                        });
                    } catch (error) {
                        if (error instanceof DiscordAPIError && error.code === 50013) {
                            console.log('Verification failed because of a permissions error.');
                            await interaction.user.send({
                                content: "Verification failed due to insufficient permissions. Please contact a server admin."
                            });
                        } else {
                            console.error('Unexpected error in verification:', error);
                            await interaction.user.send({
                                content: "An unexpected error occurred. Please try again later."
                            });
                        }
                    }
                } else {
                    await interaction.user.send({
                        content: "Incorrect captcha. Please try again."
                    });
                }
            } catch (error) {
                console.error('Error in captcha verification:', error);
                let errorMessage = 'An unexpected error occurred. Please try again later.';
                if (error.message) {
                    if (error.message.includes('Cannot send messages to this user')) {
                        errorMessage = "I couldn't send you a DM. Please check your privacy settings.";
                    } else if (error.message.includes('Missing Access')) {
                        errorMessage = "I don't have permission to send you a DM.";
                    }
                }
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: errorMessage,
                        ephemeral: true
                    });
                }
                if (error instanceof DiscordAPIError && error.code === 50013) {
                    // Handle the permissions error specifically in the catch block above
                } else {
                    await interaction.user.send({
                        content: errorMessage
                    });
                }
            }
        }
    });
};

//
//Coded by Trizzey (Discord: .trizzey)
//