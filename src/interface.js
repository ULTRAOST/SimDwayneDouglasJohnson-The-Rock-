/**
 * Пользовательский интерфейс и ввод: клавиатура, сенсорные кнопки,
 * свайпы, ползунки, пауза и экран завершения игры.
 * Игровые правила здесь не реализуются — интерфейс отправляет команды через callbacks.
 */
import { DeathCause } from "./config.js";

export class GameInterface {
  /**
   * @param {HTMLCanvasElement} canvasElement Canvas (для свайпов).
   * @param {{onStart:Function, onTogglePause:Function, onMove:Function, onCarSpeedChange:Function, onCarsPerRoadChange:Function}} commands
   *   Команды, которые интерфейс отправляет игре.
   */
  constructor(canvasElement, commands) {
    this.commands = commands;
    this.canvasElement = canvasElement;
    /** Элементы DOM. */
    this.scoreElement = document.getElementById('scoreValue');
    this.bestScoreElement = document.getElementById('bestScoreValue');
    this.overlayElement = document.getElementById('overlay');
    this.pauseButton = document.getElementById('pauseButton');
    /** @type {number} Лучший счёт (хранится в localStorage). */
    this.bestScore = this.loadBestScore();
    /** Флаги состояния, чтобы клавиши Пробел/P знали, что делать. */
    this.isGameActive = false;

    this.bestScoreElement.textContent = this.bestScore;
    this.bindControls();
  }

  /** @returns {number} Рекорд из localStorage (или 0). */
  loadBestScore() { try { return +localStorage.getItem('rockBest') || 0; } catch (e) { return 0; } }

  /** Сохраняет рекорд в localStorage. @param {number} value */
  saveBestScore(value) { try { localStorage.setItem('rockBest', value); } catch (e) {} }

  /** Подписывается на клавиатуру, кнопки, ползунки и свайпы. */
  bindControls() {
    // Используем физические клавиши (event.code), чтобы WASD работали в любой раскладке (в т.ч. русской: ЦФЫВ).
    const codeToDirection = { ArrowUp:'forward', KeyW:'forward', ArrowDown:'back', KeyS:'back', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right' };
    addEventListener('keydown', event => {
      const direction = codeToDirection[event.code];
      if (direction) { this.commands.onMove(direction); event.preventDefault(); return; }
      if (event.code === 'KeyP' || event.code === 'Space' || event.code === 'Escape') {
        if (!event.repeat) this.handlePauseKey();
        event.preventDefault();
      }
    });

    document.querySelectorAll('#pad button').forEach(button =>
      button.addEventListener('pointerdown', event => { event.preventDefault(); this.commands.onMove(button.dataset.direction); }));

    let swipeStartX, swipeStartY;
    this.canvasElement.addEventListener('pointerdown', e => { swipeStartX = e.clientX; swipeStartY = e.clientY; });
    this.canvasElement.addEventListener('pointerup', e => {
      const dx = e.clientX - swipeStartX, dy = e.clientY - swipeStartY;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) this.commands.onMove('forward'); // тап = вперёд
      else if (Math.abs(dx) > Math.abs(dy)) this.commands.onMove(dx > 0 ? 'right' : 'left');
      else this.commands.onMove(dy < 0 ? 'forward' : 'back');
    });

    this.pauseButton.onclick = () => this.handlePauseKey();

    document.getElementById('carSpeedSlider').oninput = e => {
      const value = +e.target.value;
      document.getElementById('carSpeedLabel').textContent = value.toFixed(1) + '×';
      this.commands.onCarSpeedChange(value);
    };
    document.getElementById('carsPerRoadSlider').oninput = e => {
      const value = +e.target.value;
      document.getElementById('carsPerRoadLabel').textContent = value;
      this.commands.onCarsPerRoadChange(value);
    };
  }

  /** Пробел/P/кнопка паузы: если игра не идёт — старт, иначе пауза. */
  handlePauseKey() {
    if (!this.isGameActive) this.commands.onStart();
    else this.commands.onTogglePause();
  }

  /**
   * Показывает полноэкранное сообщение с кнопкой.
   * @param {string} title Заголовок. @param {string[]} lines Строки текста.
   * @param {string} buttonText Текст кнопки. @param {Function} onButtonClick Действие кнопки.
   * @param {boolean} [letClicksThrough=false] Пропускать клики сквозь фон (для паузы).
   */
  showOverlay(title, lines, buttonText, onButtonClick, letClicksThrough = false) {
    const el = this.overlayElement;
    el.innerHTML = `<h1>${title}</h1>` + lines.map(l => `<p>${l}</p>`).join('') + `<button id="overlayButton">${buttonText}</button>`;
    el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,.45);color:#fff;text-align:center;padding:20px;';
    el.style.pointerEvents = letClicksThrough ? 'none' : 'auto';
    const button = document.getElementById('overlayButton');
    button.style.pointerEvents = 'auto';
    button.onclick = onButtonClick;
  }

  /** Прячет оверлей. */
  hideOverlay() { this.overlayElement.style.display = 'none'; }

  /** Стартовый экран. */
  showStartScreen() {
    this.isGameActive = false;
    this.showOverlay('🪨 Симулятор камня',
      ['Перейди дороги и реки: прыгай по брёвнам, берегись машин и крокодилов', 'Стрелки / WASD — прыжок · P или Пробел — пауза'],
      'Играть', () => this.commands.onStart());
  }

  /** Игра началась: убираем оверлей. */
  showGameStarted() {
    this.isGameActive = true;
    this.hideOverlay();
    this.pauseButton.textContent = '⏸ Пауза';
  }

  /** Обновляет интерфейс при смене паузы. @param {boolean} isPaused */
  showPauseState(isPaused) {
    this.pauseButton.textContent = isPaused ? '▶ Продолжить' : '⏸ Пауза';
    if (isPaused) this.showOverlay('⏸ Пауза', ['Можно менять скорость и количество машин'], 'Продолжить',
      () => this.commands.onTogglePause(), true);
    else this.hideOverlay();
  }

  /**
   * Экран конца игры + обновление рекорда.
   * @param {number} score Счёт. @param {string} cause Причина смерти (DeathCause).
   */
  showGameOver(score, cause) {
    this.isGameActive = false;
    if (score > this.bestScore) {
      this.bestScore = score;
      this.bestScoreElement.textContent = score;
      this.saveBestScore(score);
    }
    const titles = { [DeathCause.CAR]: '💥 Раздавлен!', [DeathCause.WATER]: '🌊 Утонул!', [DeathCause.CROCODILE]: '🐊 Укусил крокодил!' };
    this.showOverlay(titles[cause] || '💥 Конец игры', ['Счёт: ' + score], 'Ещё раз', () => this.commands.onStart());
  }

  /** Обновляет отображение счёта. @param {number} score */
  showScore(score) { this.scoreElement.textContent = score; }
}
