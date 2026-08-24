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

// ⚠️ REEMPLAZA ESTAS CONSTANTES CON LAS IDS REALES (Solo números entre comillas)
const CHANNEL_ID = '1541580517605113987'; // ID del canal público donde se anuncian los fichajes
const GUILD_ID = '1480693598969397251';   // ID de tu servidor de Discord

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // Requerido para otorgar roles
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Definición del comando /fichar
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

// Inicialización del Bot y registro de Slash Commands
client.once('ready', async () => {
    console.log(`✅ Bot conectado correctamente como ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Comando /fichar registrado exitosamente.');
    } catch (error) {
        console.error('Error al registrar comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    // 1. Manejar la ejecución del comando /fichar
    if (interaction.isChatInputCommand() && interaction.commandName === 'fichar') {
        const player = interaction.options.getUser('jugador');
        const teamRole = interaction.options.getRole('equipo');
        const rosterCount = interaction.options.getString('plantilla') || 'N/A';
        const manager = interaction.user;

        // Custom ID para almacenar la metadata de la propuesta
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
            .setDescription(`Hola <@${player.id}>, el club **${teamRole.name}** te ha enviado una oferta formal para unirte a su plantilla.`)
            .addFields(
                { name: '💼 Manager / Sub DT', value: `<@${manager.id}>`, inline: true },
                { name: '📊 Roster Actual', value: rosterCount, inline: true }
            )
            .setFooter({ text: 'Presiona el botón para firmar el contrato.' });

        try {
            await player.send({
                embeds: [dmEmbed],
                components: [row]
            });

            await interaction.reply({
                content: `📩 Oferta enviada con éxito por mensaje privado a <@${player.id}>.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error enviando mensaje privado:', error);
            await interaction.reply({
                content: `❌ No se pudo enviar el mensaje a <@${player.id}>. El jugador debe habilitar los mensajes directos en los ajustes del servidor.`,
                ephemeral: true
            });
        }
        return;
    }

    // 2. Manejar la respuesta al presionar "Aceptar Contrato" en el DM
    if (interaction.isButton() && interaction.customId.startsWith('dm_accept_')) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const teamRoleId = parts[2];
        const managerId = parts[3];
        const rosterCount = decodeURIComponent(parts[4]);
        const player = interaction.user;

        let roleAssigned = false;
        let errorMessage = '';

        // Intentar otorgar el rol al miembro dentro del servidor
        try {
            console.log(`🔍 Obteniendo servidor GUILD_ID: ${GUILD_ID}`);
            const guild = await client.guilds.fetch(GUILD_ID);

            console.log(`🔍 Obteniendo miembro ID: ${player.id}`);
            const member = await guild.members.fetch(player.id);

            console.log(`🔍 Intentando asignar rol ID: ${teamRoleId}`);
            await member.roles.add(teamRoleId);
            
            roleAssigned = true;
            console.log(`✅ ¡Rol asignado exitosamente a ${player.tag}!`);
        } catch (error) {
            errorMessage = error.message;
            console.error('❌ Error al asignar el rol:', error);
        }

        // Embed de confirmación para el canal público
        const acceptedEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setAuthor({ name: 'LaLiga Fichajes • Fichaje Oficial' })
            .setTitle(`Contract Accepted`)
            .setDescription(`<@${player.id}> has accepted an offer to join ⚽ <@&${teamRoleId}>.`)
            .addFields(
                { name: '📊 Roster', value: rosterCount, inline: true },
                { name: '💼 Manager', value: `<@${managerId}>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'LaLiga Fichajes • Transactions' });

        // Intentar publicar en el canal oficial
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (channel) {
                await channel.send({ embeds: [acceptedEmbed] });
                console.log('✅ Anuncio enviado al canal público.');
            }
        } catch (channelErr) {
            console.error('❌ Error enviando mensaje al canal público:', channelErr);
        }

        // Desactivar el botón en el mensaje privado
        const disabledButton = new ButtonBuilder()
            .setCustomId('disabled_offer')
            .setLabel('Contrato Firmado')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

        const statusResponse = roleAssigned 
            ? '✅ **¡Firma completada! Se te asignó el rol en el servidor y tu fichaje fue publicado.**'
            : `⚠️ **Contrato firmado y anunciado, pero falló la asignación del rol.**\n*Motivo:* \`${errorMessage}\``;

        await interaction.editReply({
            content: statusResponse,
            components: [disabledRow]
        });
    }
});

client.login(BOT_TOKEN);