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

// ⚠️ REEMPLAZA POR LA ID REAL DE TU CANAL DE FICHAJES Y DE TU SERVIDOR
const CHANNEL_ID = '1541580517605113987'; 
const GUILD_ID = '1541580517605113987'; 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // Requerido para modificar roles
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
    // 1. Comando /fichar
    if (interaction.isChatInputCommand() && interaction.commandName === 'fichar') {
        const player = interaction.options.getUser('jugador');
        const teamRole = interaction.options.getRole('equipo');
        const rosterCount = interaction.options.getString('plantilla') || 'N/A';
        const manager = interaction.user;

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
                content: `📩 Oferta enviada por mensaje privado a <@${player.id}>.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error enviando mensaje privado:', error);
            await interaction.reply({
                content: `❌ No se pudo enviar el DM a <@${player.id}>. Debe habilitar los mensajes directos del servidor.`,
                ephemeral: true
            });
        }
        return;
    }

    // 2. Clic en "Aceptar Contrato" (Asignación de rol + Publicación)
    if (interaction.isButton() && interaction.customId.startsWith('dm_accept_')) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const teamRoleId = parts[2];
        const managerId = parts[3];
        const rosterCount = decodeURIComponent(parts[4]);
        const player = interaction.user;

        let roleAssigned = false;

        // Intentar agregar el rol al miembro en el servidor
        try {
            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(player.id);
            if (guild && member) {
                await member.roles.add(teamRoleId);
                roleAssigned = true;
                console.log(`✅ Rol ${teamRoleId} asignado a ${player.tag}`);
            }
        } catch (roleError) {
            console.error('❌ Error asignando el rol al jugador:', roleError);
        }

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

        // Enviar anuncio al canal oficial
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (channel) {
                await channel.send({ embeds: [acceptedEmbed] });
            }
        } catch (channelErr) {
            console.error('❌ Error enviando mensaje al canal público:', channelErr);
        }

        // Desactivar botón en el DM
        const disabledButton = new ButtonBuilder()
            .setCustomId('disabled_offer')
            .setLabel('Contrato Firmado')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

        const statusMessage = roleAssigned 
            ? '✅ **¡Firma completada! Se te ha asignado el rol en el servidor y tu fichaje fue anunciado.**'
            : '⚠️ **Firma completada y anunciada, pero ocurrió un error con el rol. Verifica la jerarquía de roles de tu bot.**';

        await interaction.editReply({
            content: statusMessage,
            components: [disabledRow]
        });
    }
});

client.login(BOT_TOKEN);