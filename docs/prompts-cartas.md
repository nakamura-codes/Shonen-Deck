# Prompts da arte das cartas

Gere todos os ícones na mesma conversa do ChatGPT e anexe uma imagem de referência na primeira mensagem, para manter o estilo. Salve cada imagem em `art/raw/<arquivo>` e rode `npm run art`.

**Bloco de estilo:** comece todo prompt com ele.

> Pixel art game icon, 64x64 pixel style with large visible pixels, limited palette, 2–3 tone shading, dark outline, centered subject, flat solid background, no text, no character face or body — show only the power/effect. Same style as the reference image.

| Arquivo | Prompt |
|---|---|
| `gatling.png` | Many stretched rubber arms with fists punching forward in a rapid barrage, motion blur lines, red background |
| `pistol.png` | A single long stretched rubber arm with a clenched fist flying forward, red background |
| `getsuga.png` | A black crescent energy slash wave with glowing red edges, flying diagonally, dark blue background |
| `kamehameha.png` | Two cupped hands holding a glowing blue energy sphere starting to fire a beam, blue background |
| `genki_dama.png` | A gigantic white-blue glowing energy sphere held up by two raised hands, sky background |
| `kaioken.png` | Roaring red flame aura bursting upward, red background |
| `bankai.png` | A black katana with a broken chain on the hilt, surrounded by red-black spiritual energy, purple background |
| `gear_second.png` | A pink-tinted arm releasing hot steam, purple background |
| `rasengan.png` | An open palm holding a swirling spiral blue sphere of wind, blue background |
| `chidori.png` | A hand engulfed in crackling white-blue lightning, dark background |
| `sharingan.png` | A close-up red eye with three black tomoe around the pupil, dark background |
| `kage_bunshin.png` | A puff of white smoke with several identical ninja silhouettes appearing, blue background |
| `domain_expansion.png` | Crossed fingers hand sign in front of an infinite starry void, purple background |
| `haki.png` | A clenched fist hardened in glossy black armor, green background |
| `shunpo.png` | Blurred afterimages of a fast step with dust lines, green background |
| `golpe_basico.png` | A simple fist punching forward, red background |
| `defesa_basica.png` | Two crossed forearms in a guard stance, green background |
| `red.png` | A glowing crimson-red energy orb with white core repelling shockwaves outward, red background |
| `blue.png` | A swirling dark-blue energy orb pulling debris and light inward like a vortex, blue background |
| `hollow_purple.png` | A red orb and a blue orb colliding and merging into a huge glowing purple sphere erasing everything, dark purple background |

**Para criar uma carta nova:**
1. Adicione a carta em `shared/src/cards.ts`.
2. Escreva um prompt seguindo o mesmo padrão.
3. Salve a imagem com o mesmo `id` da carta e rode `npm run art`.
