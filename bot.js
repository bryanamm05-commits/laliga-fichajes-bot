const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Cambia esta línea para usar process.env:
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1541580517605113987'; // Mantén tu ID de canal aquí

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`✅ Bot conectado correctamente como ${client.user.tag}`);
});

async function sendTransaction(type, data) {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return console.error('Canal no encontrado');

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'LaLiga Fichajes' })
            .setThumbnail(data.teamLogoUrl || 'https://i.imgur.com/39A4xP9.png')
            .setTimestamp()
            .setFooter({ text: 'LaLiga Fichajes • Transactions' });

        if (type === 'sign') {
            embed.setColor('#2ECC71')
                 .setTitle(`Contract Accepted - ${data.teamName}`)
                 .setDescription(`<@${data.playerId}> has accepted an offer to join ⚽ <@&${data.teamRoleId}>.`)
                 .addFields(
                     { name: '📊 Roster', value: `${data.rosterCount}/20`, inline: true },
                     { name: '💼 Manager', value: `<@${data.managerId}>`, inline: true }
                 );
        } else if (type === 'release') {
            embed.setColor('#E74C3C')
                 .setTitle(`Player Released - ${data.teamName}`)
                 .setDescription(`<@${data.playerId}> has been released from ⚽ <@&${data.teamRoleId}>.`)
                 .addFields(
                     { name: '📊 Roster', value: `${data.rosterCount}/20`, inline: true },
                     { name: '💼 Manager', value: `<@${data.managerId}>`, inline: true },
                     { name: '👤 Released By', value: `<@${data.executorId}>`, inline: true }
                 );
        } else if (type === 'demand') {
            embed.setColor('#E74C3C')
                 .setTitle(`Player Demanded - ${data.teamName}`)
                 .setDescription(`<@${data.playerId}> has requested a demand from ⚽ <@&${data.teamRoleId}>.`)
                 .addFields(
                     { name: '📊 Roster', value: `${data.rosterCount}/20`, inline: true },
                     { name: '⚽ Team', value: `<@${data.teamRoleId}>`, inline: true }
                 );
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error enviando embed a Discord:', error);
    }
}

client.login(BOT_TOKEN);

module.exports = { sendTransaction };