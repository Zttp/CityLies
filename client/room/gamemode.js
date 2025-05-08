import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Map, MapEditor, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, Build, AreaService, AreaPlayerTriggerService, AreaViewService, Chat } from 'pixel_combats/room';

// Цвета команд
const blueTeamColor = new Color(0, 0, 1, 0.3); // Синяя команда с прозрачностью
const redTeamColor = new Color(1, 0, 0, 0.3);  // Красная команда с прозрачностью
const kingColor = new Color(1, 1, 0, 0.5);     // Золотой цвет для короля

// Создание команд
Teams.Add('BlueKingdom', 'Синее Королевство', blueTeamColor);
Teams.Add('RedKingdom', 'Красное Королевство', redTeamColor);

const BlueTeam = Teams.Get('BlueKingdom');
const RedTeam = Teams.Get('RedKingdom');

// Настройки строительства для команд
BlueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
RedTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;

// Хранилище королей и других ролей
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
    new DisplayValueHeader('Kingdom', 'Королевство', 'К'),
    new DisplayValueHeader('Bounty', 'Награда', 'Н')
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
            prevKing.Properties.Get('Role').Value = 'Воин';
            prevKing.contextedProperties.SkinType.Value = 0;
            prevKing.contextedProperties.GlowColor.Value = null;
            prevKing.Ui.Hint.Value = 'Вы больше не король Синего Королевства';
        }
    } else if (team.name === 'RedKingdom' && Kings.Red) {
        const prevKing = Players.Get(Kings.Red);
        if (prevKing) {
            prevKing.Properties.Get('Role').Value = 'Воин';
            prevKing.contextedProperties.SkinType.Value = 0;
            prevKing.contextedProperties.GlowColor.Value = null;
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
    player.contextedProperties.GlowColor.Value = kingColor;
    player.contextedProperties.MaxHp.Value = 200; // У короля больше здоровья
    player.inventory.Main.Value = true;
    player.inventory.MainInfinity.Value = true;
    player.inventory.Secondary.Value = true;
    player.inventory.SecondaryInfinity.Value = true;
    player.inventory.Melee.Value = true;
    player.inventory.Explosive.Value = true;
    player.inventory.ExplosiveInfinity.Value = true;
    player.Properties.Get('CrownPower').Value = 3; // Количество королевских приказов
    
    // Оповещаем всех
    Chat.Broadcast(`👑 Новый король ${team.displayName}: ${player.NickName}!`);
    player.Ui.Hint.Value = `Вы стали королем ${team.displayName}! Защищайте свое королевство!`;
    
    // Спавним короля в специальном месте
    const thronePos = team.name === 'BlueKingdom' ? new Vector3(-50, 10, 0) : new Vector3(50, 10, 0);
    player.Position.Value = thronePos;
}

// Функция для проверки смерти короля
function CheckKingDeath(killedPlayer) {
    if (killedPlayer.id === Kings.Blue) {
        // Король синего королевства убит
        Chat.Broadcast(`💀 Король Синего Королевства пал в бою!`);
        Kings.Blue = null;
        // Награда убийце
        const killer = killedPlayer.Properties.Get('LastDamager').Value;
        if (killer) {
            const killerPlayer = Players.Get(killer);
            if (killerPlayer) {
                killerPlayer.Properties.Scores.Value += 1000;
                killerPlayer.Properties.Get('KingSlayer').Value = true;
                killerPlayer.Ui.Hint.Value = 'Вы убили короля! +1000 очков';
                killerPlayer.contextedProperties.GlowColor.Value = new Color(1, 0.5, 0, 0.5);
            }
        }
    } else if (killedPlayer.id === Kings.Red) {
        // Король красного королевства убит
        Chat.Broadcast(`💀 Король Красного Королевства пал в бою!`);
        Kings.Red = null;
        // Награда убийце
        const killer = killedPlayer.Properties.Get('LastDamager').Value;
        if (killer) {
            const killerPlayer = Players.Get(killer);
            if (killerPlayer) {
                killerPlayer.Properties.Scores.Value += 1000;
                killerPlayer.Properties.Get('KingSlayer').Value = true;
                killerPlayer.Ui.Hint.Value = 'Вы убили короля! +1000 очков';
                killerPlayer.contextedProperties.GlowColor.Value = new Color(1, 0.5, 0, 0.5);
            }
        }
    }
}

// Функция для спавна игрока
function SpawnPlayer(player) {
    if (!player.Team) return;
    
    let spawnPos;
    if (player.Properties.Get('Role').Value === 'Король') {
        // Короли спавнятся у трона
        spawnPos = player.Team.name === 'BlueKingdom' ? 
            new Vector3(-50, 10, 0) : 
            new Vector3(50, 10, 0);
    } else {
        // Обычные игроки спавнятся в случайном месте базы
        const baseX = player.Team.name === 'BlueKingdom' ? -50 : 50;
        spawnPos = new Vector3(
            baseX + (Math.random() * 20 - 10),
            5,
            Math.random() * 20 - 10
        );
    }
    
    player.Position.Value = spawnPos;
    player.contextedProperties.Hp.Value = player.contextedProperties.MaxHp.Value;
    player.Ui.Hint.Value = 'Вы заспавнены!';
}

// Обработчики событий
Players.OnPlayerConnected.Add(function(p) {
    p.Properties.Get('Kills').Value = 0;
    p.Properties.Get('Deaths').Value = 0;
    p.Properties.Get('Scores').Value = 0;
    p.Properties.Get('Role').Value = 'Воин';
    p.Properties.Get('Bounty').Value = 0;
    p.Properties.Get('Votes').Value = 0;
    p.Properties.Get('KingSlayer').Value = false;
    p.Properties.Get('CrownPower').Value = 0;
    
    p.Ui.Hint.Value = 'Добро пожаловать в битву королевств! Напишите /help для списка команд';
    
    // Автоматическое распределение по командам
    if (BlueTeam.PlayersCount <= RedTeam.PlayersCount) {
        BlueTeam.Add(p);
    } else {
        RedTeam.Add(p);
    }
    
    SpawnPlayer(p);
});

Teams.OnPlayerAdded.Add(function(p, t) {
    p.Properties.Get('Kingdom').Value = t.displayName;
    p.Ui.Hint.Value = `Вы вступили в ${t.displayName}!`;
    
    // Если в команде нет короля, назначаем
    if (t.name === 'BlueKingdom' && !Kings.Blue) {
        AssignKing(t, p);
    } else if (t.name === 'RedKingdom' && !Kings.Red) {
        AssignKing(t, p);
    }
    
    SpawnPlayer(p);
});

Teams.OnPlayerChangeTeam.Add(function(p, oldTeam, newTeam) {
    // При смене команды снимаем корону, если игрок был королем
    if (oldTeam && p.id === Kings[oldTeam.name === 'BlueKingdom' ? 'Blue' : 'Red']) {
        if (oldTeam.name === 'BlueKingdom') {
            Kings.Blue = null;
        } else {
            Kings.Red = null;
        }
        p.Properties.Get('Role').Value = 'Воин';
        p.contextedProperties.SkinType.Value = 0;
        p.contextedProperties.GlowColor.Value = null;
        Chat.Broadcast(`${p.NickName} покинул трон ${oldTeam.displayName}!`);
    }
    
    // Добавляем в новую команду
    newTeam.Add(p);
    p.Properties.Get('Kingdom').Value = newTeam.displayName;
    
    // Если в новой команде нет короля, назначаем
    if (newTeam.name === 'BlueKingdom' && !Kings.Blue) {
        AssignKing(newTeam, p);
    } else if (newTeam.name === 'RedKingdom' && !Kings.Red) {
        AssignKing(newTeam, p);
    }
    
    SpawnPlayer(p);
});

Damage.OnDeath.Add(function(p) {
    CheckKingDeath(p);
    p.Properties.Deaths.Value++;
    
    // Сброс баунти при смерти
    if (p.Properties.Get('Bounty').Value > 0) {
        p.Properties.Get('Bounty').Value = 0;
        p.contextedProperties.GlowColor.Value = null;
    }
    
    SpawnPlayer(p);
});

Damage.OnDamage.Add(function(p, dmgd, dmg) {
    // Запоминаем последнего нанесшего урон
    dmgd.Properties.Get('LastDamager').Value = p.id;
    
    if (p.id !== dmgd.id) {
        const damageScore = Math.ceil(dmg);
        p.Properties.Scores.Value += damageScore;
        p.Ui.Hint.Value = `Нанесенный урон: ${damageScore}`;
        
        // Если атаковали короля - дополнительная награда
        if (dmgd.Properties.Get('Role').Value === 'Король') {
            p.Properties.Scores.Value += 50;
            p.Ui.Hint.Value = `Вы атаковали короля! +${damageScore + 50} очков`;
        }
    }
});

Damage.OnKill.Add(function(p, k) {
    if (p.id !== k.id) {
        p.Properties.Kills.Value++;
        
        // Дополнительные очки за убийство короля
        if (k.id === Kings.Blue || k.id === Kings.Red) {
            p.Properties.Scores.Value += 1000;
            p.Properties.Get('KingSlayer').Value = true;
        } else {
            p.Properties.Scores.Value += 100;
        }
        
        // Награда за баунти
        if (k.Properties.Get('Bounty').Value > 0) {
            const bounty = k.Properties.Get('Bounty').Value;
            p.Properties.Scores.Value += bounty;
            Chat.Broadcast(`🏆 ${p.NickName} получил награду ${bounty} за голову ${k.NickName}!`);
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
            const score = player.Properties.Scores.Value;
            if (score > maxScore || (score === maxScore && Math.random() > 0.5)) {
                maxScore = score;
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
            const score = player.Properties.Scores.Value;
            if (score > maxScore || (score === maxScore && Math.random() > 0.5)) {
                maxScore = score;
                newKing = player;
            }
        }
        
        if (newKing) {
            AssignKing(RedTeam, newKing);
        }
    }
    
    KingCheckTimer.RestartLoop(30); // Проверка каждые 30 секунд
});

// Таймер для обновления королевской силы
const CrownPowerTimer = Timers.GetContext().Get('CrownPower');
CrownPowerTimer.OnTimer.Add(function(t) {
    // Восстановление королевской силы
    if (Kings.Blue) {
        const blueKing = Players.Get(Kings.Blue);
        if (blueKing && blueKing.Properties.Get('CrownPower').Value < 3) {
            blueKing.Properties.Get('CrownPower').Value++;
        }
    }
    if (Kings.Red) {
        const redKing = Players.Get(Kings.Red);
        if (redKing && redKing.Properties.Get('CrownPower').Value < 3) {
            redKing.Properties.Get('CrownPower').Value++;
        }
    }
    
    CrownPowerTimer.RestartLoop(60); // Каждую минуту
});

// Настройки UI
Ui.GetContext().TeamProp1.Value = { Team: "BlueKingdom", Prop: "Scores" };
Ui.GetContext().TeamProp2.Value = { Team: "RedKingdom", Prop: "Scores" };

// ======================= 📜 ЧАТОВЫЕ КОМАНДЫ =======================
Chat.OnMessage.Add(function(m) {
    let mt = m.Text.toLowerCase().trim();
    let sender = Players.GetByRoomId(m.Sender);
    if (!sender) return;
    
    let senderRole = sender.Properties.Get('Role').Value;
    let isKing = senderRole === "Король";
    let isRoyalGuard = senderRole === "Гвардеец";
    let isKnight = senderRole === "Рыцарь";
    let isRebel = senderRole === "Мятежник";
    let isCitizen = senderRole === "Гражданин";

    // ======================= 🛠 ОБЩИЕ КОМАНДЫ (ВСЕМ) =======================
    if (mt === '/help') {
        let helpMsg = `
<b>🛠 Основные команды:</b>
/info - правила режима
/roles - список всех ролей
/king - текущие короли
/teams - статистика команд
/rtd - рулетка (1-100 кредитов)
/achievements - ваши достижения
/emote [текст] - действие от лица персонажа
/me [действие] - описание действия
/dance - исполнить танец
/taunt - оскорбить противника

<b>👥 Социальные:</b>
/vote [ник] - проголосовать за игрока
/gift [RID] [сумма] - подарить кредиты
/challenge [RID] - вызов на дуэль
/party [RID] - пригласить в группу
/friend [RID] - добавить в друзья
`;

        if (isKing) helpMsg += `
<b>👑 Королевские команды:</b>
/appoint [RID] [должность] - назначить на пост
/decree [текст] - издать указ
/tax [%] - установить налог
/hunt [RID] - объявить охоту
/reward [RID] [сумма] - наградить
/pardon [RID] - помиловать мятежника
/banish [RID] - изгнать из королевства
/war - объявить войну
/peace - предложить перемирие
/throne - телепортироваться к трону
/crown - королевская сила (${sender.Properties.Get('CrownPower').Value}/3)
`;

        if (isRoyalGuard) helpMsg += `
<b>🛡 Команды гвардии:</b>
/protect - защитить короля (+10HP)
/check [RID] - обыскать игрока
/arrest [RID] - арестовать нарушителя
/guard - режим охраны
`;

        if (isKnight) helpMsg += `
<b>⚔️ Рыцарские команды:</b>
/oath - принести клятву верности
/train - тренировать новобранцев
/patrol - начать патрулирование
/duel [RID] - вызвать на честный бой
/honor - показать честь
`;

        if (isRebel) helpMsg += `
<b>🎭 Команды мятежников:</b>
/rebellion - начать восстание
/hideme - скрыться на 30 сек
/sabotage - саботировать постройки
/spy [RID] - шпионить за игроком
/steal [RID] - украсть кредиты
`;

        sender.Ui.Hint.Value = helpMsg;
    }

    // ======================= 👑 КОРОЛЕВСКИЕ КОМАНДЫ =======================
    else if (mt.startsWith('/hunt ') && isKing) {
        let targetId = Number(mt.slice(6));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team !== sender.Team && sender.Properties.Get('CrownPower').Value > 0) {
            // Устанавливаем награду за голову
            target.Properties.Get('Bounty').Value = 1000;
            target.contextedProperties.GlowColor.Value = new Color(1, 0, 0, 0.7);
            Chat.Broadcast(`🏹 Король ${sender.NickName} объявил охоту на ${target.NickName}! Награда: 1000 кредитов!`);
            
            // Помечаем цель для всех
            sender.Properties.Get('CrownPower').Value--;
            
            // Таймер охоты
            target.Timers.Get('hunt_timer').Restart(300, () => {
                target.Properties.Get('Bounty').Value = 0;
                target.contextedProperties.GlowColor.Value = null;
                Chat.Broadcast(`🕒 Охота на ${target.NickName} закончилась.`);
            });
        }
    }

    else if (mt.startsWith('/appoint ') && isKing) {
        let args = mt.split(' ');
        if (args.length >= 3 && sender.Properties.Get('CrownPower').Value > 0) {
            let targetId = Number(args[1]);
            let position = args[2].toLowerCase();
            let target = Players.GetByRoomId(targetId);
            
            if (target && target.Team === sender.Team) {
                sender.Properties.Get('CrownPower').Value--;
                
                switch(position) {
                    case 'guard':
                    case 'гвардеец':
                        if (countTeamRole(sender.Team, "Гвардеец") < 3) {
                            target.Properties.Get('Role').Value = "Гвардеец";
                            target.contextedProperties.MaxHp.Value = 150;
                            target.contextedProperties.GlowColor.Value = new Color(0, 0, 1, 0.3);
                            Chat.BroadcastTeam(sender.Team, `🛡 ${target.NickName} назначен Королевским Гвардейцем!`);
                        } else {
                            sender.Ui.Hint.Value = "Уже максимальное количество гвардейцев (3)!";
                            sender.Properties.Get('CrownPower').Value++;
                        }
                        break;
                    case 'knight':
                    case 'рыцарь':
                        if (countTeamRole(sender.Team, "Рыцарь") < 5) {
                            target.Properties.Get('Role').Value = "Рыцарь";
                            target.contextedProperties.MaxHp.Value = 120;
                            target.contextedProperties.GlowColor.Value = new Color(0.5, 0.5, 1, 0.2);
                            Chat.BroadcastTeam(sender.Team, `⚔️ ${target.NickName} посвящен в Рыцари!`);
                        } else {
                            sender.Ui.Hint.Value = "Уже максимальное количество рыцарей (5)!";
                            sender.Properties.Get('CrownPower').Value++;
                        }
                        break;
                    case 'jester':
                    case 'шут':
                        target.Properties.Get('Role').Value = "Шут";
                        target.contextedProperties.MaxHp.Value = 80;
                        target.contextedProperties.GlowColor.Value = new Color(1, 0, 1, 0.3);
                        Chat.BroadcastTeam(sender.Team, `🎭 ${target.NickName} стал Королевским Шутом!`);
                        break;
                }
            }
        }
    }

    else if (mt.startsWith('/tax ') && isKing) {
        let taxRate = Number(mt.slice(5));
        if (taxRate >= 0 && taxRate <= 30) {
            sender.Team.Properties.Get('TaxRate').Value = taxRate;
            Chat.BroadcastTeam(sender.Team, `💰 Король установил налог ${taxRate}% на все доходы!`);
        }
    }

    else if (mt === '/throne' && isKing) {
        const thronePos = sender.Team.name === 'BlueKingdom' ? 
            new Vector3(-50, 10, 0) : 
            new Vector3(50, 10, 0);
        sender.Position.Value = thronePos;
        sender.Ui.Hint.Value = "Вы телепортировались к трону!";
    }

    else if (mt === '/crown' && isKing) {
        sender.Ui.Hint.Value = `Королевская сила: ${sender.Properties.Get('CrownPower').Value}/3 (восстанавливается каждую минуту)`;
    }

    // ======================= ⚔️ РЫЦАРСКИЕ КОМАНДЫ =======================
    else if (mt === '/oath' && isKnight) {
        sender.Ui.Hint.Value = "⚔️ Вы клянетесь защищать королевство до последней капли крови!";
        Chat.BroadcastTeam(sender.Team, `⚔️ Рыцарь ${sender.NickName} приносит клятву верности!`);
        sender.contextedProperties.MaxHp.Value += 10;
    }

    else if (mt === '/train' && isKnight) {
        let nearbyCitizens = sender.Team.Players.filter(p => 
            p.Properties.Get('Role').Value === "Гражданин" &&
            Vector3.Distance(p.Position.Value, sender.Position.Value) < 10
        );
        
        nearbyCitizens.forEach(citizen => {
            citizen.Properties.Scores.Value += 50;
            citizen.Ui.Hint.Value = `🎖 Рыцарь ${sender.NickName} тренирует вас! +50 кредитов`;
        });
        
        if (nearbyCitizens.length > 0) {
            sender.Ui.Hint.Value = `🎖 Вы обучили ${nearbyCitizens.length} граждан!`;
        }
    }

    else if (mt === '/honor' && isKnight) {
        Chat.BroadcastTeam(sender.Team, `⚔️ Рыцарь ${sender.NickName} отдает честь королевству!`);
        sender.Ui.Hint.Value = "Вы показали свою честь и достоинство!";
    }

    // ======================= 🎭 КОМАНДЫ МЯТЕЖНИКОВ =======================
    else if (mt === '/sabotage' && isRebel) {
        let enemyBuildings = Map.FindBlocksInRadius(sender.Position.Value, 15)
            .filter(b => b.Team !== sender.Team);
        
        if (enemyBuildings.length > 0) {
            enemyBuildings.forEach(b => {
                b.Health.Value -= 50;
            });
            Chat.Broadcast(`💣 ${sender.NickName} саботирует вражеские постройки!`);
        }
    }

    else if (mt === '/hideme' && isRebel) {
        sender.contextedProperties.Invisible.Value = true;
        Chat.Broadcast(`👻 ${sender.NickName} исчезает в тенях...`);
        
        sender.Timers.Get('hide_timer').Restart(30, () => {
            sender.contextedProperties.Invisible.Value = false;
            sender.Ui.Hint.Value = "Ваша скрытность закончилась!";
        });
    }

    // ======================= 👥 СОЦИАЛЬНЫЕ КОМАНДЫ =======================
    else if (mt.startsWith('/vote ') && !isKing) {
        let targetId = Number(mt.slice(6));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team === sender.Team) {
            target.Properties.Get('Votes').Value++;
            sender.Ui.Hint.Value = `🗳 Вы проголосовали за ${target.NickName}`;
            
            // Если набрано 5 голосов - повышение до рыцаря
            if (target.Properties.Get('Votes').Value >= 5 && 
                target.Properties.Get('Role').Value === "Гражданин") {
                target.Properties.Get('Role').Value = "Рыцарь";
                target.contextedProperties.MaxHp.Value = 120;
                Chat.BroadcastTeam(target.Team, `⚔️ ${target.NickName} получил рыцарское звание по голосованию!`);
            }
        }
    }

    else if (mt.startsWith('/challenge ') && !isRebel) {
        let targetId = Number(mt.slice(10));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team === sender.Team) {
            Chat.BroadcastTeam(sender.Team, `⚔️ ${sender.NickName} вызывает ${target.NickName} на дуэль!`);
            target.Ui.Hint.Value = `⚔️ Вас вызвали на дуэль! Напишите /accept ${sender.RoomID} чтобы принять`;
            sender.Timers.Get('duel_timer').Restart(30, () => {
                sender.Ui.Hint.Value = "⌛ Время дуэли истекло";
            });
        }
    }

    else if (mt.startsWith('/accept ') && !isRebel) {
        let challengerId = Number(mt.slice(8));
        let challenger = Players.GetByRoomId(challengerId);
        
        if (challenger && challenger.Team === sender.Team) {
            Chat.BroadcastTeam(sender.Team, `⚔️ ${sender.NickName} принимает вызов ${challenger.NickName}!`);
            
            // Создаем арену для дуэли
            let duelArenaPos = new Vector3(0, 50, 0); // Центр карты
            challenger.Position.Value = duelArenaPos;
            sender.Position.Value = duelArenaPos;
            
            // Включаем PvP между ними
            challenger.Damage.FriendlyFire.Value = true;
            sender.Damage.FriendlyFire.Value = true;
            
            // Через 30 секунд возвращаем обычные настройки
            Timers.Get(`duel_end_${challengerId}_${sender.RoomID}`).Restart(30, () => {
                challenger.Damage.FriendlyFire.Value = false;
                sender.Damage.FriendlyFire.Value = false;
                Chat.BroadcastTeam(sender.Team, `⚔️ Дуэль завершена!`);
                SpawnPlayer(challenger);
                SpawnPlayer(sender);
            });
        }
    }

    // ======================= 🎲 МИНИ-ИГРЫ И РАЗВЛЕЧЕНИЯ =======================
    else if (mt === '/dice') {
        let roll = Math.floor(Math.random() * 6) + 1;
        Chat.Broadcast(`🎲 ${sender.NickName} бросает кости: выпало ${roll}!`);
        
        if (roll === 6) {
            sender.Properties.Scores.Value += 100;
            sender.Ui.Hint.Value = "🎉 Крит! +100 кредитов";
        }
    }

    else if (mt === '/coin') {
        let side = Math.random() > 0.5 ? "Орел" : "Решка";
        Chat.Broadcast(`🪙 ${sender.NickName} подбрасывает монетку: ${side}!`);
        
        if (sender.Properties.Get('Guess') && sender.Properties.Get('Guess').Value === side) {
            sender.Properties.Scores.Value += 50;
            sender.Ui.Hint.Value = "✅ Угадал! +50 кредитов";
        }
    }

    else if (mt === '/rtd') {
        let bet = Math.min(100, Math.max(1, sender.Properties.Scores.Value));
        let roll = Math.floor(Math.random() * 100) + 1;
        
        if (roll > 90) {
            let win = bet * 5;
            sender.Properties.Scores.Value += win;
            Chat.Broadcast(`🎰 ${sender.NickName} выиграл ДжЕКПОТ ${win} кредитов (x5)!`);
        } else if (roll > 60) {
            let win = bet * 2;
            sender.Properties.Scores.Value += win;
            Chat.Broadcast(`🎰 ${sender.NickName} выиграл ${win} кредитов (x2)!`);
        } else {
            sender.Properties.Scores.Value -= bet;
            Chat.Broadcast(`🎰 ${sender.NickName} проиграл ${bet} кредитов...`);
        }
    }

    else if (mt.startsWith('/me ')) {
        let action = m.Text.slice(4);
        Chat.Broadcast(`* ${sender.NickName} ${action}`);
    }

    else if (mt === '/dance') {
        let dances = [
            "исполняет зажигательный танец!",
            "пускается в пляс!",
            "танцует как никто другой!",
            "выделывает па!",
            "зажигает на танцполе!"
        ];
        let dance = dances[Math.floor(Math.random() * dances.length)];
        Chat.Broadcast(`💃 ${sender.NickName} ${dance}`);
    }

    else if (mt === '/taunt') {
        let taunts = [
            "насмехается над противниками!",
            "показывает язык врагам!",
            "высмеивает навыки оппонентов!",
            "дразнит своих врагов!",
            "кричит 'Вы даже близко не стоите!'"
        ];
        let taunt = taunts[Math.floor(Math.random() * taunts.length)];
        Chat.Broadcast(`😝 ${sender.NickName} ${taunt}`);
    }

    // ======================= 🏆 СИСТЕМА ДОСТИЖЕНИЙ =======================
    else if (mt === '/achievements') {
        let achievements = [];
        
        if (sender.Properties.Get('KingSlayer').Value) {
            achievements.push("🔪 Убийца Короля");
        }
        if (sender.Properties.Kills.Value >= 10) {
            achievements.push(`⚔️ Ветеран (${sender.Properties.Kills.Value} убийств)`);
        }
        if (sender.Properties.Scores.Value >= 5000) {
            achievements.push(`💰 Богач (${sender.Properties.Scores.Value} кредитов)`);
        }
        
        if (achievements.length > 0) {
            sender.Ui.Hint.Value = "🏆 Ваши достижения:\n" + achievements.join("\n");
        } else {
            sender.Ui.Hint.Value = "У вас пока нет достижений. Продолжайте играть!";
        }
    }
});

// ======================= 🛠 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =======================
function countTeamRole(team, role) {
    return team.Players.filter(p => p.Properties.Get('Role').Value === role).length;
}

// Инициализация карты
function InitializeMap() {
    // Создаем тронные залы для команд
    const blueThronePos = new Vector3(-50, 5, 0);
    const redThronePos = new Vector3(50, 5, 0);
    
    // Синий тронный зал
    MapEditor.CreateCuboid(
        new Vector3(-60, 0, -10),
        new Vector3(-40, 15, 10),
        BuildBlocksSet.Blue
    );
    
    // Красный тронный зал
    MapEditor.CreateCuboid(
        new Vector3(40, 0, -10),
        new Vector3(60, 15, 10),
        BuildBlocksSet.Red
    );
    
    // Нейтральная территория
    MapEditor.CreateCuboid(
        new Vector3(-30, 0, -30),
        new Vector3(30, 5, 30),
        BuildBlocksSet.Grass
    );
    
    // Создаем троны
    MapEditor.CreateBlock(blueThronePos, BuildBlocksSet.Gold);
    MapEditor.CreateBlock(redThronePos, BuildBlocksSet.Gold);
}

// Инициализируем карту при старте
InitializeMap();
