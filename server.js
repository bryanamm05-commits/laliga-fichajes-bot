const express = require('express');
const Database = require('better-sqlite3');
const { sendTransaction } = require('./bot');

const db = new Database('liga.db');
const app = express();

app.use(express.json());
app.use(express.static('public'));

db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_name TEXT UNIQUE,
        role_id TEXT,
        manager_id TEXT,
        logo_url TEXT,
        roster_count INTEGER DEFAULT 0
    )
`);

app.post('/api/teams/update', (req, res) => {
    const { teamName, roleId, managerId, logoUrl, rosterCount } = req.body;
    
    const stmt = db.prepare(`
        INSERT INTO teams (team_name, role_id, manager_id, logo_url, roster_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(team_name) DO UPDATE SET
            role_id = excluded.role_id,
            manager_id = excluded.manager_id,
            logo_url = excluded.logo_url,
            roster_count = excluded.roster_count
    `);
    
    stmt.run(teamName, roleId, managerId, logoUrl, parseInt(rosterCount));
    res.json({ success: true, message: 'Roster guardado/actualizado correctamente' });
});

app.post('/api/transaction', async (req, res) => {
    const { actionType, payload } = req.body;
    
    let team = db.prepare('SELECT * FROM teams WHERE team_name = ?').get(payload.teamName);
    
    if (!team) {
        return res.status(404).json({ success: false, error: 'El equipo no está registrado en la base de datos.' });
    }

    let currentRoster = team.roster_count;

    if (actionType === 'sign') {
        currentRoster += 1;
    } else if (actionType === 'release' || actionType === 'demand') {
        currentRoster = Math.max(0, currentRoster - 1);
    }

    db.prepare('UPDATE teams SET roster_count = ? WHERE id = ?').run(currentRoster, team.id);

    const finalPayload = {
        ...payload,
        teamRoleId: team.role_id,
        managerId: team.manager_id,
        teamLogoUrl: team.logo_url,
        rosterCount: currentRoster
    };

    try {
        await sendTransaction(actionType, finalPayload);
        res.status(200).json({ success: true, updatedRoster: currentRoster });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Panel Web ejecutándose en el puerto ${PORT}`));