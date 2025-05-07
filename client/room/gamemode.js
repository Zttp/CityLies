import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Players, Teams, Damage, Ui, Properties, Spawns, Timers, Chat, LeaderBoard } from 'pixel_combats/room';

// Константы
const KINGDOMS = {
    RED: {
        name: "🔴 Красное Королевство",
        color: new Color(1, 0, 0, 0),
        spawnArea: new Vector3(-50, 10, 0)
    },
    BLUE: {
        name: "🔵 Синее Королевство",
        color: new Color(0, 0, 1, 0),
        spawnArea: new Vector3(50, 10, 0)
    }
};

const ROLES = {
    KING: { level: 3, name: "Король", hp: 200, color: new Color(1, 1, 0, 0) },
    NOBLE: { level: 2, name: "Дворянин", hp: 150, color: new Color(0.5, 0, 0.5, 0) },
    SOLDIER: { level: 1, name: "Солдат", hp: 100, color: null }
};

// Инициализация команд
const RedTeam = Teams.Add('RedKingdom', KINGDOMS.RED.name, KINGDOMS.RED.color);
const BlueTeam = Teams.Add('BlueKingdom', KINGDOMS.BLUE.name, KINGDOMS.BLUE.color);

// Состояние игры
const GameState = {
    kingdoms: {
        red: { king: null, nobles: [], members: [], peace: false, tax: 10 },
        blue: { king: null, nobles: [], members: [], peace: false, tax: 10 }
    },
    castleHealth: { red: 1000, blue: 1000 },
    lastAttackTime: { red: 0, blue: 0 }
};

// Система ресурсов
const Resources = {
    gold: {},
    addGold: function(playerId, amount) {
        if (!this.gold[playerId]) this.gold[playerId] = 0;
        this.gold[playerId] += amount;
        const player = Players.Get(playerId);
        if (player) player.Properties.Get('Gold').Value = this.gold[playerId];
        return this.gold[playerId];
    },
    getGold: function(playerId) {
        return this.gold[playerId] || 0;
    }
};

// Основные функции
function setRole(player, role) {
    player.Properties.Get('Role').Value = role.level;
    player.Properties.Get('RoleName').Value = role.name;
    player.contextedProperties.MaxHp.Value = role.hp;
    if (role.color) player.contextedProperties.SkinColor.Value = role.color;
}

function joinKingdom(player, kingdom) {
    const kData = GameState.kingdoms[kingdom];
    
    // Проверяем, не состоит ли уже игрок в другом королевстве
    for (const k in GameState.kingdoms) {
        if (GameState.kingdoms[k].members.includes(player.id)) {
            player.Ui.Hint.Value = `Вы уже в ${KINGDOMS[k.toUpperCase()].name}`;
            return false;
        }
    }
    
    kData.members.push(player.id);
    player.Properties.Get('Kingdom').Value = kingdom.toUpperCase();
    
    // Первый участник становится королем
    if (kData.members.length === 1) {
        kData.king = player.id;
        setRole(player, ROLES.KING);
        Chat.Broadcast(`👑 ${player.NickName} стал королем ${KINGDOMS[kingdom.toUpperCase()].name}!`);
    } else {
        setRole(player, ROLES.SOLDIER);
    }
    
    // Добавляем в команду и телепортируем
    const team = kingdom === 'red' ? RedTeam : BlueTeam;
    team.Add(player);
    player.Teleport(KINGDOMS[kingdom.toUpperCase()].spawnArea);
    
    // Выдаем стартовое золото
    Resources.addGold(player.id, 100);
    
    return true;
}

function leaveKingdom(player) {
    let foundKingdom = null;
    
    // Ищем королевство игрока
    for (const kingdom in GameState.kingdoms) {
        const index = GameState.kingdoms[kingdom].members.indexOf(player.id);
        if (index !== -1) {
            foundKingdom = kingdom;
            GameState.kingdoms[kingdom].members.splice(index, 1);
            
            // Удаляем из дворян
            const nobleIndex = GameState.kingdoms[kingdom].nobles.indexOf(player.id);
            if (nobleIndex !== -1) {
                GameState.kingdoms[kingdom].nobles.splice(nobleIndex, 1);
            }
            
            // Если это был король - выбираем нового
            if (GameState.kingdoms[kingdom].king === player.id) {
                if (GameState.kingdoms[kingdom].nobles.length > 0) {
                    GameState.kingdoms[kingdom].king = GameState.kingdoms[kingdom].nobles[0];
                    const newKing = Players.Get(GameState.kingdoms[kingdom].king);
                    if (newKing) {
                        setRole(newKing, ROLES.KING);
                        Chat.Broadcast(`👑 ${newKing.NickName} стал новым королем ${KINGDOMS[kingdom.toUpperCase()].name}!`);
                    }
                } else if (GameState.kingdoms[kingdom].members.length > 0) {
                    GameState.kingdoms[kingdom].king = GameState.kingdoms[kingdom].members[0];
                    const newKing = Players.Get(GameState.kingdoms[kingdom].king);
                    if (newKing) {
                        setRole(newKing, ROLES.KING);
                        Chat.Broadcast(`👑 ${newKing.NickName} стал новым королем ${KINGDOMS[kingdom.toUpperCase()].name}!`);
                    }
                } else {
                    GameState.kingdoms[kingdom].king = null;
                }
            }
            break;
        }
    }
    
    if (!foundKingdom) {
        player.Ui.Hint.Value = "Вы не в королевстве";
        return false;
    }
    
    // Удаляем из команды
    const team = foundKingdom === 'red' ? RedTeam : BlueTeam;
    team.Remove(player);
    
    // Сбрасываем роль
    player.Properties.Get('Role').Value = 0;
    player.Properties.Get('RoleName').Value = "";
    player.Properties.Get('Kingdom').Value = "";
    
    player.Ui.Hint.Value = `Вы покинули ${KINGDOMS[foundKingdom.toUpperCase()].name}`;
    return true;
}

// Обработчики событий
Players.OnPlayerConnected.Add(p => {
    p.Properties.Add('Gold', 0);
    p.Properties.Add('Role', 0);
    p.Properties.Add('RoleName', "");
    p.Properties.Add('Kingdom', "");
    p.Properties.Add('Kills', 0);
    p.Properties.Add('Deaths', 0);
    p.Ui.Hint.Value = 'Используйте /join red или /join blue';
});

Players.OnPlayerDisconnected.Add(p => {
    // При выходе сохранять данные не нужно - всё хранится в GameState
});

Teams.OnPlayerChangeTeam.Add(p => {
    p.Spawns.Spawn();
});

Damage.OnDeath.Add(p => {
    p.Spawns.Spawn();
    p.Properties.Get('Deaths').Value++;
    
    // Потеря золота при смерти
    const lostGold = Math.max(1, Math.floor(Resources.getGold(p.id) * 0.1));
    if (lostGold > 0) {
        Resources.addGold(p.id, -lostGold);
        p.Ui.Hint.Value = `Вы потеряли ${lostGold} золота`;
    }
});

Damage.OnKill.Add((killer, victim) => {
    if (killer.id === victim.id) return;
    
    killer.Properties.Get('Kills').Value++;
    
    // Награда за убийство
    let reward = 10;
    const victimRole = victim.Properties.Get('Role').Value;
    if (victimRole === ROLES.NOBLE.level) reward = 25;
    if (victimRole === ROLES.KING.level) reward = 100;
    
    Resources.addGold(killer.id, reward);
    killer.Ui.Hint.Value = `+${reward} золота за убийство`;
    
    // Особое сообщение за убийство короля
    if (victimRole === ROLES.KING.level) {
        Chat.Broadcast(`💀 Король ${victim.NickName} был убит игроком ${killer.NickName}!`);
    }
});

// Чат-команды
Chat.OnPlayerMessage.Add((p, msg) => {
    const args = msg.split(' ');
    const cmd = args[0].toLowerCase();

    try {
        switch(cmd) {
            case '/join':
                if (args.length < 2) throw "Укажите: /join red или /join blue";
                const kingdom = args[1].toLowerCase();
                if (kingdom !== 'red' && kingdom !== 'blue') throw "Неизвестное королевство";
                return joinKingdom(p, kingdom);
                
            case '/leave':
                return leaveKingdom(p);
                
            case '/kingdom':
                let kingdomInfo = "";
                for (const k in GameState.kingdoms) {
                    const kData = GameState.kingdoms[k];
                    kingdomInfo += `${KINGDOMS[k.toUpperCase()].name}\n`;
                    kingdomInfo += `👑 Король: ${kData.king ? Players.Get(kData.king)?.NickName || "Не в игре" : "Нет"}\n`;
                    kingdomInfo += `🎖️ Дворян: ${kData.nobles.length}\n`;
                    kingdomInfo += `⚔️ Игроков: ${kData.members.length}\n`;
                    kingdomInfo += `☮️ Мир: ${kData.peace ? "Да" : "Нет"}\n\n`;
                }
                p.Ui.Hint.Value = kingdomInfo;
                return false;
                
            default:
                return true; // Разрешить обычные сообщения
        }
    } catch (e) {
        p.Ui.Hint.Value = e;
        return false;
    }
});

// Таймер автоспавна
Timers.GetContext().Get('RespawnTimer').OnTimer.Add(t => {
    Players.All.forEach(p => {
        if (p.Properties.Health.Value <= 0) {
            p.Spawns.Spawn();
        }
    });
    t.RestartLoop(1);
}).RestartLoop(1);

// Настройки интерфейса
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader('Kills', 'Убийства', '⚔️'),
    new DisplayValueHeader('Deaths', 'Смерти', '💀'),
    new DisplayValueHeader('RoleName', 'Ранг', '🎖️'),
    new DisplayValueHeader('Kingdom', 'Королевство', '🏰')
];

Ui.GetContext().TeamProp1.Value = { Team: "RedKingdom", Prop: "Kills" };
Ui.GetContext().TeamProp2.Value = { Team: "BlueKingdom", Prop: "Kills" };
