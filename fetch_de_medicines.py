#!/usr/bin/env python3
"""
apoHouze — Duitsland Medicijnen Fetcher v2
==========================================
Bron: EMA (European Medicines Agency) — gecentraliseerde EU-vergunningen
  https://www.ema.europa.eu/en/documents/report/medicines-output_en.xlsx

Waarom alleen EMA?
  BfArM (nationale DE-vergunner) heeft geen publieke bulk-download.
  De referentiedatabank is enkel via betaald contract beschikbaar.
  AMIce laat alleen per-product CSV-export toe na handmatige zoekactie.

  De EMA XLSX bevat alle centraal vergunde EU-producten (o.a. grote
  DE-merknamen) EN heeft altijd ATC-codes → 100% betrouwbare categorie.

Output: data/_tmp/de_medicines.csv
  Kolommen: Name,INN,ATC,PharmaceuticalForm,RxStatus,Country

Gebruik: python3 fetch_de_medicines.py [--debug]
"""

import sys, os, re, csv, time, subprocess

DEBUG = "--debug" in sys.argv
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
TMP_DIR     = os.path.join(SCRIPT_DIR, "data", "_tmp")
OUTPUT_FILE = os.path.join(TMP_DIR, "de_medicines.csv")
os.makedirs(TMP_DIR, exist_ok=True)

EMA_URL = "https://www.ema.europa.eu/en/documents/report/medicines-output_en.xlsx"

ATC_MAP = {
    "A02":"Stomach & Intestine","A03":"Stomach & Intestine","A04":"Stomach & Intestine",
    "A05":"Stomach & Intestine","A06":"Stomach & Intestine","A07":"Stomach & Intestine",
    "A08":"Stomach & Intestine","A09":"Stomach & Intestine","A10":"Diabetes",
    "A11":"Vitamins & Supplements","A12":"Vitamins & Supplements","A13":"Vitamins & Supplements",
    "A16":"Stomach & Intestine",
    "B01":"Anticoagulants","B02":"Heart & Blood Pressure","B03":"Vitamins & Supplements",
    "B05":"Heart & Blood Pressure","B06":"Heart & Blood Pressure",
    "C01":"Heart & Blood Pressure","C02":"Heart & Blood Pressure","C03":"Heart & Blood Pressure",
    "C04":"Heart & Blood Pressure","C05":"Heart & Blood Pressure","C07":"Heart & Blood Pressure",
    "C08":"Heart & Blood Pressure","C09":"Heart & Blood Pressure","C10":"Cholesterol",
    "D01":"Antifungals","D02":"Skin & Wounds","D03":"Skin & Wounds","D04":"Skin & Wounds",
    "D05":"Skin & Wounds","D06":"Antibiotics","D07":"Corticosteroids","D08":"Skin & Wounds",
    "D09":"Skin & Wounds","D10":"Skin & Wounds","D11":"Skin & Wounds",
    "G01":"Women's Health","G02":"Women's Health","G03":"Women's Health","G04":"Urology",
    "H01":"Thyroid","H02":"Corticosteroids","H03":"Thyroid","H04":"Diabetes",
    "H05":"Vitamins & Supplements",
    "J01":"Antibiotics","J02":"Antifungals","J04":"Antibiotics","J05":"Antivirals",
    "J06":"Antivirals","J07":"Antivirals",
    "L01":"Oncology","L02":"Oncology","L03":"Oncology","L04":"Corticosteroids",
    "M01":"Pain & Fever","M02":"Joints & Muscles","M03":"Joints & Muscles",
    "M04":"Joints & Muscles","M05":"Joints & Muscles","M09":"Joints & Muscles",
    "N01":"Pain & Fever","N02":"Pain & Fever","N03":"Neurology","N04":"Neurology",
    "N05":"Sleep & Sedation","N06":"Antidepressants","N07":"Nervous System",
    "P01":"Antiparasitics","P02":"Antiparasitics","P03":"Antiparasitics",
    "R01":"Cough & Cold","R02":"Cough & Cold","R03":"Lungs & Asthma",
    "R04":"Cough & Cold","R05":"Cough & Cold","R06":"Allergy","R07":"Lungs & Asthma",
    "S01":"Eye & Ear","S02":"Eye & Ear","S03":"Eye & Ear",
    "V03":"First Aid","V06":"Vitamins & Supplements","V07":"First Aid","V08":"First Aid",
}

BLACKLIST = re.compile(r"\b(device|diagnostic|kit|test|imaging|dressing|appliance)\b", re.I)
WITHDRAWN = re.compile(r"withdrawn|refused|suspended|expired|revoked", re.I)


def atc_category(atc):
    return ATC_MAP.get((atc or "").strip()[:3].upper())


def curl_download(url, dest, max_time=180):
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
            if attempt < 2: time.sleep(4)
    raise RuntimeError(f"Download mislukt na 3 pogingen: {url}")


def read_xlsx(path):
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("pip install openpyxl")
    print(f"  📖 XLSX lezen ({os.path.getsize(path)//1024} KB)...")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        raise RuntimeError("XLSX is leeg")
    headers = [str(h).strip() if h is not None else f"col_{i}" for i,h in enumerate(rows[0])]
    if DEBUG: print(f"  🔍 Kolommen: {headers[:12]}")
    result = []
    for row in rows[1:]:
        d = {headers[i]: (str(row[i]).strip() if i < len(row) and row[i] is not None else "") for i in range(len(headers))}
        result.append(d)
    print(f"  📊 {len(result)} rijen geladen")
    return result


def find_col(sample, *patterns):
    for k in sample:
        kl = k.lower()
        if any(re.search(p, kl) for p in patterns):
            return k
    return None


def process_ema(rows):
    if not rows: return []
    s = rows[0]
    name_key   = find_col(s, r"^medicine name$", r"^name$", r"product name")
    inn_key    = find_col(s, r"active substance", r"\binn\b", r"generic")
    atc_key    = find_col(s, r"^atc")
    form_key   = find_col(s, r"pharmaceutical form", r"\bform\b")
    status_key = find_col(s, r"authoris", r"status")
    print(f"  📋 name:{name_key} | inn:{inn_key} | atc:{atc_key} | form:{form_key} | status:{status_key}")
    if not name_key:
        raise RuntimeError(f"Naamkolom niet gevonden. Kolommen: {list(s.keys())[:10]}")
    results, sk_status, sk_atc, sk_bl = [], 0, 0, 0
    for row in rows:
        name = row.get(name_key,"").strip()
        if not name: continue
        if status_key and WITHDRAWN.search(row.get(status_key,"")): sk_status += 1; continue
        if BLACKLIST.search(name): sk_bl += 1; continue
        atc  = row.get(atc_key,"").strip()  if atc_key  else ""
        inn  = row.get(inn_key,"").strip()   if inn_key  else ""
        form = row.get(form_key,"").strip()  if form_key else ""
        if not atc_category(atc): sk_atc += 1; continue
        results.append({"Name":name,"INN":inn,"ATC":atc,"PharmaceuticalForm":form,"RxStatus":"Rx","Country":"EU"})
    print(f"  ✅ {len(results)} geldig | {sk_status} ingetrokken | {sk_atc} geen ATC | {sk_bl} blacklist")
    return results


def deduplicate(rows):
    seen, out = set(), []
    for r in rows:
        k = r["Name"].lower()
        if k not in seen:
            seen.add(k)
            out.append(r)
    print(f"  🎯 Na dedup: {len(out)} unieke medicijnen")
    return out


def save_csv(rows):
    fields = ["Name","INN","ATC","PharmaceuticalForm","RxStatus","Country"]
    with open(OUTPUT_FILE,"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    print(f"\n✅ {len(rows)} medicijnen opgeslagen → {OUTPUT_FILE}")


def main():
    print("🇩🇪 apoHouze — Duitsland Medicijnen Fetcher v2")
    print("=" * 52)
    print("📌 Bron: EMA (BfArM heeft geen publieke bulk-download)")
    dest = os.path.join(TMP_DIR,"ema_medicines.xlsx")
    print(f"\n[1/3] Downloaden van EMA...")
    try:
        size = curl_download(EMA_URL, dest)
        if size < 50_000:
            raise RuntimeError(f"Bestand te klein ({size}B) — waarschijnlijk foutpagina")
    except Exception as e:
        print(f"\n❌ EMA download mislukt: {e}"); sys.exit(1)
    print(f"\n[2/3] XLSX verwerken...")
    try:
        rows = read_xlsx(dest)
    except Exception as e:
        print(f"\n❌ XLSX lezen mislukt: {e}"); sys.exit(1)
    print(f"\n[3/3] Filteren & opslaan...")
    processed = process_ema(rows)
    deduped   = deduplicate(processed)
    if not deduped:
        print("\n❌ Geen geldige medicijnen na filtering"); sys.exit(1)
    save_csv(deduped)


if __name__ == "__main__":
    main()
