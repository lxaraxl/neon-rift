const miniatureSource = (() => {
  const heroes = new Set([
    'astra', 'bastion', 'glitch', 'kairos', 'lyra', 'mila', 'murr', 'nyx',
    'phoenix', 'pixel', 'pyro', 'rain', 'scrap', 'silas', 'sol', 'volta',
  ]);
  return (hero, view = 'front') => heroes.has(hero) ? `art/miniatures/${hero}-${view}.webp` : null;
})();
