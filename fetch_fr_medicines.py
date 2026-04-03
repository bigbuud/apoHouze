#!/usr/bin/env python3
import csv
import requests
import zipfile
import io
import os

OUTPUT = os.environ.get("FR_OUTPUT", "fr_medicines.csv")

URL = "https://base-donnees-publique.medicaments.gouv.fr/telechargement.php"

print("📥 Downloading ANSM dataset...")
r = requests.get(URL, timeout=120)
z = zipfile.ZipFile(io.BytesIO(r.content))

files = {f.filename: f for f in z.filelist}

def read_txt(name):
    with z.open(name) as f:
        return list(csv.reader(io.TextIOWrapper(f, encoding="utf-8"), delimiter='\t'))

print("📂 Parsing files...")
cis      = read_txt("CIS_bdpm.txt")
compo    = read_txt("CIS_COMPO_bdpm.txt")
atc      = read_txt("CIS_ATC_bdpm.txt")

# index
compo_map = {}
for row in compo:
    cis_id = row[0]
    substance = row[2]
    compo_map.setdefault(cis_id, []).append(substance)

atc_map = {}
for row in atc:
    cis_id = row[0]
    code = row[1]
    atc_map[cis_id] = code

print("🔄 Merging...")
out = []

for row in cis:
    cis_id = row[0]
    name   = row[1]
    form   = row[2]
    status = row[5]

    if "Autorisé" not in status:
        continue

    generic = ", ".join(compo_map.get(cis_id, []))
    atc_code = atc_map.get(cis_id, "")

    out.append({
        "name": name,
        "generic": generic,
        "atc": atc_code,
        "form": form,
        "rx": True
    })

print(f"✅ {len(out)} medicines")

with open(OUTPUT, "w", newline='', encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["name","generic","atc","form","rx"])
    writer.writeheader()
    writer.writerows(out)

print(f"💾 Saved to {OUTPUT}")
