const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = 'TU_ID_DE_CANAL_AQUI'; // ID del canal de fichajes

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Definición del comando /fichar
const commands = [
    new SlashCommandBuilder()
        .setName('fichar')
        .setDescription('Enviar una oferta de contrato a un jugador')
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

// Registrar comando /fichar en Discord
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

// Manejador del comando
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'fichar') {
        const player = interaction.options.getUser('jugador');
        const teamRole = interaction.options.getRole('equipo');
        const rosterCount = interaction.options.getString('plantilla') || 'N/A';
        const manager = interaction.user;

        // Crear el botón de aceptación
        const acceptButton = new ButtonBuilder()
            .setCustomId('accept_offer')
            .setLabel('Aceptar Contrato')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(acceptButton);

        // Embed de la oferta pendiente
        const offerEmbed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setAuthor({ name: 'LaLiga Fichajes • Oferta Recibida' })
            .setTitle(`Oferta de Contrato: ${teamRole.name}`)
            .setDescription(`<@${player.id}>, has recibido una oferta formal para unirte a ⚽ <@&${teamRole.id}>.`)
            .addFields(
                { name: '💼 Publicado Por', value: `<@${manager.id}>`, inline: true },
                { name: '📊 Roster', value: rosterCount, inline: true }
            )
            .setFooter({ text: 'Haz clic en el botón de abajo para firmar el contrato.' });

        // Enviar mensaje con el botón al canal
        const response = await interaction.reply({
            content: `📩 <@${player.id}>, tienes una propuesta de fichaje.`,
            embeds: [offerEmbed],
            components: [row],
            fetchReply: true
        });

        // Colector para escuchar el clic del botón (Tiempo límite: 24 horas)
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 86400000 });

        collector.on('collect', async buttonInteraction => {
            // Validar que solo el jugador mencionado pueda presionar el botón
            if (buttonInteraction.user.id !== player.id) {
                return buttonInteraction.reply({ 
                    content: '❌ Esta oferta no es para ti.', 
                    ephemeral: true 
                });
            }

            // Embed de contrato aceptado
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

            // Desactivar el botón y actualizar el mensaje
            acceptButton.setDisabled(true).setLabel('Contrato Firmado');
            const disabledRow = new ActionRowBuilder().addComponents(acceptButton);

            await buttonInteraction.update({
                content: '✅ **¡Fichaje Confirmado!**',
                embeds: [acceptedEmbed],
                components: [disabledRow]
            });

            collector.stop();
        });
    }
});

client.login(BOT_TOKEN);