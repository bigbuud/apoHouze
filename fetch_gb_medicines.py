#!/usr/bin/env python3
"""
apoHouze — Verenigd Koninkrijk Medicijnen Fetcher v1
=====================================================
Bron: NHSBSA BNF Code Information (Current Year) — via CKAN API
  https://opendata.nhsbsa.net/dataset/bnf-code-information-current-year

De NHSBSA (NHS Business Services Authority) publiceert maandelijks een
volledige BNF (British National Formulary) code-dataset als open CSV.
We gebruiken de CKAN API om dynamisch de nieuwste resource-URL te vinden
en te downloaden — zo werkt het altijd, ook als de URL maandelijks wijzigt.

BNF-kolommen die we gebruiken:
  BNF_PRESENTATION_NAME  → merknaam / productnaam
  BNF_CHEMICAL_SUBSTANCE → generieke naam (INN-equivalent)
  BNF_CODE               → 15-cijferig code; eerste 2 cijfers = BNF-hoofdstuk
  UNIT_OF_MEASURE        → farmaceutische vorm (beperkt)

BNF-hoofdstuk → apoHouze-categorie mapping (BNF hoofdstukken 1-15):
  1 = Stomach & Intestine
  2 = Heart & Blood Pressure / Anticoagulants / Cholesterol
  3 = Lungs & Asthma / Allergy / Cough & Cold
  4 = Neurology / Pain & Fever / Sleep & Sedation / Antidepressants
  5 = Antibiotics / Antivirals / Antiparasitics / Antifungals
  6 = Diabetes / Thyroid / Corticosteroids
  7 = Women's Health / Urology
  8 = Oncology
  9 = Vitamins & Supplements
  10 = Joints & Muscles
  11 = Eye & Ear
  12 = Eye & Ear (ENT)
  13 = Skin & Wounds
  14 = Antivirals (vaccins)
  15 = First Aid (anaesthetica)

Output: data/_tmp/gb_medicines.csv
  Kolommen: Name,INN,ATC,PharmaceuticalForm,RxStatus,Country

Gebruik: python3 fetch_gb_medicines.py [--debug]
"""

import sys, os, re, csv, time, subprocess, json, urllib.request

DEBUG = "--debug" in sys.argv
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
TMP_DIR     = os.path.join(SCRIPT_DIR, "data", "_tmp")
OUTPUT_FILE = os.path.join(TMP_DIR, "gb_medicines.csv")
os.makedirs(TMP_DIR, exist_ok=True)

# CKAN API endpoints voor NHSBSA
CKAN_BASE    = "https://opendata.nhsbsa.net/api/3/action"
DATASET_ID   = "bnf-code-information-current-year"
DATASET_HIST = "bnf-code-information-historic"  # fallback: vorig jaar

# BNF hoofdstuk (2 cijfers) → apoHouze categorie
BNF_CHAPTER_MAP = {
    "01": "Stomach & Intestine",
    "02": "Heart & Blood Pressure",
    "03": "Lungs & Asthma",
    "04": "Neurology",
    "05": "Antibiotics",
    "06": "Diabetes",
    "07": "Women's Health",
    "08": "Oncology",
    "09": "Vitamins & Supplements",
    "10": "Joints & Muscles",
    "11": "Eye & Ear",
    "12": "Eye & Ear",
    "13": "Skin & Wounds",
    "14": "Antivirals",
    "15": "First Aid",
}

# BNF sectie-overrides voor meer precisie (BNF code begint met deze prefix)
BNF_SECTION_OVERRIDES = {
    "0201": "Heart & Blood Pressure",   # hartmedicatie
    "0202": "Heart & Blood Pressure",
    "0203": "Heart & Blood Pressure",
    "0204": "Heart & Blood Pressure",
    "0205": "Heart & Blood Pressure",
    "0206": "Heart & Blood Pressure",
    "0208": "Anticoagulants",           # anticoagulantia
    "0209": "Anticoagulants",
    "0210": "Cholesterol",              # lipidenverlagers
    "0301": "Lungs & Asthma",
    "0302": "Lungs & Asthma",
    "0303": "Allergy",                  # antihistaminica
    "0304": "Cough & Cold",             # hoest & verkoudheid
    "0401": "Sleep & Sedation",
    "0402": "Antidepressants",
    "0403": "Antidepressants",
    "0404": "Sleep & Sedation",
    "0407": "Pain & Fever",             # analgetica
    "0408": "Pain & Fever",
    "0501": "Antibiotics",
    "0502": "Antifungals",
    "0503": "Antivirals",
    "0504": "Antiparasitics",
    "0601": "Diabetes",
    "0602": "Thyroid",
    "0603": "Corticosteroids",
    "0604": "Women's Health",
    "0605": "Thyroid",
    "0606": "Women's Health",
    "0607": "Urology",
    "0608": "Women's Health",
    "0901": "Vitamins & Supplements",
    "0902": "Vitamins & Supplements",
    "0904": "Vitamins & Supplements",
    "1101": "Eye & Ear",
    "1102": "Eye & Ear",
    "1201": "Cough & Cold",             # neus/keel
    "1202": "Eye & Ear",                # oor
    "1203": "Cough & Cold",             # keel
    "1301": "Skin & Wounds",
    "1302": "Skin & Wounds",
    "1303": "Skin & Wounds",
    "1304": "Corticosteroids",
    "1306": "Antifungals",
    "1307": "Skin & Wounds",
}

APPLIANCE_BLACKLIST = re.compile(
    r"\b(dressing|appliance|catheter|bandage|stoma|device|bag|cap|pad|"
    r"syringe|needle|lancet|strip|test|monitor|machine|pump)\b", re.I
)


def bnf_to_category(bnf_code):
    """Converteer BNF-code naar apoHouze-categorie."""
    if not bnf_code or len(bnf_code) < 2:
        return None
    chapter = bnf_code[:2]
    # Pseudo-hoofdstukken 20-23 zijn verbandmiddelen — skip
    if chapter in ("20","21","22","23","19"):
        return None
    section = bnf_code[:4] if len(bnf_code) >= 4 else ""
    return BNF_SECTION_OVERRIDES.get(section) or BNF_CHAPTER_MAP.get(chapter)


def ckan_api(endpoint, params=None):
    """Eenvoudige CKAN API-aanroep, geeft result-dict terug."""
    url = f"{CKAN_BASE}/{endpoint}"
    if params:
        from urllib.parse import urlencode
        url += "?" + urlencode(params)
    if DEBUG: print(f"  🌐 CKAN: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 apoHouze-updater/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    if not data.get("success"):
        raise RuntimeError(f"CKAN API fout: {data.get('error')}")
    return data["result"]


def get_latest_csv_url():
    """
    Haal de nieuwste CSV resource-URL op via CKAN API.
    Probeert eerst de current-year dataset, dan de historic als fallback.
    """
    for dataset_id in [DATASET_ID, DATASET_HIST]:
        try:
            print(f"  🔍 CKAN package_show: {dataset_id}")
            result = ckan_api("package_show", {"id": dataset_id})
            resources = result.get("resources", [])
            if DEBUG: print(f"  🔍 {len(resources)} resources gevonden")
            # Selecteer CSV-resources en neem de meest recente (eerste)
            csv_resources = [r for r in resources if r.get("format","").upper() == "CSV"
                             and r.get("url","").endswith(".csv")]
            if not csv_resources:
                # Probeer op url-extensie alleen
                csv_resources = [r for r in resources if ".csv" in r.get("url","").lower()]
            if csv_resources:
                url = csv_resources[0]["url"]
                name = csv_resources[0].get("name","?")
                print(f"  ✅ Gevonden: {name}")
                print(f"  🔗 {url}")
                return url
        except Exception as e:
            print(f"  ⚠️  {dataset_id} mislukt: {e}")
    raise RuntimeError("Geen CSV-resource gevonden via CKAN API")


def curl_download(url, dest, max_time=300):
    cmd = ["curl","-L","--max-time",str(max_time),"--connect-timeout","20",
           "--silent","--fail","--user-agent","Mozilla/5.0 apoHouze-updater/5.0","-o",dest,url]
    for attempt in range(3):
        try:
            subprocess.run(cmd, timeout=max_time+15, check=True)
            size = os.path.getsize(dest)
            print(f"  ✅ {size//1024} KB gedownload")
            return size
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            print(f"  ⚠️  Poging {attempt+1}/3 mislukt: {e}")
            if attempt < 2: time.sleep(5)
    raise RuntimeError(f"Download mislukt na 3 pogingen: {url}")


def process_bnf_csv(path):
    """
    Verwerk de NHSBSA BNF CSV.

    Verwachte kolommen (niet hoofdlettergevoelig):
      BNF_PRESENTATION_NAME   — volledige productnaam incl. sterkte/vorm
      BNF_CHEMICAL_SUBSTANCE  — generieke stofnaam
      BNF_CODE                — 15-cijferig BNF-code
      UNIT_OF_MEASURE         — eenheid (optioneel voor vorm)
    """
    print(f"  📖 CSV lezen...")
    with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(8192)
        f.seek(0)
        # Detecteer separator
        sep = "\t" if sample.count("\t") > sample.count(",") else ","
        reader = csv.DictReader(f, delimiter=sep)
        rows = list(reader)

    if not rows:
        raise RuntimeError("CSV is leeg")

    print(f"  📊 {len(rows)} rijen geladen")
    if DEBUG: print(f"  🔍 Kolommen: {list(rows[0].keys())[:10]}")

    # Normaliseer kolomnamen naar uppercase voor consistente lookup
    def norm(d):
        return {k.upper().strip(): v for k,v in d.items()}
    rows = [norm(r) for r in rows]

    results = []
    skipped_bl  = 0
    skipped_cat = 0
    seen        = set()

    for row in rows:
        # Probeer kolomnamen flexibel
        name = (row.get("BNF_PRESENTATION_NAME") or row.get("PRESENTATION_NAME") or
                row.get("BNF PRESENTATION NAME") or row.get("PRESENTATION") or "").strip()
        inn  = (row.get("BNF_CHEMICAL_SUBSTANCE") or row.get("CHEMICAL_SUBSTANCE") or
                row.get("BNF CHEMICAL SUBSTANCE") or row.get("SUBSTANCE") or "").strip()
        code = (row.get("BNF_CODE") or row.get("BNF CODE") or row.get("BNFCODE") or "").strip()
        uom  = (row.get("UNIT_OF_MEASURE") or row.get("UNIT OF MEASURE") or "").strip()

        if not name: continue

        # Filter hulpmiddelen/verbandmiddelen
        if APPLIANCE_BLACKLIST.search(name):
            skipped_bl += 1
            continue

        category = bnf_to_category(code)
        if not category:
            skipped_cat += 1
            continue

        # Deduplicatie op naam (case-insensitive)
        key = name.lower()
        if key in seen: continue
        seen.add(key)

        results.append({
            "Name":               name,
            "INN":                inn,
            "ATC":                code[:7] if code else "",  # BNF-code als pseudo-ATC
            "PharmaceuticalForm": uom,
            "RxStatus":           "Rx",   # BNF-data maakt geen OTC-onderscheid
            "Country":            "GB",
        })

    print(f"  ✅ {len(results)} unieke medicijnen | {skipped_cat} geen categorie | {skipped_bl} blacklist")
    return results


def save_csv(rows):
    fields = ["Name","INN","ATC","PharmaceuticalForm","RxStatus","Country"]
    with open(OUTPUT_FILE,"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    print(f"\n✅ {len(rows)} medicijnen opgeslagen → {OUTPUT_FILE}")


def main():
    print("🇬🇧 apoHouze — Verenigd Koninkrijk Medicijnen Fetcher v1")
    print("=" * 56)
    print("📌 Bron: NHSBSA BNF Code Information (CKAN open data)")

    print(f"\n[1/3] Nieuwste CSV-URL ophalen via CKAN API...")
    try:
        csv_url = get_latest_csv_url()
    except Exception as e:
        print(f"\n❌ CKAN API mislukt: {e}"); sys.exit(1)

    dest = os.path.join(TMP_DIR, "gb_bnf_raw.csv")
    print(f"\n[2/3] CSV downloaden...")
    try:
        size = curl_download(csv_url, dest)
        if size < 10_000:
            raise RuntimeError(f"Bestand te klein ({size}B)")
    except Exception as e:
        print(f"\n❌ Download mislukt: {e}"); sys.exit(1)

    print(f"\n[3/3] Verwerken & opslaan...")
    try:
        results = process_bnf_csv(dest)
    except Exception as e:
        print(f"\n❌ CSV verwerking mislukt: {e}"); sys.exit(1)

    if not results:
        print("\n❌ Geen geldige medicijnen na filtering"); sys.exit(1)

    save_csv(results)


if __name__ == "__main__":
    main()
