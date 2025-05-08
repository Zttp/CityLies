import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Map, MapEditor, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, Build, AreaService, AreaPlayerTriggerService, AreaViewService, Chat } from 'pixel_combats/room';

// Цвета команд
const blueTeamColor = new Color(0, 0, 1, 0); // Синяя команда
const redTeamColor = new Color(1, 0, 0, 0);  // Красная команда
const kingColor = new Color(1, 1, 0, 0);     // Золотой цвет для короля

// Создание команд
Teams.Add('BlueKingdom', 'Синее Королевство', blueTeamColor);
Teams.Add('RedKingdom', 'Красное Королевство', redTeamColor);

const BlueTeam = Teams.Get('BlueKingdom');
const RedTeam = Teams.Get('RedKingdom');

// Настройки строительства для команд
BlueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
RedTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;

// Хранилище королей
const Kings = {
    Blue: null,  // ID короля синего королевства
    Red: null    // ID короля красного королевства
};

// Настройки таблицы лидеров
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader('Kills', 'Убийства', 'У'),
    new DisplayValueHeader('Deaths', 'Смерти', 'С'),
    new DisplayValueHeader('Scores', 'Очки', 'О'),
    new DisplayValueHeader('Role', 'Роль', 'Р'),
    new DisplayValueHeader('Kingdom', 'Королевство', 'К')
];

LeaderBoard.PlayersWeightGetter.Set(function(p) {
    return p.Properties.Get('Scores').Value;
});

// Функция для назначения короля
function AssignKing(team, player) {
    // Снимаем корону с предыдущего короля
    if (team.name === 'BlueKingdom' && Kings.Blue) {
        const prevKing = Players.Get(Kings.Blue);
        if (prevKing) {
            prevKing.Properties.Get('Role').Value = 'Крестьянин';
            prevKing.contextedProperties.SkinType.Value = 0;
            prevKing.Ui.Hint.Value = 'Вы больше не король Синего Королевства';
        }
    } else if (team.name === 'RedKingdom' && Kings.Red) {
        const prevKing = Players.Get(Kings.Red);
        if (prevKing) {
            prevKing.Properties.Get('Role').Value = 'Крестьянин';
            prevKing.contextedProperties.SkinType.Value = 0;
            prevKing.Ui.Hint.Value = 'Вы больше не король Красного Королевства';
        }
    }

    // Назначаем нового короля
    if (team.name === 'BlueKingdom') {
        Kings.Blue = player.id;
    } else {
        Kings.Red = player.id;
    }

    // Даем привилегии короля
    player.Properties.Get('Role').Value = 'Король';
    player.contextedProperties.SkinType.Value = 4; // Особый скин для короля
    player.contextedProperties.MaxHp.Value = 200; // У короля больше здоровья
    player.inventory.Main.Value = true;
    player.inventory.MainInfinity.Value = true;
    player.inventory.Secondary.Value = true;
    player.inventory.SecondaryInfinity.Value = true;
    player.inventory.Melee.Value = true;
    player.inventory.Explosive.Value = true;
    player.inventory.ExplosiveInfinity.Value = true;
    
    // Оповещаем всех
    room.Ui.Hint.Value = `Новый король ${team.displayName}: ${player.NickName}!`;
    player.Ui.Hint.Value = `Вы стали королем ${team.displayName}! Защищайте свое королевство!`;
    player.Spawns.Spawn(); // Спавним короля
}

// Функция для проверки смерти короля
function CheckKingDeath(killedPlayer) {
    if (killedPlayer.id === Kings.Blue) {
        // Король синего королевства убит
        room.Ui.Hint.Value = `Король Синего Королевства пал в бою!`;
        killedPlayer.Ui.Hint.Value = 'Вы больше не король!';
        Kings.Blue = null;
        // Награда убийце
        const killer = killedPlayer.Properties.Get('LastDamager').Value;
        if (killer) {
            const killerPlayer = Players.Get(killer);
            if (killerPlayer) {
                killerPlayer.Properties.Scores.Value += 1000;
                killerPlayer.Ui.Hint.Value = 'Вы убили короля! +1000 очков';
            }
        }
    } else if (killedPlayer.id === Kings.Red) {
        // Король красного королевства убит
        room.Ui.Hint.Value = `Король Красного Королевства пал в бою!`;
        killedPlayer.Ui.Hint.Value = 'Вы больше не король!';
        Kings.Red = null;
        // Награда убийце
        const killer = killedPlayer.Properties.Get('LastDamager').Value;
        if (killer) {
            const killerPlayer = Players.Get(killer);
            if (killerPlayer) {
                killerPlayer.Properties.Scores.Value += 1000;
                killerPlayer.Ui.Hint.Value = 'Вы убили короля! +1000 очков';
            }
        }
    }
}

// Обработчики событий
Players.OnPlayerConnected.Add(function(p) {
    p.Spawns.Spawn();
    // Проверяем RID игрока
    if (p.RoomID === 1) {
        // Игрок с RID 1 становится королем синего королевства
        BlueTeam.Add(p);
        AssignKing(BlueTeam, p);
    } else if (p.RoomID === 2) {
        // Игрок с RID 2 становится королем красного королевства
        RedTeam.Add(p);
        AssignKing(RedTeam, p);
    } else {
        // Остальные игроки распределяются с балансировкой
        if (BlueTeam.PlayersCount <= RedTeam.PlayersCount) {
            BlueTeam.Add(p);
        } else {
            RedTeam.Add(p);
        }
    }
    
    // Инициализация свойств игрока
    p.Properties.Get('Kills').Value = 0;
    p.Properties.Get('Deaths').Value = 0;
    p.Properties.Get('Scores').Value = 0;
    p.Properties.Get('Role').Value = 'Крестьянин';
    p.Properties.Get('Kingdom').Value = p.Team.displayName;
    p.Properties.Get('Bounty').Value = 0;
    
    p.Spawns.Spawn(); // Спавним игрока
    p.Ui.Hint.Value = 'Добро пожаловать в битву королевств!';
});

Teams.OnPlayerChangeTeam.Add(function(p, oldTeam, newTeam) {
    // При смене команды снимаем корону, если игрок был королем
    if (oldTeam && p.id === Kings[oldTeam.name === 'BlueKingdom' ? 'Blue' : 'Red']) {
        if (oldTeam.name === 'BlueKingdom') {
            Kings.Blue = null;
        } else {
            Kings.Red = null;
        }
        p.Properties.Get('Role').Value = 'Крестьянин';
        p.contextedProperties.SkinType.Value = 0;
        room.Ui.Hint.Value = `${p.NickName} покинул трон ${oldTeam.displayName}!`;
    }
    
    // Обновляем информацию о королевстве
    p.Properties.Get('Kingdom').Value = newTeam.displayName;
    
    // Если в новой команде нет короля, назначаем
    if (newTeam.name === 'BlueKingdom' && !Kings.Blue && newTeam.PlayersCount > 0) {
        AssignKing(BlueTeam, p);
    } else if (newTeam.name === 'RedKingdom' && !Kings.Red && newTeam.PlayersCount > 0) {
        AssignKing(RedTeam, p);
    }
    
    p.Spawns.Spawn(); // Спавним игрока после смены команды
});

Damage.OnDeath.Add(function(p) {
    CheckKingDeath(p);
    p.Properties.Deaths.Value++;
    Spawns.GetContext(p).Spawn();
});

Damage.OnDamage.Add(function(p, dmgd, dmg) {
    // Запоминаем последнего нанесшего урон
    dmgd.Properties.Get('LastDamager').Value = p.id;
    
    if (p.id !== dmgd.id) {
        p.Properties.Scores.Value += Math.ceil(dmg);
        p.Ui.Hint.Value = `Нанесенный урон: ${Math.ceil(dmg)}`;
    }
});

Damage.OnKill.Add(function(p, k) {
    if (p.id !== k.id) {
        p.Properties.Kills.Value++;
        
        // Дополнительные очки за убийство короля
        if (k.id === Kings.Blue || k.id === Kings.Red) {
            p.Properties.Scores.Value += 1000;
        } else {
            p.Properties.Scores.Value += 100;
        }
        
        // Награда за охоту
        if (k.Properties.Get('Bounty').Value > 0) {
            const bounty = k.Properties.Get('Bounty').Value;
            p.Properties.Scores.Value += bounty;
            room.Ui.Hint.Value = `🏆 ${p.NickName} получил награду ${bounty} за голову ${k.NickName}!`;
            k.Properties.Get('Bounty').Value = 0;
            k.contextedProperties.GlowColor.Value = null;
        }
    }
});

// Таймер для проверки королей
const KingCheckTimer = Timers.GetContext().Get('KingCheck');
KingCheckTimer.OnTimer.Add(function(t) {
    // Проверяем синее королевство
    if (BlueTeam.PlayersCount > 0 && !Kings.Blue) {
        // Находим игрока с наибольшим количеством очков
        let maxScore = -1;
        let newKing = null;
        
        for (const player of BlueTeam.Players) {
            if (player.Properties.Scores.Value > maxScore) {
                maxScore = player.Properties.Scores.Value;
                newKing = player;
            }
        }
        
        if (newKing) {
            AssignKing(BlueTeam, newKing);
        }
    }
    
    // Проверяем красное королевство
    if (RedTeam.PlayersCount > 0 && !Kings.Red) {
        // Находим игрока с наибольшим количеством очков
        let maxScore = -1;
        let newKing = null;
        
        for (const player of RedTeam.Players) {
            if (player.Properties.Scores.Value > maxScore) {
                maxScore = player.Properties.Scores.Value;
                newKing = player;
            }
        }
        
        if (newKing) {
            AssignKing(RedTeam, newKing);
        }
    }
    
    KingCheckTimer.RestartLoop(30); // Проверка каждые 30 секунд
});

// Настройки UI
Ui.GetContext().TeamProp1.Value = { Team: "BlueKingdom", Prop: "Scores" };
Ui.GetContext().TeamProp2.Value = { Team: "RedKingdom", Prop: "Scores" };

Chat.OnMessage.Add(function(m) {
    let mt = m.Text.toLowerCase().trim();
    let sender = Players.GetByRoomId(m.Sender);
    let senderRole = sender.Properties.Get('Role').Value;
    let isKing = senderRole === "Король";

    // Команда для установки награды за голову
    if (mt.startsWith('/bounty ') && isKing) {
        let args = mt.split(' ');
        if (args.length >= 3) {
            let targetId = Number(args[1]);
            let bountyAmount = Number(args[2]);
            let target = Players.GetByRoomId(targetId);
            
            if (target && target.Team !== sender.Team && bountyAmount > 0) {
                // Устанавливаем награду за голову
                target.Properties.Get('Bounty').Value = bountyAmount;
                room.Ui.Hint.Value = `🏹 Король ${sender.NickName} объявил охоту на ${target.NickName}! Награда: ${bountyAmount} кредитов!`;
                
                // Помечаем цель для всех
                target.contextedProperties.GlowColor.Value = new Color(1, 0, 0, 0);
                target.Timers.Get('hunt_timer').Restart(300, () => {
                    target.Properties.Get('Bounty').Value = 0;
                    target.contextedProperties.GlowColor.Value = null;
                });
            }
        }
    }
    
    // Команда для назначения ролей
    else if (mt.startsWith('/appoint ') && isKing) {
        let args = mt.split(' ');
        if (args.length >= 3) {
            let targetId = Number(args[1]);
            let role = args[2];
            let target = Players.GetByRoomId(targetId);
            
            if (target && target.Team === sender.Team) {
                // Проверяем допустимые роли
                const allowedRoles = ['Рыцарь', 'Гвардеец', 'Крестьянин', 'Советник'];
                if (allowedRoles.includes(role)) {
                    target.Properties.Get('Role').Value = role;
                    Chat.BroadcastTeam(sender.Team, `🎖 Король ${sender.NickName} назначил ${target.NickName} на должность ${role}!`);
                    
                    // Даем бонусы в зависимости от роли
                    switch(role) {
                        case 'Рыцарь':
                            target.contextedProperties.MaxHp.Value = 150;
                            target.inventory.Main.Value = true;
                            break;
                        case 'Гвардеец':
                            target.contextedProperties.MaxHp.Value = 120;
                            target.inventory.Secondary.Value = true;
                            break;
                        case 'Советник':
                            target.contextedProperties.MaxHp.Value = 100;
                            break;
                        default:
                            target.contextedProperties.MaxHp.Value = 80;
                    }
                } else {
                    sender.Ui.Hint.Value = "Недопустимая роль. Доступные: Рыцарь, Гвардеец, Крестьянин, Советник";
                }
            }
        }
    }
    
    // Команда для сбора налогов
    else if (mt.startsWith('/tax ') && isKing) {
        let taxRate = Number(mt.slice(5));
        if (taxRate >= 0 && taxRate <= 30) {
            let totalTax = 0;
            for (const player of sender.Team.Players) {
                if (player.Properties.Get('Role').Value !== "Король") {
                    let tax = Math.floor(player.Properties.Scores.Value * (taxRate / 100));
                    player.Properties.Scores.Value -= tax;
                    totalTax += tax;
                    player.Ui.Hint.Value = `💰 Король собрал с вас налог ${tax} кредитов (${taxRate}%)`;
                }
            }
            sender.Properties.Scores.Value += totalTax;
            Chat.BroadcastTeam(sender.Team, `💰 Король ${sender.NickName} собрал налог ${taxRate}% и получил ${totalTax} кредитов!`);
        } else {
            sender.Ui.Hint.Value = "Налог должен быть от 0 до 30%";
        }
    }
    
    // Команда для назначения помощника
    else if (mt.startsWith('/assistant ') && isKing) {
        let targetId = Number(mt.slice(11));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team === sender.Team) {
            target.Properties.Get('Role').Value = "Советник";
            target.contextedProperties.MaxHp.Value = 100;
            Chat.BroadcastTeam(sender.Team, `🎖 Король ${sender.NickName} назначил ${target.NickName} своим советником!`);
            target.Ui.Hint.Value = `Вы стали советником короля! Теперь вы можете помогать управлять королевством.`;
        }
    }
    
    // Команда помощи
    else if (mt === '/help') {
        let helpMsg = `
<b>🛠 Основные команды:</b>
/info - правила режима
/roles - список всех ролей
/king - текущие короли
/teams - статистика команд

<b>👑 Королевские команды:</b>
/bounty [RID] [сумма] - объявить охоту
/appoint [RID] [роль] - назначить роль
/tax [%] - собрать налог
/assistant [RID] - назначить советника
`;
        sender.Ui.Hint.Value = helpMsg;
    }
});
