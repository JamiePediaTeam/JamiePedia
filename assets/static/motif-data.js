const allMotifs = [];

class Motif {
  constructor(id, name, image = null, aliases = [], color = '#ef8a85') {
    this.id = id;
    this.name = name;
    this.image = image;
    this.aliases = aliases;
    this.color = color;
    allMotifs.push(this);
  }
}

const Motifs = {
  BITTERSWEET_KALIA_VIBTE: new Motif(
    'bittersweet-kalia-vibte',
    'Bittersweet/Kalia Vibte',
    '../public/images/cover-art/bs.png',
    [],
    '#FFFFFF'
  ),

  GUMMYWORM: new Motif(
    'gummyworm',
    'Gummyworm',
    '../public/images/motif-art/gummyworm.png',
    [],
    '#66BDE6'
  ),

  CONSTANT_COMPANIONS: new Motif(
    'constant-companions',
    'Constant Companions',
    '../public/images/cover-art/cc.png',
    [],
    '#FA0B06'
  )
};

function getMotifById(id) {
  return allMotifs.find((motif) => motif.id === id);
}

window.MotifData = {
  Motifs,
  allMotifs,
  Motif,
  getMotifById
};