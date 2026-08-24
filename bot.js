const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1541580517605113987'; // Canal donde se anunciará el fichaje firmado

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message] // Permite al bot recibir interacciones en DM
});

const commands = [
    new SlashCommandBuilder()
        .setName('fichar')
        .setDescription('Enviar una oferta de contrato por DM a un jugador')
        .addUserOption(option => 
            option.setName('jugador')
                  .setDescription('El jugador al que le envías la oferta')
                  .setRequired(true))
        .addRoleOption(option => 
            option.setName('equipo')
                  .setDescription('Tu equipo (Rol de Discord)')
                  .setRequired(true))
        .addStringOption(option => 
            option.setName('plantilla')
                  .setDescription('Número de jugadores actual (Ejemplo: 15/20)')
                  .setRequired(false))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`✅ Bot conectado correctamente como ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Comando /fichar actualizado.');
    } catch (error) {
        console.error('Error registrando comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    // 1. Manejar comando /fichar
    if (interaction.isChatInputCommand() && interaction.commandName === 'fichar') {
        const player = interaction.options.getUser('jugador');
        const teamRole = interaction.options.getRole('equipo');
        const rosterCount = interaction.options.getString('plantilla') || 'N/A';
        const manager = interaction.user;

        // ID único codificado para la transacción
        const customButtonId = `dm_accept_${teamRole.id}_${manager.id}_${encodeURIComponent(rosterCount)}`;

        const acceptButton = new ButtonBuilder()
            .setCustomId(customButtonId)
            .setLabel('Aceptar Contrato')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(acceptButton);

        const dmEmbed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setAuthor({ name: 'LaLiga Fichajes • Oferta Recibida' })
            .setTitle(`Propuesta de Contrato: ${teamRole.name}`)
            .setDescription(`Hola <@${player.id}>, has recibido una propuesta formal para unirte a ⚽ **${teamRole.name}**.`)
            .addFields(
                { name: '💼 Manager / Sub DT', value: `<@${manager.id}>`, inline: true },
                { name: '📊 Roster Actual', value: rosterCount, inline: true }
            )
            .setFooter({ text: 'Presiona el botón para firmar el contrato.' });

        try {
            // Intentar enviar al DM
            await player.send({
                embeds: [dmEmbed],
                components: [row]
            });

            // Confirmación efímera en el servidor
            await interaction.reply({
                content: `📩 Oferta enviada por mensaje privado a <@${player.id}>.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error al enviar DM:', error);
            await interaction.reply({
                content: `❌ No se pudo enviar el mensaje privado a <@${player.id}>. El usuario debe activar "Permitir mensajes directos de miembros del servidor" en su Configuración de Privacidad.`,
                ephemeral: true
            });
        }
        return;
    }

    // 2. Manejar cuando el jugador presiona "Aceptar Contrato" desde su DM
    if (interaction.isButton() && interaction.customId.startsWith('dm_accept_')) {
        await interaction.deferUpdate(); // Evita el error "No ha respondido a tiempo"

        const parts = interaction.customId.split('_');
        const teamRoleId = parts[2];
        const managerId = parts[3];
        const rosterCount = decodeURIComponent(parts[4]);
        const player = interaction.user;

        const acceptedEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setAuthor({ name: 'LaLiga Fichajes • Fichaje Oficial' })
            .setTitle(`Contract Accepted - <@&${teamRoleId}>`)
            .setDescription(`<@${player.id}> has accepted an offer to join ⚽ <@&${teamRoleId}>.`)
            .addFields(
                { name: '📊 Roster', value: rosterCount, inline: true },
                { name: '💼 Manager', value: `<@${managerId}>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'LaLiga Fichajes • Transactions' });

        // Publicar el anuncio en el canal público oficial de fichajes
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (channel) {
                await channel.send({ embeds: [acceptedEmbed] });
            }
        } catch (err) {
            console.error('Error publicando en el canal público:', err);
        }

        // Desactivar el botón en el privado del jugador
        const disabledButton = new ButtonBuilder()
            .setCustomId('disabled_offer')
            .setLabel('Contrato Firmado')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

        await interaction.editReply({
            content: '✅ **¡Firma completada! Tu fichaje ha sido publicado oficialmente en el servidor.**',
            components: [disabledRow]
        });
    }
});

client.login(BOT_TOKEN);