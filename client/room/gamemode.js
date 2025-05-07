import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Map, MapEditor, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, Build, AreaService, AreaPlayerTriggerService, AreaViewService, Chat } from 'pixel_combats/room';

// Цвета фракций
const FactionColors = {
    Police: new Color(0, 0, 1, 0),      // Синий
    Bandits: new Color(1, 0, 0, 0),     // Красный
    Mayor: new Color(1, 1, 0, 0),       // Желтый
    Mercenaries: new Color(0, 1, 0, 0), // Зеленый
    Revolution: new Color(1, 0, 1, 0),  // Фиолетовый
    Detective: new Color(0, 1, 1, 0),   // Голубой (детектив)
    Reporter: new Color(1, 1, 1, 0)     // Белый (репортер)
};

// Специальные роли
const SpecialRoles = {
    Traitor: "Предатель",  // Скрытый во фракциях
    Maniac: "Маньяк",     // Независимый убийца
    Detective: "Детектив",// Нейтральный сыщик
    Reporter: "Репортер"  // Нейтральный журналист
};

// Система фракций
const Factions = {
    List: {
        Police: { members: [], color: FactionColors.Police, spawnPoints: [] },
        Bandits: { members: [], color: FactionColors.Bandits, spawnPoints: [] },
        Mayor: { members: [], color: FactionColors.Mayor, spawnPoints: [] },
        Mercenaries: { members: [], color: FactionColors.Mercenaries, spawnPoints: [] },
        Revolution: { members: [], color: FactionColors.Revolution, spawnPoints: [] }
    },
    PlayerToFaction: {}, // { playerId: factionName }
    Traitors: {},        // { playerId: true } - кто предатель
    SpecialRoles: {}     // { playerId: roleName } - особые роли
};

// Настройки сервера
const Props = Properties.GetContext();
Props.Get('Time_Hours').Value = 0;
Props.Get('Time_Minutes').Value = 0;
Props.Get('Time_Seconds').Value = 0;
Props.Get('GamePhase').Value = "Day"; // Day / Night / Emergency

// Настройки урона
Damage.GetContext().FriendlyFire.Value = false; // FF выключен, но предатели могут стрелять в своих

// Инициализация фракций
function InitFactions() {
    for (const factionName in Factions.List) {
        Teams.Add(factionName, factionName, Factions.List[factionName].color);
        const team = Teams.Get(factionName);
        team.Spawns.SpawnPointsGroups.Add(1);
    }
    // Добавляем нейтральные команды
    Teams.Add(SpecialRoles.Detective, SpecialRoles.Detective, FactionColors.Detective);
    Teams.Add(SpecialRoles.Reporter, SpecialRoles.Reporter, FactionColors.Reporter);
}

// Назначение ролей
function AssignRoles() {
    const allPlayers = Players.All;
    
    // 1. Назначаем предателей (по 1 на фракцию)
    for (const factionName in Factions.List) {
        const faction = Factions.List[factionName];
        if (faction.members.length > 1) {
            const randomIndex = Math.floor(Math.random() * faction.members.length);
            const traitorId = faction.members[randomIndex];
            Factions.Traitors[traitorId] = true;
            Players.Get(traitorId).Properties.Get('Role').Value = "Предатель";
            // Предатель не знает, что он предатель до триггера
        }
    }
    
    // 2. Назначаем особые роли (детектив, репортер, маньяк)
    if (allPlayers.length >= 4) {
        // Детектив
        const detective = allPlayers[Math.floor(Math.random() * allPlayers.length)];
        Factions.SpecialRoles[detective.id] = SpecialRoles.Detective;
        detective.Properties.Get('Role').Value = SpecialRoles.Detective;
        Teams.Get(SpecialRoles.Detective).Add(detective);
        
        // Репортер
        const reporter = allPlayers.find(p => p.id !== detective.id);
        if (reporter) {
            Factions.SpecialRoles[reporter.id] = SpecialRoles.Reporter;
            reporter.Properties.Get('Role').Value = SpecialRoles.Reporter;
            Teams.Get(SpecialRoles.Reporter).Add(reporter);
        }
        
        // Маньяк (если игроков достаточно)
        if (allPlayers.length >= 6) {
            const maniac = allPlayers.find(p => !Factions.SpecialRoles[p.id]);
            if (maniac) {
                Factions.SpecialRoles[maniac.id] = SpecialRoles.Maniac;
                maniac.Properties.Get('Role').Value = SpecialRoles.Maniac;
            }
        }
    }
}

// Механика предательства
function ActivateTraitor(player) {
    if (Factions.Traitors[player.id]) {
        player.Ui.Hint.Value = "ТЫ ПРЕДАТЕЛЬ! Уничтожь свою фракцию изнутри!";
        player.Properties.Get('Role').Value = "Предатель";
        Damage.GetContext(player).FriendlyFire.Value = true; // Может стрелять в своих
        
        // Даем скрытое задание
        const faction = Factions.List[Factions.PlayerToFaction[player.id]];
        if (faction.members.length > 1) {
            const targetId = faction.members.find(id => id !== player.id);
            if (targetId) {
                player.Timers.Get('TraitorMission').Restart(60, () => {
                    player.Ui.Hint.Value = `Убей ${Players.Get(targetId).NickName} до конца дня!`;
                });
            }
        }
    }
}

// Система дня и ночи
const DayNightTimer = Timers.GetContext().Get('DayNightCycle');
DayNightTimer.OnTimer.Add(function(t) {
    if (Props.Get('GamePhase').Value === "Day") {
        Props.Get('GamePhase').Value = "Night";
        Chat.Broadcast("🌙 Наступает ночь... Предатели активируются!");
        
        // Активируем всех предателей ночью
        for (const playerId in Factions.Traitors) {
            const player = Players.Get(playerId);
            if (player) ActivateTraitor(player);
        }
        
        // Маньяк может убивать ночью
        for (const playerId in Factions.SpecialRoles) {
            if (Factions.SpecialRoles[playerId] === SpecialRoles.Maniac) {
                const maniac = Players.Get(playerId);
                maniac.Ui.Hint.Value = "Охота началась... Выбери жертву!";
            }
        }
    } else {
        Props.Get('GamePhase').Value = "Day";
        Chat.Broadcast("☀ Наступает день. Детектив ищет улики...");
        
        // Детектив получает подсказку
        for (const playerId in Factions.SpecialRoles) {
            if (Factions.SpecialRoles[playerId] === SpecialRoles.Detective) {
                const detective = Players.Get(playerId);
                const randomClue = GetRandomClue();
                detective.Ui.Hint.Value = `Подсказка: ${randomClue}`;
            }
        }
    }
    DayNightTimer.RestartLoop(300); // 5 минут день/ночь
});

// Детективные улики
function GetRandomClue() {
    const clues = [
        "Предатель был замечен возле склада",
        "Кто-то подкупил охранника",
        "На месте преступления найдено оружие",
        "Свидетель видел подозрительного человека"
    ];
    return clues[Math.floor(Math.random() * clues.length)];
}

// Репортерские сенсации
function PublishNews(reporter, targetId, scandalType) {
    const target = Players.Get(targetId);
    if (!target) return;
    
    let message = "";
    switch (scandalType) {
        case "corruption":
            message = `📰 СКАНДАЛ: ${target.NickName} замечен в коррупции!`;
            target.Properties.Get('Reputation').Value -= 20;
            break;
        case "murder":
            message = `📰 КРИМИНАЛ: ${target.NickName} подозревается в убийстве!`;
            target.Properties.Get('Reputation').Value -= 30;
            break;
        case "secret":
            message = `📰 РАЗОБЛАЧЕНИЕ: ${target.NickName} скрывает тайну!`;
            target.Properties.Get('Reputation').Value -= 15;
            break;
    }
    
    Chat.Broadcast(message);
    reporter.Properties.Get('Scores').Value += 50;
}

// Обработчик убийств
Damage.OnKill.Add(function(killer, victim) {
    // Проверяем, был ли это предатель
    if (Factions.Traitors[killer.id] && Factions.PlayerToFaction[killer.id] === Factions.PlayerToFaction[victim.id]) {
        killer.Properties.Get('Scores').Value += 100;
        Chat.Broadcast(`💀 ПРЕДАТЕЛЬСТВО! ${killer.NickName} убил союзника!`);
    }
    
    // Проверяем, был ли это маньяк
    if (Factions.SpecialRoles[killer.id] === SpecialRoles.Maniac) {
        killer.Properties.Get('Scores').Value += 75;
        Chat.Broadcast(`🔪 КРОВАВАЯ РАСПРАВА! Маньяк нанес удар!`);
    }
    
    // Если убили детектива или репортера
    if (Factions.SpecialRoles[victim.id] === SpecialRoles.Detective) {
        Chat.Broadcast("🕵️‍♂️ Детектив убит! Город остался без защиты!");
    }
    if (Factions.SpecialRoles[victim.id] === SpecialRoles.Reporter) {
        Chat.Broadcast("📰 Репортер убит! Правда похоронена вместе с ним!");
    }
});

// Команды для игроков
Chat.OnPlayerChat.Add(function(player, msg) {
    if (msg === "/faction") {
        const faction = Factions.PlayerToFaction[player.id];
        player.Ui.Hint.Value = `Ваша фракция: ${faction || "Нет"}`;
        return false;
    }
    
    if (msg === "/role") {
        const role = player.Properties.Get('Role').Value || "Обычный член фракции";
        player.Ui.Hint.Value = `Ваша роль: ${role}`;
        return false;
    }
    
    if (msg.startsWith("/report ")) {
        if (Factions.SpecialRoles[player.id] === SpecialRoles.Reporter) {
            const args = msg.split(" ");
            if (args.length >= 3) {
                const target = Players.Find(p => p.NickName === args[1]);
                if (target) {
                    PublishNews(player, target.id, args[2]);
                    return false;
                }
            }
        }
    }
    
    return true;
});

// Инициализация игры
InitFactions();
AssignRoles();
DayNightTimer.RestartLoop(300);
