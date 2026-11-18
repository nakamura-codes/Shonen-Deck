// Gerado por tools/process-weapons.ts — não edite à mão.
// Tamanho de cada sprite de arma (2 px por pixel do boneco) e onde fica o cabo, apontando para cima e para a direita.
export const WEAPON_RES = 2;
export const WEAPONS: Record<string, { w: number; h: number; gripX: number; gripY: number }> = {
  "espada_trunks": {
    "w": 45,
    "h": 46,
    "gripX": 5.1,
    "gripY": 39.4
  },
  "pistola_pirata": {
    "w": 21,
    "h": 21,
    "gripX": 2.8,
    "gripY": 17.6
  },
  "kunai_ninja": {
    "w": 18,
    "h": 19,
    "gripX": 2.3,
    "gripY": 15.6
  },
  "zanpakuto": {
    "w": 47,
    "h": 55,
    "gripX": 6,
    "gripY": 38.5
  },
  "cutelo_nanami": {
    "w": 30,
    "h": 29,
    "gripX": 3.4,
    "gripY": 24.9
  }
};
