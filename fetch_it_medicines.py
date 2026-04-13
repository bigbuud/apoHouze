#!/usr/bin/env python3
"""
apoHouze — Italië Medicijnen Fetcher v1
=========================================
Bron 1: AIFA Transparency List (Lista di Trasparenza) — CSV
  Klasse A en H (NHS-vergoed), alle werkzame stoffen met merknamen
  URL: https://www.aifa.gov.it/liste-di-trasparenza
  Direct CSV link: wisselt per publicatiedatum → haal via pagina op

Bron 2: AIFA open data farmaci (AIC register) via data.gov.it
  https://www.dati.salute.gov.it/dati/dettaglioDataset.jsp?menu=dati&idPag=5

Kolommen Transparency List CSV (puntkomma-gescheiden):
  Principio Attivo (INN), Forma Farmaceutica, Dosaggio,
  ATC, Codice AIC, Denominazione (merknaam), Ditta, Classe

Strategie:
  - Gebruik de AIFA Transparency List CSV (klasse A+H) als primaire bron
  - Alle AIC-farmaci als fallback (bredere dekking, ook klasse C)
  - Categorisatie via ATC-code (zelfde ATC_MAP als update.js)
  - Rx: alle klasse A en H zijn prescription; klasse C(nn) = OTC

Output: data/_tmp/it_medicines.csv
"""

import sys, os, re, csv, time, subprocess, io, urllib.request, json

DEBUG = "--debug" in sys.argv
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
TMP_DIR     = os.path.join(SCRIPT_DIR, "data", "_tmp")
OUTPUT_FILE = os.path.join(TMP_DIR, "it_medicines.csv")
os.makedirs(TMP_DIR, exist_ok=True)

# AIFA Transparency List — directe CSV-URL
# AIFA publiceert dit maandelijks; URL-patroon is stabiel via aifa.gov.it
AIFA_TRASPARENZA_URLS = [
    # Directe CSV-link van meest recente publicatie (januari 2025)
    "https://www.aifa.gov.it/documents/20142/0/lista_di_trasparenza.csv",
    # Alternatief: data.gov.it farmaci open data
    "https://www.dati.gov.it/view/dataset/r_lazio__farmaci_trasparenza/resource.csv",
]

# AIFA farmaci register (AIC) via open data portaal
# Bevat alle vergunde Italiaanse geneesmiddelen met ATC
AIFA_AIC_URLS = [
    "https://www.aifa.gov.it/documents/20142/0/farmaci_aic.csv",
    "https://farmaci.agenziafarmaco.gov.it/aifa/farmaci-export.csv",
    # data.salute.gov.it open data endpoint
    "https://www.dati.salute.gov.it/imgs/C_17_dataset_5_download_itemDownload0_upFile.csv",
]

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

# INN-gebaseerde fallback mapping (Italiaanse namen = grotendeels zelfde als internationaal)
INN_CAT = [
    (r"paracetamolo|ibuprofene|naprossene|aspirina|diclofenac|"
     r"tramadolo|codeina|ossicodone|morfina|fentanil|"
     r"celecoxib|meloxicam|ketorolac|ketoprofene|piroxicam|indometacina", "Pain & Fever"),
    (r"amoxicillina|azitromicina|claritromicina|eritromicina|"
     r"ciprofloxacina|levofloxacina|doxiciclina|metronidazolo|"
     r"cefalexina|cefuroxima|nitrof|trimetoprim|sulfametossazolo|"
     r"vancomicina|rifampicina|isoniazide|clindamicina", "Antibiotics"),
    (r"aciclovir|valaciclovir|oseltamivir|famciclovir|tenofovir|"
     r"emtricitabina|lopinavir|ritonavir|dolutegravir|sofosbuvir|"
     r"ganciclovir|valganciclovir", "Antivirals"),
    (r"fluconazolo|itraconazolo|voriconazolo|ketoconazolo|clotrimazolo|"
     r"miconazolo|terbinafina|nistatina|amfotericina|griseofulvina", "Antifungals"),
    (r"ivermectina|albendazolo|mebendazolo|metronidazolo.*paras|"
     r"idrossiclorochina|clorochina|atovaquone|permetrina", "Antiparasitics"),
    (r"loratadina|cetirizina|fexofenadina|levocetirizina|desloratadina|"
     r"difenidramina|clorfeniramina|idrossizina|azelastina|"
     r"olopatadina|bilastina|rupatadina|ebastina", "Allergy"),
    (r"destrometorfano|guaifenesina|pseudoefedrina|fenilefrina|"
     r"xilometazolina|ossimetazolina|ambroxolo|bromexina|"
     r"acetilcisteina|carbocisteina|ipratropio.*nasale", "Cough & Cold"),
    (r"salbutamolo|salmeterolo|formoterolo|tiotropio|ipratropio.*polm|"
     r"budesonide.*inhal|fluticasone|beclometasone|"
     r"montelukast|teofillina|roflumilast|omalizumab", "Lungs & Asthma"),
    (r"omeprazolo|pantoprazolo|esomeprazolo|lansoprazolo|rabeprazolo|"
     r"ranitidina|famotidina|loperamide|bismuto|metoclopramide|ondansetron|"
     r"domperidone|mesalazina|mesalamine|macrogol|lattulosio|senna|bisacodyl", "Stomach & Intestine"),
    (r"amlodipina|lisinopril|losartan|metoprololo|atenololo|"
     r"idroclorotiazide|furosemide|spironolattone|digossina|amiodarone|"
     r"enalapril|ramipril|carvedilolo|bisoprololo|valsartan|"
     r"candesartan|olmesartan|telmisartan|propranololo|verapamil|"
     r"diltiazem|nitroglicerina|isosorbide|nifedipina|amlodipina|"
     r"perindopril|zofenopril|lercanidipina|indapamide|clonidina", "Heart & Blood Pressure"),
    (r"atorvastatina|simvastatina|rosuvastatina|pravastatina|ezetimibe|"
     r"fenofibrato|gemfibrozil|fluvastatina|pitavastatina", "Cholesterol"),
    (r"warfarin|eparina|enoxaparina|apixaban|rivaroxaban|dabigatran|"
     r"clopidogrel|ticagrelor|prasugrel|ac.*acetilsalicilico.*antiaggr", "Anticoagulants"),
    (r"metformina|glipizide|glibenclamide|glimepiride|pioglitazone|"
     r"sitagliptin|saxagliptin|linagliptin|empagliflozin|canagliflozin|"
     r"dapagliflozin|liraglutide|semaglutide|exenatide|dulaglutide|"
     r"insulina|acarbosio|repaglinide|tirzepatide", "Diabetes"),
    (r"levotiroxina|liotironina|metimazolo|propiltiouracile", "Thyroid"),
    (r"prednisone|prednisolone|metilprednisolone|desametasone|"
     r"idrocortisone.*sistem|betametasone.*sistem|triamcinolone.*sistem|"
     r"fludrocortisone|deflazacort", "Corticosteroids"),
    (r"gabapentin|pregabalin|levetiracetam|carbamazepina|lamotrigina|"
     r"topiramato|fenitoina|valproato|acido valproico|zonisamide|"
     r"levodopa|carbidopa|ropinirolo|pramipexolo|rasagilina|"
     r"donepezil|rivastigmina|galantamina|memantina|"
     r"sumatriptan|rizatriptan|zolmitriptan|almotriptan", "Neurology"),
    (r"zolpidem|zopiclone|estazolam|temazepam|triazolam|"
     r"diazepam|lorazepam|alprazolam|clonazepam|oxazepam|"
     r"buspirone|melatonina|ramelteon", "Sleep & Sedation"),
    (r"sertralina|fluoxetina|paroxetina|escitalopram|citalopram|"
     r"venlafaxina|duloxetina|bupropione|mirtazapina|amitriptilina|"
     r"nortriptilina|imipramina|clomipramina|trazodone|"
     r"quetiapina|aripiprazolo|olanzapina|risperidone|litio|"
     r"fluvoxamina|vortioxetina|vilazodona", "Antidepressants"),
    (r"vitamina a|vitamina b|vitamina c|vitamina d|vitamina e|vitamina k|"
     r"tiamina|riboflavina|niacina|acido folico|cianocobalamina|"
     r"acido ascorbico|colecalciferolo|tocoferolo|fillochinone|"
     r"ferro.*integr|calcio.*integr|zinco.*integr|magnesio.*integr|"
     r"multivitaminico|prenatale.*vitam", "Vitamins & Supplements"),
    (r"etinil estradiolo|estradiolo|estrogeni coniugati|levonorgestrel|"
     r"noretisterone|desogestrel|drospirenone|etonogestrel|norgestimato|"
     r"progesterone|misoprostolo.*ostet|ossitocina|mifepristone|ulipristal|"
     r"clomifene|letrozolo.*fertil|raloxifene|ospemifene", "Women's Health"),
    (r"tamsulosina|alfuzosina|finasteride|dutasteride|sildenafil|tadalafil|"
     r"vardenafil|avanafil|ossibutinina|tolterodina|solifenacina|"
     r"mirabegron|vibegron|tamsulosin", "Urology"),
    (r"tamoxifene|anastrozolo|letrozolo.*cancer|exemestane|fulvestrant|"
     r"imatinib|erlotinib|ciclofosfamide|metotrexato.*cancer|"
     r"capecitabina|temozolomide|paclitaxel|docetaxel|"
     r"pembrolizumab|nivolumab|bevacizumab|rituximab.*cancer", "Oncology"),
    (r"metotrexato.*reuma|idrossiclorochina|sulfasalazina.*reuma|"
     r"leflunomide|etanercept|adalimumab|infliximab|"
     r"colchicina|allopurinolo|febuxostat|probenecid|"
     r"ciclobenzaprina|baclofene|tizanidina|"
     r"alendronato|risedronato|acido zoledronico|denosumab", "Joints & Muscles"),
    (r"tretinoina|adapalene|benzoile|isotretinoina|clobetasolo|"
     r"betametasone.*topico|fluocinonide|tacrolimus.*topico|"
     r"calcipotriol|mupirocina|minoxidil.*topico|"
     r"imiquimod|permetrina.*topico|acido salicilico.*topico", "Skin & Wounds"),
    (r"latanoprost|bimatoprost|timololo.*oft|dorzolamide|"
     r"brimonidina|ciprofloxacina.*oft|tobramicina.*oft|"
     r"prednisolone.*oft|desametasone.*oft|"
     r"olopatadina.*oft|lacrime artificiali|"
     r"neomicina.*auric|ciprofloxacina.*auric", "Eye & Ear"),
    (r"lidocaina|benzocaina|bupivacaina|ropivacaina|"
     r"clorexidina|povidone.*iodio|acqua ossigenata|"
     r"bacitracina|neomicina.*topica|mupirocina.*ferita", "First Aid"),
]

BLACKLIST = re.compile(
    r"\b(vaccino|immunoglobulina|albumina|dialisi|dispositivo|diagnostico|"
     r"radiofarmaco|veterinario|ematologico.*trasfus)\b", re.I
)

def atc_category(atc):
    return ATC_MAP.get((atc or "").strip()[:3].upper())

def inn_category(inn):
    if not inn: return None
    t = inn.lower()
    for pat, cat in INN_CAT:
        if re.search(pat, t, re.I):
            return cat
    return None

def curl_download(url, dest, max_time=120):
    cmd = ["curl","-L","--max-time",str(max_time),"--connect-timeout","20",
           "--silent","--fail","--user-agent","Mozilla/5.0 apoHouze-updater/5.0",
           "-o", dest, url]
    for attempt in range(3):
        try:
            subprocess.run(cmd, timeout=max_time+15, check=True)
            size = os.path.getsize(dest)
            print(f"  ✅ {size//1024} KB")
            return size
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            print(f"  ⚠️  Poging {attempt+1}/3: {e}")
            if attempt < 2: time.sleep(4)
    return 0

def detect_sep(path, encodings=("utf-8-sig","latin-1","utf-8")):
    """Detecteer separator en encoding van een CSV/TXT bestand."""
    for enc in encodings:
        try:
            with open(path, encoding=enc, errors="strict") as f:
                sample = f.read(4096)
            counts = {s: sample.count(s) for s in (";","\t",",")}
            sep = max(counts, key=counts.get)
            return sep, enc
        except UnicodeDecodeError:
            continue
    return ";", "latin-1"

def process_csv(path, seen):
    """
    Verwerk een AIFA CSV-bestand (Transparency List of AIC register).
    Kolommen worden flexibel gedetecteerd.
    """
    sep, enc = detect_sep(path)
    with open(path, encoding=enc, errors="replace") as f:
        reader = csv.DictReader(f, delimiter=sep)
        rows = list(reader)

    if not rows:
        return []

    if DEBUG:
        print(f"  🔍 Kolommen: {list(rows[0].keys())[:8]}")
    else:
        print(f"  📊 {len(rows)} rijen | sep='{sep}' | enc={enc}")

    # Flexibele kolomdetectie
    sample = rows[0]
    keys = list(sample.keys())

    def find(patterns):
        for k in keys:
            kl = k.lower()
            if any(re.search(p, kl) for p in patterns):
                return k
        return None

    name_key  = find([r"denominazione|nome.*comm|brand|specialità|farmaco"])
    inn_key   = find([r"principio.*attivo|sostanza.*attiva|inn\b|dci\b"])
    atc_key   = find([r"^atc"])
    form_key  = find([r"forma.*farm|pharmaceutical.*form"])
    class_key = find([r"classe\b|rimborso|class\b"])

    if DEBUG:
        print(f"  📋 name:{name_key} | inn:{inn_key} | atc:{atc_key} | form:{form_key}")

    results = []
    sk_bl = 0; sk_cat = 0; sk_dup = 0

    for row in rows:
        name  = (row.get(name_key) or "").strip() if name_key else ""
        inn   = (row.get(inn_key) or "").strip()  if inn_key  else ""
        atc   = (row.get(atc_key) or "").strip()  if atc_key  else ""
        form  = (row.get(form_key) or "").strip()  if form_key else ""
        cls   = (row.get(class_key) or "").strip() if class_key else ""

        if not name and not inn:
            continue

        display_name = name or inn
        if not display_name:
            continue

        if BLACKLIST.search(display_name) or BLACKLIST.search(inn):
            sk_bl += 1; continue

        # Categorie: ATC eerst, dan INN naam-matching
        category = atc_category(atc) or inn_category(inn) or inn_category(name)
        if not category:
            sk_cat += 1; continue

        # Rx/OTC: klasse A en H = Rx; C(nn) = OTC
        cls_upper = cls.upper()
        rx = "A" in cls_upper or "H" in cls_upper or ("C" in cls_upper and "NN" not in cls_upper)

        key = display_name.lower()
        if key in seen:
            sk_dup += 1; continue
        seen.add(key)

        results.append({
            "Name": display_name, "INN": inn, "ATC": atc,
            "PharmaceuticalForm": form,
            "RxStatus": "Rx" if rx else "OTC",
            "Country": "IT",
        })

        # Sla ook INN apart op als het verschilt van naam
        if inn and inn.lower() != display_name.lower():
            key2 = inn.lower()
            if key2 not in seen:
                seen.add(key2)
                results.append({
                    "Name": inn, "INN": inn, "ATC": atc,
                    "PharmaceuticalForm": form,
                    "RxStatus": "Rx" if rx else "OTC",
                    "Country": "IT",
                })

    print(f"  ✅ {len(results)} entries | {sk_cat} geen cat | {sk_bl} bl | {sk_dup} dup")
    return results

def main():
    print("🇮🇹 apoHouze — Italië Medicijnen Fetcher v1")
    print("=" * 48)
    print("📌 Bron: AIFA Transparency List + AIC Register\n")

    seen = set()
    all_results = []

    # Probeer Transparency List
    print("[1/3] AIFA Transparency List downloaden...")
    for url in AIFA_TRASPARENZA_URLS:
        dest = os.path.join(TMP_DIR, "it_trasparenza.csv")
        print(f"  📥 {url}")
        size = curl_download(url, dest)
        if size > 10000:
            r = process_csv(dest, seen)
            all_results.extend(r)
            print(f"  → {len(all_results)} totaal")
            if all_results:
                break
        else:
            print(f"  ⚠️  Te klein ({size}B)")

    # Fallback: AIC register
    if len(all_results) < 1000:
        print("\n[2/3] AIFA AIC Register downloaden (fallback)...")
        for url in AIFA_AIC_URLS:
            dest = os.path.join(TMP_DIR, "it_aic.csv")
            print(f"  📥 {url}")
            size = curl_download(url, dest)
            if size > 10000:
                r = process_csv(dest, seen)
                all_results.extend(r)
                print(f"  → {len(all_results)} totaal")
                if all_results:
                    break
            else:
                print(f"  ⚠️  Te klein ({size}B)")
    else:
        print("\n[2/3] Transparency List voldoende, AIC overgeslagen.")

    print(f"\n[3/3] Opslaan ({len(all_results)} medicijnen)...")
    if not all_results:
        print("❌ Geen resultaten gevonden"); sys.exit(1)

    fields = ["Name","INN","ATC","PharmaceuticalForm","RxStatus","Country"]
    with open(OUTPUT_FILE,"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader(); w.writerows(all_results)
    print(f"✅ {len(all_results)} opgeslagen → {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
