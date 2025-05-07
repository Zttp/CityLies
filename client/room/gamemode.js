import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Players, Teams, Damage, Ui, Properties, Spawns, Timers, Chat, LeaderBoard } from 'pixel_combats/room';

// Константы
const KINGDOMS = {
    RED: {
        name: "🔴 Красное Королевство",
        color: new Color(1, 0, 0, 0),
        spawnArea: new Vector3(-50, 0, 0)
    },
    BLUE: {
        name: "🔵 Синее Королевство",
        color: new Color(0, 0, 1, 0),
        spawnArea: new Vector3(50, 0, 0)
    }
};

const ROLES = {
    KING: { level: 3, name: "Король", hp: 200, color: new Color(1, 1, 0, 0) },
    NOBLE: { level: 2, name: "Дворянин", hp: 150, color: new Color(0.5, 0, 0.5, 0) },
    SOLDIER: { level: 1, name: "Солдат", hp: 100, color: null }
};

// Состояние игры
const GameState = {
    kingdoms: {
        red: { king: null, nobles: [], members: [], peace: false, tax: 0 },
        blue: { king: null, nobles: [], members: [], peace: false, tax: 0 }
    },
    playerRoles: {},
    playerKingdoms: {},
    castleHealth: { red: 1000, blue: 1000 },
    lastAttackTime: { red: 0, blue: 0 }
};

// Инициализация команд
Teams.Add('RedKingdom', KINGDOMS.RED.name, KINGDOMS.RED.color);
Teams.Add('BlueKingdom', KINGDOMS.BLUE.name, KINGDOMS.BLUE.color);
const RedTeam = Teams.Get('RedKingdom');
const BlueTeam = Teams.Get('BlueKingdom');

// Настройки урона
Damage.GetContext().FriendlyFire.Value = true;

// Система ресурсов
const Resources = {
    gold: {},
    addGold: function(playerId, amount) {
        this.gold[playerId] = (this.gold[playerId] || 0) + amount;
        return this.gold[playerId];
    },
    getGold: function(playerId) {
        return this.gold[playerId] || 0;
    },
    transferGold: function(from, to, amount) {
        if (this.gold[from] < amount) return false;
        this.gold[from] -= amount;
        this.addGold(to, amount);
        return true;
    }
};

// Основные функции
function setRole(player, role) {
    GameState.playerRoles[player.id] = role;
    player.Properties.Get('Role').Value = role.level;
    player.Properties.Get('RoleName').Value = role.name;
    player.contextedProperties.MaxHp.Value = role.hp;
    if (role.color) player.contextedProperties.SkinColor.Value = role.color;
}

function joinKingdom(player, kingdom) {
    if (GameState.playerKingdoms[player.id]) return false;
    
    const kData = GameState.kingdoms[kingdom];
    kData.members.push(player.id);
    GameState.playerKingdoms[player.id] = kingdom;
    player.Properties.Get('Kingdom').Value = kingdom;
    
    // Первый участник становится королем
    if (kData.members.length === 1) {
        kData.king = player.id;
        setRole(player, ROLES.KING);
        Chat.Broadcast(`👑 ${player.NickName} стал королем ${KINGDOMS[kingdom.toUpperCase()].name}!`);
    } else {
        setRole(player, ROLES.SOLDIER);
    }
    
    // Добавляем в команду
    const team = kingdom === 'red' ? RedTeam : BlueTeam;
    team.Add(player);
    
    // Телепортация в зону спавна
    player.Teleport(KINGDOMS[kingdom.toUpperCase()].spawnArea);
    
    return true;
}

function leaveKingdom(player) {
    const kingdom = GameState.playerKingdoms[player.id];
    if (!kingdom) return false;
    
    const kData = GameState.kingdoms[kingdom];
    const role = GameState.playerRoles[player.id];
    
    // Удаляем из всех списков
    kData.members = kData.members.filter(id => id !== player.id);
    kData.nobles = kData.nobles.filter(id => id !== player.id);
    
    // Если это был король - выбираем нового
    if (kData.king === player.id) {
        if (kData.nobles.length > 0) {
            promotePlayer(kData.nobles[0], true);
        } else if (kData.members.length > 0) {
            promotePlayer(kData.members[0], true);
        } else {
            kData.king = null;
        }
    }
    
    // Удаляем данные игрока
    delete GameState.playerKingdoms[player.id];
    delete GameState.playerRoles[player.id];
    player.Properties.Get('Kingdom').Value = "-";
    player.Properties.Get('Role').Value = 0;
    
    // Удаляем из команды
    const team = kingdom === 'red' ? RedTeam : BlueTeam;
    team.Remove(player);
    
    return true;
}

function promotePlayer(targetId, silent = false) {
    const player = Players.Get(targetId);
    if (!player) return false;
    
    const kingdom = GameState.playerKingdoms[targetId];
    if (!kingdom) return false;
    
    const kData = GameState.kingdoms[kingdom];
    if (kData.king === targetId) return false;
    
    setRole(player, ROLES.NOBLE);
    kData.nobles.push(targetId);
    
    if (!silent) {
        Chat.Broadcast(`🎖️ ${player.NickName} повышен до дворянина в ${KINGDOMS[kingdom.toUpperCase()].name}!`);
    }
    
    return true;
}

function signPeaceTreaty(kingdom1, kingdom2) {
    GameState.kingdoms[kingdom1].peace = true;
    GameState.kingdoms[kingdom2].peace = true;
    Damage.GetContext().FriendlyFire.Value = false;
    
    Chat.Broadcast(`☮️ ${KINGDOMS[kingdom1.toUpperCase()].name} и ${KINGDOMS[kingdom2.toUpperCase()].name} заключили мир!`);
    return true;
}

function breakPeaceTreaty(kingdom) {
    GameState.kingdoms[kingdom].peace = false;
    Damage.GetContext().FriendlyFire.Value = true;
    
    Chat.Broadcast(`⚔️ ${KINGDOMS[kingdom.toUpperCase()].name} разорвал мирный договор!`);
    return true;
}

// Экономические функции
function collectTaxes(kingdom) {
    const kData = GameState.kingdoms[kingdom];
    if (!kData.king) return;
    
    const taxAmount = kData.tax;
    let totalCollected = 0;
    
    kData.members.forEach(memberId => {
        if (memberId !== kData.king) {
            const success = Resources.transferGold(memberId, kData.king, taxAmount);
            if (success) totalCollected += taxAmount;
        }
    });
    
    if (totalCollected > 0) {
        const king = Players.Get(kData.king);
        if (king) king.Ui.Hint.Value = `Собрано налогов: ${totalCollected} золота`;
    }
}

// Боевые механики
function attackCastle(attacker, kingdom) {
    if (GameState.kingdoms[kingdom].peace) return false;
    
    const now = Date.now();
    if (now - GameState.lastAttackTime[kingdom] < 30000) {
        attacker.Ui.Hint.Value = "Замок можно атаковать раз в 30 секунд";
        return false;
    }
    
    GameState.castleHealth[kingdom] -= 50;
    GameState.lastAttackTime[kingdom] = now;
    
    if (GameState.castleHealth[kingdom] <= 0) {
        GameState.castleHealth[kingdom] = 0;
        Chat.Broadcast(`💀 Замок ${KINGDOMS[kingdom.toUpperCase()].name} разрушен!`);
        // Награда за разрушение замка
        Resources.addGold(attacker.id, 500);
    } else {
        Chat.Broadcast(`🏰 Замок ${KINGDOMS[kingdom.toUpperCase()].name} атакован! Здоровье: ${GameState.castleHealth[kingdom]}/1000`);
    }
    
    return true;
}

// Обработчики событий
Players.OnPlayerConnected.Add(p => {
    p.Properties.Get('Gold').Value = 0;
    Resources.addGold(p.id, 100); // Стартовое золото
    p.Ui.Hint.Value = 'Добро пожаловать! Используйте /join red или /join blue';
});

Players.OnPlayerDisconnected.Add(p => {
    // Сохраняем золото при выходе
    p.Properties.Get('Gold').Value = Resources.getGold(p.id);
});

Teams.OnPlayerChangeTeam.Add(p => {
    p.Spawns.Spawn();
    p.Properties.Get('Kills').Value = 0;
    p.Properties.Get('Deaths').Value = 0;
});

Damage.OnDeath.Add(p => {
    p.Spawns.Spawn();
    p.Properties.Get('Deaths').Value++;
    
    // Потеря золота при смерти
    const lostGold = Math.floor(Resources.getGold(p.id) * 0.1);
    if (lostGold > 0) {
        Resources.addGold(p.id, -lostGold);
        p.Ui.Hint.Value = `Вы потеряли ${lostGold} золота при смерти`;
    }
});

Damage.OnKill.Add((killer, victim) => {
    if (killer.id === victim.id) return;
    
    killer.Properties.Get('Kills').Value++;
    
    // Награда за убийство зависит от ранга жертвы
    let reward = 10;
    const victimRole = GameState.playerRoles[victim.id];
    if (victimRole === ROLES.NOBLE) reward = 25;
    if (victimRole === ROLES.KING) reward = 100;
    
    Resources.addGold(killer.id, reward);
    killer.Ui.Hint.Value = `+${reward} золота за убийство`;
    
    // Особое сообщение за убийство короля
    if (victimRole === ROLES.KING) {
        Chat.Broadcast(`💀 Король ${victim.NickName} был убит игроком ${killer.NickName}!`);
    }
});

// Чат-команды
Chat.OnPlayerMessage.Add((p, msg) => {
    const args = msg.split(' ');
    const cmd = args[0].toLowerCase();
    const kingdom = GameState.playerKingdoms[p.id];

    try {
        switch(cmd) {
            case '/join':
                if (args.length < 2) throw "Используйте: /join red или /join blue";
                const k = args[1].toLowerCase();
                if (k !== 'red' && k !== 'blue') throw "Неизвестное королевство";
                if (kingdom) throw "Вы уже в королевстве";
                return joinKingdom(p, k);
                
            case '/leave':
                if (!kingdom) throw "Вы не в королевстве";
                return leaveKingdom(p);
                
            case '/promote':
                if (!kingdom || GameState.kingdoms[kingdom].king !== p.id) throw "Только король может повышать";
                if (args.length < 2) throw "Укажите ID игрока";
                return promotePlayer(args[1]);
                
            case '/peace':
                if (!kingdom || GameState.kingdoms[kingdom].king !== p.id) throw "Только король может заключать мир";
                const otherKingdom = kingdom === 'red' ? 'blue' : 'red';
                if (GameState.kingdoms[otherKingdom].king === null) throw "В другом королевстве нет короля";
                return signPeaceTreaty(kingdom, otherKingdom);
                
            case '/war':
                if (!kingdom || GameState.kingdoms[kingdom].king !== p.id) throw "Только король может объявлять войну";
                return breakPeaceTreaty(kingdom);
                
            case '/tax':
                if (!kingdom || GameState.kingdoms[kingdom].king !== p.id) throw "Только король может устанавливать налог";
                const tax = parseInt(args[1]);
                if (isNaN(tax) || tax < 0 || tax > 50) throw "Налог должен быть от 0 до 50";
                GameState.kingdoms[kingdom].tax = tax;
                Chat.Broadcast(`📜 ${p.NickName} установил налог ${tax}% в ${KINGDOMS[kingdom.toUpperCase()].name}`);
                return false;
                
            case '/collect':
                if (!kingdom || GameState.kingdoms[kingdom].king !== p.id) throw "Только король может собирать налоги";
                collectTaxes(kingdom);
                return false;
                
            case '/attack':
                if (!kingdom) throw "Вы не в королевстве";
                const targetKingdom = kingdom === 'red' ? 'blue' : 'red';
                return attackCastle(p, targetKingdom);
                
            case '/gold':
                p.Ui.Hint.Value = `Ваше золото: ${Resources.getGold(p.id)}`;
                return false;
                
            case '/give':
                if (args.length < 3) throw "Используйте: /give playerId amount";
                const amount = parseInt(args[2]);
                if (isNaN(amount) || amount <= 0) throw "Укажите корректную сумму";
                if (Resources.getGold(p.id) < amount) throw "Недостаточно золота";
                const target = Players.Get(args[1]);
                if (!target) throw "Игрок не найден";
                Resources.transferGold(p.id, target.id, amount);
                p.Ui.Hint.Value = `Вы передали ${amount} золота игроку ${target.NickName}`;
                target.Ui.Hint.Value = `Вы получили ${amount} золота от ${p.NickName}`;
                return false;
                
            case '/kingdom':
                if (!kingdom) throw "Вы не в королевстве";
                const kInfo = GameState.kingdoms[kingdom];
                let info = `=== ${KINGDOMS[kingdom.toUpperCase()].name} ===\n`;
                info += `👑 Король: ${kInfo.king ? Players.Get(kInfo.king).NickName : "Нет"}\n`;
                info += `🎖️ Дворян: ${kInfo.nobles.length}\n`;
                info += `⚔️ Солдат: ${kInfo.members.length - kInfo.nobles.length - (kInfo.king ? 1 : 0)}\n`;
                info += `☮️ Мирный договор: ${kInfo.peace ? "Да" : "Нет"}\n`;
                info += `💰 Налог: ${kInfo.tax}%\n`;
                info += `🏰 Здоровье замка: ${GameState.castleHealth[kingdom]}/1000`;
                p.Ui.Hint.Value = info;
                return false;
                
            default:
                return true;
        }
    } catch (e) {
        p.Ui.Hint.Value = e;
        return false;
    }
});

// Таймеры
Timers.GetContext().Get('GameTick').OnTimer.Add(t => {
    // Восстановление здоровья замков
    Object.keys(GameState.castleHealth).forEach(k => {
        if (GameState.castleHealth[k] < 1000) {
            GameState.castleHealth[k] = Math.min(1000, GameState.castleHealth[k] + 1);
        }
    });
    
    // Автобаланс команд
    if (!GameState.kingdoms.red.peace || !GameState.kingdoms.blue.peace) {
        const diff = RedTeam.PlayersCount - BlueTeam.PlayersCount;
        if (Math.abs(diff) > 2) {
            const fromTeam = diff > 0 ? RedTeam : BlueTeam;
            const toKingdom = diff > 0 ? 'blue' : 'red';
            
            for (const player of fromTeam.Players) {
                if (GameState.playerRoles[player.id]?.level === ROLES.SOLDIER.level) {
                    leaveKingdom(player);
                    joinKingdom(player, toKingdom);
                    break;
                }
            }
        }
    }
    
    t.RestartLoop(10);
}).RestartLoop(10);

// Инициализация UI
Ui.GetContext().TeamProp1.Value = { Team: "RedKingdom", Prop: "Kills" };
Ui.GetContext().TeamProp2.Value = { Team: "BlueKingdom", Prop: "Kills" };
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader('Kills', 'Убийства', '⚔️'),
    new DisplayValueHeader('Deaths', 'Смерти', '💀'),
    new DisplayValueHeader('RoleName', 'Ранг', '🎖️'),
    new DisplayValueHeader('Kingdom', 'Королевство', '🏰')
];
