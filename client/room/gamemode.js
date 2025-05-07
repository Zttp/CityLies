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
    let isKing = sender.id === Kings.Blue || sender.id === Kings.Red;
    let isBlueKing = sender.id === Kings.Blue;
    let isRedKing = sender.id === Kings.Red;

    // ======================= 📜 ОБЩИЕ КОМАНДЫ =======================
    if (mt === '/help') {
        let helpMsg = `
<b>🛠 Доступные команды:</b>
<b>🔹 Основные:</b>
/info - информация о режиме
/king - текущие короли
/teams - состав команд
/rtd - испытать удачу (1-50 кредитов)

<b>👑 Королевские команды:</b>
/peace - предложить перемирие
/promote [id] - повысить союзника
/demote [id] - понизить союзника
/reward [id] [amount] - наградить союзника
/decree [text] - королевский указ
`;

        if (isKing) {
            helpMsg += `
<b>⚔️ Военные команды:</b>
/attack - объявить атаку
/defense - режим обороны
/call [text] - призыв к атаке
`;
        }

        sender.Ui.Hint.Value = helpMsg;
    }
    else if (mt === '/info') {
        sender.Ui.Hint.Value = `
<b>⚔️ Режим "Два Королевства":</b>
• 2 команды: Синее и Красное королевства
• В каждой команде есть король
• Убийство короля врага: +1000 очков
• Защита своего короля - главная цель
• Короли могут издавать указы и награждать союзников
`;
    }
    else if (mt === '/king') {
        let blueKing = Kings.Blue ? Players.Get(Kings.Blue).NickName : "Нет короля";
        let redKing = Kings.Red ? Players.Get(Kings.Red).NickName : "Нет короля";
        sender.Ui.Hint.Value = `
<b>👑 Текущие короли:</b>
Синее Королевство: ${blueKing}
Красное Королевство: ${redKing}
`;
    }
    else if (mt === '/teams') {
        let blueCount = BlueTeam.PlayersCount;
        let redCount = RedTeam.PlayersCount;
        sender.Ui.Hint.Value = `
<b>👥 Состав команд:</b>
Синее Королевство: ${blueCount} игроков
Красное Королевство: ${redCount} игроков
Баланс: ${Math.abs(blueCount - redCount)}
`;
    }
    else if (mt === '/rtd') {
        let randomCredits = Math.floor(Math.random() * 50) + 1;
        sender.Properties.Scores.Value += randomCredits;
        sender.Ui.Hint.Value = `🎰 Выпало ${randomCredits} кредитов!`;
        Chat.Broadcast(`${sender.NickName} выиграл ${randomCredits} кредитов в лотерее!`);
    }

    // ======================= 👑 КОРОЛЕВСКИЕ КОМАНДЫ =======================
    else if (mt === '/peace' && isKing) {
        let enemyKingId = isBlueKing ? Kings.Red : Kings.Blue;
        let enemyKing = Players.Get(enemyKingId);
        
        if (enemyKing) {
            Chat.Broadcast(`Король ${sender.NickName} предлагает перемирие королю ${enemyKing.NickName}!`);
            enemyKing.Ui.Hint.Value = `Король ${sender.NickName} предлагает перемирие! Напишите /peace для согласия.`;
            sender.Ui.Hint.Value = `Предложение перемирия отправлено королю ${enemyKing.NickName}`;
        } else {
            sender.Ui.Hint.Value = `У противников нет короля для переговоров!`;
        }
    }
    else if (mt.startsWith('/promote') && isKing) {
        let targetId = Number(mt.slice(9));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team === sender.Team) {
            target.Properties.Get('Role').Value = 'Генерал';
            target.contextedProperties.MaxHp.Value += 25;
            Chat.BroadcastTeam(sender.Team, `${target.NickName} повышен до Генерала королем ${sender.NickName}!`);
        } else {
            sender.Ui.Hint.Value = `Игрок не найден или не в вашей команде!`;
        }
    }
    else if (mt.startsWith('/demote') && isKing) {
        let targetId = Number(mt.slice(8));
        let target = Players.GetByRoomId(targetId);
        
        if (target && target.Team === sender.Team && target.Properties.Get('Role').Value !== 'Король') {
            target.Properties.Get('Role').Value = 'Воин';
            target.contextedProperties.MaxHp.Value = 100;
            Chat.BroadcastTeam(sender.Team, `${target.NickName} понижен до Воина королем ${sender.NickName}!`);
        } else {
            sender.Ui.Hint.Value = `Нельзя понизить этого игрока!`;
        }
    }
    else if (mt.startsWith('/reward') && isKing) {
        let parts = mt.split(' ');
        if (parts.length >= 3) {
            let targetId = Number(parts[1]);
            let amount = Number(parts[2]);
            let target = Players.GetByRoomId(targetId);
            
            if (target && target.Team === sender.Team && amount > 0) {
                target.Properties.Scores.Value += amount;
                Chat.BroadcastTeam(sender.Team, `Король ${sender.NickName} наградил ${target.NickName} ${amount} кредитами!`);
            } else {
                sender.Ui.Hint.Value = `Неверная команда! Используйте: /reward [id] [amount]`;
            }
        }
    }
    else if (mt.startsWith('/decree') && isKing) {
        let decreeText = mt.slice(8);
        if (decreeText) {
            Chat.BroadcastTeam(sender.Team, `📜 <b>Королевский указ:</b> ${decreeText}`);
        } else {
            sender.Ui.Hint.Value = `Напишите текст указа после команды!`;
        }
    }

    // ======================= ⚔️ ВОЕННЫЕ КОМАНДЫ (ТОЛЬКО КОРОЛИ) =======================
    else if (mt === '/attack' && isKing) {
        Chat.BroadcastTeam(sender.Team, `⚔️ Король ${sender.NickName} объявляет всеобщую атаку! В бой!`);
        // Можно добавить временные баффы для атаки
        for (let player of sender.Team.Players) {
            player.Ui.Hint.Value = "⚔️ Режим атаки! +10% урона в течение 5 минут!";
            // player.Damage.DamageOut.Value *= 1.1; // +10% урона
        }
    }
    else if (mt === '/defense' && isKing) {
        Chat.BroadcastTeam(sender.Team, `🛡 Король ${sender.NickName} объявляет режим обороны! Защищайте королевство!`);
        // Можно добавить временные баффы для защиты
        for (let player of sender.Team.Players) {
            player.Ui.Hint.Value = "🛡 Режим обороны! +10% защиты в течение 5 минут!";
            // player.Damage.DamageIn.Value *= 0.9; // -10% получаемого урона
        }
    }
    else if (mt.startsWith('/call') && isKing) {
        let callText = mt.slice(5);
        if (callText) {
            Chat.BroadcastTeam(sender.Team, `📣 <b>Призыв короля ${sender.NickName}:</b> ${callText}`);
        } else {
            sender.Ui.Hint.Value = `Напишите текст призыва после команды!`;
        }
    }

    // ======================= 🛡 АДМИН-КОМАНДЫ =======================
    else if (mt.startsWith('/setking') && sender.Build.BuildRangeEnable.Value) {
        let targetId = Number(mt.slice(8));
        let target = Players.GetByRoomId(targetId);
        
        if (target) {
            AssignKing(target.Team, target);
            Chat.Broadcast(`Администратор назначил ${target.NickName} королем ${target.Team.displayName}!`);
        }
    }
    else if (mt.startsWith('/swapkings') && sender.Build.BuildRangeEnable.Value) {
        if (Kings.Blue && Kings.Red) {
            let blueKing = Players.Get(Kings.Blue);
            let redKing = Players.Get(Kings.Red);
            
            AssignKing(RedTeam, blueKing);
            AssignKing(BlueTeam, redKing);
            
            Chat.Broadcast(`Администратор поменял королей местами!`);
        }
    }
});
