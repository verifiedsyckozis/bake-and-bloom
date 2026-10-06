// Level list. Each level has:
//   moves   swaps you get
//   colors  how many piece types appear (fewer is easier)
//   goal    'score': have at least stars[0] points when the moves run out
//           'frost': clear every layer of frosting (map: '.', '1', or '2' per cell)
//           'order': collect pieces. Keys are piece indexes from theme.js
//                    (0 croissant, 1 cupcake, 2 cookie, 3 plant, 4 cactus, 5 tulip)
//                    or 'line' / 'wrap' / 'bomb' for making that special.
//   stars   points for 1, 2, and 3 stars. You need 1 star to pass.
//   tip     shown on the level's start card
// Star scores were tuned by simulating thousands of games (see plan.md).
window.M3 = window.M3 || {};

M3.LEVELS = [
  {
    moves: 15, colors: 5, goal: 'score', stars: [3000, 8000, 15000],
    tip: 'Line up 3 or more to clear them. Score enough before your moves run out.',
  },
  {
    moves: 16, colors: 5, goal: 'score', stars: [4000, 9000, 16000],
    tip: 'Match 4 in a row to bake a Striped piece. It clears a whole line!',
  },
  {
    moves: 20, colors: 5, goal: 'frost',
    frost: [
      '........',
      '........',
      '..1111..',
      '..1111..',
      '..1111..',
      '..1111..',
      '........',
      '........',
    ],
    stars: [10000, 26000, 32000],
    tip: 'Clear the pieces sitting on frosting to scrape it off.',
  },
  {
    moves: 18, colors: 5, goal: 'order', order: [{ key: 0, count: 15 }, { key: 3, count: 15 }],
    stars: [2000, 10000, 15000],
    tip: 'Match 4 in a square to free a Butterfly. It flies off to grab a piece you need!',
  },
  {
    moves: 20, colors: 6, goal: 'score', stars: [4500, 8000, 12000],
    tip: 'Match in an L or T shape to make a Gift Box. It bursts twice!',
  },
  {
    moves: 22, colors: 5, goal: 'frost',
    frost: [
      '........',
      '.111111.',
      '.122221.',
      '.12..21.',
      '.12..21.',
      '.122221.',
      '.111111.',
      '........',
    ],
    stars: [20000, 58000, 66000],
    tip: 'Dark frosting takes two clears.',
  },
  {
    moves: 20, colors: 5, goal: 'order', order: [{ key: 'line', count: 3 }, { key: 'wrap', count: 1 }],
    stars: [3000, 12000, 18000],
    tip: 'Make Striped pieces (4 in a row) and a Gift Box (L or T shape).',
  },
  {
    moves: 30, colors: 5, goal: 'frost',
    frost: Array(8).fill('11111111'),
    stars: [20000, 85000, 92000],
    tip: 'Frosting everywhere! Specials scrape off lots at once.',
  },
  {
    moves: 26, colors: 5, goal: 'order', order: [{ key: 'bomb', count: 1 }, { key: 1, count: 25 }],
    stars: [3000, 15000, 22000],
    tip: 'Line up 5 in a row for a Sprinkle Bomb. Swap it with any piece to clear that color.',
  },
  {
    moves: 22, colors: 6, goal: 'score', stars: [6000, 10000, 15000],
    tip: 'Swap two specials together for a combo!',
  },
  {
    moves: 30, colors: 5, goal: 'frost',
    frost: [
      '22....22',
      '.22..22.',
      '..2222..',
      '...22...',
      '...22...',
      '..2222..',
      '.22..22.',
      '22....22',
    ],
    stars: [10000, 80000, 90000],
    tip: 'Corners are tricky. Striped pieces reach them.',
  },
  {
    moves: 25, colors: 5, goal: 'order', order: [{ key: 'wrap', count: 2 }, { key: 'line', count: 5 }],
    stars: [5000, 16000, 22000],
    tip: 'Bomb + Striped turns a whole color into Striped pieces.',
  },
  {
    moves: 28, colors: 5, goal: 'frost',
    frost: [
      '11111111',
      '12....21',
      '1.2..2.1',
      '1......1',
      '1......1',
      '1.2..2.1',
      '12....21',
      '11111111',
    ],
    stars: [10000, 64000, 72000],
    tip: 'Work the edges.',
  },
  {
    moves: 26, colors: 6, goal: 'order', order: [{ key: 4, count: 25 }, { key: 3, count: 25 }],
    stars: [5000, 9000, 13000],
    tip: 'A garden order: cacti and potted plants.',
  },
  {
    moves: 36, colors: 5, goal: 'frost',
    frost: Array(8).fill('22222222'),
    stars: [30000, 155000, 168000],
    tip: 'The big bake. Every cell has two layers.',
  },
];
