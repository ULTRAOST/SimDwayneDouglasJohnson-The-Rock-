/*
 * RU: Основная игровая логика. Здесь создаётся сцена, обрабатывается управление,
 * генерируются дороги и машины, обновляется счёт и проверяются столкновения.
 * EN: Core game logic. This file creates the scene, handles controls, generates
 * roads and cars, updates the score, and checks collisions.
 */

/** RU: Находит HTML-элемент по его ID. EN: Finds an HTML element by its ID. */
const $ = (id) => document.getElementById(id);

/** RU: Холст, на котором Three.js рисует игру. EN: Canvas used by Three.js to render the game. */
const canvas = $("c");
/** RU: WebGL-рендерер игры. EN: WebGL renderer for the game. */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

/** RU: Трёхмерная сцена игры. EN: Three-dimensional game scene. */
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BACKGROUND);
scene.fog = new THREE.Fog(SCENE_FOG_COLOR, FOG_NEAR, FOG_FAR);

/** RU: Камера, показывающая игровое поле. EN: Camera that displays the playfield. */
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
/** RU: Рассеянное освещение сцены. EN: Ambient scene lighting. */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

/** RU: Направленный источник света и теней. EN: Directional light source and shadows. */
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(6, 12, 6);
sun.castShadow = true;
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
scene.add(sun, sun.target);

/** RU: Все строки игрового мира, созданные на данный момент. EN: All currently generated world rows. */
const rows = new Map();
/** RU: Настройки скорости и плотности машин. EN: Traffic speed and density settings. */
let speed = DEFAULT_SETTINGS.speed;
/** RU: Количество машин на каждой дороге. EN: Number of cars on each road. */
let density = DEFAULT_SETTINGS.density;
/** RU: Признак паузы. EN: Whether the game is paused. */
let paused = false;
/** RU: Признак того, что игра была запущена. EN: Whether the game has started. */
let started = false;
/** RU: Признак проигрыша. EN: Whether the player has lost. */
let dead = false;
/** RU: Самый дальний достигнутый ряд. EN: Farthest row reached. */
let maxRow = 0;
/** RU: Лучший сохранённый результат. EN: Best saved score. */
let best = loadBestScore();

/** RU: Обновляет размер рендерера и пропорции камеры. EN: Updates renderer size and camera aspect ratio. */
function resizeRenderer() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resizeRenderer);
resizeRenderer();

/**
 * RU: Создаёт материал заданного цвета.
 * EN: Creates a material with the specified color.
 * @param {number} color RU: Цвет в шестнадцатеричном формате. EN: Hexadecimal color.
 * @returns {THREE.MeshLambertMaterial} RU: Материал объекта. EN: Object material.
 */
function makeMaterial(color) {
  return new THREE.MeshLambertMaterial({ color });
}

/** RU: Игровой камень, которым управляет игрок. EN: Player-controlled rock. */
const rock = new THREE.Mesh(
  new THREE.DodecahedronGeometry(0.4, 0),
  new THREE.MeshLambertMaterial({ color: 0x8a8d91, flatShading: true })
);
rock.castShadow = true;
scene.add(rock);

/**
 * RU: Данные о положении камня и текущем прыжке.
 * EN: Data describing the rock position and current jump.
 */
const player = {
  /** RU: Координата по горизонтали. EN: Horizontal coordinate. */
  x: 0,
  /** RU: Номер ряда. EN: Row index. */
  row: 0,
  /** RU: Данные анимации прыжка или null. EN: Jump animation data or null. */
  hop: null,
  /** RU: Временная координата X во время прыжка. EN: Temporary X coordinate during a jump. */
  vx: 0
};

/**
 * RU: Создаёт машинку из простых трёхмерных фигур.
 * EN: Creates a car from simple 3D shapes.
 * @returns {THREE.Group} RU: Группа объектов машины. EN: Group containing the car objects.
 */
function makeCar() {
  /** RU: Группа, в которую собираются детали машины. EN: Group that holds car parts. */
  const group = new THREE.Group();
  /** RU: Длина корпуса машины. EN: Car body length. */
  const length = 1 + Math.random() * 0.9;
  /** RU: Случайный цвет корпуса. EN: Random body color. */
  const color = CAR_COLORS[Math.random() * CAR_COLORS.length | 0];
  /** RU: Нижняя часть корпуса. EN: Lower car body. */
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, 0.7), makeMaterial(color));
  body.position.y = 0.35;
  /** RU: Верхняя часть корпуса. EN: Upper car body. */
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(length * 0.5, 0.3, 0.6), makeMaterial(0xdfe6e9));
  cabin.position.y = 0.7;
  /** RU: Геометрия и материал колёс. EN: Wheel geometry and material. */
  const wheelGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.8);
  const wheelMaterial = makeMaterial(0x222222);
  /** RU: Создаёт колёса с обеих сторон машины. EN: Creates wheels on both sides of the car. */
  [-0.3, 0.3].forEach((offset) => {
    /** RU: Отдельное колесо. EN: A single wheel. */
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(offset * length * 1.2, 0.15, 0);
    group.add(wheel);
  });
  group.add(body, cabin);
  group.traverse((object) => { object.castShadow = true; });
  /** RU: Длина машины используется при проверке столкновения. EN: Car length used for collision detection. */
  group.userData.length = length;
  return group;
}

/**
 * RU: Заполняет ряд дороги машинами.
 * EN: Populates a road row with cars.
 * @param {Object} row RU: Данные ряда дороги. EN: Road row data.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function populateRoad(row) {
  row.cars.forEach((car) => row.group.remove(car));
  row.cars = [];
  /** RU: Общая ширина участка, по которому распределяются машины. EN: Total span used to distribute cars. */
  const span = 2 * (WORLD_WIDTH + 6);
  for (let index = 0; index < density; index += 1) {
    /** RU: Новая машина. EN: Newly created car. */
    const car = makeCar();
    car.position.set(-WORLD_WIDTH - 6 + (index + Math.random() * 0.6) * span / Math.max(density, 1), 0, 0);
    car.rotation.y = row.direction > 0 ? 0 : Math.PI;
    row.group.add(car);
    row.cars.push(car);
  }
}

/**
 * RU: Создаёт ряд травы или дороги, если он ещё не создан.
 * EN: Creates a grass or road row if it does not exist yet.
 * @param {number} rowIndex RU: Номер ряда. EN: Row index.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function generateRow(rowIndex) {
  if (rows.has(rowIndex)) return;

  /** RU: Группа объектов текущего ряда. EN: Group of objects in the current row. */
  const group = new THREE.Group();
  group.position.z = -rowIndex;
  /** RU: Тип ряда — трава или дорога. EN: Row type: grass or road. */
  const type = (rowIndex < 3 || Math.random() < 0.4) ? "grass" : "road";
  /** RU: Структура с данными ряда. EN: Data structure for the row. */
  const row = {
    /** RU: Номер ряда. EN: Row index. */
    index: rowIndex,
    /** RU: Тип поверхности. EN: Surface type. */
    type,
    /** RU: Группа объектов ряда. EN: Row object group. */
    group,
    /** RU: Машины в ряду. EN: Cars in the row. */
    cars: [],
    /** RU: Координаты деревьев. EN: Tree coordinates. */
    trees: new Set(),
    /** RU: Направление движения машин. EN: Car travel direction. */
    direction: Math.random() < 0.5 ? 1 : -1,
    /** RU: Скорость машин в ряду. EN: Car speed in this row. */
    velocity: 1.2 + Math.random() * 2
  };

  /** RU: Поверхность ряда. EN: Row surface. */
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(60, 0.2, 1),
    makeMaterial(type === "road" ? 0x3d4450 : (rowIndex % 2 ? 0x6fcf5a : 0x62c24e))
  );
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  group.add(floor);

  if (type === "road") {
    for (let x = -30; x < 30; x += 2) {
      /** RU: Разметка на дороге. EN: Road marking. */
      const marking = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.06), makeMaterial(0xdddddd));
      marking.position.set(x, 0.005, 0);
      group.add(marking);
    }
    populateRoad(row);
  } else {
    for (let x = -12; x <= 12; x += 1) {
      if (Math.abs(x) > WORLD_WIDTH || (rowIndex >= 3 && Math.random() < 0.2 && x !== 0) || Math.abs(x) > WORLD_WIDTH - 1) {
        if (rowIndex < 3 && Math.abs(x) <= WORLD_WIDTH) continue;
        row.trees.add(x);
        /** RU: Группа частей дерева. EN: Group containing tree parts. */
        const tree = new THREE.Group();
        /** RU: Случайная высота дерева. EN: Random tree height. */
        const height = 0.5 + Math.random() * 0.6;
        /** RU: Ствол дерева. EN: Tree trunk. */
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), makeMaterial(0x7a5230));
        trunk.position.y = 0.2;
        /** RU: Крона дерева. EN: Tree foliage. */
        const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.4, height + 0.5, 6), makeMaterial(0x2e8b3d));
        foliage.position.y = 0.4 + (height + 0.5) / 2;
        tree.add(trunk, foliage);
        tree.position.x = x;
        tree.traverse((object) => { object.castShadow = true; });
        group.add(tree);
      }
    }
  }

  scene.add(group);
  rows.set(rowIndex, row);
}

/**
 * RU: Сбрасывает состояние игры и создаёт начальные ряды.
 * EN: Resets game state and creates the initial rows.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function resetGame() {
  rows.forEach((row) => scene.remove(row.group));
  rows.clear();
  player.x = 0;
  player.row = 0;
  player.hop = null;
  player.vx = 0;
  maxRow = 0;
  dead = false;
  rock.scale.set(1, 1, 1);
  rock.position.set(0, 0.4, 0);
  for (let rowIndex = -4; rowIndex < 24; rowIndex += 1) generateRow(rowIndex);
  $("score").textContent = "0";
  $("best").textContent = String(best);
}

/**
 * RU: Завершает игру после столкновения с машиной.
 * EN: Ends the game after a collision with a car.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function endGame() {
  dead = true;
  rock.scale.y = 0.2;
  rock.position.y = 0.1;
  if (maxRow > best) {
    best = maxRow;
    $("best").textContent = String(best);
    saveBestScore(best);
  }
  $("ov").innerHTML = `<h1>${UI_TEXT.crushed}</h1><p>${UI_TEXT.score}${maxRow}</p><button id="go">Ещё раз</button>`;
  $("ov").style.display = "flex";
  $("ov").style.pointerEvents = "auto";
  $("go").onclick = startGame;
}

/**
 * RU: Запускает новую игру.
 * EN: Starts a new game.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function startGame() {
  resetGame();
  started = true;
  paused = false;
  $("ov").style.display = "none";
  $("pause").textContent = UI_TEXT.pause;
}

/**
 * RU: Включает или выключает паузу.
 * EN: Turns the pause state on or off.
 * @param {boolean} shouldPause RU: Нужно ли поставить игру на паузу. EN: Whether the game should pause.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function setPause(shouldPause) {
  if (!started || dead) return;
  paused = shouldPause;
  $("pause").textContent = paused ? UI_TEXT.resume : UI_TEXT.pause;
  if (paused) {
    $("ov").innerHTML = `<h1>⏸ Пауза</h1><p>Можно менять скорость и количество машин</p><button id="go">Продолжить</button>`;
    $("ov").style.display = "flex";
    $("ov").style.pointerEvents = "auto";
    $("go").onclick = () => setPause(false);
  } else {
    $("ov").style.display = "none";
  }
}

/**
 * RU: Перемещает камень на одну клетку в выбранном направлении.
 * EN: Moves the rock one tile in the selected direction.
 * @param {"f"|"b"|"l"|"r"} direction RU: Направление движения. EN: Movement direction.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function movePlayer(direction) {
  if (!started || paused || dead || player.hop) return;
  /** RU: Будущая координата X. EN: Target X coordinate. */
  let nextX = player.x;
  /** RU: Будущий номер ряда. EN: Target row index. */
  let nextRow = player.row;
  if (direction === "f") nextRow += 1;
  if (direction === "b") nextRow -= 1;
  if (direction === "l") nextX -= 1;
  if (direction === "r") nextX += 1;
  if (Math.abs(nextX) > WORLD_WIDTH - 1 || nextRow < -3) return;

  generateRow(nextRow);
  /** RU: Ряд, куда движется игрок. EN: Row the player is moving into. */
  const targetRow = rows.get(nextRow);
  if (targetRow && targetRow.trees.has(nextX)) return;

  player.hop = { time: 0, fromX: player.x, fromRow: player.row, toX: nextX, toRow: nextRow };
  for (let rowIndex = nextRow; rowIndex < nextRow + 20; rowIndex += 1) generateRow(rowIndex);
  rows.forEach((row, rowIndex) => {
    if (rowIndex < nextRow - 8) {
      scene.remove(row.group);
      rows.delete(rowIndex);
    }
  });
}

/** RU: Обрабатывает нажатия клавиш на клавиатуре. EN: Handles keyboard key presses. */
addEventListener("keydown", (event) => {
  /** RU: Нажатая клавиша в нижнем регистре. EN: Pressed key in lowercase. */
  const key = event.key.toLowerCase();
  /** RU: Соответствие клавиш направлениям движения. EN: Maps keys to movement directions. */
  const keyDirections = {
    arrowup: "f", w: "f", arrowdown: "b", s: "b",
    arrowleft: "l", a: "l", arrowright: "r", d: "r"
  };
  /** RU: Направление, соответствующее клавише, если оно есть. EN: Direction mapped to the key, if any. */
  const direction = keyDirections[key];
  if (direction) {
    movePlayer(direction);
    event.preventDefault();
  }
  if (key === "p" || key === " " || key === "escape") {
    if (!started || dead) startGame();
    else setPause(!paused);
    event.preventDefault();
  }
});

/** RU: Подключает управление стрелками на экране для телефонов. EN: Enables on-screen directional controls for phones. */
document.querySelectorAll("#pad button").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    movePlayer(button.dataset.d);
  });
});

/** RU: Начальная координата касания по X. EN: Initial touch coordinate on X. */
let touchStartX = 0;
/** RU: Начальная координата касания по Y. EN: Initial touch coordinate on Y. */
let touchStartY = 0;
canvas.addEventListener("pointerdown", (event) => {
  touchStartX = event.clientX;
  touchStartY = event.clientY;
});
canvas.addEventListener("pointerup", (event) => {
  /** RU: Изменение координаты касания по X. EN: Touch movement delta on X. */
  const deltaX = event.clientX - touchStartX;
  /** RU: Изменение координаты касания по Y. EN: Touch movement delta on Y. */
  const deltaY = event.clientY - touchStartY;
  if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) movePlayer("f");
  else if (Math.abs(deltaX) > Math.abs(deltaY)) movePlayer(deltaX > 0 ? "r" : "l");
  else movePlayer(deltaY < 0 ? "f" : "b");
});

/** RU: Обработчик кнопки паузы. EN: Pause button handler. */
$("pause").onclick = () => {
  if (!started || dead) startGame();
  else setPause(!paused);
};
/** RU: Обработчик кнопки запуска. EN: Start button handler. */
$("go").onclick = startGame;
/** RU: Обработчик изменения скорости машин. EN: Handler for changing car speed. */
$("spd").oninput = (event) => {
  speed = Number(event.target.value);
  $("sv").textContent = `${speed.toFixed(1)}×`;
};
/** RU: Обработчик изменения количества машин. EN: Handler for changing the number of cars. */
$("den").oninput = (event) => {
  density = Number(event.target.value);
  $("dv").textContent = String(density);
  rows.forEach((row) => {
    if (row.type === "road") populateRoad(row);
  });
};

/** RU: Подготавливает игру перед первым запуском. EN: Prepares the game before the first start. */
resetGame();

/** RU: Время предыдущего кадра. EN: Time of the previous frame. */
let lastFrameTime = performance.now();
/** RU: Плавная горизонтальная позиция камеры. EN: Smoothed horizontal camera position. */
let cameraX = 0;
/** RU: Плавная глубина камеры. EN: Smoothed camera depth. */
let cameraZ = 0;

/**
 * RU: Основной цикл обновления и отрисовки игры.
 * EN: Main game update and rendering loop.
 * @param {number} now RU: Текущее время кадра. EN: Current frame timestamp.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  /** RU: Время, прошедшее с предыдущего кадра, в секундах. EN: Time elapsed since previous frame, in seconds. */
  const deltaTime = Math.min((now - lastFrameTime) / 1000, MAX_FRAME_DELTA);
  lastFrameTime = now;

  if (started && !paused && !dead) {
    rows.forEach((row) => {
      if (row.type !== "road") return;
      row.cars.forEach((car) => {
        car.position.x += row.direction * row.velocity * speed * deltaTime;
        if (car.position.x > WORLD_WIDTH + 6) car.position.x = -WORLD_WIDTH - 6;
        if (car.position.x < -WORLD_WIDTH - 6) car.position.x = WORLD_WIDTH + 6;
      });
    });

    if (player.hop) {
      /** RU: Текущие данные прыжка. EN: Current jump data. */
      const hop = player.hop;
      hop.time += deltaTime / JUMP_DURATION;
      /** RU: Прогресс прыжка от 0 до 1. EN: Jump progress from 0 to 1. */
      const progress = Math.min(hop.time, 1);
      player.vx = hop.fromX + (hop.toX - hop.fromX) * progress;
      rock.position.set(player.vx, 0.4 + Math.sin(progress * Math.PI) * 0.6, -(hop.fromRow + (hop.toRow - hop.fromRow) * progress));
      rock.rotation.x -= (hop.toRow - hop.fromRow) * deltaTime * 20;
      rock.rotation.z -= (hop.toX - hop.fromX) * deltaTime * 20;
      if (progress >= 1) {
        player.x = hop.toX;
        player.row = hop.toRow;
        player.hop = null;
        if (player.row > maxRow) {
          maxRow = player.row;
          $("score").textContent = String(maxRow);
        }
      }
    } else {
      rock.position.set(player.x, 0.4, -player.row);
    }

    /** RU: Ряд, в котором сейчас находится игрок. EN: Row currently occupied by the player. */
    const currentRow = rows.get(player.row);
    if (currentRow && currentRow.type === "road" && !player.hop) {
      for (const car of currentRow.cars) {
        if (Math.abs(car.position.x - player.x) < car.userData.length / 2 + 0.3) {
          endGame();
          break;
        }
      }
    }
  }

  /** RU: Целевые координаты камеры рядом с игроком. EN: Target camera coordinates near the player. */
  const targetX = rock.position.x;
  /** RU: Целевая глубина камеры. EN: Target camera depth. */
  const targetZ = rock.position.z;
  cameraX += (targetX - cameraX) * Math.min(deltaTime * 4, 1);
  cameraZ += (targetZ - cameraZ) * Math.min(deltaTime * 4, 1);
  camera.position.set(cameraX * 0.5 + 4, 8, cameraZ + 6);
  camera.lookAt(cameraX * 0.5, 0, cameraZ - 1.5);
  sun.position.set(cameraX + 6, 12, cameraZ + 6);
  sun.target.position.set(cameraX, 0, cameraZ);
  renderer.render(scene, camera);
}

/** RU: Запускает цикл игры с первого кадра. EN: Starts the game loop from the first frame. */
requestAnimationFrame(gameLoop);
