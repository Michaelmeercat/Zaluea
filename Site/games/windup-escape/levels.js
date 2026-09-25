/*
 * Level data. Map legend:
 *   #  toy block (bounce)      .  floor          S  start       E  exit door
 *   k  gold key (star)         w  wind-up key    o  hole
 *   ^ > v <  arrow pad         c  crumbly tile   A / B  pop-up blocks
 *   1-9  warp tubes (pairs)
 * Times (spring, par) are in beats; one beat = 0.5 s = one tile of walking.
 * Marble paths are lists of [x, y] waypoints walked in a loop.
 */
(function (root) {
  'use strict';
  var LEVELS = [
    {
      name: 'Wind Me Up', intro: 'turn', dir: 'right', spring: 30, par: 16,
      tip: 'Beat the \u2605 on the spring bar to earn the time star.',
      marks: [[5, 1], [5, 5]],
      map: [
        '#######',
        '#S...k#',
        '#.###.#',
        '#.###.#',
        '#.###.#',
        'E.....#',
        '#######'
      ]
    },
    {
      name: 'Bonk!', intro: 'bonk', dir: 'left', spring: 36, par: 21,
      map: [
        '#######',
        '#k...S#',
        '#####.#',
        '#.....#',
        '#.###.#',
        'E..k..#',
        '#######'
      ]
    },
    {
      name: 'No Left Turns?', intro: 'left', dir: 'up', spring: 36, par: 17,
      map: [
        '#####E#',
        '#...#.#',
        '#.#.#.#',
        '#.#.k.#',
        '#S#####',
        '#######'
      ]
    },
{
      name: 'Wind-Up Keys', intro: 'winder', dir: 'right', spring: 12, par: 33, needsWinder: true,
      map: [
        '#########',
        '#S......#',
        '#######.#',
        '#.....#.#',
        '#.###.#w#',
        '#.#E..#.#',
        '#.#####.#',
        '#w.....k#',
        '#########'
      ]
    },
    {
      name: 'Mind the Gap', intro: 'hole', dir: 'right', spring: 40, par: 24,
      map: [
        '#######',
        '#S...k#',
        '#ooo.o#',
        '#k...o#',
        '#.oooo#',
        '#.....E',
        '#######'
      ]
    },
    {
      name: 'Arrow Pads', intro: 'arrow', dir: 'right', spring: 50, par: 33,
      map: [
        '#########',
        '#S.....v#',
        '#######v#',
        '#k..<..v#',
        '#.oo^oov#',
        '#.oo^k<<#',
        '#v#######',
        '#.....k.E',
        '#########'
      ]
    },
    {
      name: 'Marble Crossing', intro: 'marble', dir: 'down', spring: 50, par: 30,
      marbles: [{ path: [[5, 1], [5, 5]] }],
      map: [
        '#########',
        '#k..#.#k#',
        '#.S.#.#.#',
        '#.......E',
        '#...#.#.#',
        '#...#.#k#',
        '#########'
      ]
    },
    {
      name: 'Rush Hour', dir: 'right', spring: 44, par: 25,
      tip: 'Marbles never stop. Wait for a gap!',
      marbles: [
        { path: [[1, 2], [7, 2]] },
        { path: [[7, 4], [1, 4]] },
        { path: [[1, 6], [7, 6]], offset: 3 }
      ],
      map: [
        '#########',
        '#S....k.#',
        '#.......#',
        '#.##.##.#',
        '#.......#',
        '#.##.##.#',
        '#.......#',
        '#k..E...#',
        '#########'
      ]
    },
    {
      name: 'Pop-Up Blocks', intro: 'piston', dir: 'right', spring: 46, par: 28,
      map: [
        '#########',
        '#S..A..k#',
        '#.#####.#',
        '#B#####B#',
        '#.#####.#',
        '#k..A...#',
        '#######E#'
      ]
    },
    {
      name: 'Cookie Jar', intro: 'crumble', dir: 'right', spring: 40, par: 21,
      map: [
        '#######',
        '#Sccck#',
        '#ccccc#',
        '#cckcc#',
        '#ccccc#',
        '#kcccc#',
        '#####E#'
      ]
    },
    {
      name: 'Warp Tubes', intro: 'pipe', dir: 'right', spring: 40, par: 24,
      map: [
        '#########',
        '#S...1..#',
        '#.....k.#',
        '#########',
        '#1.k..2.#',
        '#.......#',
        '#########',
        '#.2.....E',
        '#########'
      ]
    },
    {
      name: 'Roundabout', dir: 'right', spring: 46, par: 29,
      tip: 'Ride the arrows round, then tap to hop off.',
      map: [
        '#########',
        '#S......#',
        '#oo.ooo.#',
        '#ov<<oo.#',
        '#ov#^ook#',
        '#o>k^oo.#',
        '#oo.ooo.#',
        '#w......E',
        '#########'
      ]
    },
    {
      name: 'Tube Hop', dir: 'right', spring: 44, par: 29,
      tip: 'Tubes keep you facing the same way.',
      marbles: [{ path: [[5, 5], [7, 5], [7, 7], [5, 7]], offset: 4 }],
      map: [
        '#########',
        '#S..#..k#',
        '#..1#1..#',
        '#.k.#..2#',
        '#########',
        '#2.3#...#',
        '#...#.3.E',
        '#..k#..k#',
        '#########'
      ]
    },
    {
      name: 'Cookie Bridges', dir: 'right', spring: 44, par: 29,
      tip: 'Cookies crumble behind you. No going back!',
      map: [
        '#########',
        '#Sccccck#',
        '#ooooooc#',
        '#kcccc#c#',
        '#cooococ#',
        '#cckoccc#',
        '#oocoooo#',
        '###E#####'
      ]
    },
    {
      name: 'Stop and Go', dir: 'right', spring: 46, par: 32,
      tip: 'Blocks and marbles both keep time. Watch the rhythm!',
      marbles: [{ path: [[3, 3], [7, 3]] }],
      map: [
        '#########',
        '#S..A..k#',
        '#.#####.#',
        '#.......#',
        '###A#B###',
        '#k......E',
        '#########'
      ]
    },
    {
      name: 'Tick-Tock', dir: 'right', spring: 36, par: 21,
      pistonPeriod: 2, pistonUpFor: 1,
      tip: 'Fast blocks! Bounce once to get in rhythm.',
      map: [
        '#########',
        '#S.ABAB.#',
        '#.#BABA.#',
        '#.#AkAB.#',
        '#.#BABA.#',
        '#k.ABAB.E',
        '#########'
      ]
    },
    {
      name: 'Marble Alley', dir: 'right', spring: 50, par: 37,
      tip: 'Duck into a side pocket to let the marble pass.',
      marbles: [{ path: [[1, 3], [7, 3]] }],
      map: [
        '#########',
        '##k###k##',
        '##.###.##',
        'S.......E',
        '###.#.###',
        '###k#k###',
        '#########'
      ]
    },
    {
      name: 'Spin Cycle', dir: 'up', spring: 46, par: 32,
      marbles: [{ path: [[1, 1], [7, 1], [7, 7], [1, 7]] }],
      map: [
        '#########',
        '#k......#',
        '#.##.##.#',
        '#.#v<<#.#',
        'E.#v#^#.#',
        '#.#>k^#.#',
        '#.##.##.#',
        '#...S..k#',
        '#########'
      ]
    },
    {
      name: 'Clockwork', dir: 'right', spring: 14, par: 20,
      tip: 'Short spring! Grab the wind-up keys.',
      marbles: [{ path: [[1, 3], [7, 3]] }],
      map: [
        '#########',
        '#S.A..Bw#',
        '#.##.##.#',
        '#w......#',
        '#.##B##.#',
        '#k.A...k#',
        '####.####',
        '####E####'
      ]
    },
    {
      name: 'The Great Escape', dir: 'right', spring: 22, par: 31,
      tip: 'Everything at once! Plan your route before you wind up.',
      marbles: [{ path: [[1, 5], [7, 5]] }, { path: [[7, 9], [1, 9]], offset: 4 }],
      map: [
        '#########',
        '#Scccc..#',
        '#oooocA.#',
        '#kw..c#.#',
        '####.##.#',
        '#.......#',
        '#.##.##B#',
        '#.#v<<#.#',
        '#.#>k^#.#',
        '#.......#',
        '#w#####E#',
        '#########'
      ]
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.WLEVELS = LEVELS;
})(this);
