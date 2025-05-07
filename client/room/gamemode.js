import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Map, MapEditor, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, Build, AreaService, AreaPlayerTriggerService, AreaViewService, Chat } from 'pixel_combats/room';

// Цвета
const weaponColor = new Color(0, 1, 1, 1);
const skinColor = new Color(0, 5, 0, 0);
const blockColor = new Color(128, 128, 0, 0);
const flyColor = new Color(3, 0, 1, 0);
const hpColor = new Color(9, 9, 0, 0);
const statColor = new Color(1, 0, 0, 1);
const spawnColor = new Color(1, 1, 0, 1);
const banColor = new Color(0, 0, 0, 0);
const miColor = new Color(1, 1, 1, 0);

// Контексты
const Inv = Inventory.GetContext();
const Sp = Spawns.GetContext();
const Dmg = Damage.GetContext();

// Важные игроки
const ImportantPlayersIDs = {
    Admins: ['D411BD94CAE31F89', '', ''],
    VIPs: {
        LVL3: ['2827CD16AE7CC982'],
        LVL2: [''],
        LVL1: ['']
    },
    Bans: ['']
};

// Настройки урона
Dmg.DamageOut.Value = true;
Dmg.FriendlyFire.Value = false; // Отключен френдли файр для команд
BreackGraph.OnlyPlayerBlocksDmg = true;

// Настройки свойств сервера
const Props = Properties.GetContext();
Props.Get('Time_Hours').Value = 0;
Props.Get('Time_Minutes').Value = 0;
Props.Get('Time_Seconds').Value = 0;
Props.Get('Players_Now').Value = 0;
Props.Get('Players_WereMax').Value = 24;
Props.Get('Time_FixedString').Value = '00:00:00';

// Королевства
const Kingdoms = {
    Red: {
        name: "Красное Королевство",
        color: new Color(1, 0, 0, 0),
        king: null,
        nobles: [], // Дворяне
        knights: [], // Рыцари
        peasants: [], // Крестьяне
        treasury: 0, // Казна
        spawnPoints: []
    },
    Blue: {
        name: "Синее Королевство",
        color: new Color(0, 0, 1, 0),
        king: null,
        nobles: [],
        knights: [],
        peasants: [],
        treasury: 0,
        spawnPoints: []
    },
    // Роли и их привилегии
    Roles: {
        KING: {
            name: "Король",
            perks: {
                maxHp: 200,
                damageMultiplier: 1.5,
                canTax: true,
                canPromote: true,
                canPardon: true,
                buildBlocks: BuildBlocksSet.AllClear
            }
        },
        NOBLE: {
            name: "Дворянин",
            perks: {
                maxHp: 150,
                damageMultiplier: 1.2,
                buildBlocks: BuildBlocksSet.AllClear
            }
        },
        KNIGHT: {
            name: "Рыцарь",
            perks: {
                maxHp: 125,
                damageMultiplier: 1.1,
                buildBlocks: BuildBlocksSet.Blue
            }
        },
        PEASANT: {
            name: "Крестьянин",
            perks: {
                maxHp: 100,
                damageMultiplier: 1.0,
                buildBlocks: BuildBlocksSet.Blue
            }
        }
    },
    // Функции для работы с королевствами
    assignRole: function(player, role) {
        const kingdom = this.getPlayerKingdom(player);
        if (!kingdom) return false;
        
        // Удаляем из всех ролей
        kingdom.peasants = kingdom.peasants.filter(id => id !== player.id);
        kingdom.knights = kingdom.knights.filter(id => id !== player.id);
        kingdom.nobles = kingdom.nobles.filter(id => id !== player.id);
        
        // Назначаем новую роль
        switch(role) {
            case 'PEASANT':
                kingdom.peasants.push(player.id);
                break;
            case 'KNIGHT':
                kingdom.knights.push(player.id);
                break;
            case 'NOBLE':
                kingdom.nobles.push(player.id);
                break;
            case 'KING':
                if (kingdom.king) {
                    this.assignRole(Players.Get(kingdom.king), 'NOBLE'); // Бывший король становится дворянином
                }
                kingdom.king = player.id;
                break;
        }
        
        this.applyRolePerks(player, role);
        player.Properties.Get('Role').Value = this.Roles[role].name;
        return true;
    },
    
    getPlayerKingdom: function(player) {
        if (player.Team.Name === 'Red') return this.Red;
        if (player.Team.Name === 'Blue') return this.Blue;
        return null;
    },
    
    getPlayerRole: function(player) {
        const kingdom = this.getPlayerKingdom(player);
        if (!kingdom) return null;
        
        if (kingdom.king === player.id) return 'KING';
        if (kingdom.nobles.includes(player.id)) return 'NOBLE';
        if (kingdom.knights.includes(player.id)) return 'KNIGHT';
        return 'PEASANT';
    },
    
    applyRolePerks: function(player, role) {
        const perks = this.Roles[role].perks;
        
        player.contextedProperties.MaxHp.Value = perks.maxHp;
        player.Damage.DamageOut.Value = perks.damageMultiplier;
        player.Build.BlocksSet.Value = perks.buildBlocks;
        
        // Особые способности для короля
        if (role === 'KING') {
            player.inventory.Main.Value = true;
            player.inventory.MainInfinity.Value = true;
            player.inventory.Secondary.Value = true;
            player.inventory.SecondaryInfinity.Value = true;
            player.inventory.Melee.Value = true;
            player.Build.FlyEnable.Value = true;
        }
    },
    
    // Система наследования трона
    handleKingDeath: function(kingdom) {
        if (kingdom.nobles.length > 0) {
            // Наследует старший дворянин
            const newKingId = kingdom.nobles[0];
            this.assignRole(Players.Get(newKingId), 'KING');
            Chat.Broadcast(`${kingdom.name}: ${Players.Get(newKingId).NickName} стал новым королем!`);
        } else if (kingdom.knights.length > 0) {
            // Если нет дворян, наследует рыцарь
            const newKingId = kingdom.knights[0];
            this.assignRole(Players.Get(newKingId), 'KING');
            Chat.Broadcast(`${kingdom.name}: ${Players.Get(newKingId).NickName} стал новым королем!`);
        } else {
            // Если нет никого, королевство остается без короля
            kingdom.king = null;
            Chat.Broadcast(`${kingdom.name} осталось без короля!`);
        }
    },
    
    // Система налогов
    collectTaxes: function(kingdom, amount) {
        if (!kingdom.king) return false;
        
        let totalCollected = 0;
        kingdom.peasants.forEach(peasantId => {
            const peasant = Players.Get(peasantId);
            if (peasant && peasant.Properties.Scores.Value >= amount) {
                peasant.Properties.Scores.Value -= amount;
                totalCollected += amount;
            }
        });
        
        kingdom.treasury += totalCollected;
        return totalCollected;
    },
    
    // Система распределения казны
    distributeTreasury: function(kingdom, amounts) {
        if (!kingdom.king || kingdom.treasury <= 0) return false;
        
        const kingPlayer = Players.Get(kingdom.king);
        if (!kingPlayer) return false;
        
        let totalDistributed = 0;
        
        // Король получает свою долю
        if (amounts.king && kingdom.treasury >= amounts.king) {
            kingPlayer.Properties.Scores.Value += amounts.king;
            kingdom.treasury -= amounts.king;
            totalDistributed += amounts.king;
        }
        
        // Дворяне получают свою долю
        kingdom.nobles.forEach(nobleId => {
            const noble = Players.Get(nobleId);
            if (noble && amounts.noble && kingdom.treasury >= amounts.noble) {
                noble.Properties.Scores.Value += amounts.noble;
                kingdom.treasury -= amounts.noble;
                totalDistributed += amounts.noble;
            }
        });
        
        // Рыцари получают свою долю
        kingdom.knights.forEach(knightId => {
            const knight = Players.Get(knightId);
            if (knight && amounts.knight && kingdom.treasury >= amounts.knight) {
                knight.Properties.Scores.Value += amounts.knight;
                kingdom.treasury -= amounts.knight;
                totalDistributed += amounts.knight;
            }
        });
        
        return totalDistributed;
    }
};

// Создание команд (королевств)
Teams.Add('Red', Kingdoms.Red.name, Kingdoms.Red.color);
Teams.Add('Blue', Kingdoms.Blue.name, Kingdoms.Blue.color);

const RedTeam = Teams.Get('Red');
const BlueTeam = Teams.Get('Blue');

// Настройки спавн-поинтов для королевств
Kingdoms.Red.spawnPoints = [
    new Vector3(10, 10, 10),
    new Vector3(12, 10, 10),
    new Vector3(14, 10, 10)
];

Kingdoms.Blue.spawnPoints = [
    new Vector3(-10, 10, -10),
    new Vector3(-12, 10, -10),
    new Vector3(-14, 10, -10)
];

// Настройки таблицы лидеров
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader('Kills', 'Убийства', 'У'),
    new DisplayValueHeader('Deaths', 'Смерти', 'С'),
    new DisplayValueHeader('Scores', 'Золото', 'З'),
    new DisplayValueHeader('Role', 'Роль', 'Р'),
    new DisplayValueHeader('Kingdom', 'Королевство', 'К'),
    new DisplayValueHeader('XP', 'Опыт', 'О'),
    new DisplayValueHeader('RoomID', 'RID', 'RID')
];

LeaderBoard.PlayersWeightGetter.Set(function(p) {
    return p.Properties.Get('Scores').Value;
});

// Функции для выдачи прав
function VIPPlayer(p) {
    // Админы получают особые права
    p.inventory.Main.Value = true;
    p.inventory.MainInfinity.Value = true;
    p.inventory.Secondary.Value = true;
    p.inventory.SecondaryInfinity.Value = true;
    p.inventory.Melee.Value = true;
    p.inventory.Explosive.Value = true;
    p.inventory.ExplosiveInfinity.Value = true;
    p.inventory.Build.Value = true;
    p.inventory.BuildInfinity.Value = true;
    p.contextedProperties.SkinType.Value = 4;
    p.Build.Pipette.Value = true;
    p.Build.FlyEnable.Value = true;
    p.Build.BalkLenChange.Value = true;
    p.Build.BuildRangeEnable.Value = true;
    p.Build.BuildModeEnable.Value = true;
    p.Build.RemoveQuad.Value = true;
    p.Build.FillQuad.Value = true;
    p.Build.FloodFill.Value = true;
    p.Build.ChangeSpawnsEnable.Value = true;
    p.Build.LoadMapEnable.Value = true;
    p.Build.ChangeMapAuthorsEnable.Value = true;
    p.Build.GenMapEnable.Value = true;
    p.Build.ChangeCameraPointsEnable.Value = true;
    p.Build.CollapseChangeEnable.Value = true;
    p.Build.QuadChangeEnable.Value = true;
    p.Build.SetSkyEnable.Value = true;
    p.Build.BlocksSet.Value = BuildBlocksSet.AllClear;
    p.Properties.Get('Adm').Value = '✓';
    p.Properties.Get('Status').Value = 'Админ';
    p.contextedProperties.GetContext().MaxHp.Value = 125;
    Dmg.DamageOut.Value *= 5;
}

// Настройки UI
Ui.GetContext().TeamProp1.Value = { Team: "Red", Prop: "Scores" };
Ui.GetContext().TeamProp2.Value = { Team: "Blue", Prop: "Scores" };

// Чат-команды
Chat.OnMessage.Add(function(p, msg) {
    const args = msg.split(' ');
    const command = args[0].toLowerCase();
    
    // Общие команды
    switch(command) {
        case '/help':
            p.Ui.Hint.Value = "Доступные команды: /kingdom, /roles, /tax, /treasury, /promote, /revolt, /pay";
            break;
            
        case '/kingdom':
            const kingdom = Kingdoms.getPlayerKingdom(p);
            if (kingdom) {
                p.Ui.Hint.Value = `Вы в ${kingdom.name}. Король: ${kingdom.king ? Players.Get(kingdom.king).NickName : "нет"}`;
            } else {
                p.Ui.Hint.Value = "Вы не в королевстве";
            }
            break;
            
        case '/roles':
            p.Ui.Hint.Value = "Роли: Король (1), Дворянин (2), Рыцарь (3), Крестьянин (4)";
            break;
            
        case '/pay':
            if (args.length < 3) {
                p.Ui.Hint.Value = "Использование: /pay [игрок] [сумма]";
                return;
            }
            
            const targetPlayer = Players.Find(args[1]);
            if (!targetPlayer) {
                p.Ui.Hint.Value = "Игрок не найден";
                return;
            }
            
            const amount = parseInt(args[2]);
            if (isNaN(amount) || amount <= 0 || p.Properties.Scores.Value < amount) {
                p.Ui.Hint.Value = "Неверная сумма";
                return;
            }
            
            p.Properties.Scores.Value -= amount;
            targetPlayer.Properties.Scores.Value += amount;
            p.Ui.Hint.Value = `Вы передали ${amount} золота игроку ${targetPlayer.NickName}`;
            targetPlayer.Ui.Hint.Value = `Вы получили ${amount} золота от ${p.NickName}`;
            break;
    }
    
    // Команды для короля
    const role = Kingdoms.getPlayerRole(p);
    if (role === 'KING') {
        switch(command) {
            case '/tax':
                const taxAmount = args.length > 1 ? parseInt(args[1]) : 10;
                if (isNaN(taxAmount) {
                    p.Ui.Hint.Value = "Использование: /tax [сумма]";
                    return;
                }
                
                const collected = Kingdoms.collectTaxes(Kingdoms.getPlayerKingdom(p), taxAmount);
                p.Ui.Hint.Value = `Собрано налогов: ${collected} золота`;
                Chat.Broadcast(`${p.NickName} собрал налоги в размере ${taxAmount} золота с каждого крестьянина!`);
                break;
                
            case '/treasury':
                const kingdom = Kingdoms.getPlayerKingdom(p);
                p.Ui.Hint.Value = `Казна королевства: ${kingdom.treasury} золота`;
                break;
                
            case '/promote':
                if (args.length < 2) {
                    p.Ui.Hint.Value = "Использование: /promote [игрок] [роль:1-4]";
                    return;
                }
                
                const target = Players.Find(args[1]);
                if (!target) {
                    p.Ui.Hint.Value = "Игрок не найден";
                    return;
                }
                
                if (Kingdoms.getPlayerKingdom(target) !== Kingdoms.getPlayerKingdom(p)) {
                    p.Ui.Hint.Value = "Игрок не из вашего королевства";
                    return;
                }
                
                const roleNum = args.length > 2 ? parseInt(args[2]) : 3; // По умолчанию повышаем до рыцаря
                let newRole;
                
                switch(roleNum) {
                    case 1: newRole = 'KING'; break;
                    case 2: newRole = 'NOBLE'; break;
                    case 3: newRole = 'KNIGHT'; break;
                    case 4: newRole = 'PEASANT'; break;
                    default:
                        p.Ui.Hint.Value = "Неверная роль (1-4)";
                        return;
                }
                
                Kingdoms.assignRole(target, newRole);
                p.Ui.Hint.Value = `Вы повысили ${target.NickName} до ${Kingdoms.Roles[newRole].name}`;
                target.Ui.Hint.Value = `${p.NickName} повысил вас до ${Kingdoms.Roles[newRole].name}`;
                break;
        }
    }
    
    // Команда для свержения короля
    if (command === '/revolt' && (role === 'NOBLE' || role === 'KNIGHT')) {
        const kingdom = Kingdoms.getPlayerKingdom(p);
        if (!kingdom.king) {
            p.Ui.Hint.Value = "В королевстве нет короля";
            return;
        }
        
        // Проверяем, поддерживают ли другие игроки бунт
        const supporters = [];
        Players.All.forEach(player => {
            if (Kingdoms.getPlayerKingdom(player) === kingdom && 
                (Kingdoms.getPlayerRole(player) === 'NOBLE' || Kingdoms.getPlayerRole(player) === 'KNIGHT') &&
                player.id !== p.id) {
                supporters.push(player);
            }
        });
        
        if (supporters.length >= 2) { // Нужно минимум 2 сторонника
            // Свергаем короля
            const oldKing = Players.Get(kingdom.king);
            Kingdoms.assignRole(oldKing, 'NOBLE');
            
            // Новый король - инициатор бунта
            Kingdoms.assignRole(p, 'KING');
            
            Chat.Broadcast(`${p.NickName} сверг ${oldKing.NickName} и стал новым королем ${kingdom.name}!`);
        } else {
            p.Ui.Hint.Value = "Недостаточно сторонников для бунта (нужно минимум 2 дворянина/рыцаря)";
        }
    }
});

// Обработчики событий
Players.OnPlayerConnected.Add(function(p) {
    p.Ui.Hint.Value = 'Добро пожаловать в Королевства! Выберите команду (/red или /blue)';
});

Teams.OnRequestJoinTeam.Add(function(p, t) {
    p.Properties.Get('RoomID').Value = p.IdInRoom;
    p.Properties.Get('Ban').Value = '×';
    p.Properties.Get('Adm').Value = '×';
    p.Properties.Get('Role').Value = 'Крестьянин';
    p.Properties.Get('Kingdom').Value = t.Name === 'Red' ? Kingdoms.Red.name : Kingdoms.Blue.name;
    p.Properties.Get('XP').Value = 0;
    
    // Назначаем случайную точку спавна для королевства
    const kingdom = t.Name === 'Red' ? Kingdoms.Red : Kingdoms.Blue;
    const spawnPoint = kingdom.spawnPoints[Math.floor(Math.random() * kingdom.spawnPoints.length)];
    p.Spawns.SpawnPointsGroups.Add(1).Points.Add(spawnPoint);
    
    // Проверка прав
    if (ImportantPlayersIDs.Admins.includes(p.id)) {
        VIPPlayer(p);
    }
    
    // Добавляем в королевство как крестьянина
    Kingdoms.assignRole(p, 'PEASANT');
    
    // Если в королевстве нет короля и это первый игрок - назначаем его королем
    if (kingdom.king === null && t.PlayersCount === 0) {
        Kingdoms.assignRole(p, 'KING');
        Chat.Broadcast(`${p.NickName} стал первым королем ${kingdom.name}!`);
    }
});

Teams.OnPlayerChangeTeam.Add(function(p) { 
    p.Spawns.Spawn();
    
    if (ImportantPlayersIDs.Bans.includes(p.id)) {
        p.spawns.enable = false;
        p.spawns.Despawn();
        p.Properties.Get('Status').Value = 'Забанен';
        p.Properties.Get('Ban').Value = '✓';
        p.Ui.Hint.Value = 'Тебя забанили :(';
    }
    
    p.msg.Show(`Привет, ${p.NickName}! Добро пожаловать в ${p.Team.Name === 'Red' ? Kingdoms.Red.name : Kingdoms.Blue.name}`);
});

// Обработчики спавна и бессмертия
Spawns.GetContext().OnSpawn.Add(function(p) {
    p.Properties.Immortality.Value = true;
    const t = p.Timers.Get('immortality').Restart(3);
});

Timers.OnPlayerTimer.Add(function(t) {
    if (t.Id != 'immortality') return;
    t.Player.Properties.Immortality.Value = false;
});

// Обработчики урона и смертей
Damage.OnDeath.Add(function(p) {
    if (GameMode.Parameters.GetBool('AutoSpawn')) {
        Spawns.GetContext(p).Spawn();
        ++p.Properties.Deaths.Value;
        return;
    }
    ++p.Properties.Deaths.Value;
    
    // Если умер король - обрабатываем наследование
    const role = Kingdoms.getPlayerRole(p);
    if (role === 'KING') {
        const kingdom = Kingdoms.getPlayerKingdom(p);
        Kingdoms.handleKingDeath(kingdom);
    }
});

Damage.OnDamage.Add(function(p, dmgd, dmg) {
    if (p.id != dmgd.id) {
        p.Properties.Scores.Value += Math.ceil(dmg);
        
        // Если убит игрок из другого королевства - дополнительная награда
        if (p.Team.Name !== dmgd.Team.Name) {
            p.Properties.Scores.Value += 10;
        }
    }
    p.Ui.Hint.Value = `Нанесенный урон: ${Math.ceil(dmg)}`;
});

Damage.OnKill.Add(function(p, k) {
    if (p.id !== k.id) { 
        ++p.Properties.Kills.Value;
        
        // Дополнительные очки за убийство вражеского короля
        if (Kingdoms.getPlayerRole(k) === 'KING') {
            p.Properties.Scores.Value += 100;
            Chat.Broadcast(`${p.NickName} убил короля ${k.NickName}!`);
        }
        
        if (p.Properties.Kills.Value == 1) {
            p.PopUp("Получено Достижение: Новичок");
            p.Properties.Scores.Value += 50;
        }
    }
});
