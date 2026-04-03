#!/usr/bin/env python3
"""
🇬🇧 apoHouze — Verenigd Koninkrijk Medicijnen Fetcher v3
========================================================
Bron: NHSBSA BNF Code Information (CKAN open data)
Kolommen: BNF_PRESENTATION (naam), BNF_CHEMICAL_SUBSTANCE (INN),
           BNF_CHAPTER_CODE (categorie), BNF_PRESENTATION (vorm via naam)
Maandelijks bijgewerkt door NHS Business Services Authority
"""
import sys, os, csv, re, json, urllib.request, urllib.error

OUTPUT_FILE = os.environ.get('GB_OUTPUT', '/tmp/gb_medicines.csv')

print("🇬🇧 apoHouze — Verenigd Koninkrijk Medicijnen Fetcher v3")
print("=" * 56)
print("📌 Bron: NHSBSA BNF Code Information (CKAN open data)")

# ------------------------------------------------------------------
# BNF Chapter code (2-digit) → apoHouze category
# BNF uses legacy BNF 68 structure (not new BNF 70+)
# ------------------------------------------------------------------
BNF_CHAPTER_MAP = {
    '01': 'Stomach & Intestine',      # Gastro-intestinal
    '02': 'Heart & Blood Pressure',   # Cardiovascular
    '03': 'Lungs & Asthma',           # Respiratory (also Allergy, Cough & Cold)
    '04': 'Neurology',                # Central nervous system
    '05': 'Antibiotics',              # Infections
    '06': 'Diabetes',                 # Endocrine (diabetes, thyroid, etc.)
    '07': "Women's Health",           # Obstetrics, gynaecology, urinary
    '08': 'Oncology',                 # Malignant disease
    '09': 'Vitamins & Supplements',   # Nutrition and blood
    '10': 'Joints & Muscles',         # Musculoskeletal and joint diseases
    '11': 'Eye & Ear',                # Eye
    '12': 'Eye & Ear',                # Ear, nose and oropharynx
    '13': 'Skin & Wounds',            # Skin
    '14': 'Antivirals',               # Immunological products and vaccines
    '15': 'Pain & Fever',             # Anaesthesia
}

# BNF section codes for more specific mapping (first 4 chars of BNF_PRESENTATION_CODE)
BNF_SECTION_MAP = {
    '0301': 'Lungs & Asthma',         # Bronchodilators
    '0302': 'Lungs & Asthma',         # Corticosteroids (respiratory)
    '0304': 'Allergy',                # Antihistamines
    '0401': 'Sleep & Sedation',       # Hypnotics and anxiolytics
    '0402': 'Sleep & Sedation',       # Drugs for psychoses
    '0403': 'Antidepressants',        # Antidepressant drugs
    '0404': 'Neurology',              # CNS stimulants
    '0407': 'Pain & Fever',           # Analgesics
    '0408': 'Neurology',              # Antiepileptics
    '0409': 'Parkinson',              # Drugs for Parkinson's
    '0412': 'Nervous System',         # Drugs for dementia
    '0601': 'Diabetes',               # Drugs used in diabetes
    '0602': 'Thyroid',                # Thyroid and antithyroid drugs
    '0605': 'Corticosteroids',        # Corticosteroids
    '0606': 'Vitamins & Supplements', # Bisphosphonates
    '0607': 'Vitamins & Supplements', # Vitamins
    '0609': 'Urology',                # Sex hormones (male)
    '0701': "Women's Health",         # Gynaecological drugs
    '0703': "Women's Health",         # Contraceptives
    '0704': 'Urology',                # Drugs for genito-urinary disorders
    '0901': 'Vitamins & Supplements', # Vitamins A & D
    '0902': 'Vitamins & Supplements', # Vitamins B & C
    '0903': 'Anticoagulants',         # Vitamins K
    '0905': 'Cholesterol',            # Lipid-lowering drugs
    '1001': 'Pain & Fever',           # NSAIDs
    '1002': 'Joints & Muscles',       # Gout
    '1003': 'Joints & Muscles',       # Rheumatic disease suppressing
    '1004': 'Joints & Muscles',       # Gout
    '1301': 'Skin & Wounds',          # Emollients
    '1302': 'Corticosteroids',        # Topical corticosteroids
    '1303': 'Antifungals',            # Topical antifungals
    '1304': 'Antibiotics',            # Topical antibiotics
    '1501': 'Pain & Fever',           # General anaesthesia
}

BLACKLIST = re.compile(
    r'\b(appliance|device|dressing|bandage|stocking|catheter|syringe|needle|'
    r'lens|glucose meter|test strip|lancet|cannula|dialysis|ostomy|'
    r'nutritional supplement product|formula|special order)\b',
    re.IGNORECASE
)

def get_category(chapter_code, section_code=None):
    """Map BNF chapter/section to apoHouze category."""
    if section_code and section_code[:4] in BNF_SECTION_MAP:
        return BNF_SECTION_MAP[section_code[:4]]
    if chapter_code and chapter_code[:2] in BNF_CHAPTER_MAP:
        return BNF_CHAPTER_MAP[chapter_code[:2]]
    return None

def map_form(name):
    """Extract pharmaceutical form from medicine name."""
    n = name.lower()
    if re.search(r'effervescen|dissolv', n):           return 'Effervescent tablet'
    if re.search(r'orodispers|dispersib|melt', n):     return 'Dispersible tablet'
    if re.search(r'eye drop|ophthalm|ocul', n):        return 'Eye drops'
    if re.search(r'ear drop|otic', n):                 return 'Ear drops'
    if re.search(r'nasal spray|nasal drop', n):        return 'Nasal spray'
    if re.search(r'inhaler|inhala|aerosol|turbuhaler|accuhaler|breezhaler', n): return 'Inhaler'
    if re.search(r'\btablet|\btabs\b', n):             return 'Tablet'
    if re.search(r'capsule|\bcaps\b', n):              return 'Capsule'
    if re.search(r'syrup|oral solution|elixir|linctus', n): return 'Syrup'
    if re.search(r'\bdrops\b', n):                     return 'Drops'
    if re.search(r'\bcream\b', n):                     return 'Cream'
    if re.search(r'\bointment\b', n):                  return 'Ointment'
    if re.search(r'\bgel\b', n):                       return 'Gel'
    if re.search(r'patch|transdermal', n):             return 'Patch'
    if re.search(r'\bspray\b', n):                     return 'Spray'
    if re.search(r'inject|infusion|intravenous|i\.v\.|i\.m\.', n): return 'Injection'
    if re.search(r'suppositories|suppository', n):     return 'Suppository'
    if re.search(r'powder', n):                        return 'Powder'
    if re.search(r'suspension', n):                    return 'Suspension'
    if re.search(r'solution', n):                      return 'Solution'
    if re.search(r'mouthwash|mouth rinse', n):         return 'Mouthwash'
    if re.search(r'lozenge|pastille', n):              return 'Lozenge'
    if re.search(r'enema', n):                         return 'Enema'
    return 'Tablet'

# ------------------------------------------------------------------
# Step 1: Get latest CSV URL via CKAN API
# ------------------------------------------------------------------
print("\n[1/3] CSV-URL ophalen via CKAN API...")
DATASET_ID = 'bnf-code-information-current-year'
CKAN_URL = f'https://opendata.nhsbsa.net/api/3/action/package_show?id={DATASET_ID}'

csv_url = None
try:
    req = urllib.request.Request(CKAN_URL, headers={'User-Agent': 'apoHouze-updater/3.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    resources = data.get('result', {}).get('resources', [])
    # Pick latest CSV resource (sorted by name desc → latest version first)
    csv_resources = [r for r in resources if r.get('format','').upper() == 'CSV']
    csv_resources.sort(key=lambda r: r.get('name',''), reverse=True)
    if csv_resources:
        csv_url = csv_resources[0]['url']
        print(f"  ✅ Resource: {csv_resources[0]['name']}")
        print(f"  🔗 {csv_url}")
    else:
        raise ValueError("Geen CSV resource gevonden")
except Exception as e:
    print(f"  ❌ CKAN API mislukt: {e}")
    sys.exit(1)

# ------------------------------------------------------------------
# Step 2: Download CSV
# ------------------------------------------------------------------
print("\n[2/3] CSV downloaden...")
import tempfile, os
tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
try:
    req = urllib.request.Request(csv_url, headers={'User-Agent': 'apoHouze-updater/3.0'})
    with urllib.request.urlopen(req, timeout=120) as r, open(tmp.name, 'wb') as f:
        total = 0
        while True:
            chunk = r.read(65536)
            if not chunk: break
            f.write(chunk)
            total += len(chunk)
    print(f"  ✅ {total//1024} KB gedownload")
except Exception as e:
    print(f"  ❌ Download mislukt: {e}")
    os.unlink(tmp.name)
    sys.exit(1)

# ------------------------------------------------------------------
# Step 3: Parse CSV — find the right columns
# The BNF CSV has these key columns:
#   BNF_CHAPTER_CODE    → category (first 2 chars)
#   BNF_CHEMICAL_SUBSTANCE → INN/generic
#   BNF_PRESENTATION    → full medicine name (e.g. "Paracetamol 500mg tablets")
#   BNF_PRESENTATION_CODE → 15-digit code
# ------------------------------------------------------------------
print("\n[3/3] Verwerken & opslaan...")

medicines = {}  # name_lower → dict (dedup by presentation)
skipped_appliance = 0
skipped_chapter = 0
skipped_pseudo = 0

with open(tmp.name, encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    headers = reader.fieldnames or []
    print(f"  📊 Kolommen: {', '.join(headers[:8])}{'...' if len(headers)>8 else ''}")
    
    # Identify key columns (case-insensitive)
    hmap = {h.upper(): h for h in headers}
    
    col_name    = hmap.get('BNF_PRESENTATION') or hmap.get('BNF_PRODUCT')
    col_inn     = hmap.get('BNF_CHEMICAL_SUBSTANCE')
    col_chapter = hmap.get('BNF_CHAPTER_CODE')
    col_section = hmap.get('BNF_SECTION_CODE')
    col_code    = hmap.get('BNF_PRESENTATION_CODE') or hmap.get('BNF_CODE')
    
    print(f"  📋 naam:{col_name} inn:{col_inn} chapter:{col_chapter}")
    
    if not col_name:
        # Fallback: try to find a name column
        for h in headers:
            if 'PRESENTATION' in h.upper() or 'PRODUCT' in h.upper():
                col_name = h
                break
    
    if not col_name:
        print(f"  ❌ Naamkolom niet gevonden. Alle kolommen: {', '.join(headers)}")
        os.unlink(tmp.name)
        sys.exit(1)

    for row in reader:
        name = row.get(col_name, '').strip()
        if not name or len(name) < 3:
            continue
        
        chapter_code = row.get(col_chapter, '').strip() if col_chapter else ''
        section_code = row.get(col_section, '').strip() if col_section else ''
        pres_code    = row.get(col_code, '').strip() if col_code else ''
        inn          = row.get(col_inn, '').strip() if col_inn else ''
        
        # Skip pseudo BNF chapters (20-23 = dressings/appliances)
        if chapter_code and chapter_code[:2] in ('20','21','22','23','19'):
            skipped_pseudo += 1
            continue
        
        # Skip appliances, devices, dressings
        if BLACKLIST.search(name):
            skipped_appliance += 1
            continue
        if inn and BLACKLIST.search(inn):
            skipped_appliance += 1
            continue
        
        # Get category from chapter/section
        category = get_category(chapter_code, section_code or pres_code)
        if not category:
            skipped_chapter += 1
            continue
        
        # Dedup: one entry per unique presentation name
        key = name.lower()
        if key not in medicines:
            form = map_form(name)
            medicines[key] = {
                'Name': name,
                'INN': inn,
                'ATC': '',          # BNF uses its own system, not ATC
                'PharmaceuticalForm': form,
                'RxStatus': '',
                'Country': 'GB',
                'Category': category,
            }

os.unlink(tmp.name)

total = len(medicines)
print(f"  ✅ {total} unieke medicijnen | ⛔ Appliances: {skipped_appliance} | Geen categorie: {skipped_chapter} | Pseudo chapters: {skipped_pseudo}")

if total == 0:
    print("  ❌ Geen geldige medicijnen na filtering")
    sys.exit(1)

# ------------------------------------------------------------------
# Step 4: Write output CSV
# ------------------------------------------------------------------
os.makedirs(os.path.dirname(OUTPUT_FILE) or '.', exist_ok=True)
fieldnames = ['Name','INN','ATC','PharmaceuticalForm','RxStatus','Country','Category']
with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(medicines.values())

size = os.path.getsize(OUTPUT_FILE) // 1024
print(f"\n✅ {total} medicijnen opgeslagen → {OUTPUT_FILE} ({size} KB)")
