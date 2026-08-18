

/* ------------------------------------------------------------------
 * doodlz.app - random usernames (5,250 of them).
 * Used only when a player leaves the name field empty.
 *
 * Names are built from a family friendly adjective + a noun taken from
 * 14 themed categories, weighted like this (approx.):
 *
 *   Animals 800 | Food 700 | Objects 700 | Nature 500 | Places 400
 *   Colors 300  | Space 300 | Transport 250 | Clothing 250
 *   Hobbies 250 | Fantasy 250 | Jobs 200 | Sounds 200 | Shapes 150
 *
 * Every generated name is <= 13 characters and safe for all ages.
 * ------------------------------------------------------------------ */

var ADJ = [
  'Happy', 'Silly', 'Jolly', 'Fuzzy', 'Speedy', 'Brave', 'Tiny', 'Mega',
  'Cosmic', 'Sunny', 'Zesty', 'Lucky', 'Witty', 'Cheery', 'Bouncy', 'Snazzy',
  'Peppy', 'Nifty', 'Rusty', 'Frosty', 'Toasty', 'Groovy', 'Wobbly', 'Dizzy',
  'Sneaky', 'Cuddly', 'Perky', 'Zippy', 'Chunky', 'Crispy', 'Dandy', 'Breezy',
  'Plucky', 'Spiffy', 'Merry', 'Bubbly', 'Quirky', 'Mighty', 'Swift', 'Calm',
  'Neat', 'Bold', 'Wild', 'Cool', 'Fancy', 'Jazzy', 'Loopy', 'Nimble',
];

/* noun pools, ordered so the weights above come out right */
var CATEGORIES = {
  animals: ['Panda','Otter','Koala','Llama','Walrus','Puffin','Beaver','Turtle','Falcon','Badger',
            'Hamster','Penguin','Moose','Bunny','Gecko','Kitten','Puppy','Lemur','Narwhal','Ferret',
            'Hedgehog','Sparrow','Dolphin','Robin','Bison','Camel','Cobra','Crab','Deer','Eagle',
            'Finch','Goose','Heron','Iguana','Jaguar','Koi','Lynx','Manatee','Newt','Owl'],
  food:    ['Taco','Waffle','Noodle','Pickle','Muffin','Donut','Pretzel','Mango','Peanut','Biscuit',
            'Pancake','Cookie','Bagel','Melon','Cherry','Olive','Pepper','Pumpkin','Carrot','Radish',
            'Plum','Peach','Nacho','Toast','Cupcake','Popcorn','Pudding','Sundae','Jelly','Scone',
            'Ravioli','Burrito','Pasta','Cocoa','Honey','Sorbet'],
  objects: ['Cactus','Kettle','Lantern','Pebble','Rocket','Button','Marble','Teapot','Anchor','Balloon',
            'Crayon','Mitten','Compass','Pillow','Whistle','Bucket','Paddle','Ribbon','Sticker','Trumpet',
            'Umbrella','Wagon','Yoyo','Zipper','Lamp','Mirror','Basket','Kite','Ladder','Spoon',
            'Clock','Broom','Candle','Puzzle','Magnet','Bottle'],
  nature:  ['Maple','Willow','River','Meadow','Boulder','Fern','Clover','Acorn','Blossom','Cedar',
            'Pinecone','Dewdrop','Sunbeam','Thunder','Breeze','Glacier','Canyon','Ivy','Lily','Moss',
            'Sprout','Coral','Feather','Snowdrop','Petal'],
  places:  ['Harbor','Village','Castle','Bridge','Island','Temple','Cottage','Lagoon','Bazaar','Summit',
            'Prairie','Oasis','Cavern','Plaza','Alley','Ranch','Grotto','Pier','Studio','Attic'],
  colors:  ['Violet','Indigo','Amber','Scarlet','Teal','Copper','Ruby','Emerald','Onyx','Ivory',
            'Lilac','Cobalt','Bronze','Crimson','Magenta','Sapphire'],
  space:   ['Comet','Nebula','Meteor','Orbit','Quasar','Pulsar','Galaxy','Photon','Neutron','Atom',
            'Proton','Eclipse','Stardust','Cosmos','Asteroid','Satellite'],
  transport:['Tugboat','Scooter','Tractor','Sailboat','Trolley','Glider','Canoe','Subway','Chopper','Blimp',
             'Rowboat','Skiff'],
  clothing:['Beanie','Poncho','Sneaker','Scarf','Sweater','Sandal','Bowtie','Hoodie','Boots','Tophat',
            'Cape','Gloves'],
  hobbies: ['Doodle','Sketch','Puzzler','Camper','Angler','Baker','Dancer','Juggler','Skater','Climber',
            'Painter','Runner'],
  fantasy: ['Dragon','Wizard','Griffin','Pixie','Golem','Phoenix','Unicorn','Sprite','Elfling','Troll',
            'Mermaid','Kraken'],
  jobs:    ['Captain','Pilot','Chef','Ranger','Scout','Farmer','Sailor','Doctor','Builder','Teacher'],
  sounds:  ['Whoosh','Sizzle','Jingle','Rumble','Boing','Zoom','Chirp','Clang','Splash','Pop'],
  shapes:  ['Spiral','Diamond','Ripple','Zigzag','Bubble','Prism','Wave','Star'],
};

/* per-category target counts (they add up to 5,250) */
var TARGETS = {
  animals: 800, food: 700, objects: 700, nature: 500, places: 400,
  colors: 300, space: 300, transport: 250, clothing: 250, hobbies: 250,
  fantasy: 250, jobs: 200, sounds: 200, shapes: 150,
};

var NAMES = [];
var seen = new Set();

for (var cat of Object.keys(CATEGORIES)) {
  var nouns = CATEGORIES[cat];
  var want = TARGETS[cat];
  var made = 0;
  /* walk adjective-major so each noun gets used evenly */
  for (var j = 0; j < ADJ.length && made < want; j++) {
    for (var i = 0; i < nouns.length && made < want; i++) {
      var name = ADJ[j] + nouns[i];
      if (name.length > 13 || seen.has(name)) continue;
      seen.add(name);
      NAMES.push(name);
      made++;
    }
  }
  /* top up with a numbered variant if the length filter ate too many */
  for (var n = 2; made < want; n++) {
    for (var i = 0; i < nouns.length && made < want; i++) {
      var name = nouns[i] + n;
      if (name.length > 13 || seen.has(name)) continue;
      seen.add(name);
      NAMES.push(name);
      made++;
    }
    if (n > 400) break;
  }
}

/* Pick a random name, never repeating one that is in `avoid` (a Set of the
   names already used in the room plus the names this same person was given
   recently), so an empty name box does not keep handing out the same one. */
function randomUsername(avoid) {
  var skip = avoid instanceof Set ? avoid : new Set(Array.isArray(avoid) ? avoid : []);
  if (skip.size >= NAMES.length) skip.clear();
  for (var tries = 0; tries < 80; tries++) {
    var n = NAMES[Math.floor(Math.random() * NAMES.length)];
    if (!skip.has(n)) return n;
  }
  var free = NAMES.filter((n) => !skip.has(n));
  if (free.length) return free[Math.floor(Math.random() * free.length)];
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}


