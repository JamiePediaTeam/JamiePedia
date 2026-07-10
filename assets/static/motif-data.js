const allMotifs = [];

class Motif {
  constructor(id, name, image = null, aliases = [], color = '#ef8a85', options = {}) {
    this.id = id;
    this.name = name;
    this.image = image;
    this.aliases = aliases;
    this.color = color;
    this.variationGroup = options.variationGroup || null;
    this.variationLabel = options.variationLabel || null;
    this.iconText = options.iconText || null;
    this.iconColor = options.iconColor || color;
    this.variations = Array.isArray(options.variations) ? options.variations : [];
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
  ),

  SPACE_CENTER: new Motif(
    'space-center',
    'Space Center',
    '../public/images/cover-art/aa.png',
    ['space-center-a', 'space-center-b'],
    '#9EC7CD',
    {
      variationGroup: 'space-center',
      iconText: 'SC',
      iconColor: '#9EC7CD',
      variations: [
        { id: 'A', label: 'A', color: '#9EC7CD' },
        { id: 'B', label: 'B', color: '#A2E9CF' }
      ]
    }
  )
};

function getMotifById(id) {
  return allMotifs.find((motif) => motif.id === id || motif.aliases.includes(id));
}

window.MotifData = {
  Motifs,
  allMotifs,
  Motif,
  getMotifById
};