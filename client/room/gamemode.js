import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Players, Teams, Damage, Ui, Properties, Spawns, Timers, Chat, LeaderBoard } from 'pixel_combats/room';

// 1. Инициализация команд
const RedTeam = Teams.Add('RedKingdom', '🔴 Красное Королевство', new Color(1, 0, 0, 0));
const BlueTeam = Teams.Add('BlueKingdom', '🔵 Синее Королевство', new Color(0, 0, 1, 0));

// 2. Система хранения данных
const PlayerData = new Map();
const KingdomData = {
    red: { king: null, members: new Set(), nobles: new Set(), peace: false },
    blue: { king: null, members: new Set(), nobles: new Set(), peace: false }
};

// 3. Основные функции
function setRole(player, roleName) {
    const roles = {
        'king': { level: 3, hp: 200, color: new Color(1, 1, 0, 0) },
        'noble': { level: 2, hp: 150, color: new Color(0.5, 0, 0.5, 0) },
        'soldier': { level: 1, hp: 100, color: null }
    };
    
    const role = roles[roleName];
    if (!role) return;
    
    PlayerData.get(player.id).role = roleName;
    player.Properties.Get('Role').Value = role.level;
    player.Properties.Get('RoleName').Value = roleName;
    player.contextedProperties.MaxHp.Value = role.hp;
    if (role.color) player.contextedProperties.SkinColor.Value = role.color;
}

function joinKingdom(player, kingdom) {
    // Проверяем, не состоит ли уже в другом королевстве
    for (const k in KingdomData) {
        if (KingdomData[k].members.has(player.id)) {
            player.Ui.Hint.Value = `Вы уже в ${k === 'red' ? 'Красном' : 'Синем'} королевстве`;
            return false;
        }
    }
    
    const kData = KingdomData[kingdom];
    kData.members.add(player.id);
    
    // Сохраняем данные игрока
    PlayerData.set(player.id, {
        kingdom: kingdom,
        role: 'soldier',
        gold: 100
    });
    
    // Первый игрок становится королём
    if (kData.members.size === 1) {
        kData.king = player.id;
        setRole(player, 'king');
        Chat.Broadcast(`👑 ${player.NickName} стал королём ${kingdom === 'red' ? 'Красного' : 'Синего'} королевства!`);
    } else {
        setRole(player, 'soldier');
    }
    
    // Добавляем в команду и телепортируем
    const team = kingdom === 'red' ? RedTeam : BlueTeam;
    team.Add(player);
    player.Teleport(new Vector3(kingdom === 'red' ? -50 : 50, 10, 0));
    
    player.Ui.Hint.Value = `Добро пожаловать в ${kingdom === 'red' ? 'Красное' : 'Синее'} королевство!`;
    return true;
}

// 4. Обработчики событий
Players.OnPlayerConnected.Add(p => {
    // Инициализация свойств
    p.Properties.Add('Role', 0);
    p.Properties.Add('RoleName', '');
    p.Properties.Add('Kills', 0);
    p.Properties.Add('Deaths', 0);
    p.Properties.Add('Gold', 0);
    
    p.Ui.Hint.Value = 'Введите /join red или /join blue';
});

Players.OnPlayerDisconnected.Add(p => {
    // При выходе сохраняем золото
    const data = PlayerData.get(p.id);
    if (data) p.Properties.Get('Gold').Value = data.gold;
});

Damage.OnDeath.Add(p => {
    p.Spawns.Spawn();
    p.Properties.Get('Deaths').Value++;
    
    // Штраф за смерть
    const data = PlayerData.get(p.id);
    if (data) {
        const lostGold = Math.floor(data.gold * 0.1);
        data.gold = Math.max(0, data.gold - lostGold);
        p.Ui.Hint.Value = `Вы потеряли ${lostGold} золота`;
    }
});

Damage.OnKill.Add((killer, victim) => {
    if (killer.id === victim.id) return;
    
    killer.Properties.Get('Kills').Value++;
    
    // Награда за убийство
    const killerData = PlayerData.get(killer.id);
    const victimRole = PlayerData.get(victim.id)?.role;
    
    let reward = 10;
    if (victimRole === 'noble') reward = 25;
    if (victimRole === 'king') reward = 100;
    
    if (killerData) {
        killerData.gold += reward;
        killer.Ui.Hint.Value = `+${reward} золота за убийство`;
    }
    
    // Особое сообщение за убийство короля
    if (victimRole === 'king') {
        Chat.Broadcast(`💀 Король ${victim.NickName} был убит игроком ${killer.NickName}!`);
    }
});

// 5. Чат-команды
Chat.OnPlayerMessage.Add((p, msg) => {
    const args = msg.toLowerCase().split(' ');
    if (args[0] !== '/join') return true;
    
    try {
        if (args.length < 2) throw "Укажите: /join red или /join blue";
        
        const kingdom = args[1];
        if (kingdom !== 'red' && kingdom !== 'blue') throw "Неизвестное королевство";
        
        return joinKingdom(p, kingdom);
    } catch (e) {
        p.Ui.Hint.Value = e;
        return false;
    }
});

// 6. Настройка интерфейса
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader('Kills', 'Убийства', '⚔️'),
    new DisplayValueHeader('Deaths', 'Смерти', '💀'),
    new DisplayValueHeader('RoleName', 'Ранг', '🎖️'),
    new DisplayValueHeader('Gold', 'Золото', '💰')
];

Ui.GetContext().TeamProp1.Value = { Team: "RedKingdom", Prop: "Kills" };
Ui.GetContext().TeamProp2.Value = { Team: "BlueKingdom", Prop: "Kills" };

// 7. Автоспавн
Timers.GetContext().Get('RespawnTimer').OnTimer.Add(t => {
    Players.All.forEach(p => {
        if (p.Properties.Health.Value <= 0) {
            p.Spawns.Spawn();
        }
    });
    t.RestartLoop(1);
}).RestartLoop(1);
