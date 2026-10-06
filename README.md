# Bake & Bloom

A cozy match-3 puzzle game with baking treats and houseplants, built with plain HTML, CSS, and JavaScript. No frameworks, no build step.

**Play:** https://verifiedsyckozis.github.io/bake-and-bloom/

On iPhone or iPad, open the link in Safari, tap Share, then **Add to Home Screen** to play it like an app.

## How to play
- Swap two neighboring pieces by tapping one and then the other, or by swiping. A swap only counts if it lines up 3 or more.
- 15 levels, each with limited moves and a goal: reach a score, scrape off all the frosting, or fill an order. Earn up to 3 stars.
- **4 in a row** makes a **Striped** piece that clears its row or column.
- **An L or T shape** makes a **Gift Box** that bursts 3×3, falls, and bursts again.
- **4 in a square** frees a **Butterfly** that flies to a piece you need (or frosting) and clears it.
- **5 in a row** makes a **Sprinkle Bomb**. Swap it with any piece to clear every piece of that kind.
- Swap two specials together for combos (bomb + bomb clears the whole board).
- Win with moves to spare and the leftovers turn into Striped pieces for bonus points.
- You have 5 hearts. Failing a level, or quitting after you've moved, costs one. Hearts grow back one every 30 minutes.
- Sound effects can be muted with the speaker button.

## Run locally
Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

Piece art and background were generated with ComfyCloud; see `assets/PROMPTS.md`. The design and build plan is in `plan.md`.
