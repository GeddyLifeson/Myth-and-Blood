/** First and last names for every player soldier; veterans keep the pair under their title. */
const SoldierNames = (() => {
  const FIRST =
    `Aldwin Alys Amabel Anselm Aubrey Avela Balfour Bartle Basil Bede Beric Berta Bertram Bettany Blaise Bram Brannoc Brice Brigid Bryony Burkhard Cade Calder Callum Cecily Cedric Cerys Chadwick Clement Colm Corwin Cuthbert Dafydd Dagna Dalla Dalton Damia Darnell Deryn Dilys Dorcas Drogo Dunstan Eadric Eadwyn Edda Edgar Edith Edmer Edwy Eldon Eleri Elfrida Elin Elmer Elsbeth Emlyn Enid Eoin Erwin Esme Eudora Evander Fenna Fenwick Ferris Fiona Fitch Flora Fulk Gabrel Garrick Gavin Gerda Giles Gilda Godric Godwin Greta Griff Gunnar Gwen Gwenllian Hadley Halric Hanna Hartley Hedda Helga Hester Hild Hob Horace Hugh Hywel Idony Ilsa Imogen Ingram Iolo Isaura Isembard Jago Jarl Jasper Jocelin Jory Joss Kendra Kenric Kester Kit Kyra Lambert Landry Leofric Leta Lowri Lorcan Lucan Lydia Madoc Maeve Mallory Marden Maud Mavis Merrick Meryn Milo Mirren Moira Nerys Nesta Nolan Norbert Odo Olwen Orla Osric Osmund Oswin Otto Pascoe Pell Perrin Petra Philippa Piers Quillan Quenby Radulf Ragna Ralf Reginald Rhian Rhodri Rolf Rosamund Rowan Rufus Runa Ryland Sabine Saer Selwyn Sibyl Sigrid Silas Siward Sorrel Stefan Sunniva Tamsin Tancred Tegan Tibald Tobias Torin Tristan Tudor Ulric Una Urien Valda Vance Verity Vivian Walden Walter Wilfred Wilmot Winifred Wystan Wynne Yarrow Yorick Ysolde Zelda Aelfric Agnes Alard Ambrose Ansel Arlo Arwel Astrid Audra Bevan Bronwen Brynn Caelan Carys Ceridwen Cleve Cora Dara Delwyn Doran Dyfan Edric Eira Elowen Emeric Faelan Finn Gethin Gwilym Hakon Idris Ivo Jorund Keira Leif Linnet Lleu Mabyn Marek Nia Orrin Padarn Rhosyn Rurik Sian Tegid Thorin Tomos Ulla Vidar Wren`.split(
      /\s+/
    );

  const LAST =
    `Ashdown Ashford Atwell Bannock Barrow Beckett Bellamy Birchall Blackmere Bracken Bramwell Brightwater Brook Burrow Caldwell Carver Castle Chandler Coldwell Cooper Cormorant Crane Crowhurst Dale Dawnrey Dunmore Eastwick Elderby Fairlow Farrow Fenner Fernley Fletcher Flint Foxley Frost Garrow Gladwin Gorse Grayling Greaves Hale Harrow Hartwell Hawke Hazelmere Heath Hollis Holloway Hunter Ironside Kettle Kingsley Lark Lockwood Longmere Mallow Marsh Mercer Millward Moorcroft Morrow Nettle Northcott Oakes Orchard Osgood Pargeter Penhallow Pike Pryor Quarry Rainsford Redfern Ridley Rook Rushby Sallow Sedge Shepherd Skerry Slate Sparrow Stannard Stone Swift Tanner Thatcher Thorne Tolley Trevane Tuck Underhill Vane Wakefield Warrener Weaver Westcott Whitlock Willow Winterbourne Wolfe Wright Yarrow Yewdale Ambry Anvil Ballard Barley Bishop Blythe Boyle Bright Cairn Cliff Cobb Craddock Crowe Dacre Denholm Drover Eames Eddowes Embers Falconer Fell Gaunt Grist Hallam Harker Haywood Holt Hurst Jessop Kell Lacey Lyle Marlow Maynard Naylor Newlin Orme Paget Pelham Prewitt Quill Radley Rudd Sable Selby Sharpe Tarrant Teague Thistle Tilden Tunstall Veale Wade Walsh Wick Wray Yates Ravenscar Stormwick Hollowell Greywater Duskmoor Emberlow Hightower Ironwood Kestrel Larkspur Mournfield Oathkeep Pennyworth Quickwater Ryecroft Saltmarsh Thornfield Wyvern`.split(
      /\s+/
    );

  const used = new Set();

  // Own stream so naming a soldier never shifts the game's seeded random numbers.
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  function rand() {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  /** A first and last name not given out recently; the set restarts after 4000 names. */
  function roll() {
    if (used.size > 4000) used.clear();
    let name;
    for (let i = 0; i < 20; i++) {
      name = `${pick(FIRST)} ${pick(LAST)}`;
      if (!used.has(name)) break;
    }
    used.add(name);
    return name;
  }

  function remember(name) {
    if (name) used.add(name);
  }

  return { FIRST, LAST, roll, remember, used };
})();
