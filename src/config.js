/**
 * Общие константы и настройки «Симулятора камня».
 * Этот модуль не зависит от DOM или Three.js.
 */
/** Направления движения камня. */
const Direction = Object.freeze({FORWARD:'forward', BACK:'back', LEFT:'left', RIGHT:'right'});

/** Тип полосы: трава (безопасно), дорога (машины) или река (брёвна и крокодилы). */
const RowType = Object.freeze({GRASS:'grass', ROAD:'road', RIVER:'river'});

/** Причины смерти камня. */
const DeathCause = Object.freeze({CAR:'car', WATER:'water', CROCODILE:'crocodile'});

/** Параметры игры. */
const GAME_CONFIG = Object.freeze({
  fieldHalfWidth: 8,          // половина ширины поля в клетках
  safeStartRows: 3,           // сколько первых рядов — только трава
  minRowBehindStart: -3,      // как далеко назад можно ходить
  rowsGeneratedBehind: 4,     // сколько рядов создаём позади старта
  rowsGeneratedAhead: 20,     // сколько рядов создаём впереди игрока
  rowsKeptBehindPlayer: 8,    // ряды дальше этого расстояния сзади удаляются
  carWrapMargin: 6,           // за сколько клеток за краем поля машина «телепортируется»
  hopDurationSeconds: 0.13,   // длительность прыжка камня
  hopMaxLift: 0.6,            // максимальная высота прыжка
  grassProbability: 0.3,      // вероятность, что ряд будет травой
  riverProbability: 0.25,     // вероятность, что ряд будет рекой (остальное — дорога)
  logsPerRiver: 5,            // число брёвен на реке
  riverSpeedFactor: 0.6,      // река течёт медленнее, чем едут машины
  crocodileProbability: 0.6,  // вероятность, что на реке плавает крокодил
  crocodileLength: 1.8,       // длина крокодила
  crocodileSpeedFactor: 1.5,  // крокодил плывёт быстрее течения (обгоняет брёвна)
  standingOnLogLift: 0.2,     // на сколько камень приподнят, когда стоит на бревне
  sweptAwayX: 7.8,            // если бревно унесло камень дальше этой X — он погибает
  treeProbability: 0.2,       // вероятность дерева на траве
  carColorVariants: 6,        // число вариантов цвета машины (индексы 0..5)
  rockHalfWidth: 0.3          // «радиус» камня для столкновения с машиной
});

export { Direction, RowType, DeathCause, GAME_CONFIG };
