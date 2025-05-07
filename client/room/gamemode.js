import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Map, Players, Teams, Damage, Ui, Properties, Spawns, Timers, Chat } from 'pixel_combats/room';

// Цвета
const kingdom1Color = new Color(1, 0, 0, 0); // Красное королевство
const kingdom2Color = new Color(0, 0, 1, 0); // Синее королевство
const kingColor = new Color(1, 1, 0, 0); // Золотой для королей
const nobleColor = new Color(0.5, 0, 0.5, 0); // Пурпурный для знати

// Королевства
const Kingdoms = {
    Red: {
        name: "Красное Королевство",
        king: null,
        nobles: [],
        members: [],
        color: kingdom1Color,
        peaceTreaty: false
    },
    Blue: {
        name: "Синее Королевство",
        king: null,
        nobles: [],
        members: [],
        color: kingdom2Color,
        peaceTreaty: false
    },
    PlayerToKingdom: {} // {playerId: kingdomName}
};

// Уровни и роли
const Roles = {
    KING: 3,
    NOBLE: 2,
    SOLDIER: 1,
    GetRoleName: function(role) {
        switch(role) {
            case this.KING: return "Король";
            case this.NOBLE: return "Дворянин";
            default: return "Солдат";
        }
    }
};

// Инициализация команд
Teams.Add('RedKingdom', Kingdoms.Red.name, Kingdoms.Red.color);
Teams.Add('BlueKingdom', Kingdoms.Blue.name, Kingdoms.Blue.color);
const RedTeam = Teams.Get('RedKingdom');
const BlueTeam = Teams.Get('BlueKingdom');

// Настройки таблицы лидеров
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader('Kills', 'Убийства', 'У'),
    new DisplayValueHeader('Deaths', 'Смерти', 'С'),
    new DisplayValueHeader('Role', 'Ранг', 'Ранг'),
    new DisplayValueHeader('Kingdom', 'Королевство', 'Корол.')
];

// Функции для работы с королевствами
function JoinKingdom(player, kingdomName) {
    if (Kingdoms.PlayerToKingdom[player.id]) {
        player.Ui.Hint.Value = `Вы уже в королевстве ${Kingdoms.PlayerToKingdom[player.id]}`;
        return false;
    }

    const kingdom = Kingdoms[kingdomName];
    if (!kingdom) {
        player.Ui.Hint.Value = "Неизвестное королевство";
        return false;
    }

    // Первый в королевстве становится королем
    if (kingdom.members.length === 0) {
        kingdom.king = player.id;
        player.Properties.Get('Role').Value = Roles.KING;
        player.contextedProperties.SkinType.Value = 4; // Особый скин для короля
        player.contextedProperties.MaxHp.Value = 200; // Больше здоровья
        Chat.Broadcast(`Игрок ${player.NickName} стал королем ${kingdom.name}!`);
    } else {
        player.Properties.Get('Role').Value = Roles.SOLDIER;
    }

    kingdom.members.push(player.id);
    Kingdoms.PlayerToKingdom[player.id] = kingdomName;
    player.Properties.Get('Kingdom').Value = kingdomName;
    
    // Добавляем в команду
    const team = kingdomName === 'Red' ? RedTeam : BlueTeam;
    team.Add(player);
    
    player.Ui.Hint.Value = `Вы присоединились к ${kingdom.name}`;
    return true;
}

function LeaveKingdom(player) {
    const kingdomName = Kingdoms.PlayerToKingdom[player.id];
    if (!kingdomName) {
        player.Ui.Hint.Value = "Вы не в королевстве";
        return false;
    }

    const kingdom = Kingdoms[kingdomName];
    const role = player.Properties.Get('Role').Value;

    // Удаляем игрока из королевства
    kingdom.members = kingdom.members.filter(id => id !== player.id);
    if (role === Roles.NOBLE) {
        kingdom.nobles = kingdom.nobles.filter(id => id !== player.id);
    }
    delete Kingdoms.PlayerToKingdom[player.id];
    player.Properties.Get('Kingdom').Value = "-";
    player.Properties.Get('Role').Value = 0;

    // Если это был король - выбираем нового
    if (kingdom.king === player.id) {
        if (kingdom.nobles.length > 0) {
            // Назначаем королем первого дворянина
            kingdom.king = kingdom.nobles[0];
            const newKing = Players.Get(kingdom.king);
            if (newKing) {
                newKing.Properties.Get('Role').Value = Roles.KING;
                newKing.contextedProperties.SkinType.Value = 4;
                newKing.contextedProperties.MaxHp.Value = 200;
                Chat.Broadcast(`Игрок ${newKing.NickName} стал новым королем ${kingdom.name}!`);
            }
        } else if (kingdom.members.length > 0) {
            // Назначаем королем первого солдата
            kingdom.king = kingdom.members[0];
            const newKing = Players.Get(kingdom.king);
            if (newKing) {
                newKing.Properties.Get('Role').Value = Roles.KING;
                newKing.contextedProperties.SkinType.Value = 4;
                newKing.contextedProperties.MaxHp.Value = 200;
                Chat.Broadcast(`Игрок ${newKing.NickName} стал новым королем ${kingdom.name}!`);
            }
        } else {
            kingdom.king = null;
        }
    }

    // Удаляем из команды
    const team = kingdomName === 'Red' ? RedTeam : BlueTeam;
    team.Remove(player);

    player.Ui.Hint.Value = `Вы покинули ${kingdom.name}`;
    return true;
}

function PromotePlayer(king, targetId) {
    const kingdomName = Kingdoms.PlayerToKingdom[king.id];
    if (!kingdomName || king.id !== Kingdoms[kingdomName].king) {
        king.Ui.Hint.Value = "Только король может повышать";
        return false;
    }

    const target = Players.Get(targetId);
    if (!target) {
        king.Ui.Hint.Value = "Игрок не найден";
        return false;
    }

    if (Kingdoms.PlayerToKingdom[targetId] !== kingdomName) {
        king.Ui.Hint.Value = "Игрок не из вашего королевства";
        return false;
    }

    if (target.Properties.Get('Role').Value >= Roles.NOBLE) {
        king.Ui.Hint.Value = "Игрок уже имеет высокий ранг";
        return false;
    }

    target.Properties.Get('Role').Value = Roles.NOBLE;
    Kingdoms[kingdomName].nobles.push(targetId);
    target.contextedProperties.SkinType.Value = 2; // Скин для дворянина
    target.contextedProperties.MaxHp.Value = 150; // Больше здоровья чем у солдата

    Chat.Broadcast(`Игрок ${target.NickName} повышен до дворянина в ${Kingdoms[kingdomName].name}!`);
    return true;
}

function SignPeaceTreaty(king1, king2) {
    const kingdom1Name = Kingdoms.PlayerToKingdom[king1.id];
    const kingdom2Name = Kingdoms.PlayerToKingdom[king2.id];
    
    if (!kingdom1Name || !kingdom2Name || 
        king1.id !== Kingdoms[kingdom1Name].king || 
        king2.id !== Kingdoms[kingdom2Name].king) {
        king1.Ui.Hint.Value = "Только короли могут подписывать договоры";
        return false;
    }

    if (kingdom1Name === kingdom2Name) {
        king1.Ui.Hint.Value = "Нельзя заключить мир с самим собой";
        return false;
    }

    Kingdoms[kingdom1Name].peaceTreaty = true;
    Kingdoms[kingdom2Name].peaceTreaty = true;
    Damage.GetContext().FriendlyFire.Value = false;

    Chat.Broadcast(`Мирный договор между ${Kingdoms[kingdom1Name].name} и ${Kingdoms[kingdom2Name].name} подписан!`);
    return true;
}

function BreakPeaceTreaty(king) {
    const kingdomName = Kingdoms.PlayerToKingdom[king.id];
    if (!kingdomName || king.id !== Kingdoms[kingdomName].king) {
        king.Ui.Hint.Value = "Только король может разорвать договор";
        return false;
    }

    Kingdoms[kingdomName].peaceTreaty = false;
    Damage.GetContext().FriendlyFire.Value = true;

    Chat.Broadcast(`${Kingdoms[kingdomName].name} разорвал мирный договор!`);
    return true;
}

// Обработчики событий
Players.OnPlayerConnected.Add(function(p) {
    p.Ui.Hint.Value = 'Добро пожаловать в режим Королевств! Используйте /join red или /join blue';
});

Teams.OnRequestJoinTeam.Add(function(p, t) {
    p.Properties.Get('Role').Value = 0;
    p.Properties.Get('Kingdom').Value = "-";
    p.Properties.Get('Kills').Value = 0;
    p.Properties.Get('Deaths').Value = 0;
});

Teams.OnPlayerChangeTeam.Add(function(p) { 
    p.Spawns.Spawn();
    p.msg.Show(`Привет, ${p.NickName}! Выбери королевство (/join red или /join blue)`);
});

Damage.OnDeath.Add(function(p) {
    p.Spawns.Spawn();
    ++p.Properties.Deaths.Value;
});

Damage.OnKill.Add(function(p, k) {
    if (p.id !== k.id) { 
        ++p.Properties.Kills.Value;
        
        // Если убил короля - получаешь больше очков
        if (k.Properties.Get('Role').Value === Roles.KING) {
            p.Properties.Scores.Value += 100;
            Chat.Broadcast(`Король ${k.NickName} был убит игроком ${p.NickName}!`);
        } else {
            p.Properties.Scores.Value += 10;
        }
    }
});

// Обработчики чат-команд
Chat.OnPlayerMessage.Add(function(p, msg) {
    const args = msg.split(' ');
    const cmd = args[0].toLowerCase();

    switch(cmd) {
        case '/join':
            if (args.length < 2) {
                p.Ui.Hint.Value = "Используйте: /join red или /join blue";
                return false;
            }
            const kingdom = args[1].toLowerCase();
            if (kingdom === 'red') {
                return JoinKingdom(p, 'Red');
            } else if (kingdom === 'blue') {
                return JoinKingdom(p, 'Blue');
            } else {
                p.Ui.Hint.Value = "Неизвестное королевство. Используйте red или blue";
                return false;
            }
            
        case '/leave':
            return LeaveKingdom(p);
            
        case '/promote':
            if (args.length < 2) {
                p.Ui.Hint.Value = "Используйте: /promote playerId";
                return false;
            }
            return PromotePlayer(p, args[1]);
            
        case '/pptreaty':
            if (args.length < 2) {
                p.Ui.Hint.Value = "Используйте: /pptreaty playerId";
                return false;
            }
            const target = Players.Get(args[1]);
            if (!target) {
                p.Ui.Hint.Value = "Игрок не найден";
                return false;
            }
            return SignPeaceTreaty(p, target);
            
        case '/breakpeace':
            return BreakPeaceTreaty(p);
            
        case '/kingdom':
            const kingdomName = Kingdoms.PlayerToKingdom[p.id];
            if (!kingdomName) {
                p.Ui.Hint.Value = "Вы не в королевстве";
                return false;
            }
            const kInfo = Kingdoms[kingdomName];
            p.Ui.Hint.Value = `Королевство: ${kInfo.name}\nКороль: ${kInfo.king ? Players.Get(kInfo.king).NickName : "Нет"}\nДворян: ${kInfo.nobles.length}\nСолдат: ${kInfo.members.length - kInfo.nobles.length - (kInfo.king ? 1 : 0)}`;
            return false;
            
        default:
            return true; // Разрешить обычные сообщения
    }
});

// Автобаланс королевств
Timers.GetContext().Get('BalanceTimer').OnTimer.Add(function(t) {
    // Балансируем только если нет мирного договора
    if (Kingdoms.Red.peaceTreaty && Kingdoms.Blue.peaceTreaty) return;
    
    const redCount = RedTeam.PlayersCount;
    const blueCount = BlueTeam.PlayersCount;
    
    if (Math.abs(redCount - blueCount) > 2) {
        // Переносим игроков из большего королевства в меньшее
        const fromTeam = redCount > blueCount ? RedTeam : BlueTeam;
        const toTeam = redCount > blueCount ? BlueTeam : RedTeam;
        const fromKingdom = redCount > blueCount ? 'Red' : 'Blue';
        const toKingdom = redCount > blueCount ? 'Blue' : 'Red';
        
        // Находим солдата (не короля и не дворянина) для переноса
        for (const player of fromTeam.Players) {
            if (player.Properties.Get('Role').Value === Roles.SOLDIER) {
                LeaveKingdom(player);
                JoinKingdom(player, toKingdom);
                break;
            }
        }
    }
    t.RestartLoop(30); // Проверяем баланс каждые 30 секунд
}).RestartLoop(30);

// Инициализация таймера
Timers.GetContext().Get('BalanceTimer').Start();
