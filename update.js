#!/usr/bin/env node
/**
 * apoHouze — Medicine Database Updater
 * =====================================
 * Haalt officiële merklijsten op van nationale geneesmiddelenregisters
 * en voegt ontbrekende medicijnen toe aan de landbestanden.
 *
 * Bronnen:
 *   BE — SAM v2 (FAMHP / eHealth): publiek XML-export, dagelijks bijgewerkt
 *   NL — CBG Geneesmiddeleninformatiebank: publiek databestand, wekelijks bijgewerkt
 *
 * Gebruik:
 *   node update.js           — update BE + NL
 *   node update.js be        — update alleen BE
 *   node update.js nl        — update alleen NL
 *   node update.js --dry-run — preview zonder bestanden te schrijven
 */

'use strict';
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const zlib  = require('zlib');

const DATA_DIR   = path.join(__dirname, 'data', 'countries');
const LOG_FILE   = path.join(__dirname, 'data', 'last-update.json');
const TMP_DIR    = path.join(__dirname, 'data', '_tmp');

const DRY_RUN = process.argv.includes('--dry-run');
const args    = process.argv.slice(2).filter(a => !a.startsWith('--'));
const targets = args.length ? args.map(a => a.toLowerCase()) : ['be', 'nl'];

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ================================================================
// ATC-CODE → CATEGORIE MAPPING (eerste 3 tekens van ATC-code)
// ================================================================
const ATC_MAP = {
  // A — Spijsverteringskanaal en metabolisme
  A02: 'Stomach & Intestine',   // Antacida, maagzuurremmers
  A03: 'Stomach & Intestine',   // Krampen/spasmen
  A04: 'Stomach & Intestine',   // Anti-emetica
  A05: 'Stomach & Intestine',   // Galwegen
  A06: 'Stomach & Intestine',   // Laxantia
  A07: 'Stomach & Intestine',   // Antidiarrhoica
  A08: 'Stomach & Intestine',   // Obesitas
  A09: 'Stomach & Intestine',   // Digestiva
  A10: 'Diabetes',              // Diabetesmiddelen
  A11: 'Vitamins & Supplements',// Vitamines
  A12: 'Vitamins & Supplements',// Mineralen
  A13: 'Vitamins & Supplements',// Tonica
  A16: 'Stomach & Intestine',   // Overige maag-darmklachten
  // B — Bloed en bloedvormende organen
  B01: 'Anticoagulants',        // Antitrombotisch
  B02: 'Heart & Blood Pressure',// Hemostase
  B03: 'Vitamins & Supplements',// Bloedmiddelen / ijzer / foliumzuur
  B05: 'Heart & Blood Pressure',// Bloedvervangers
  B06: 'Heart & Blood Pressure',// Overige bloedmiddelen
  // C — Hart en bloedvaten
  C01: 'Heart & Blood Pressure',// Harttherapie
  C02: 'Heart & Blood Pressure',// Antihypertensiva
  C03: 'Heart & Blood Pressure',// Diuretica
  C04: 'Heart & Blood Pressure',// Vasodilatantia
  C05: 'Heart & Blood Pressure',// Vasoprotectiva
  C07: 'Heart & Blood Pressure',// Bètablokkers
  C08: 'Heart & Blood Pressure',// Calciumantagonisten
  C09: 'Heart & Blood Pressure',// ACE-remmers/ARB
  C10: 'Cholesterol',           // Lipidenverlagers
  // D — Dermatologica
  D01: 'Antifungals',           // Antifungale dermato
  D02: 'Skin & Wounds',         // Bescherming huid
  D03: 'Skin & Wounds',         // Wondbehandeling
  D04: 'Skin & Wounds',         // Antipruriginosa
  D05: 'Skin & Wounds',         // Psoriasismiddelen
  D06: 'Antibiotics',           // Antibiotica dermato
  D07: 'Corticosteroids',       // Corticosteroïden dermato
  D08: 'Skin & Wounds',         // Antiseptica
  D09: 'Skin & Wounds',         // Verband
  D10: 'Skin & Wounds',         // Acnemiddelen
  D11: 'Skin & Wounds',         // Overige dermato
  // G — Urogenitaalstelsel en geslachtshormonen
  G01: "Women's Health",        // Gynaecologische anti-infectiva
  G02: "Women's Health",        // Overige gynaecologica
  G03: "Women's Health",        // Geslachtshormonen / contraceptiva
  G04: 'Urology',               // Urologica
  // H — Hormonen (excl. geslachtshormonen en insuline)
  H01: 'Thyroid',               // Hypofysehormonen
  H02: 'Corticosteroids',       // Corticosteroïden systemisch
  H03: 'Thyroid',               // Schildklierhormonen
  H04: 'Diabetes',              // Glucagon
  H05: 'Vitamins & Supplements',// Calciumhomeostase
  // J — Antiinfectiva systemisch
  J01: 'Antibiotics',           // Antibiotica
  J02: 'Antifungals',           // Antimycotica systemisch
  J04: 'Antibiotics',           // Antimycobacterieel
  J05: 'Antivirals',            // Antivirale middelen
  J06: 'Antivirals',            // Immunsera / immunoglobulinen
  J07: 'Antivirals',            // Vaccins
  // L — Antineoplastica en immunomodulerende middelen
  L01: 'Oncology',              // Cytostatica
  L02: 'Oncology',              // Endocriene therapie oncologie
  L03: 'Oncology',              // Immunostimulantia
  L04: 'Corticosteroids',       // Immunosuppressiva
  // M — Skeletspierstelsel
  M01: 'Pain & Fever',          // Antiinflammatoir/antireumatisch
  M02: 'Joints & Muscles',      // Topische middelen
  M03: 'Joints & Muscles',      // Spierrelaxantia
  M04: 'Joints & Muscles',      // Jichtmiddelen
  M05: 'Joints & Muscles',      // Botaandoeningen
  M09: 'Joints & Muscles',      // Overige skeletspierstelsel
  // N — Zenuwstelsel
  N01: 'Pain & Fever',          // Anesthetica
  N02: 'Pain & Fever',          // Analgetica / migraine
  N03: 'Neurology',             // Anti-epileptica
  N04: 'Neurology',             // Anti-Parkinson
  N05: 'Sleep & Sedation',      // Psycholeptica (sedativa/anxiolytica/antipsychotica)
  N06: 'Antidepressants',       // Psychoanaleptica (antidepressiva)
  N07: 'Nervous System',        // Overige zenuwstelsel / rookstop
  // P — Antiparasitaire middelen
  P01: 'Antiparasitics',        // Antiprotozoaire middelen
  P02: 'Antiparasitics',        // Anthelmintica
  P03: 'Antiparasitics',        // Ectoparasiticide
  // R — Ademhalingsstelsel
  R01: 'Cough & Cold',          // Neusklachten
  R02: 'Cough & Cold',          // Keelklachten
  R03: 'Lungs & Asthma',        // Astma/COPD
  R04: 'Cough & Cold',          // Andere luchtwegmiddelen
  R05: 'Cough & Cold',          // Hoest en verkoudheid
  R06: 'Allergy',               // Antihistaminica systemisch
  R07: 'Lungs & Asthma',        // Overige luchtwegen
  // S — Zintuigorganen
  S01: 'Eye & Ear',             // Oogmiddelen
  S02: 'Eye & Ear',             // Oormiddelen
  S03: 'Eye & Ear',             // Oog/oor combinaties
  // V — Diverse
  V03: 'First Aid',             // Antidota / diverse
  V06: 'Vitamins & Supplements',// Voedingspreparaten
  V07: 'First Aid',             // Hulpstoffen
  V08: 'First Aid',             // Contrastmiddelen
};

function atcToCategory(atcCode) {
  if (!atcCode) return null;
  const key = atcCode.trim().substring(0, 3).toUpperCase();
  return ATC_MAP[key] || null;
}

// ================================================================
// FARMACEUTISCHE VORM MAPPING
// ================================================================
const FORM_MAP = [
  [/tablet|tabl\b|tablette/i,              'Tablet'],
  [/capsule|cap\b|capsul/i,               'Capsule'],
  [/bruistablet|effervesc/i,              'Effervescent tablet'],
  [/smelttablet|orodispers|dispergeer/i,  'Dispersible tablet'],
  [/siroop|sirop|syrup|drank/i,           'Syrup'],
  [/druppels|druppel\b|drops|gouttes/i,   'Drops'],
  [/oogdruppels|collyre|eye drop/i,       'Eye drops'],
  [/oordruppels|otic|ear drop/i,          'Ear drops'],
  [/neusspray|nasal spray|spray nasal/i,  'Nasal spray'],
  [/inhalator|inhaler|aerosol|poeder.*inhal/i,'Inhaler'],
  [/crème|cream|creme/i,                  'Cream'],
  [/zalf|ointment|pommade/i,              'Ointment'],
  [/gel\b/i,                              'Gel'],
  [/pleister|patch|transderm/i,           'Patch'],
  [/spray\b/i,                            'Spray'],
  [/inject|infuus|infusion|oplossing.*inj/i,'Injection'],
  [/zetpil|suppositoire|suppos/i,         'Suppository'],
  [/poeder|powder|poudre/i,               'Powder'],
  [/suspensie|suspension/i,               'Suspension'],
  [/oplossing|solution/i,                 'Solution'],
  [/mondwater|mouthwash|bain de bouche/i, 'Mouthwash'],
  [/kauwgom|gum/i,                        'Chewing gum'],
  [/zuigtablet|pastille|lozenge/i,        'Lozenge'],
  [/klysma|enema/i,                       'Enema'],
  [/ampul|ampoule/i,                      'Ampoule'],
];

function mapForm(text) {
  if (!text) return 'Tablet';
  for (const [re, form] of FORM_MAP) {
    if (re.test(text)) return form;
  }
  return 'Tablet';
}

// ================================================================
// HULPFUNCTIES
// ================================================================
function fetchBinary(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;
    const go = (u) => {
      proto.get(u, { headers: { 'User-Agent': 'apoHouze-updater/3.0' } }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          file.close();
          return go(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} — ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    go(url);
  });
}

function loadExistingNames(code) {
  const fp = path.join(DATA_DIR, `${code}.js`);
  if (!fs.existsSync(fp)) return null;
  const content = fs.readFileSync(fp, 'utf8');
  const names = new Set();
  for (const m of content.matchAll(/name:\s*"([^"]+)"/g))
    names.add(m[1].toLowerCase().trim());
  return { content, names };
}

function appendMedicines(code, medicines) {
  if (!medicines.length) return 0;
  const fp = path.join(DATA_DIR, `${code}.js`);
  let content = fs.readFileSync(fp, 'utf8');
  const insertAt = content.lastIndexOf('\n];');
  if (insertAt === -1) return 0;
  const lines = medicines.map(m =>
    `  { name: ${JSON.stringify(m.name)}, generic: ${JSON.stringify(m.generic||'')}, ` +
    `category: ${JSON.stringify(m.category)}, form: ${JSON.stringify(m.form)}, rx: ${m.rx} },`
  ).join('\n');
  const updated = content.slice(0, insertAt) + '\n' + lines + '\n' + content.slice(insertAt);
  if (!DRY_RUN) fs.writeFileSync(fp, updated, 'utf8');
  return medicines.length;
}

// ================================================================
// BELGIË — SAM v2 XML Export
// De SAM-export is een ZIP-bestand met meerdere XML-bestanden.
// We gebruiken het AMP-bestand dat merk+stof+ATC+vorm bevat.
// ================================================================
async function updateBE() {
  console.log('\n🇧🇪 België — SAM v2 ophalen...');
  
  // Stap 1: download de SAM-exportpagina om de actuele ZIP-URL te vinden
  const pageUrl = 'https://www.vas.ehealth.fgov.be/websamcivics/samcivics/';
  const pageDest = path.join(TMP_DIR, 'sam_page.html');
  
  try {
    await fetchBinary(pageUrl, pageDest);
  } catch (e) {
    console.error(`  ❌ Kon SAM-pagina niet ophalen: ${e.message}`);
    return 0;
  }
  
  const pageContent = fs.readFileSync(pageDest, 'utf8');
  
  // Zoek de download-URL in de pagina (XSD versie 4 of 5 is stabielst)
  // Patroon: links naar ZIP-bestanden in de tabel
  const zipMatches = [...pageContent.matchAll(/href="([^"]*\.zip[^"]*)"/gi)];
  let zipUrl = null;
  
  for (const m of zipMatches) {
    const href = m[1];
    // Voorkeur voor versie 4 of 5, niet versie 6 (meest recente kan instabiel zijn)
    if (href.includes('samv2') || href.includes('sam_v2') || href.includes('export')) {
      zipUrl = href.startsWith('http') ? href : 'https://www.vas.ehealth.fgov.be' + href;
      break;
    }
  }
  
  // Fallback: gebruik bekende patroon-URL
  if (!zipUrl) {
    // De SAM-pagina gebruikt JavaScript om links te laden, we proberen de bekende URL
    console.log('  ℹ️  Geen ZIP-link gevonden op pagina, probeer directe download...');
    zipUrl = 'https://www.vas.ehealth.fgov.be/websamcivics/samcivics/download?version=4';
  }
  
  // Stap 2: download en parse ZIP
  const zipDest = path.join(TMP_DIR, 'sam_be.zip');
  try {
    await fetchBinary(zipUrl, zipDest);
    console.log(`  ✅ SAM ZIP gedownload (${(fs.statSync(zipDest).size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    console.error(`  ❌ Download mislukt: ${e.message}`);
    console.log('  💡 Probeer handmatig: https://www.vas.ehealth.fgov.be/websamcivics/samcivics/');
    return 0;
  }

  // Stap 3: extraheer en parseer XML
  return parseSAMZip(zipDest);
}

async function parseSAMZip(zipPath) {
  // Probeer de ZIP te extraheren met het ingebouwde zlib of unzip
  const AdmZip = (() => { try { return require('adm-zip'); } catch { return null; } })();
  
  if (!AdmZip) {
    // Gebruik systeem unzip
    const { execSync } = require('child_process');
    const extractDir = path.join(TMP_DIR, 'sam_extract');
    if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir);
    try {
      execSync(`unzip -o "${zipPath}" -d "${extractDir}" 2>/dev/null || true`);
    } catch (e) {
      console.error(`  ❌ Extraheren mislukt: ${e.message}`);
      return 0;
    }
    return parseSAMDirectory(extractDir);
  }
  
  const zip = new AdmZip(zipPath);
  const extractDir = path.join(TMP_DIR, 'sam_extract');
  zip.extractAllTo(extractDir, true);
  return parseSAMDirectory(extractDir);
}

function parseSAMDirectory(dir) {
  // Zoek het AMP XML-bestand (bevat AMPs met ATCCode, naam, stof, farmaceutische vorm)
  const xmlFiles = findFilesRecursive(dir, '.xml');
  
  // Filter: AMP-bestanden of het grootste XML-bestand
  let ampFile = xmlFiles.find(f => /amp/i.test(path.basename(f))) 
             || xmlFiles.sort((a,b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  
  if (!ampFile) {
    console.error('  ❌ Geen XML-bestand gevonden in SAM-export');
    return 0;
  }
  
  console.log(`  📄 XML parsen: ${path.basename(ampFile)} (${(fs.statSync(ampFile).size/1024/1024).toFixed(1)} MB)`);
  
  const xml = fs.readFileSync(ampFile, 'utf8');
  return extractMedicinesFromSAMXml(xml, 'be');
}

function extractMedicinesFromSAMXml(xml, code) {
  const country = loadExistingNames(code);
  if (!country) return 0;
  
  const newMedicines = [];
  const seen = new Set(country.names);
  
  // SAM XML structuur: <AMP> bevat <Name>, <ATCCode>, actieve stof via <VMP>/<VTM>
  // We parsen met reguliere expressies (geen zware XML-parser nodig)
  
  // Extract AMP blokken
  const ampBlocks = xml.matchAll(/<AMP\b[^>]*>([\s\S]*?)<\/AMP>/gi);
  let processed = 0;
  
  for (const block of ampBlocks) {
    const inner = block[1];
    
    // Naam (Frans of Nederlands)
    const nameFR = (inner.match(/<Fr>([^<]+)<\/Fr>/) || [])[1]?.trim();
    const nameNL = (inner.match(/<Nl>([^<]+)<\/Nl>/) || [])[1]?.trim();
    const name = nameNL || nameFR;
    if (!name) continue;
    if (seen.has(name.toLowerCase())) continue;
    
    // Generieke naam / werkzame stof
    const inn = (inner.match(/<Inn>([^<]+)<\/Inn>/) 
              || inner.match(/<ActiveIngredient>([^<]+)<\/ActiveIngredient>/)
              || [])[1]?.trim() || '';
    
    // ATC-code → categorie
    const atc = (inner.match(/<ATCCode>([^<]+)<\/ATCCode>/) || [])[1]?.trim() || '';
    const category = atcToCategory(atc);
    if (!category) continue; // overgeslagen zonder ATC-mapping
    
    // Farmaceutische vorm
    const formRaw = (inner.match(/<PharmaceuticalFormFr>([^<]+)<\/PharmaceuticalFormFr>/)
                  || inner.match(/<PharmaceuticalFormNl>([^<]+)<\/PharmaceuticalFormNl>/)
                  || inner.match(/<PharmaceuticalForm>([^<]+)<\/PharmaceuticalForm>/)
                  || [])[1]?.trim() || '';
    const form = mapForm(formRaw);
    
    // Receptplichtig
    const rxStr = (inner.match(/<PrescriptionRequired>([^<]+)<\/PrescriptionRequired>/) 
                || inner.match(/<Rx>([^<]+)<\/Rx>/)
                || [])[1]?.trim() || '';
    const rx = /true|yes|1|oui|ja/i.test(rxStr);
    
    newMedicines.push({ name, generic: inn, category, form, rx });
    seen.add(name.toLowerCase());
    processed++;
  }
  
  console.log(`  📊 ${processed} nieuwe medicijnen gevonden in SAM`);
  const added = appendMedicines(code, newMedicines);
  return added;
}

function findFilesRecursive(dir, ext) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      results.push(...findFilesRecursive(full, ext));
    } else if (entry.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ================================================================
// NEDERLAND — CBG Geneesmiddeleninformatiebank
// Wekelijks bijgewerkt databestand (tab-gescheiden of XML)
// ================================================================
async function updateNL() {
  console.log('\n🇳🇱 Nederland — CBG Geneesmiddeleninformatiebank ophalen...');
  
  // CBG biedt een databestand aan — de URL is te vinden op de infopagina
  // Actuele URL (wekelijks bijgewerkt, geen auth vereist):
  const urls = [
    'https://www.geneesmiddeleninformatiebank.nl/nl/cp130264',  // databestand pagina
    'https://data.openstate.eu/dataset/2e0055db-6f28-4b05-920b-a648ba026baa/resource/1efaa651-add9-40f5-8b0c-2c2f2d352e11/download/geneesmiddeleninformatiebank.csv',
  ];
  
  // Probeer de CBG pagina op te halen om de download-URL te vinden
  const pageDest = path.join(TMP_DIR, 'cbg_page.html');
  let downloadUrl = null;
  
  for (const url of urls) {
    try {
      await fetchBinary(url, pageDest);
      const content = fs.readFileSync(pageDest, 'utf8');
      
      // Zoek direct download link
      const csvMatch = content.match(/href="([^"]*(?:download|databestand|export)[^"]*\.(?:csv|txt|zip|xml)[^"]*)"/i);
      if (csvMatch) {
        downloadUrl = csvMatch[1].startsWith('http') ? csvMatch[1] 
                    : 'https://www.geneesmiddeleninformatiebank.nl' + csvMatch[1];
        break;
      }
      
      // Als het al een CSV is (openstate.eu)
      if (url.endsWith('.csv') && content.includes(',') || content.includes('\t')) {
        downloadUrl = url;
        break;
      }
    } catch (e) {
      console.log(`  ⚠️  ${url}: ${e.message}`);
    }
  }
  
  if (!downloadUrl) {
    console.error('  ❌ Kon geen download-URL vinden voor CBG-databestand');
    console.log('  💡 Ga handmatig naar: https://www.geneesmiddeleninformatiebank.nl/nl/cp130264');
    return 0;
  }
  
  // Download het databestand
  const dataDest = path.join(TMP_DIR, 'cbg_nl.csv');
  try {
    await fetchBinary(downloadUrl, dataDest);
    console.log(`  ✅ CBG databestand gedownload (${(fs.statSync(dataDest).size / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`  ❌ Download mislukt: ${e.message}`);
    return 0;
  }
  
  return parseCBGData(dataDest);
}

function parseCBGData(filePath) {
  const country = loadExistingNames('nl');
  if (!country) return 0;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  if (!lines.length) return 0;
  
  // Detecteer separator
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  
  console.log(`  📋 Kolommen: ${headers.slice(0, 8).join(', ')}...`);
  
  // Zoek relevante kolommen
  const nameIdx  = headers.findIndex(h => /naam|name|product/i.test(h));
  const innIdx   = headers.findIndex(h => /inn|werkzame|actief|generic|substance/i.test(h));
  const atcIdx   = headers.findIndex(h => /atc/i.test(h));
  const formIdx  = headers.findIndex(h => /vorm|form|toedien/i.test(h));
  const rxIdx    = headers.findIndex(h => /recept|prescri|rx|ur[p\b]/i.test(h));
  
  if (nameIdx === -1) {
    console.error('  ❌ Naamkolom niet gevonden in CBG-data');
    return 0;
  }
  
  const newMedicines = [];
  const seen = new Set(country.names);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
    
    const name = cols[nameIdx];
    if (!name || seen.has(name.toLowerCase())) continue;
    
    const inn      = innIdx  >= 0 ? (cols[innIdx]  || '') : '';
    const atcCode  = atcIdx  >= 0 ? (cols[atcIdx]  || '') : '';
    const formRaw  = formIdx >= 0 ? (cols[formIdx]  || '') : '';
    const rxRaw    = rxIdx   >= 0 ? (cols[rxIdx]   || '') : '';
    
    const category = atcToCategory(atcCode);
    if (!category) continue;
    
    const form = mapForm(formRaw);
    const rx   = /UA|URA|recept|prescri|true|yes|1/i.test(rxRaw);
    
    newMedicines.push({ name, generic: inn, category, form, rx });
    seen.add(name.toLowerCase());
  }
  
  console.log(`  📊 ${newMedicines.length} nieuwe medicijnen gevonden in CBG`);
  return appendMedicines('nl', newMedicines);
}

// ================================================================
// HOOFD
// ================================================================
async function main() {
  console.log('\n🔄 apoHouze Medicine Database Updater');
  console.log(`📅 ${new Date().toISOString()}`);
  if (DRY_RUN) console.log('🔍 DRY RUN — geen bestanden worden gewijzigd');
  
  const log = { updated_at: new Date().toISOString(), dry_run: DRY_RUN, results: {} };
  let totalAdded = 0;
  
  for (const target of targets) {
    let added = 0;
    const before = loadExistingNames(target)?.names.size || 0;
    
    if (target === 'be') added = await updateBE();
    else if (target === 'nl') added = await updateNL();
    else { console.log(`⚠️  Onbekend land: ${target}`); continue; }
    
    const after = loadExistingNames(target)?.names.size || 0;
    log.results[target] = { before, after, added: after - before };
    totalAdded += (after - before);
    
    console.log(`\n  ✅ ${target.toUpperCase()}: ${before} → ${after} medicijnen (+${after - before} nieuw)`);
  }
  
  // Opruimen
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}
  
  if (!DRY_RUN) fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  
  console.log(`\n🎉 Klaar! Totaal toegevoegd: ${totalAdded} nieuwe medicijnen`);
  if (totalAdded > 0 && !DRY_RUN) console.log('🚀 Commit en push om Docker rebuild te triggeren.');
  
  process.exit(0);
}

main().catch(err => { console.error('❌ Fout:', err.message); process.exit(1); });
