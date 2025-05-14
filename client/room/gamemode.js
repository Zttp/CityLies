import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Map, MapEditor, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, Build, AreaService, AreaPlayerTriggerService, AreaViewService, Chat } from 'pixel_combats/room';

// Отключаем команды и урон
Teams.Add('Builders', 'Строители', new Color(0.2, 0.8, 0.2, 0.5));
const BuildersTeam = Teams.Get('Builders');
Damage.Enable.Value = false;

// Настройки строительства
BuildersTeam.Build.BlocksSet.Value = BuildBlocksSet.White;
Build.Enable.Value = true;
Build.Infinity.Value = true;

// Очищаем карту
Map.Clear();

// Создаем учебные зоны
const tutorialZones = [
    { 
        name: "Основы", 
        position: new Vector3(-20, 5, 0),
        size: new Vector3(10, 10, 10),
        color: new Color(1, 1, 1, 0.3)
    },
    { 
        name: "Фундамент", 
        position: new Vector3(0, 5, 0),
        size: new Vector3(10, 10, 10),
        color: new Color(0.8, 0.5, 0.2, 0.3)
    },
    { 
        name: "Симметрия", 
        position: new Vector3(20, 5, 0),
        size: new Vector3(10, 10, 10),
        color: new Color(0.2, 0.5, 0.8, 0.3)
    },
    { 
        name: "Окна и двери", 
        position: new Vector3(40, 5, 0),
        size: new Vector3(10, 10, 10),
        color: new Color(0.8, 0.2, 0.8, 0.3)
    },
    { 
        name: "Крыши", 
        position: new Vector3(60, 5, 0),
        size: new Vector3(10, 10, 10),
        color: new Color(0.5, 0.8, 0.5, 0.3)
    }
];

// Создаем триггерные зоны
tutorialZones.forEach(zone => {
    const area = AreaService.CreateBox(zone.position, zone.size);
    AreaViewService.Create(area, zone.color, zone.name);
    
    AreaPlayerTriggerService.Create(area).OnEnter.Add((player) => {
        showTutorialStep(player, zone.name);
    });
});

// Функция показа учебного шага
function showTutorialStep(player, stepName) {
    switch(stepName) {
        case "Основы":
            player.Ui.Hint.Value = `
<b>🎯 Основы строительства:</b>
1. Нажмите [B] чтобы открыть меню строительства
2. Выберите блок из панели
3. ЛКМ - установить блок
4. ПКМ - удалить блок
5. Используйте колесо мыши для изменения размера кисти

<b>Практика:</b>
Попробуйте построить простую стену 3x3 блока`;
            break;
            
        case "Фундамент":
            player.Ui.Hint.Value = `
<b>🏗 Фундамент - основа здания:</b>
1. Всегда начинайте с прочного основания
2. Используйте более толстые блоки для фундамента
3. Углубляйте фундамент в землю для устойчивости
4. Чем выше здание - тем прочнее должен быть фундамент

<b>Практика:</b>
Постройте фундамент 5x5 блоков, углубленный на 2 блока вниз`;
            break;
            
        case "Симметрия":
            player.Ui.Hint.Value = `
<b>⚖️ Симметрия в строительстве:</b>
1. Используйте сетку (нажмите [G] для включения)
2. Стройте от центра к краям
3. Для симметричных зданий сначала определите ось симметрии
4. Используйте нечетные размеры для четкого центра

<b>Практика:</b>
Постройте симметричную башню с центральной осью`;
            break;
            
        case "Окна и двери":
            player.Ui.Hint.Value = `
<b>🪟 Окна и двери:</b>
1. Оставляйте пустые блоки для оконных проемов
2. Используйте стеклянные блоки для окон
3. Делайте дверные проемы минимум 2 блока в высоту
4. Чередуйте окна для красивого фасада
5. Используйте полублоки для создания дверных косяков

<b>Практика:</b>
Постройте стену с 2 окнами и 1 дверным проемом`;
            break;
            
        case "Крыши":
            player.Ui.Hint.Value = `
<b>🏠 Виды крыш:</b>
1. Плоская - простейший вариант
2. Скатная - используйте ступенчатые блоки
3. Купол - сложная, но красивая конструкция
4. Шатровая - симметричная со всех сторон

<b>Советы:</b>
- Начинайте с углов и двигайтесь к центру
- Используйте полублоки для плавных переходов
- Делайте свесы крыши для реалистичности

<b>Практика:</b>
Попробуйте создать скатную крышу на своем здании`;
            break;
    }
}

// При входе игрока
Players.OnPlayerConnected.Add(function(player) {
    BuildersTeam.Add(player);
    player.Properties.Add('TutorialStep', 0);
    
    // Даем строительные инструменты
    player.inventory.Main.Value = false;
    player.inventory.Secondary.Value = false;
    player.inventory.Melee.Value = true;
    player.spawns.spawn();
    
    // Первое сообщение
    player.Ui.Hint.Value = `
<b>Добро пожаловать в туториал по строительству!</b>
Перемещайтесь между цветными зонами, чтобы изучать разные аспекты строительства.

<b>Основные клавиши:</b>
[B] - меню строительства
[G] - показать/скрыть сетку
[F] - изменить режим строительства
[Пробел] + [ЛКМ] - копировать блок
[Пробел] + [ПКМ] - вставить блок

Начните с белой зоны "Основы" слева.`;
    
    // Телепортируем к началу
    player.Spawns.Spawn(new Vector3(-20, 10, 0));
});

// Чат-команды
Chat.OnMessage.Add(function(m) {
    const msg = m.Text.toLowerCase().trim();
    const player = Players.GetByRoomId(m.Sender);
    
    if (msg === '/help') {
        player.Ui.Hint.Value = `
<b>Доступные команды:</b>
/help - показать это сообщение
/tools - список инструментов строительства
/tips - случайный совет по строительству
/reset - сбросить свою постройку
/grid - переключить сетку`;
    }
    else if (msg === '/tools') {
        player.Ui.Hint.Value = `
<b>Инструменты строительства:</b>
1. Основной блок - базовый строительный элемент
2. Полублок - для детализации и плавных форм
3. Стеклянный блок - для окон и декора
4. Лестница - функциональный элемент
5. Дверь - автоматически открывается при подходе`;
    }
    else if (msg === '/tips') {
        const tips = [
            "Используйте разные текстуры блоков для разнообразия",
            "Добавьте колонны по углам здания для устойчивости",
            "Создайте балкон с помощью полублоков",
            "Используйте лестницы как декоративные элементы",
            "Постройте фонтан в центре двора",
            "Добавьте факелы для освещения территории"
        ];
        player.Ui.Hint.Value = `<b>Совет:</b> ${tips[Math.floor(Math.random() * tips.length)]}`;
    }
    else if (msg === '/reset') {
        Map.Clear();
        player.Ui.Hint.Value = "Ваша постройка была сброшена. Начните заново!";
    }
    else if (msg === '/grid') {
        Build.ShowGrid.Value = !Build.ShowGrid.Value;
        player.Ui.Hint.Value = `Сетка ${Build.ShowGrid.Value ? "включена" : "выключена"}`;
    }
});

// Таймер с подсказками
const TipsTimer = Timers.GetContext().Get('TipsTimer');
TipsTimer.OnTimer.Add(function(t) {
    Players.ForEach(function(player) {
        if (Math.random() > 0.7) {
            player.Ui.Hint.Value = "<b>Подсказка:</b> Используйте разные типы блоков для создания интересных текстур в ваших постройках!";
        }
    });
    TipsTimer.RestartLoop(60);
});
