/*
 * RU: Константы интерфейса, настройки и визуального оформления.
 * EN: Interface constants, settings, and visual theme configuration.
 */

/** RU: Ширина игровой области по горизонтали. EN: Horizontal half-width of the playable area. */
const WORLD_WIDTH = 8;
/** RU: Цвет фона сцены. EN: Scene background color. */
const SCENE_BACKGROUND = 0xbfe3f5;
/** RU: Цвет тумана на сцене. EN: Scene fog color. */
const SCENE_FOG_COLOR = 0xbfe3f5;
/** RU: Ближняя граница тумана. EN: Near fog distance. */
const FOG_NEAR = 18;
/** RU: Дальняя граница тумана. EN: Far fog distance. */
const FOG_FAR = 40;
/** RU: Угол обзора камеры. EN: Camera field of view. */
const CAMERA_FOV = 50;
/** RU: Минимальная дистанция камеры. EN: Camera near clipping plane. */
const CAMERA_NEAR = 0.1;
/** RU: Максимальная дистанция камеры. EN: Camera far clipping plane. */
const CAMERA_FAR = 100;
/** RU: Ключ сохранения рекорда. EN: Local-storage key for the best score. */
const BEST_SCORE_KEY = "rockBest";
/** RU: Скорость анимации прыжка в секундах. EN: Jump animation duration in seconds. */
const JUMP_DURATION = 0.13;
/** RU: Максимальный шаг времени одного кадра. EN: Maximum frame delta time. */
const MAX_FRAME_DELTA = 0.05;
/** RU: Цвета машин. EN: Available car colors. */
const CAR_COLORS = [0xd63031, 0x0984e3, 0xfdcb6e, 0x00b894, 0x6c5ce7, 0xe17055];
/** RU: Сообщения для экранного оверлея. EN: Text used in the overlay. */
const UI_TEXT = {
  title: "🪨 Симулятор камня",
  instructions: "Перейди дорогу и не попади под машину",
  controls: "Стрелки / WASD — движение · P или Пробел — пауза",
  play: "Играть",
  pause: "⏸ Пауза",
  resume: "▶ Продолжить",
  crushed: "💥 Раздавлен!",
  score: "Счёт: "
};
/** RU: Настройки начального количества машин и скорости. EN: Initial traffic and speed settings. */
const DEFAULT_SETTINGS = {
  speed: 1,
  density: 3,
  minSpeed: 0.3,
  maxSpeed: 3,
  minCars: 0,
  maxCars: 8
};
