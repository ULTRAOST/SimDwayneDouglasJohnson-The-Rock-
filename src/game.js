/**
 * Игровая логика: состояние поля, перемещение камня, транспорт и столкновения.
 * Модуль не обращается к DOM и не использует Three.js.
 */
import { Direction, RowType, DeathCause, GAME_CONFIG } from "./config.js";

export class RockGame {
  constructor() {
    /** @type {Map<number, RowData>} Все существующие ряды по номеру. */
    this.rows = new Map();
    /** @type {number} Текущая X-координата камня (клетка). */
    this.playerX = 0;
    /** @type {number} Текущий ряд камня. */
    this.playerRow = 0;
    /** @type {?Object} Текущий прыжок {progress,fromX,fromRow,toX,toRow} или null. */
    this.activeHop = null;
    /** @type {number} Самый дальний достигнутый ряд (= счёт). */
    this.score = 0;
    /** @type {boolean} Игра запущена (после нажатия «Играть»). */
    this.isStarted = false;
    /** @type {boolean} Игра на паузе. */
    this.isPaused = false;
    /** @type {boolean} Камень раздавлен. */
    this.isDead = false;
    /** @type {number} Множитель скорости машин. */
    this.carSpeedMultiplier = 1;
    /** @type {number} Желаемое число машин на каждой дороге. */
    this.carsPerRoad = 3;

    /**
     * Подписчики событий. Назначаются снаружи (main-код).
     * @type {{onReset:Function,onScoreChange:Function,onRowCreated:Function,onRowRemoved:Function,onCarsRegenerated:Function,onPauseChange:Function,onGameOver:Function}}
     */
    this.listeners = {
      onReset(){}, onScoreChange(score){}, onRowCreated(row){}, onRowRemoved(rowIndex){},
      onCarsRegenerated(row){}, onPauseChange(isPaused){}, onGameOver(score, cause){}
    };
  }

  /** @returns {boolean} true, если игра идёт прямо сейчас (не пауза, не смерть). */
  isRunning() { return this.isStarted && !this.isPaused && !this.isDead; }

  /** Сбрасывает состояние и создаёт стартовые ряды. */
  reset() {
    this.rows.clear();
    this.playerX = 0; this.playerRow = 0; this.activeHop = null;
    this.score = 0; this.isDead = false;
    this.listeners.onReset();
    for (let i = -GAME_CONFIG.rowsGeneratedBehind; i < 24; i++) this.createRowIfMissing(i);
    this.listeners.onScoreChange(0);
  }

  /** Начинает новую игру. */
  start() {
    this.reset();
    this.isStarted = true;
    this.isPaused = false;
    this.listeners.onPauseChange(false);
  }

  /**
   * Включает/выключает паузу.
   * @param {boolean} shouldPause
   */
  setPaused(shouldPause) {
    if (!this.isStarted || this.isDead) return;
    this.isPaused = shouldPause;
    this.listeners.onPauseChange(shouldPause);
  }

  /** @param {number} multiplier Новый множитель скорости машин. */
  setCarSpeedMultiplier(multiplier) { this.carSpeedMultiplier = multiplier; }

  /**
   * Меняет число машин и пересоздаёт их на всех дорогах.
   * @param {number} count
   */
  setCarsPerRoad(count) {
    this.carsPerRoad = count;
    this.rows.forEach(row => {
      if (row.type === RowType.ROAD) { this.fillRoadWithCars(row); this.listeners.onCarsRegenerated(row); }
    });
  }

  /**
   * Расставляет машины по дороге равномерно со случайным сдвигом.
   * @param {RowData} row Ряд-дорога.
   */
  fillRoadWithCars(row) {
    const count = this.carsPerRoad;
    const totalSpan = 2 * (GAME_CONFIG.fieldHalfWidth + GAME_CONFIG.carWrapMargin);
    row.cars = [];
    for (let i = 0; i < count; i++) {
      row.cars.push({
        x: -GAME_CONFIG.fieldHalfWidth - GAME_CONFIG.carWrapMargin + (i + Math.random() * 0.6) * totalSpan / count,
        length: 1 + Math.random() * 0.9,
        colorIndex: Math.floor(Math.random() * GAME_CONFIG.carColorVariants)
      });
    }
  }

  /**
   * Генерирует ряд, если его ещё нет.
   * @param {number} rowIndex
   */
  createRowIfMissing(rowIndex) {
    if (this.rows.has(rowIndex)) return;
    // Тип ряда: на старте всегда трава, дальше случайно трава / река / дорога.
    const roll = Math.random();
    let rowType = RowType.ROAD;
    if (rowIndex < GAME_CONFIG.safeStartRows || roll < GAME_CONFIG.grassProbability) rowType = RowType.GRASS;
    else if (roll < GAME_CONFIG.grassProbability + GAME_CONFIG.riverProbability) rowType = RowType.RIVER;
    /** @type {RowData} */
    const row = {
      index: rowIndex,
      type: rowType,
      carDirection: Math.random() < 0.5 ? 1 : -1,
      carBaseSpeed: 1.2 + Math.random() * 2,
      cars: [],
      treeXs: new Set(),
      logs: [],
      crocodiles: []
    };
    if (rowType === RowType.RIVER) row.carBaseSpeed = (1.2 + Math.random() * 2) * GAME_CONFIG.riverSpeedFactor;
    if (rowType === RowType.ROAD) this.fillRoadWithCars(row);
    else if (rowType === RowType.RIVER) this.fillRiver(row);
    else this.fillGrassWithTrees(row);
    this.rows.set(rowIndex, row);
    this.listeners.onRowCreated(row);
  }

  /**
   * Заполняет реку брёвнами и (возможно) крокодилом.
   * @param {RowData} row Ряд-река.
   */
  fillRiver(row) {
    const edge = GAME_CONFIG.fieldHalfWidth + GAME_CONFIG.carWrapMargin;
    const count = GAME_CONFIG.logsPerRiver;
    const span = 2 * edge;
    for (let i = 0; i < count; i++) {
      row.logs.push({ x: -edge + (i + Math.random() * 0.4) * span / count, length: 2 + Math.random() });
    }
    if (Math.random() < GAME_CONFIG.crocodileProbability) {
      row.crocodiles.push({ x: -edge + Math.random() * span, length: GAME_CONFIG.crocodileLength });
    }
  }

  /**
   * Возвращает бревно, на котором может стоять камень в точке x (или null).
   * @param {RowData} row Ряд-река. @param {number} x Координата X камня.
   * @returns {?{x:number,length:number}}
   */
  findLogUnder(row, x) {
    return row.logs.find(log => Math.abs(log.x - x) < log.length / 2 + GAME_CONFIG.rockHalfWidth) || null;
  }

  /**
   * Ставит деревья: сплошная стена по краям и случайные внутри (после стартовой зоны).
   * @param {RowData} row Ряд-трава.
   */
  fillGrassWithTrees(row) {
    const half = GAME_CONFIG.fieldHalfWidth;
    const isStartZone = row.index < GAME_CONFIG.safeStartRows;
    for (let x = -12; x <= 12; x++) {
      // В стартовой зоне стена начинается чуть дальше от центра.
      const isBorder = Math.abs(x) >= (isStartZone ? half + 1 : half);
      const isRandomTree = !isStartZone && x !== 0 && Math.random() < GAME_CONFIG.treeProbability;
      if (isBorder || isRandomTree) row.treeXs.add(x);
    }
  }

  /**
   * Пытается переместить камень на одну клетку.
   * @param {string} direction Значение из Direction.
   */
  tryMove(direction) {
    if (!this.isRunning() || this.activeHop) return;
    let targetX = Math.round(this.playerX), targetRow = this.playerRow; // округляем: на бревне X дробный
    if (direction === Direction.FORWARD) targetRow++;
    if (direction === Direction.BACK) targetRow--;
    if (direction === Direction.LEFT) targetX--;
    if (direction === Direction.RIGHT) targetX++;
    if (Math.abs(targetX) > GAME_CONFIG.fieldHalfWidth - 1 || targetRow < GAME_CONFIG.minRowBehindStart) return;

    this.createRowIfMissing(targetRow);
    const targetRowData = this.rows.get(targetRow);
    if (targetRowData && targetRowData.treeXs.has(targetX)) return; // дерево преграждает путь

    this.activeHop = { progress: 0, fromX: this.playerX, fromRow: this.playerRow, toX: targetX, toRow: targetRow };
    for (let r = targetRow; r < targetRow + GAME_CONFIG.rowsGeneratedAhead; r++) this.createRowIfMissing(r);
    this.removeRowsFarBehind(targetRow);
  }

  /**
   * Удаляет ряды, оставшиеся далеко позади игрока.
   * @param {number} currentRow
   */
  removeRowsFarBehind(currentRow) {
    this.rows.forEach((row, index) => {
      if (index < currentRow - GAME_CONFIG.rowsKeptBehindPlayer) {
        this.rows.delete(index);
        this.listeners.onRowRemoved(index);
      }
    });
  }

  /**
   * Обновляет игру на один кадр.
   * @param {number} deltaSeconds Время с прошлого кадра, сек.
   */
  update(deltaSeconds) {
    if (!this.isRunning()) return;
    this.moveCars(deltaSeconds);
    if (this.activeHop) this.advanceHop(deltaSeconds);
    else this.checkHazards(deltaSeconds);
  }

  /** Двигает все машины и «зацикливает» их на краях. @param {number} dt */
  moveCars(deltaSeconds) {
    const edge = GAME_CONFIG.fieldHalfWidth + GAME_CONFIG.carWrapMargin;
    /** Двигает один объект ряда и зацикливает его на краю. */
    const moveItem = (item, row, speedFactor) => {
      item.x += row.carDirection * row.carBaseSpeed * speedFactor * this.carSpeedMultiplier * dt;
      if (item.x > edge) item.x = -edge;
      if (item.x < -edge) item.x = edge;
    };
    this.rows.forEach(row => {
      row.cars.forEach(car => moveItem(car, row, 1));
      row.logs.forEach(log => moveItem(log, row, 1));
      row.crocodiles.forEach(croc => moveItem(croc, row, GAME_CONFIG.crocodileSpeedFactor));
    });
  }

  /** Продвигает текущий прыжок; по завершении фиксирует позицию и счёт. @param {number} dt */
  advanceHop(deltaSeconds) {
    const hop = this.activeHop;
    hop.progress = Math.min(hop.progress + dt / GAME_CONFIG.hopDurationSeconds, 1);
    if (hop.progress >= 1) {
      this.playerX = hop.toX; this.playerRow = hop.toRow; this.activeHop = null;
      if (this.playerRow > this.score) { this.score = this.playerRow; this.listeners.onScoreChange(this.score); }
      // Приземлились в реку не на бревно — тонем.
      const landedRow = this.rows.get(this.playerRow);
      if (landedRow && landedRow.type === RowType.RIVER && !this.findLogUnder(landedRow, this.playerX)) this.die(DeathCause.WATER);
    }
  }

  /**
   * Проверяет опасности для стоящего камня: машины на дороге; вода, течение и крокодилы на реке.
   * @param {number} dt Время кадра, сек.
   */
  checkHazards(deltaSeconds) {
    const row = this.rows.get(this.playerRow);
    if (!row) return;
    if (row.type === RowType.ROAD) {
      for (const car of row.cars) {
        if (Math.abs(car.x - this.playerX) < car.length / 2 + GAME_CONFIG.rockHalfWidth) { this.die(DeathCause.CAR); return; }
      }
    } else if (row.type === RowType.RIVER) {
      if (!this.findLogUnder(row, this.playerX)) { this.die(DeathCause.WATER); return; }
      // Бревно несёт камень вместе с течением.
      this.playerX += row.carDirection * row.carBaseSpeed * this.carSpeedMultiplier * dt;
      if (Math.abs(this.playerX) > GAME_CONFIG.sweptAwayX) { this.die(DeathCause.WATER); return; }
      // Крокодил кусает камень, стоящий на бревне.
      for (const croc of row.crocodiles) {
        if (Math.abs(croc.x - this.playerX) < croc.length / 2 + GAME_CONFIG.rockHalfWidth) { this.die(DeathCause.CROCODILE); return; }
      }
    }
  }

  /**
   * Камень погиб: конец игры.
   * @param {string} cause Причина смерти (DeathCause).
   */
  die(cause) {
    this.isDead = true;
    this.listeners.onGameOver(this.score, cause);
  }

  /**
   * Текущее положение камня для отрисовки.
   * @returns {{x:number, lift:number, row:number, hopDeltaX:number, hopDeltaRow:number}}
   *   x/row — дробные координаты, lift — высота над землёй, hopDelta* — направление прыжка (0 если стоит).
   */
  getPlayerPose() {
    const hop = this.activeHop;
    if (!hop) {
      const row = this.rows.get(this.playerRow);
      const lift = row && row.type === RowType.RIVER ? GAME_CONFIG.standingOnLogLift : 0;
      return { x: this.playerX, lift, row: this.playerRow, hopDeltaX: 0, hopDeltaRow: 0 };
    }
    const t = hop.progress;
    return {
      x: hop.fromX + (hop.toX - hop.fromX) * t,
      lift: Math.sin(t * Math.PI) * GAME_CONFIG.hopMaxLift,
      row: hop.fromRow + (hop.toRow - hop.fromRow) * t,
      hopDeltaX: hop.toX - hop.fromX,
      hopDeltaRow: hop.toRow - hop.fromRow
    };
  }
}
