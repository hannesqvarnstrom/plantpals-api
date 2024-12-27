/**
 * 
 * GET 'https://api.gbif.org/v1/species/6306650/name' (species/:gbifKey/name)
 * -> 
 * {
  "key": 1639991,
  "scientificName": "Brassica oleracea subsp. oleracea",
  "type": "SCIENTIFIC",
  "genusOrAbove": "Brassica",
  "specificEpithet": "oleracea",
  "infraSpecificEpithet": "oleracea",
  "parsed": true,
  "parsedPartially": false,
  "canonicalName": "Brassica oleracea oleracea",
  "canonicalNameWithMarker": "Brassica oleracea subsp. oleracea",
  "canonicalNameComplete": "Brassica oleracea subsp. oleracea",
  "rankMarker": "subsp."
}

if hybrid -> canonicalNameWithMarker will have the speciesname beginning with an x
and the regular canonicalName will not have this.
can use the diff to tell


if variety:
{
  "key": 1640362,
  "scientificName": "Brassica oleracea var. oleracea",
  "type": "SCIENTIFIC",
  "genusOrAbove": "Brassica",
  "specificEpithet": "oleracea",
  "infraSpecificEpithet": "oleracea",
  "parsed": true,
  "parsedPartially": false,
  "canonicalName": "Brassica oleracea oleracea",
  "canonicalNameWithMarker": "Brassica oleracea var. oleracea",
  "canonicalNameComplete": "Brassica oleracea var. oleracea",
  "rankMarker": "var."
}

same as hybrid or subsp. -> can use the diff between ..WithMarker and regular canonicalName to parse out the logic
 */

/**
 *
 * family
 * genus
 *      species
 *          ssp
 *              var
 *              cultivar
 *          var
 *              cultivar
 *          cultivar
 *      cultivar
 *
 * everything under genus can be cross
 *
 *
 * species:
 *      genusname speciesname
 *      cross = genusname speciesname x ?
 *
 * genus cultivar:
 *      genusname cultivarname
 *      cross = genusname cultivarname x ?
 *
 * ssp 1:
 *  genusname speciesname ssp. ssp_name
 *  cross: genusname speciesname ssp. ssp_name x ?
 *  var:
 *      genusname speciesname ssp. ssp_name var var_name
 *      cross: genusname speciesname ssp. ssp_name var var_name x ?
 *  cultivar:
 *      genusname speciesname ssp. ssp_name 'cultivarname'
 *      cross:
 *          genusname speciesname ssp. ssp_name 'cultivarname' x ?
 *
 *
 * name =
 * genusname (always) + cross ? (not the same species ? mother's speciesname : nothing) + cultivarname (if exists?) x same thing for father?
 *  however, when calculating nested names, use parenthesis for hybridizations.
 *
 *
 * speciesName=
 * om species, artepitet som vanligt
 * om cultivar, ärver species name från förälder
 * om hybrid, (förälders speciesname eller cultivarname x förälders speciesname eller cultivarname)
 *vilket innebär att nested hybrider blir (A x B) x ((C x D) x E)
 * men... om man använder en cultivar som förälder borde det blir något strul?
 * och hur blir det i fall av subsp och eller var?
 *
 *
 */

