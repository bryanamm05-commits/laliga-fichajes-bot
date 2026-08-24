const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = 'TU_ID_DE_CANAL_AQUI'; // Canal público donde se anunciará el fichaje final

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ] 
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
    console.log(`✅ Bot conectado como ${client.user.tag}`);
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
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'fichar') {
        const player = interaction.options.getUser('jugador');
        const teamRole = interaction.options.getRole('equipo');
        const rosterCount = interaction.options.getString('plantilla') || 'N/A';
        const manager = interaction.user;

        // Crear botón de aceptación para el DM
        const acceptButton = new ButtonBuilder()
            .setCustomId('accept_offer')
            .setLabel('Aceptar Contrato')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(acceptButton);

        // Embed privado para el jugador
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
            // Intentar enviar DM al jugador
            const dmMessage = await player.send({
                embeds: [dmEmbed],
                components: [row]
            });

            // Confirmar al Manager que la oferta fue enviada por DM
            await interaction.reply({
                content: `📩 Oferta enviada con éxito por privado a <@${player.id}>. Esperando su respuesta.`,
                ephemeral: true
            });

            // Escuchar la respuesta del botón en el DM (Tiempo límite: 24 horas)
            const collector = dmMessage.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 86400000 
            });

            collector.on('collect', async buttonInteraction => {
                // Embed oficial para el canal público de fichajes
                const acceptedEmbed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setAuthor({ name: 'LaLiga Fichajes • Fichaje Oficial' })
                    .setTitle(`Contract Accepted - ${teamRole.name}`)
                    .setDescription(`<@${player.id}> has accepted an offer to join ⚽ <@&${teamRole.id}>.`)
                    .addFields(
                        { name: '📊 Roster', value: rosterCount, inline: true },
                        { name: '💼 Manager', value: `<@${manager.id}>`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'LaLiga Fichajes • Transactions' });

                // Publicar en el canal oficial de fichajes
                const announceChannel = await client.channels.fetch(CHANNEL_ID);
                if (announceChannel) {
                    await announceChannel.send({ embeds: [acceptedEmbed] });
                }

                // Desactivar el botón en el DM del jugador
                acceptButton.setDisabled(true).setLabel('Contrato Firmado');
                const disabledRow = new ActionRowBuilder().addComponents(acceptButton);

                await buttonInteraction.update({
                    content: '✅ **¡Has aceptado el contrato! Tu fichaje ha sido anunciado públicamente.**',
                    components: [disabledRow]
                });

                collector.stop();
            });

        } catch (error) {
            console.error('Error al enviar DM:', error);
            await interaction.reply({
                content: `❌ No se pudo enviar el mensaje privado a <@${player.id}>. Es posible que tenga los DMs bloqueados.`,
                ephemeral: true
            });
        }
    }
});

client.login(BOT_TOKEN);