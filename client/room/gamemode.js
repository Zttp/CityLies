import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Map, Players, Inventory, LeaderBoard, Teams, Damage, Ui, Properties, Spawns, Timers, Chat } from 'pixel_combats/room';

// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    DAY_NIGHT_CYCLE: 300, // 5 минут на фазу
    TRAITOR_REVEAL_CHANCE: 0.3, // 30% шанс что предатель узнает о себе
    DETECTIVE_CLUES: [
        "Предатель был замечен возле склада",
        "Кто-то подкупил охранника",
        "На месте преступления найдено оружие",
        "Свидетель видел подозрительного человека"
    ]
};

// Цвета фракций
const FACTION_COLORS = {
    POLICE: new Color(0, 0, 1, 0),      // Синий
    BANDITS: new Color(1, 0, 0, 0),     // Красный
    MAYOR: new Color(1, 1, 0, 0),       // Желтый
    MERCENARIES: new Color(0, 1, 0, 0), // Зеленый
    REVOLUTION: new Color(1, 0, 1, 0),  // Фиолетовый
    DETECTIVE: new Color(0, 1, 1, 0),   // Голубой
    REPORTER: new Color(1, 1, 1, 0)     // Белый
};

// Типы ролей
const ROLE_TYPES = {
    TRAITOR: "Предатель",
    MANIAC: "Маньяк",
    DETECTIVE: "Детектив",
    REPORTER: "Репортер",
    DEFAULT: "Горожанин"
};

// ========== СИСТЕМА ФРАКЦИЙ ==========
class FactionSystem {
    constructor() {
        this.factions = {
            POLICE: { name: "Полиция", members: [], color: FACTION_COLORS.POLICE },
            BANDITS: { name: "Бандиты", members: [], color: FACTION_COLORS.BANDITS },
            MAYOR: { name: "Администрация", members: [], color: FACTION_COLORS.MAYOR },
            MERCENARIES: { name: "Наемники", members: [], color: FACTION_COLORS.MERCENARIES },
            REVOLUTION: { name: "Революционеры", members: [], color: FACTION_COLORS.REVOLUTION }
        };
        
        this.playerRoles = {};
        this.traitors = new Set();
        this.dayNightPhase = "DAY";
    }

    initTeams() {
        for (const [id, data] of Object.entries(this.factions)) {
            if (!Teams.Get(id)) {
                Teams.Add(id, data.name, data.color);
                Teams.Get(id).Spawns.SpawnPointsGroups.Add(1);
            }
        }
        
        // Создаем команды для особых ролей
        if (!Teams.Get(ROLE_TYPES.DETECTIVE)) {
            Teams.Add(ROLE_TYPES.DETECTIVE, ROLE_TYPES.DETECTIVE, FACTION_COLORS.DETECTIVE);
        }
        if (!Teams.Get(ROLE_TYPES.REPORTER)) {
            Teams.Add(ROLE_TYPES.REPORTER, ROLE_TYPES.REPORTER, FACTION_COLORS.REPORTER);
        }
    }

    assignPlayerToFaction(player, factionId) {
        if (this.factions[factionId]) {
            this.factions[factionId].members.push(player.id);
            this.playerRoles[player.id] = { faction: factionId, role: ROLE_TYPES.DEFAULT };
            Teams.Get(factionId).Add(player);
            player.Properties.Get("Faction").Value = factionId;
            player.Properties.Get("Role").Value = ROLE_TYPES.DEFAULT;
            return true;
        }
        return false;
    }

    assignSpecialRoles() {
        const players = Players.All.filter(p => !this.playerRoles[p.id]?.role);
        if (players.length < 4) return;

        // Выбираем детектива
        const detective = players[Math.floor(Math.random() * players.length)];
        this.playerRoles[detective.id] = { role: ROLE_TYPES.DETECTIVE };
        Teams.Get(ROLE_TYPES.DETECTIVE).Add(detective);
        detective.Properties.Get("Role").Value = ROLE_TYPES.DETECTIVE;

        // Выбираем репортера из оставшихся
        const reporter = players.find(p => p.id !== detective.id);
        if (reporter) {
            this.playerRoles[reporter.id] = { role: ROLE_TYPES.REPORTER };
            Teams.Get(ROLE_TYPES.REPORTER).Add(reporter);
            reporter.Properties.Get("Role").Value = ROLE_TYPES.REPORTER;
        }

        // Выбираем маньяка если игроков достаточно
        if (players.length >= 6) {
            const maniac = players.find(p => !this.playerRoles[p.id]);
            if (maniac) {
                this.playerRoles[maniac.id] = { role: ROLE_TYPES.MANIAC };
                maniac.Properties.Get("Role").Value = ROLE_TYPES.MANIAC;
            }
        }
    }

    assignTraitors() {
        for (const [factionId, data] of Object.entries(this.factions)) {
            if (data.members.length > 1) {
                const traitorId = data.members[Math.floor(Math.random() * data.members.length)];
                this.traitors.add(traitorId);
                this.playerRoles[traitorId].role = ROLE_TYPES.TRAITOR;
                Players.Get(traitorId).Properties.Get("Role").Value = ROLE_TYPES.TRAITOR;
            }
        }
    }

    startDayNightCycle() {
        Timers.GetContext().Get("DayNightTimer").OnTimer.Add((timer) => {
            this.dayNightPhase = this.dayNightPhase === "DAY" ? "NIGHT" : "DAY";
            Chat.Broadcast(this.dayNightPhase === "DAY" ? 
                "☀ Наступает день. Детектив ищет улики..." : 
                "🌙 Наступает ночь... Предатели активируются!");

            // Активируем предателей ночью
            if (this.dayNightPhase === "NIGHT") {
                this.traitors.forEach(traitorId => {
                    const player = Players.Get(traitorId);
                    if (player && Math.random() < CONFIG.TRAITOR_REVEAL_CHANCE) {
                        player.Ui.Hint.Value = "ТЫ ПРЕДАТЕЛЬ! Уничтожь свою фракцию изнутри!";
                        Damage.GetContext(player).FriendlyFire.Value = true;
                    }
                });
            }

            // Даем подсказку детективу днем
            if (this.dayNightPhase === "DAY") {
                for (const [playerId, roleData] of Object.entries(this.playerRoles)) {
                    if (roleData.role === ROLE_TYPES.DETECTIVE) {
                        const clue = CONFIG.DETECTIVE_CLUES[
                            Math.floor(Math.random() * CONFIG.DETECTIVE_CLUES.length)
                        ];
                        Players.Get(playerId).Ui.Hint.Value = `Подсказка: ${clue}`;
                    }
                }
            }

            timer.RestartLoop(CONFIG.DAY_NIGHT_CYCLE);
        }).RestartLoop(CONFIG.DAY_NIGHT_CYCLE);
    }
}

// ========== ОСНОВНОЙ КОД ==========
const factionSystem = new FactionSystem();

// Инициализация при старте
function InitGame() {
    // Настройка свойств сервера
    const Props = Properties.GetContext();
    Props.Get('GamePhase').Value = "DAY";
    Props.Get('Time_Hours').Value = 0;
    Props.Get('Time_Minutes').Value = 0;

    // Инициализация фракций
    factionSystem.initTeams();
    
    // Настройка таблицы лидеров
    LeaderBoard.PlayerLeaderBoardValues = [
        new DisplayValueHeader('Kills', 'Убийства', 'Убийств'),
        new DisplayValueHeader('Deaths', 'Смерти', 'Смертей'),
        new DisplayValueHeader('Faction', 'Фракция', 'Фракция'),
        new DisplayValueHeader('Role', 'Роль', 'Роль')
    ];

    // Настройка урона
    Damage.GetContext().FriendlyFire.Value = false;
}

// Обработчик подключения игрока
Players.OnPlayerConnected.Add((player) => {
    if (!player.Properties.Get("Faction").Value) {
        // Распределяем по фракциям для баланса
        const factionIds = Object.keys(factionSystem.factions);
        const smallestFaction = factionIds.reduce((smallest, current) => 
            factionSystem.factions[current].members.length < factionSystem.factions[smallest].members.length ? 
            current : smallest, factionIds[0]);
        
        factionSystem.assignPlayerToFaction(player, smallestFaction);
    }
    
    player.Ui.Hint.Value = `Добро пожаловать в Город Лжи, ${player.NickName}!`;
});

// Обработчик смены команды
Teams.OnPlayerChangeTeam.Add((player) => {
    player.Spawns.Spawn();
});

// Обработчик убийств
Damage.OnKill.Add((killer, victim) => {
    const killerRole = factionSystem.playerRoles[killer.id]?.role;
    const victimRole = factionSystem.playerRoles[victim.id]?.role;
    
    // Предатель убил своего
    if (factionSystem.traitors.has(killer.id) && 
        factionSystem.playerRoles[killer.id]?.faction === factionSystem.playerRoles[victim.id]?.faction) {
        Chat.Broadcast(`💀 ПРЕДАТЕЛЬСТВО! ${killer.NickName} убил союзника!`);
        killer.Properties.Get('Kills').Value += 1;
        killer.Properties.Get('Scores').Value += 100;
    }
    
    // Маньяк убил кого-то
    else if (killerRole === ROLE_TYPES.MANIAC) {
        Chat.Broadcast(`🔪 КРОВАВАЯ РАСПРАВА! Маньяк убил ${victim.NickName}!`);
        killer.Properties.Get('Kills').Value += 1;
        killer.Properties.Get('Scores').Value += 75;
    }
    
    // Убили детектива или репортера
    else if (victimRole === ROLE_TYPES.DETECTIVE) {
        Chat.Broadcast("🕵️‍♂️ Детектив убит! Город остался без защиты!");
    } 
    else if (victimRole === ROLE_TYPES.REPORTER) {
        Chat.Broadcast("📰 Репортер убит! Правда похоронена вместе с ним!");
    }
    
    victim.Properties.Get('Deaths').Value += 1;
});

// Чат-команды
Chat.OnPlayerChat.Add((player, msg) => {
    if (msg === "/role") {
        const role = player.Properties.Get("Role").Value || ROLE_TYPES.DEFAULT;
        player.Ui.Hint.Value = `Ваша роль: ${role}`;
        return false;
    }
    
    if (msg === "/faction") {
        const faction = player.Properties.Get("Faction").Value || "Нет";
        player.Ui.Hint.Value = `Ваша фракция: ${faction}`;
        return false;
    }
    
    // Команда для репортера
    if (msg.startsWith("/report ") && factionSystem.playerRoles[player.id]?.role === ROLE_TYPES.REPORTER) {
        const args = msg.split(" ");
        if (args.length >= 3) {
            const target = Players.Find(p => p.NickName === args[1]);
            if (target) {
                const scandalType = args[2];
                let message = "";
                
                switch (scandalType) {
                    case "corruption":
                        message = `📰 СКАНДАЛ: ${target.NickName} замечен в коррупции!`;
                        break;
                    case "murder":
                        message = `📰 КРИМИНАЛ: ${target.NickName} подозревается в убийстве!`;
                        break;
                    default:
                        message = `📰 НОВОСТЬ: ${target.NickName} замечен в подозрительной деятельности!`;
                }
                
                Chat.Broadcast(message);
                player.Properties.Get('Scores').Value += 50;
                return false;
            }
        }
    }
    
    return true;
});

// Запуск игры
InitGame();

// Распределяем роли после подключения всех игроков
Timers.GetContext().Get("RoleAssignment").Restart(10, () => {
    factionSystem.assignSpecialRoles();
    factionSystem.assignTraitors();
    factionSystem.startDayNightCycle();
});
