export function enableGridKeyboard(board, columns) {
  const cells = Array.from(board.children);
  let current = cells[0];
  current.tabIndex = 0;

  board.addEventListener("focusin", event => {
    if (!cells.includes(event.target) || event.target === current) return;
    current.tabIndex = -1;
    current = event.target;
    current.tabIndex = 0;
  });

  board.addEventListener("keydown", event => {
    if (event.target !== current) return;
    const index = cells.indexOf(current);
    const column = index % columns;
    const moves = {
      ArrowLeft: column > 0 ? index - 1 : index,
      ArrowRight: column < columns - 1 ? index + 1 : index,
      ArrowUp: index >= columns ? index - columns : index,
      ArrowDown: index + columns,
    };
    if (!Object.hasOwn(moves, event.key)) return;
    event.preventDefault();
    cells[moves[event.key]]?.focus();
  });
}
