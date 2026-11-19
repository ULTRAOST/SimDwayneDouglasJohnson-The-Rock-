/**
 * Точка входа приложения: связывает игровую логику, 3D-отрисовку и интерфейс.
 */
import { RockGame } from "./game.js";
import { ThreeSceneRenderer } from "./renderer.js";
import { GameInterface } from "./interface.js";

const canvasElement = document.getElementById('gameCanvas');
const game = new RockGame();
const renderer = new ThreeSceneRenderer(canvasElement);

// Интерфейс отправляет команды в игру.
const gameInterface = new GameInterface(canvasElement, {
  onStart: () => game.start(),
  onTogglePause: () => game.setPaused(!game.isPaused),
  onMove: direction => game.tryMove(direction),
  onCarSpeedChange: value => game.setCarSpeedMultiplier(value),
  onCarsPerRoadChange: count => game.setCarsPerRoad(count)
});

// Игра сообщает о событиях — их получают отрисовщик и интерфейс.
game.listeners.onReset = () => renderer.clearScene();
game.listeners.onRowCreated = row => renderer.addRow(row);
game.listeners.onRowRemoved = rowIndex => renderer.removeRow(rowIndex);
game.listeners.onCarsRegenerated = row => renderer.rebuildCars(row);
game.listeners.onScoreChange = score => gameInterface.showScore(score);
game.listeners.onPauseChange = isPaused => { if (game.isStarted) { isPaused ? gameInterface.showPauseState(true) : gameInterface.showGameStarted(); } };
game.listeners.onGameOver = (score, cause) => { renderer.showRockDead(cause); gameInterface.showGameOver(score, cause); };

game.reset();
gameInterface.showStartScreen();

/** Время предыдущего кадра, мс. */
let previousFrameTime = performance.now();

/**
 * Главный цикл: обновляет механику, синхронизирует отрисовку и рисует кадр.
 * @param {number} now Время текущего кадра, мс.
 */
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const deltaSeconds = Math.min((now - previousFrameTime) / 1000, 0.05);
  previousFrameTime = now;

  game.update(deltaSeconds);
  renderer.syncMovingObjects(game.rows);
  if (!game.isDead) {
    const pose = game.getPlayerPose();
    renderer.placeRock(pose.x, pose.lift, pose.row);
    if (game.isRunning()) renderer.spinRock(pose.hopDeltaX, pose.hopDeltaRow, deltaSeconds);
  }
  renderer.updateCamera(deltaSeconds);
  renderer.render();
}
requestAnimationFrame(gameLoop);
