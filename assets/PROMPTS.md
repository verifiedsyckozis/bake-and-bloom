# ComfyCloud prompts — Bake & Bloom piece icons

Prompts and settings used to generate the 6 piece icons on 2026-10-05. Keep the style line identical across all 6 so they read as one set.

## Final settings (used for the shipped icons)
Queued through the ComfyCloud API (`POST /api/prompt`). The graph is a minimal Krea2 turbo text-to-image setup (no LoRAs, no prompt refiner):

- **Model:** `krea2_turbo_int8_convrot.safetensors` (UNETLoader, default dtype)
- **CLIP:** `qwen3vl_4b_fp8_scaled.safetensors`, type `krea2`
- **VAE:** `qwen_image_vae.safetensors`
- **Sampler:** KSampler, 10 steps, cfg 1, `euler`, `simple`, denoise 1. The negative is ConditioningZeroOut, so at cfg 1 negative prompts have no effect; "no text" etc. go in the positive prompt.
- **Size:** 1024×1024 EmptyLatentImage
- **Background removal:** `RMBG` node, model `RMBG-2.0`, sensitivity 1, process_res 1024, refine_foreground on, background Alpha
- **Seeds:** croissant 1001, cupcake 1002, cookie 1003, plant 1004, cactus 1005, tulip 1006
- **Post-process (local):** each 1024 cutout was cropped to a square around its visible pixels plus 6% margin, then resized to 256×256 with macOS `sips` into `assets/pieces/<id>.png`.

## Output spec
- 1024×1024 generation, downscaled to **256×256 PNG with a transparent background**.
- One object per image, centered, about 80% of the frame, nothing touching the edges.
- No text, no plate or table, no drop shadow on the background. The tile already provides the color and shadow.
- Save as `assets/pieces/<id>.png` using the ids below.

## Shared style line
> cute cozy mobile game icon, single object, soft 3D clay render, rounded chunky shapes, gentle warm studio lighting, subtle highlights, saturated pastel-friendly colors, clean bold silhouette, centered with generous empty margin, isolated on a plain pure white background, no text, no plate, no table, no shadow on the background

## Negative prompt (unused with this cfg-1 turbo setup; kept for other models)
> text, letters, watermark, logo, frame, border, plate, table, hands, people, multiple objects, cropped, blurry, noisy, photorealistic, dark background, harsh shadows

## Pieces
| id | subject prompt (joined before the style line with ", ") | goes on tile |
|----|---------------------------------------------|--------------|
| croissant | a golden flaky croissant with a curved crescent shape | butter `#ffd46e` |
| cupcake | a cupcake with tall pink swirled frosting and a red cherry on top, striped paper liner | pink `#f8a9c6` |
| cookie | a round chocolate chip cookie seen from the front at a slight angle, with big chunky dark chocolate chips | caramel `#d9a27a` |
| plant | a small bushy leafy green houseplant in a terracotta clay pot | sage `#a7d58f` |
| cactus | a chubby tall rounded green cactus in a small cream ceramic pot | sky `#92cbf0` |
| tulip | a single red-pink tulip flower on a short stem with two green leaves | lavender `#c8adf2` |

Each icon's main color should contrast with its tile color, and every silhouette should be different (crescent, swirl-top, circle, leafy bush, tall rounded column, cup-shaped bloom). That way the pieces stay readable at about 50px and for colorblind players.

## Background removal
If the workflow can't output transparency directly, generate on plain white and run a background-removal node (for example a RemBG / BiRefNet node) before saving.

## Page background (`assets/bg.jpg`)
Same model, CLIP, VAE and sampler settings as the icons, with no background removal. Generated at 1344×768 with seed 2001, which beat seed 2002. Saved as JPEG quality 82 with `sips` (about 156 KB). In `style.css`, `--page-bg` lays a light cream gradient over it so text stays readable.

> cozy sunlit home kitchen interior, soft 3D clay render style like a cute mobile game backdrop, wooden open shelves with potted houseplants and trailing pothos vines, terracotta pots, fresh croissants cupcakes and cookies on a cream countertop, big window with soft warm morning light, warm cream peach and sage green color palette, gentle shallow depth of field so everything is soft and slightly blurred, calm and uncluttered in the center, cozy and inviting, no people, no text
