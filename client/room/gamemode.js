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
            prevKing.Properties.Get('Role').Value = 'Воин';
            prevKing.contextedProperties.SkinType.Value = 0;
            prevKing.Ui.Hint.Value = 'Вы больше не король Синего Королевства';
        }
    } else if (team.name === 'RedKingdom' && Kings.Red) {
        const prevKing = Players.Get(Kings.Red);
        if (prevKing) {
            prevKing.Properties.Get('Role').Value = 'Воин';
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
    Chat.Broadcast(`Новый король ${team.displayName}: ${player.NickName}!`);
    player.Ui.Hint.Value = `Вы стали королем ${team.displayName}! Защищайте свое королевство!`;
}

// Функция для проверки смерти короля
function CheckKingDeath(killedPlayer) {
    if (killedPlayer.id === Kings.Blue) {
        // Король синего королевства убит
        Chat.Broadcast(`Король Синего Королевства пал в бою!`);
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
        Chat.Broadcast(`Король Красного Королевства пал в бою!`);
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
    p.Ui.Hint.Value = 'Добро пожаловать в битву королевств!';
});

Teams.OnRequestJoinTeam.Add(function(p, t) {
    // Инициализация свойств игрока
    p.Properties.Get('Kills').Value = 0;
    p.Properties.Get('Deaths').Value = 0;
    p.Properties.Get('Scores').Value = 0;
    p.Properties.Get('Role').Value = 'Воин';
    p.Properties.Get('Kingdom').Value = t.displayName;
    
    // Распределение по командам с балансировкой
    if (BlueTeam.PlayersCount <= RedTeam.PlayersCount) {
        BlueTeam.Add(p);
    } else {
        RedTeam.Add(p);
    }
    
    // Если в команде нет короля и это не первая команда, назначаем короля
    if (p.Team.name === 'BlueKingdom' && !Kings.Blue && BlueTeam.PlayersCount > 0) {
        AssignKing(BlueTeam, p);
    } else if (p.Team.name === 'RedKingdom' && !Kings.Red && RedTeam.PlayersCount > 0) {
        AssignKing(RedTeam, p);
    }
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
        Chat.Broadcast(`${p.NickName} покинул трон ${oldTeam.displayName}!`);
    }
    
    // Добавляем в новую команду
    newTeam.Add(p);
    p.Properties.Get('Kingdom').Value = newTeam.displayName;
    
    // Если в новой команде нет короля, назначаем
    if (newTeam.name === 'BlueKingdom' && !Kings.Blue) {
        AssignKing(BlueTeam, p);
    } else if (newTeam.name === 'RedKingdom' && !Kings.Red) {
        AssignKing(RedTeam, p);
    }
    
    p.Spawns.Spawn();
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

// Старт таймеров
KingCheckTimer.RestartLoop(30);

Chat.OnMessage.Add(function(m) {
    let mt = m.Text.toLowerCase().trim();
    let sender = Players.GetByRoomId(m.Sender);
    let senderRole = sender.Properties.Get('Role').Value;
    let isKing = senderRole === "KING";
    let isRoyalGuard = senderRole === "ROYAL_GUARD";
    let isKnight = senderRole === "KNIGHT";
    let isRebel = senderRole === "REBEL";
    let isCitizen = senderRole === "CITIZEN";

    // ======================= 📜 ОБЩИЕ КОМАНДЫ (ВСЕМ) =======================
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

<b>👥 Социальные:</b>
/vote [ник] - проголосовать за игрока
/gift [RID] [сумма] - подарить кредиты
/challenge [RID] - вызов на дуэль
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
`;

        if (isRoyalGuard) helpMsg += `
<b>🛡 Команды гвардии:</b>
/protect - защитить короля (+10HP)
/check [RID] - обыскать игрока
/arrest [RID] - арестовать нарушителя
`;

        if (isKnight) helpMsg += `
<b>⚔️ Рыцарские команды:</b>
/oath - принести клятву верности
/train - тренировать новобранцев
/patrol - начать патрулирование
`;

        if (isRebel) helpMsg += `
<b>🎭 Команды мятежников:</b>
/rebellion - начать восстание
/hideme - скрыться на 30 сек
/sabotage - саботировать постройки
/spy [RID] - шпионить за игроком
`;

        sender.Ui.Hint.Value = helpMsg;
    }

    // ======================= 👑 КОРОЛЕВСКИЕ КОМАНДЫ =======================
    else if (mt.startsWith('/hunt ') && isKing) {
        let targetId = Number(mt.slice(6));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team !== sender.Team) {
            // Устанавливаем награду за голову
            target.Properties.Get('Bounty').Value = 1000;
            Chat.Broadcast(`🏹 Король ${sender.NickName} объявил охоту на ${target.NickName}! Награда: 1000 кредитов!`);
            
            // Помечаем цель для всех
            target.contextedProperties.GlowColor.Value = new Color(1, 0, 0, 0);
            target.Timers.Get('hunt_timer').Restart(300, () => {
                target.Properties.Get('Bounty').Value = 0;
                target.contextedProperties.GlowColor.Value = null;
            });
        }
    }

    else if (mt.startsWith('/appoint ') && isKing) {
        let args = mt.split(' ');
        if (args.length >= 3) {
            let targetId = Number(args[1]);
            let position = args[2];
            let target = Players.GetByRoomId(targetId);
            
            if (target && target.Team === sender.Team) {
                switch(position) {
                    case 'guard':
                        KingProtectionSystem.assignGuard(sender, target);
                        break;
                    case 'general':
                        target.Properties.Get('Role').Value = "GENERAL";
                        target.contextedProperties.MaxHp.Value = 140;
                        Chat.BroadcastTeam(sender.Team, `🎖 ${target.NickName} назначен Генералом!`);
                        break;
                    case 'knight':
                        if (countTeamRole(sender.Team, "KNIGHT") < 5) {
                            target.Properties.Get('Role').Value = "KNIGHT";
                            target.contextedProperties.MaxHp.Value = 120;
                            Chat.BroadcastTeam(sender.Team, `⚔️ ${target.NickName} посвящен в Рыцари!`);
                        } else {
                            sender.Ui.Hint.Value = "Уже максимальное количество рыцарей (5)!";
                        }
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

    // ======================= ⚔️ РЫЦАРСКИЕ КОМАНДЫ =======================
    else if (mt === '/oath' && isKnight) {
        sender.Ui.Hint.Value = "⚔️ Вы клянетесь защищать королевство до последней капли крови!";
        Chat.BroadcastTeam(sender.Team, `⚔️ Рыцарь ${sender.NickName} приносит клятву верности!`);
        sender.contextedProperties.MaxHp.Value += 10;
    }

    else if (mt === '/train' && isKnight) {
        let nearbyCitizens = sender.Team.Players.filter(p => 
            p.Properties.Get('Role').Value === "CITIZEN" &&
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

    // ======================= 👥 СОЦИАЛЬНЫЕ КОМАНДЫ =======================
    else if (mt.startsWith('/vote ') && !isKing) {
        let targetId = Number(mt.slice(6));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team === sender.Team) {
            target.Properties.Get('Votes').Value++;
            sender.Ui.Hint.Value = `🗳 Вы проголосовали за ${target.NickName}`;
            
            // Если набрано 5 голосов - повышение до рыцаря
            if (target.Properties.Get('Votes').Value >= 5 && 
                target.Properties.Get('Role').Value === "CITIZEN") {
                target.Properties.Get('Role').Value = "KNIGHT";
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
            });
        }
    }

    // ======================= 🏆 СИСТЕМА НАГРАД =======================
    else if (mt.startsWith('/reward') && (isKing || isRoyalGuard)) {
        let args = mt.split(' ');
        if (args.length >= 3) {
            let targetId = Number(args[1]);
            let amount = Number(args[2]);
            let target = Players.GetByRoomId(targetId);
            
            if (target && target.Team === sender.Team && amount > 0) {
                target.Properties.Scores.Value += amount;
                Chat.BroadcastTeam(sender.Team, `💰 ${sender.NickName} награждает ${target.NickName} ${amount} кредитами!`);
            }
        }
    }

    // ======================= 🎲 МИНИ-ИГРЫ =======================
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
});

// ======================= 🎯 ОБРАБОТКА НАГРАД ЗА ОХОТУ =======================
Damage.OnKill.Add(function(killer, victim) {
    // Награда за охоту
    if (victim.Properties.Get('Bounty').Value > 0) {
        let bounty = victim.Properties.Get('Bounty').Value;
        killer.Properties.Scores.Value += bounty;
        Chat.Broadcast(`🏆 ${killer.NickName} получил награду ${bounty} за голову ${victim.NickName}!`);
        victim.Properties.Get('Bounty').Value = 0;
        victim.contextedProperties.GlowColor.Value = null;
    }
    
    // Автоматическое голосование за убийцу
    if (killer.Team === victim.Team && victim.Properties.Get('Role').Value === "REBEL") {
        killer.Properties.Get('Votes').Value++;
    }
});

// ======================= 🛠 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =======================
function countTeamRole(team, role) {
    return team.Players.filter(p => p.Properties.Get('Role').Value === role).length;
}
