const miniatureSource = (() => {
  const heroes = new Set([
    'astra', 'bastion', 'cipher', 'glitch', 'grom', 'kairos', 'lyra', 'mila',
    'murr', 'nyx', 'phoenix', 'pixel', 'pyro', 'rain', 'raven', 'scrap',
    'silas', 'sol', 'tesla', 'volta', 'zhar',
  ]);
  return (hero, view = 'front') => heroes.has(hero) ? `art/miniatures/${hero}-${view}.webp` : null;
})();
