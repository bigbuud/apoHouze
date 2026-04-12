#!/usr/bin/env python3
"""
apoHouze — Verenigde Staten Medicijnen Fetcher v3
==================================================
Bron: FDA NDC Directory flat files
  https://www.accessdata.fda.gov/cder/ndctext.zip

product.txt kolommen (tab-gescheiden, met header):
  PRODUCTID, PRODUCTNDC, PRODUCTTYPENAME, PROPRIETARYNAME,
  PROPRIETARYNAMESUFFIX, NONPROPRIETARYNAME, DOSAGEFORMNAME,
  ROUTENAME, STARTMARKETINGDATE, ENDMARKETINGDATE,
  MARKETINGCATEGORYNAME, APPLICATIONNUMBER, LABELERNAME,
  SUBSTANCENAME, ACTIVE_NUMERATOR_STRENGTH, ACTIVE_INGRED_UNIT,
  PHARM_CLASSES, DEASCHEDULE, NDC_EXCLUDE_FLAG,
  LISTING_RECORD_CERTIFIED_THROUGH

Strategie:
  - Per FDA-product sla ZOWEL de merknaam (PROPRIETARYNAME) ALS de
    generieke naam (NONPROPRIETARYNAME) op als aparte entries
    → zo krijg je zowel "Tylenol" als "Acetaminophen" in de DB
  - Dedup-sleutel = naam.lower() (eenvoudig, effectief)
  - Categorisatie: PHARM_CLASSES eerst, dan NONPROPRIETARYNAME keyword-match
  - Geen ENDMARKETINGDATE-filter (te onbetrouwbaar); gebruik NDC_EXCLUDE_FLAG
  - BLACKLIST voor bloedproducten, vaccins, diagnostica

Output: data/_tmp/us_medicines.csv
"""

import sys, os, re, csv, time, subprocess, zipfile, io

DEBUG = "--debug" in sys.argv
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
TMP_DIR     = os.path.join(SCRIPT_DIR, "data", "_tmp")
OUTPUT_FILE = os.path.join(TMP_DIR, "us_medicines.csv")
os.makedirs(TMP_DIR, exist_ok=True)

FDA_NDC_URLS = [
    "https://www.accessdata.fda.gov/cder/ndctext.zip",
    "https://www.fda.gov/files/drugs/published/NDC-Database-File---Product-Labeler.zip",
]

# ================================================================
# PHARM_CLASS → categorie  (FDA EPC-strings)
# ================================================================
PHARM_CLASS_MAP = [
    (r"analgesic|nonsteroidal anti.inflam|nsaid|opioid|narcotic|antipyretic|salicylate", "Pain & Fever"),
    (r"antibacterial|antibiotic|penicillin|cephalosporin|macrolide|quinolone|tetracycline|aminoglycoside|carbapenem|lincosamide|nitrofuran|oxazolidinone|rifamycin|sulfonamide|glycopeptide", "Antibiotics"),
    (r"antiviral|antiretroviral|neuraminidase|reverse transcriptase|integrase|protease inhibitor.*antiviral|nucleoside.*antiviral", "Antivirals"),
    (r"antifungal|azole antifungal|polyene antifungal|allylamine", "Antifungals"),
    (r"antiparasit|anthelmintic|antimalarial|antiprotozoal|ectoparasiticide", "Antiparasitics"),
    (r"antihistamine|histamine.*receptor.*antagonist.*\[epc\]|h1.*receptor", "Allergy"),
    (r"decongestant|expectorant|antitussive|mucolytic|nasal decongestant", "Cough & Cold"),
    (r"bronchodilator|beta.*agonist.*\[moa\]|short.acting beta|long.acting beta|anticholinergic.*pulmonary|leukotriene|inhaled.*corticosteroid|phosphodiesterase.*inhibitor.*pulmonary|mast cell stabilizer", "Lungs & Asthma"),
    (r"proton pump inhibitor|antacid|h2.*receptor.*antagonist|laxative|antidiarrheal|antiemetic|prokinetic|gastrointestinal|5.aminosalicylate|intestinal anti.inflam", "Stomach & Intestine"),
    (r"antihypertensive|beta.*adrenergic.*blocker|ace inhibitor|angiotensin.*receptor.*blocker|calcium.*channel.*blocker|diuretic.*cardiac|vasodilator|cardiac glycoside|antiarrhythmic|alpha.*blocker.*cardiac|direct renin", "Heart & Blood Pressure"),
    (r"hmg.coa|statin|lipid.lowering|cholesterol absorption|fibric acid|bile acid|pcsk9", "Cholesterol"),
    (r"anticoagulant|antiplatelet|factor xa|direct thrombin|vitamin k antagonist|heparin|thrombolytic|platelet aggregation", "Anticoagulants"),
    (r"antidiabetic|insulin|hypoglycemic|glp.1|sglt|dpp.4|incretin|biguanide|sulfonylurea|thiazolidinedione|alpha.glucosidase|glinide|amylin", "Diabetes"),
    (r"thyroid|antithyroid|thyroid hormone", "Thyroid"),
    (r"corticosteroid|glucocorticoid|mineralocorticoid|adrenal corticosteroid", "Corticosteroids"),
    (r"anticonvulsant|antiepileptic|anti.parkinson|dopamine.*agonist.*\[moa\]|cholinesterase inhibitor|nmda.*antagonist|glutamate.*antagonist", "Neurology"),
    (r"sedative|hypnotic|anxiolytic|benzodiazepine|gaba.*agonist|melatonin.*agonist|orexin.*antagonist", "Sleep & Sedation"),
    (r"antidepressant|ssri|snri|serotonin.*norepinephrine|serotonin.*reuptake|monoamine.*oxidase|tricyclic|atypical antidepressant|norepinephrine.*dopamine.*reuptake|serotonin.*modulator", "Antidepressants"),
    (r"vitamin|mineral supplement|iron.*supplement|folic acid|electrolyte|nutritional", "Vitamins & Supplements"),
    (r"contraceptive|estrogen|progestin|hormone.*replacement|ovulation.*stimulant|selective.*estrogen.*receptor|aromatase.*inhibitor.*gynecol|tocolytic|uterotonic|cervical.*ripening", "Women's Health"),
    (r"alpha.*adrenergic.*blocker.*urolog|5.alpha.*reductase|phosphodiesterase type 5|overactive.*bladder|muscarinic.*antagonist.*urolog|beta.3.*adrenergic.*agonist", "Urology"),
    (r"antineoplastic|chemotherapy|cytotoxic|kinase inhibitor.*oncol|checkpoint inhibitor|proteasome inhibitor|histone deacetylase|bcl.*inhibitor|immunomodulator.*oncol|hormone.*antagonist.*oncol", "Oncology"),
    (r"muscle.*relaxant|gout|uricosuric|bisphosphonate|dmard|disease.*modifying|tnf.*inhibitor|interleukin.*inhibitor|jak.*inhibitor|xanthine oxidase inhibitor", "Joints & Muscles"),
    (r"topical.*dermatologic|retinoid|keratolytic|emollient|topical.*anti.infective.*derm|topical.*corticosteroid|topical.*calcineurin|topical.*antifungal.*derm|topical.*antibiotic", "Skin & Wounds"),
    (r"ophthalmic|ocular.*antibiotic|ophthalmic.*anti.inflam|glaucoma|prostaglandin.*analog.*eye|carbonic anhydrase.*eye|alpha.*agonist.*eye|otic", "Eye & Ear"),
    (r"local anesthetic|topical.*anesthetic|antiseptic|topical.*anti.infective.*wound|topical.*antimicrobial.*wound", "First Aid"),
]

# ================================================================
# GENERIEKE NAAM → categorie  (keyword-matching, brede dekking)
# ================================================================
GENERIC_MAP = [
    # Pain & Fever — breed: ook opiaten, combinaties
    (r"acetaminophen|paracetamol|ibuprofen|naprox|aspirin|diclofenac|"
     r"celecoxib|meloxicam|ketoprofen|piroxicam|indomethacin|ketorolac|"
     r"tramadol|oxycodon|hydrocodon|codeine|morphine|fentanyl|buprenorphine|"
     r"methadone|hydromorphone|oxymorphone|tapentadol|butorphanol|nalbuphine|"
     r"pentazocine|meperidine|sufentanil|remifentanil|alfentanil", "Pain & Fever"),
    # Antibiotics
    (r"amoxicillin|ampicillin|penicillin|nafcillin|oxacillin|dicloxacillin|"
     r"piperacillin|cephalexin|cefuroxime|ceftriaxone|cefdinir|cefadroxil|"
     r"cefprozil|cefpodoxime|cefaclor|cefazolin|azithromycin|clarithromycin|"
     r"erythromycin|doxycycline|minocycline|tetracycline|tigecycline|"
     r"ciprofloxacin|levofloxacin|moxifloxacin|ofloxacin|gemifloxacin|"
     r"trimethoprim|sulfamethoxazole|metronidazol|clindamycin|vancomycin|"
     r"linezolid|nitrofurantoin|fosfomycin|rifampin|isoniazid|ethambutol|"
     r"pyrazinamide|daptomycin|aztreonam|imipenem|meropenem|ertapenem|"
     r"gentamicin|tobramycin|amikacin|streptomycin|neomycin.*systemic", "Antibiotics"),
    # Antivirals
    (r"acyclovir|valacyclovir|famciclovir|oseltamivir|zanamivir|baloxavir|"
     r"tenofovir|emtricitabin|efavirenz|lopinavir|ritonavir|atazanavir|"
     r"dolutegravir|bictegravir|raltegravir|elvitegravir|cobicistat|"
     r"sofosbuvir|ledipasvir|velpatasvir|glecaprevir|pibrentasvir|"
     r"ribavirin|ganciclovir|valganciclovir|cidofovir|foscarnet|"
     r"nirmatrelvir|molnupiravir|remdesivir|adefovir|entecavir|lamivudine|"
     r"abacavir|zidovudine|stavudine|didanosine", "Antivirals"),
    # Antifungals
    (r"fluconazole|itraconazole|voriconazole|posaconazole|ketoconazole|"
     r"isavuconazole|clotrimazole|miconazole|terbinafine|nystatin|"
     r"amphotericin|griseofulvin|econazole|butoconazole|terconazole|"
     r"ciclopirox|tolnaftate|undecylenic|anidulafungin|caspofungin|micafungin", "Antifungals"),
    # Antiparasitics
    (r"ivermectin|mebendazole|albendazole|praziquantel|pyrantel|"
     r"hydroxychloroquine|chloroquine|atovaquone|primaquine|mefloquine|"
     r"permethrin|lindane|spinosad|malathion|pyrethrins|tinidazole|"
     r"nitazoxanide|metronidazol.*parasit|miltefosine", "Antiparasitics"),
    # Allergy
    (r"loratadine|cetirizine|fexofenadine|levocetirizine|desloratadine|"
     r"diphenhydramine|chlorpheniramine|hydroxyzine.*allerg|azelastine|"
     r"olopatadine|brompheniramine|clemastine|promethazine|cyproheptadine|"
     r"acrivastine|triprolidine|ketotifen|epinastine|alcaftadine", "Allergy"),
    # Cough & Cold
    (r"dextromethorphan|guaifenesin|pseudoephedrine|phenylephrine|"
     r"xylometazoline|oxymetazoline|naphazoline|ipratropium.*nasal|"
     r"benzonatate|bromhexine|ambroxol|acetylcysteine|carbocisteine|"
     r"codeine.*cough|hydrocodone.*cough|dihydrocodeine", "Cough & Cold"),
    # Lungs & Asthma
    (r"albuterol|salbutamol|levalbuterol|salmeterol|formoterol|indacaterol|"
     r"olodaterol|vilanterol|tiotropium|umeclidinium|aclidinium|glycopyrrolate.*pulm|"
     r"ipratropium.*pulm|budesonide.*inhal|fluticasone.*inhal|beclomethasone|"
     r"mometasone.*inhal|ciclesonide|montelukast|zafirlukast|zileuton|"
     r"theophylline|aminophylline|roflumilast|omalizumab|mepolizumab|"
     r"benralizumab|dupilumab.*asthm|tezepelumab", "Lungs & Asthma"),
    # Stomach & Intestine
    (r"omeprazole|pantoprazole|esomeprazole|lansoprazole|rabeprazole|dexlansoprazole|"
     r"ranitidine|famotidine|cimetidine|nizatidine|calcium.*antacid|"
     r"aluminum hydroxide|magnesium hydroxide|sodium bicarbonate.*antacid|"
     r"simethicone|loperamide|bismuth|metoclopramide|ondansetron|prochlorperazine|"
     r"promethazine.*nausea|granisetron|dolasetron|palonosetron|aprepitant|"
     r"docusate|bisacodyl|senna|lactulose|polyethylene glycol|lubiprostone|"
     r"linaclotide|plecanatide|rifaximin|mesalamine|mesalazine|balsalazide|"
     r"olsalazine|sulfasalazine.*gastro|budesonide.*gastro|hyoscyamine|"
     r"dicyclomine|mebeverine|pancrelipase|ursodiol|cholestyramine.*gastro|"
     r"tegaserod|alvimopan|methylnaltrexone|naloxegol", "Stomach & Intestine"),
    # Heart & Blood Pressure — uitgebreid
    (r"amlodipine|nifedipine|felodipine|nicardipine|isradipine|nisoldipine|"
     r"lisinopril|enalapril|ramipril|captopril|benazepril|fosinopril|"
     r"moexipril|perindopril|quinapril|trandolapril|"
     r"losartan|valsartan|irbesartan|candesartan|olmesartan|telmisartan|"
     r"eprosartan|azilsartan|"
     r"metoprolol|atenolol|bisoprolol|carvedilol|propranolol|labetalol|"
     r"nadolol|acebutolol|betaxolol|pindolol|sotalol.*cardiac|nebivolol|"
     r"hydrochlorothiazide|chlorthalidone|indapamide|metolazone|furosemide|"
     r"torsemide|bumetanide|spironolactone|eplerenone|triamterene|amiloride|"
     r"digoxin|amiodarone|dronedarone|flecainide|propafenone|mexiletine|"
     r"disopyramide|quinidine|procainamide|lidocaine.*cardiac|"
     r"diltiazem|verapamil.*cardiac|"
     r"hydralazine|minoxidil.*systemic|isosorbide|nitroglycerin|"
     r"clonidine|methyldopa|guanfacine|doxazosin|prazosin|terazosin|"
     r"sacubitril|ivabradine|ranolazine|aliskiren|"
     r"dopamine|dobutamine|milrinone|norepinephrine.*cardiac", "Heart & Blood Pressure"),
    # Cholesterol
    (r"atorvastatin|simvastatin|rosuvastatin|pravastatin|lovastatin|"
     r"fluvastatin|pitavastatin|cerivastatin|"
     r"ezetimibe|fenofibrate|gemfibrozil|niacin.*lipid|"
     r"evolocumab|alirocumab|inclisiran|bempedoic|"
     r"colestipol|cholestyramine.*lipid|colesevelam|omega.3.*lipid", "Cholesterol"),
    # Anticoagulants
    (r"warfarin|heparin|enoxaparin|dalteparin|fondaparinux|tinzaparin|"
     r"apixaban|rivaroxaban|dabigatran|edoxaban|betrixaban|"
     r"clopidogrel|ticagrelor|prasugrel|ticlopidine|"
     r"aspirin.*81|dipyridamole|vorapaxar|"
     r"argatroban|bivalirudin|lepirudin|desirudin|"
     r"alteplase|reteplase|tenecteplase|urokinase|streptokinase|"
     r"cilostazol|pentoxifylline", "Anticoagulants"),
    # Diabetes
    (r"metformin|glipizide|glyburide|glimepiride|glibenclamide|"
     r"pioglitazone|rosiglitazone|"
     r"sitagliptin|saxagliptin|linagliptin|alogliptin|vildagliptin|"
     r"empagliflozin|canagliflozin|dapagliflozin|ertugliflozin|"
     r"liraglutide|semaglutide|exenatide|dulaglutide|albiglutide|"
     r"lixisenatide|tirzepatide|"
     r"insulin|acarbose|miglitol|repaglinide|nateglinide|"
     r"pramlintide|colesevelam.*diabetes", "Diabetes"),
    # Thyroid
    (r"levothyroxine|liothyronine|liotrix|thyroid.*dessicated|"
     r"methimazole|propylthiouracil|potassium iodide", "Thyroid"),
    # Corticosteroids
    (r"prednisone|prednisolone|methylprednisolone|dexamethasone|"
     r"hydrocortisone|betamethasone|triamcinolone.*systemic|"
     r"fludrocortisone|cortisone|deflazacort|budesonide.*systemic", "Corticosteroids"),
    # Neurology — uitgebreid
    (r"levodopa|carbidopa|ropinirole|pramipexole|rasagiline|selegiline|"
     r"entacapone|tolcapone|apomorphine|amantadine.*parkinson|"
     r"donepezil|rivastigmine|galantamine|memantine|"
     r"gabapentin|pregabalin|phenytoin|fosphenytoin|valproate|valproic acid|"
     r"carbamazepine|oxcarbazepine|lamotrigine|topiramate|levetiracetam|"
     r"zonisamide|lacosamide|eslicarbazepine|brivaracetam|perampanel|"
     r"cenobamate|rufinamide|vigabatrin|tiagabine|"
     r"sumatriptan|rizatriptan|zolmitriptan|naratriptan|almotriptan|"
     r"eletriptan|frovatriptan|ergotamine|dihydroergotamine|"
     r"baclofen.*neuro|tizanidine|dantrolene.*spasm|"
     r"riluzole|edaravone|nusinersen|risdiplam", "Neurology"),
    # Sleep & Sedation
    (r"zolpidem|zaleplon|eszopiclone|triazolam|temazepam|flurazepam|"
     r"quazepam|estazolam|"
     r"diazepam|lorazepam|alprazolam|clonazepam|midazolam|"
     r"chlordiazepoxide|oxazepam|clorazepate|"
     r"buspirone|melatonin|ramelteon|suvorexant|lemborexant|"
     r"hydroxyzine.*sleep|doxepin.*sleep|diphenhydramine.*sleep|"
     r"chloral hydrate|phenobarbital", "Sleep & Sedation"),
    # Antidepressants — uitgebreid met antipsychotica
    (r"sertraline|fluoxetine|paroxetine|escitalopram|citalopram|fluvoxamine|"
     r"venlafaxine|duloxetine|desvenlafaxine|levomilnacipran|"
     r"bupropion|mirtazapine|trazodone|nefazodone|"
     r"amitriptyline|nortriptyline|imipramine|desipramine|clomipramine|"
     r"doxepin.*antidepr|trimipramine|protriptyline|"
     r"phenelzine|tranylcypromine|isocarboxazid|selegiline.*antidepr|"
     r"lithium|lamotrigine.*mood|"
     r"quetiapine|aripiprazole|olanzapine|risperidone|paliperidone|"
     r"ziprasidone|lurasidone|asenapine|iloperidone|brexpiprazole|"
     r"cariprazine|lumateperone|haloperidol|chlorpromazine|thioridazine|"
     r"fluphenazine|perphenazine|thiothixene|loxapine|molindone|"
     r"clozapine|vilazodone|vortioxetine", "Antidepressants"),
    # Vitamins & Supplements
    (r"vitamin a|vitamin b|vitamin c|vitamin d|vitamin e|vitamin k|"
     r"thiamine|riboflavin|niacin.*vitamin|pyridoxine|biotin|pantothenic|"
     r"folic acid|cyanocobalamin|hydroxocobalamin|methylcobalamin|"
     r"ascorbic acid|cholecalciferol|ergocalciferol|tocopherol|phytonadione|"
     r"ferrous|ferric|iron.*supplement|polysaccharide iron|"
     r"calcium carb|calcium cit|calcium gluc|calcium lact|"
     r"zinc.*supplement|magnesium.*supplement|potassium.*supplement|"
     r"selenium|chromium|manganese|copper.*supplement|iodine.*supplement|"
     r"multivitamin|prenatal vitamin|electrolyte.*supplement|"
     r"sodium fluoride.*supplement", "Vitamins & Supplements"),
    # Women's Health
    (r"ethinyl estradiol|estradiol|conjugated estrogen|esterified estrogen|"
     r"estrone|estriol|"
     r"medroxyprogesterone|levonorgestrel|norethindrone|desogestrel|"
     r"drospirenone|etonogestrel|norgestimate|norgestrel|"
     r"progesterone|hydroxyprogesterone|"
     r"clomiphene|letrozole.*fertility|gonadotropin|follitropin|"
     r"misoprostol.*obstet|dinoprostone|oxytocin|carboprost|methylergonovine|"
     r"mifepristone|ulipristal|"
     r"raloxifene|ospemifene|bazedoxifene", "Women's Health"),
    # Urology
    (r"tamsulosin|alfuzosin|silodosin|doxazosin.*bph|terazosin.*bph|"
     r"finasteride|dutasteride|"
     r"sildenafil|tadalafil|vardenafil|avanafil|"
     r"oxybutynin|tolterodine|solifenacin|darifenacin|fesoterodine|"
     r"trospium|mirabegron|vibegron|"
     r"bethanechol|flavoxate|phenazopyridine", "Urology"),
    # Oncology
    (r"tamoxifen|anastrozole|letrozole.*cancer|exemestane|fulvestrant|"
     r"imatinib|erlotinib|gefitinib|osimertinib|afatinib|dacomitinib|"
     r"dasatinib|nilotinib|ponatinib|bosutinib|"
     r"ibrutinib|acalabrutinib|zanubrutinib|"
     r"venetoclax|navitoclax|"
     r"bortezomib|carfilzomib|ixazomib|"
     r"lenalidomide|thalidomide|pomalidomide|"
     r"cyclophosphamide|ifosfamide|melphalan|busulfan|"
     r"methotrexate.*cancer|fluorouracil|capecitabine|gemcitabine|"
     r"temozolomide|carmustine|lomustine|"
     r"paclitaxel|docetaxel|cabazitaxel|"
     r"irinotecan|topotecan|etoposide|"
     r"pembrolizumab|nivolumab|atezolizumab|durvalumab|avelumab|"
     r"ipilimumab|cemiplimab|"
     r"bevacizumab|ramucirumab|sunitinib|sorafenib|regorafenib|"
     r"palbociclib|ribociclib|abemaciclib|"
     r"olaparib|niraparib|rucaparib|talazoparib|"
     r"abiraterone|enzalutamide|darolutamide|apalutamide", "Oncology"),
    # Joints & Muscles
    (r"methotrexate.*rheuma|hydroxychloroquine|sulfasalazine.*rheuma|"
     r"leflunomide|etanercept|adalimumab|infliximab|golimumab|certolizumab|"
     r"tocilizumab|sarilumab|abatacept|rituximab.*rheuma|"
     r"baricitinib|tofacitinib|upadacitinib|filgotinib|"
     r"colchicine|allopurinol|febuxostat|probenecid|rasburicase|pegloticase|"
     r"cyclobenzaprine|methocarbamol|carisoprodol|orphenadrine|chlorzoxazone|"
     r"baclofen.*muscle|tizanidine|dantrolene.*muscle|"
     r"alendronate|risedronate|ibandronate|zoledronic|pamidronate|"
     r"denosumab|teriparatide|abaloparatide|romosozumab|raloxifene.*bone|"
     r"naproxen.*rheuma|diclofenac.*rheuma|celecoxib.*rheuma|"
     r"indomethacin.*gout|sulindac", "Joints & Muscles"),
    # Skin & Wounds
    (r"tretinoin|adapalene|tazarotene|trifarotene|"
     r"benzoyl peroxide|salicylic acid.*topical|azelaic acid|"
     r"clindamycin.*topical|erythromycin.*topical|dapsone.*topical|"
     r"isotretinoin|acitretin|alitretinoin|"
     r"clobetasol|halobetasol|betamethasone.*topical|mometasone.*topical|"
     r"fluocinonide|triamcinolone.*topical|hydrocortisone.*topical|"
     r"desonide|fluocinolone.*topical|alclometasone|"
     r"tacrolimus.*topical|pimecrolimus|"
     r"calcipotriene|calcitriol.*topical|"
     r"mupirocin|fusidic acid|retapamulin|"
     r"minoxidil.*topical|finasteride.*topical|"
     r"imiquimod|podofilox|sinecatechins|"
     r"ivermectin.*topical|permethrin.*topical|malathion.*topical|"
     r"coal tar|anthralin|urea.*topical|lactic acid.*topical", "Skin & Wounds"),
    # Eye & Ear
    (r"latanoprost|bimatoprost|travoprost|tafluprost|unoprostone|"
     r"timolol.*ophthal|betaxolol.*ophthal|carteolol.*ophthal|"
     r"dorzolamide|brinzolamide|acetazolamide.*eye|"
     r"brimonidine|apraclonidine|"
     r"pilocarpine.*eye|echothiophate|"
     r"ciprofloxacin.*ophthal|ofloxacin.*ophthal|moxifloxacin.*ophthal|"
     r"levofloxacin.*ophthal|tobramycin.*ophthal|gentamicin.*ophthal|"
     r"erythromycin.*ophthal|azithromycin.*ophthal|"
     r"prednisolone.*ophthal|dexamethasone.*ophthal|fluorometholone|"
     r"loteprednol|difluprednate|rimexolone|"
     r"ketorolac.*ophthal|diclofenac.*ophthal|bromfenac|nepafenac|"
     r"olopatadine.*ophthal|ketotifen.*ophthal|azelastine.*ophthal|"
     r"epinastine|alcaftadine|bepotastine|"
     r"cyclopentolate|tropicamide|atropine.*ophthal|"
     r"artificial tear|hydroxypropyl|carboxymethylcellulose.*eye|"
     r"hyaluronic acid.*eye|polyvinyl alcohol.*eye|"
     r"neomycin.*otic|ciprofloxacin.*otic|ofloxacin.*otic|"
     r"cortisporin.*otic|acetic acid.*otic|antipyrine.*otic", "Eye & Ear"),
    # First Aid
    (r"lidocaine|benzocaine|prilocaine|tetracaine|bupivacaine|ropivacaine|"
     r"procaine|mepivacaine|articaine|"
     r"chlorhexidine|povidone.iodine|hydrogen peroxide.*topical|"
     r"isopropyl alcohol.*topical|ethanol.*topical|"
     r"bacitracin|polymyxin b.*topical|neomycin.*topical|"
     r"silver sulfadiazine|mafenide|"
     r"mupirocin|retapamulin.*topical|"
     r"collagenase.*wound|becaplermin|"
     r"benzalkonium|cetylpyridinium|thymol.*antisep", "First Aid"),
]

BLACKLIST = re.compile(
    r"\b(vaccine|vaccin|immunoglobulin|antitoxin|antivenom|"
    r"whole blood|packed red|platelet|plasma.*transfus|albumin.*transfus|"
    r"diagnostic.*kit|in vitro|reagent|contrast.*media|radiolabel|radioactive|"
    r"dialysis.*solution|peritoneal.*dialysis|"
    r"veterinary|animal.*use|for animals)\b", re.I
)

# NDC_EXCLUDE_FLAG = 'Y' betekent uitgesloten van actieve marketing
EXCLUDE_FLAG = re.compile(r"^Y$", re.I)


def pharm_class_to_cat(pharm_str):
    if not pharm_str: return None
    t = pharm_str.lower()
    for pat, cat in PHARM_CLASS_MAP:
        if re.search(pat, t): return cat
    return None


def generic_to_cat(name):
    if not name: return None
    t = name.lower()
    for pat, cat in GENERIC_MAP:
        if re.search(pat, t): return cat
    return None


def curl_download(url, dest, max_time=300):
    cmd = ["curl","-L","--max-time",str(max_time),"--connect-timeout","20",
           "--silent","--fail","--user-agent","Mozilla/5.0 apoHouze-updater/5.0",
           "-o",dest,url]
    for attempt in range(3):
        try:
            subprocess.run(cmd, timeout=max_time+15, check=True)
            size = os.path.getsize(dest)
            print(f"  ✅ {size//1024} KB gedownload")
            return size
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            print(f"  ⚠️  Poging {attempt+1}/3: {e}")
            if attempt < 2: time.sleep(5)
    return 0


def process_ndc(zip_path):
    print(f"  📦 ZIP openen ({os.path.getsize(zip_path)//1024} KB)...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        names = zf.namelist()
        if DEBUG: print(f"  🔍 ZIP inhoud: {names}")
        prod = next((n for n in names if "product" in n.lower() and n.endswith(".txt")), None)
        if not prod:
            raise RuntimeError(f"product.txt niet gevonden. Bestanden: {names}")
        print(f"  📖 {prod} lezen...")
        with zf.open(prod) as f:
            content = f.read().decode("utf-8", errors="replace")

    reader = csv.DictReader(io.StringIO(content), delimiter="\t")
    rows = list(reader)
    print(f"  📊 {len(rows)} rijen | kolommen: {list(rows[0].keys())[:6] if rows else '?'}")

    seen     = set()
    results  = []
    sk_excl  = 0  # NDC_EXCLUDE_FLAG=Y
    sk_bl    = 0  # blacklist
    sk_cat   = 0  # geen categorie
    sk_dup   = 0  # duplicaat

    for row in rows:
        # Sla uit als NDC_EXCLUDE_FLAG = Y
        if EXCLUDE_FLAG.match(row.get("NDC_EXCLUDE_FLAG","").strip()):
            sk_excl += 1; continue

        brand   = (row.get("PROPRIETARYNAME") or "").strip()
        suffix  = (row.get("PROPRIETARYNAMESUFFIX") or "").strip()
        generic = (row.get("NONPROPRIETARYNAME") or "").strip()
        form    = (row.get("DOSAGEFORMNAME") or "").strip()
        pharm   = (row.get("PHARM_CLASSES") or "").strip()
        dea     = (row.get("DEASCHEDULE") or "").strip()
        mkt     = (row.get("MARKETINGCATEGORYNAME") or "").upper()

        # Rx/OTC bepalen
        rx = bool(dea) or ("OTC" not in mkt and "MONOGRAPH" not in mkt)

        # Categorie: pharm_class eerst, dan generic name
        category = pharm_class_to_cat(pharm) or generic_to_cat(generic) or generic_to_cat(brand)
        if not category:
            sk_cat += 1; continue

        # Sla MERKNAAM op (als die bestaat en niet blacklisted)
        if brand:
            full_brand = f"{brand} {suffix}".strip() if suffix else brand
            if not BLACKLIST.search(full_brand):
                key = full_brand.lower()
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "Name": full_brand, "INN": generic,
                        "ATC": "", "PharmaceuticalForm": form,
                        "RxStatus": "Rx" if rx else "OTC", "Country": "US",
                    })
                else:
                    sk_dup += 1
            else:
                sk_bl += 1

        # Sla OOK GENERIEKE NAAM op (als die bestaat, anders dan merk, en niet blacklisted)
        if generic and generic.lower() != brand.lower():
            # Verwijder salt/ester suffixen voor dedup (maar bewaar de volledige naam)
            if not BLACKLIST.search(generic):
                key = generic.lower()
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "Name": generic, "INN": generic,
                        "ATC": "", "PharmaceuticalForm": form,
                        "RxStatus": "Rx" if rx else "OTC", "Country": "US",
                    })
                else:
                    sk_dup += 1
            else:
                sk_bl += 1

    print(f"  ✅ {len(results)} entries")
    print(f"     Uitgesloten (NDC_EXCLUDE_FLAG): {sk_excl}")
    print(f"     Geen categorie: {sk_cat}")
    print(f"     Blacklist: {sk_bl}")
    print(f"     Duplicaten: {sk_dup}")
    return results


def save_csv(rows):
    fields = ["Name","INN","ATC","PharmaceuticalForm","RxStatus","Country"]
    with open(OUTPUT_FILE,"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    print(f"\n✅ {len(rows)} medicijnen opgeslagen → {OUTPUT_FILE}")


def main():
    print("🇺🇸 apoHouze — Verenigde Staten Medicijnen Fetcher v3")
    print("=" * 54)
    print("📌 Bron: FDA NDC Directory (ndctext.zip)\n")

    dest = os.path.join(TMP_DIR, "us_ndctext.zip")
    print("[1/3] Downloaden...")
    ok = False
    for url in FDA_NDC_URLS:
        print(f"  📥 {url}")
        size = curl_download(url, dest)
        if size > 100_000:
            ok = True; break
        print(f"  ⚠️  Te klein ({size}B)")
    if not ok:
        print("❌ Download mislukt"); sys.exit(1)

    print(f"\n[2/3] Verwerken...")
    try:
        results = process_ndc(dest)
    except Exception as e:
        print(f"❌ Fout: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)

    if not results:
        print("❌ Geen resultaten"); sys.exit(1)

    print(f"\n[3/3] Opslaan...")
    save_csv(results)


if __name__ == "__main__":
    main()
