const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = 'TU_ID_DE_CANAL_AQUI'; // Cambia por la ID real del canal de fichajes

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Definición del comando /fichar
const commands = [
    new SlashCommandBuilder()
        .setName('fichar')
        .setDescription('Publicar un nuevo fichaje de equipo')
        .addUserOption(option => 
            option.setName('jugador')
                  .setDescription('El usuario de Discord a fichar')
                  .setRequired(true))
        .addRoleOption(option => 
            option.setName('equipo')
                  .setDescription('El rol del equipo al que se une')
                  .setRequired(true))
        .addStringOption(option => 
            option.setName('plantilla')
                  .setDescription('Número de jugadores en plantilla (Ejemplo: 15/20)')
                  .setRequired(false))
].map(command => command.toJSON());

// Registrar comandos en Discord al iniciar
client.once('ready', async () => {
    console.log(`✅ Bot conectado correctamente como ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        console.log('Registrando comandos / de Discord...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Comando /fichar registrado globalmente.');
    } catch (error) {
        console.error('Error al registrar comandos:', error);
    }
});

// Manejo de la interacción del comando /fichar
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'fichar') {
        const player = interaction.options.getUser('jugador');
        const teamRole = interaction.options.getRole('equipo');
        const rosterCount = interaction.options.getString('plantilla') || 'N/A';
        const executor = interaction.user;

        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setAuthor({ name: 'LaLiga Fichajes' })
            .setTitle(`Contract Accepted - ${teamRole.name}`)
            .setDescription(`<@${player.id}> has accepted an offer to join ⚽ <@&${teamRole.id}>.`)
            .addFields(
                { name: '📊 Roster', value: rosterCount, inline: true },
                { name: '💼 Publicado Por', value: `<@${executor.id}>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'LaLiga Fichajes • Transactions' });

        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (channel) {
                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: '✅ Fichaje publicado con éxito.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Error: Canal de fichajes no encontrado.', ephemeral: true });
            }
        } catch (error) {
            console.error('Error enviando la transacción:', error);
            await interaction.reply({ content: '❌ Hubo un error al publicar el fichaje.', ephemeral: true });
        }
    }
});

client.login(BOT_TOKEN);