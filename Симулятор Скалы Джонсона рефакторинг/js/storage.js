/*
 * RU: Слой работы с сохранёнными данными.
 * EN: Data-access layer for saved game data.
 */

/**
 * RU: Читает лучший результат из локального хранилища.
 * EN: Reads the best score from local storage.
 * @returns {number} RU: Сохранённый рекорд или 0. EN: Saved best score or 0.
 */
function loadBestScore() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * RU: Сохраняет рекорд игрока.
 * EN: Saves the player's best score.
 * @param {number} score RU: Новый результат. EN: New score.
 * @returns {void} RU: Ничего не возвращает. EN: Returns nothing.
 */
function saveBestScore(score) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch (error) {
    // RU: Игра продолжает работать, если браузер запрещает хранение.
    // EN: The game keeps running if the browser blocks storage.
  }
}
