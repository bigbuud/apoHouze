#!/usr/bin/env node
/**
 * apoHouze — Country database generator
 * Generates data/countries/{code}.js files with 1500+ medicines each.
 * 
 * Usage:  node generate.js [countryCode]
 *         node generate.js all
 */

// ================================================================
// SHARED GENERIC MEDICINES (WHO Essential + European core list)
// Each entry: { generic, category, forms[], rx }
// ================================================================
const GENERICS = [
  // PAIN & FEVER
  { generic: "Paracetamol", category: "Pain & Fever", forms: ["Tablet 500mg","Tablet 1000mg","Effervescent tablet 500mg","Suspension 24mg/ml","Suppository 125mg","Suppository 250mg","Suppository 500mg"], rx: false },
  { generic: "Ibuprofen", category: "Pain & Fever", forms: ["Tablet 200mg","Tablet 400mg","Tablet 600mg","Tablet 800mg","Syrup 100mg/5ml","Gel 5%","Capsule 200mg","Capsule 400mg"], rx: false },
  { generic: "Diclofenac", category: "Pain & Fever", forms: ["Tablet 25mg","Tablet 50mg","Tablet 75mg","Gel 1%","Gel 2%","Suppository 50mg","Suppository 100mg","Patch"], rx: false },
  { generic: "Naproxen", category: "Pain & Fever", forms: ["Tablet 250mg","Tablet 500mg","Tablet 220mg (OTC)","Gel 10%"], rx: false },
  { generic: "Aspirin", category: "Pain & Fever", forms: ["Tablet 500mg","Tablet 300mg","Effervescent tablet 500mg"], rx: false },
  { generic: "Codeine", category: "Pain & Fever", forms: ["Tablet 15mg","Tablet 30mg","Syrup 15mg/5ml"], rx: true },
  { generic: "Tramadol", category: "Pain & Fever", forms: ["Capsule 50mg","Tablet SR 100mg","Tablet SR 150mg","Tablet SR 200mg","Drops 100mg/ml"], rx: true },
  { generic: "Oxycodone", category: "Pain & Fever", forms: ["Tablet 5mg","Tablet 10mg","Tablet SR 10mg","Tablet SR 20mg","Tablet SR 40mg"], rx: true },
  { generic: "Morphine", category: "Pain & Fever", forms: ["Tablet SR 10mg","Tablet SR 30mg","Tablet SR 60mg","Solution 10mg/5ml"], rx: true },
  { generic: "Celecoxib", category: "Pain & Fever", forms: ["Capsule 100mg","Capsule 200mg"], rx: true },
  { generic: "Meloxicam", category: "Pain & Fever", forms: ["Tablet 7.5mg","Tablet 15mg"], rx: true },
  { generic: "Ketorolac", category: "Pain & Fever", forms: ["Tablet 10mg","Eye drops 0.5%"], rx: true },
  { generic: "Etoricoxib", category: "Pain & Fever", forms: ["Tablet 30mg","Tablet 60mg","Tablet 90mg","Tablet 120mg"], rx: true },
  { generic: "Indomethacin", category: "Pain & Fever", forms: ["Capsule 25mg","Capsule 50mg","Suppository 100mg"], rx: true },

  // COUGH & COLD
  { generic: "Xylometazoline", category: "Cough & Cold", forms: ["Nasal spray 0.05%","Nasal spray 0.1%","Nasal drops 0.05%","Nasal drops 0.1%"], rx: false },
  { generic: "Oxymetazoline", category: "Cough & Cold", forms: ["Nasal spray 0.025%","Nasal spray 0.05%","Nasal drops 0.025%"], rx: false },
  { generic: "Bromhexine", category: "Cough & Cold", forms: ["Tablet 8mg","Syrup 4mg/5ml","Drops 2mg/ml"], rx: false },
  { generic: "Ambroxol", category: "Cough & Cold", forms: ["Tablet 30mg","Syrup 15mg/5ml","Lozenge 15mg","Solution for inhalation"], rx: false },
  { generic: "Acetylcysteine", category: "Cough & Cold", forms: ["Effervescent tablet 200mg","Effervescent tablet 600mg","Sachet 200mg","Syrup 100mg/5ml"], rx: false },
  { generic: "Dextromethorphan", category: "Cough & Cold", forms: ["Syrup 15mg/5ml","Capsule 30mg","Lozenge 7.5mg"], rx: false },
  { generic: "Guaifenesin", category: "Cough & Cold", forms: ["Syrup 100mg/5ml","Tablet 200mg","Tablet 400mg"], rx: false },
  { generic: "Ipratropium (nasal)", category: "Cough & Cold", forms: ["Nasal spray 0.03%","Nasal spray 0.06%"], rx: true },
  { generic: "Pseudoephedrine", category: "Cough & Cold", forms: ["Tablet 30mg","Tablet 60mg","Syrup 30mg/5ml"], rx: false },
  { generic: "Phenylephrine", category: "Cough & Cold", forms: ["Nasal spray 0.25%","Nasal drops 0.25%","Tablet 10mg"], rx: false },
  { generic: "Budesonide (nasal)", category: "Cough & Cold", forms: ["Nasal spray 32mcg","Nasal spray 64mcg"], rx: false },
  { generic: "Fluticasone (nasal)", category: "Cough & Cold", forms: ["Nasal spray 50mcg","Nasal spray 100mcg"], rx: false },
  { generic: "Mometasone (nasal)", category: "Cough & Cold", forms: ["Nasal spray 50mcg"], rx: true },

  // ALLERGY
  { generic: "Loratadine", category: "Allergy", forms: ["Tablet 10mg","Syrup 5mg/5ml","Orally disintegrating tablet 10mg"], rx: false },
  { generic: "Cetirizine", category: "Allergy", forms: ["Tablet 10mg","Syrup 5mg/5ml","Drops 10mg/ml"], rx: false },
  { generic: "Levocetirizine", category: "Allergy", forms: ["Tablet 5mg","Oral solution 2.5mg/5ml"], rx: false },
  { generic: "Desloratadine", category: "Allergy", forms: ["Tablet 5mg","Syrup 2.5mg/5ml","Orally disintegrating tablet 2.5mg"], rx: true },
  { generic: "Fexofenadine", category: "Allergy", forms: ["Tablet 60mg","Tablet 120mg","Tablet 180mg"], rx: false },
  { generic: "Bilastine", category: "Allergy", forms: ["Tablet 20mg","Oral solution 2.5mg/ml"], rx: false },
  { generic: "Rupatadine", category: "Allergy", forms: ["Tablet 10mg","Oral solution 1mg/ml"], rx: true },
  { generic: "Chlorphenamine", category: "Allergy", forms: ["Tablet 4mg","Syrup 2mg/5ml"], rx: false },
  { generic: "Hydroxyzine", category: "Allergy", forms: ["Tablet 10mg","Tablet 25mg","Syrup 10mg/5ml"], rx: true },
  { generic: "Azelastine (nasal)", category: "Allergy", forms: ["Nasal spray 0.1%"], rx: false },
  { generic: "Cromoglicate (nasal)", category: "Allergy", forms: ["Nasal spray 2%","Eye drops 2%"], rx: false },
  { generic: "Ketotifen (eye)", category: "Allergy", forms: ["Eye drops 0.025%"], rx: false },

  // STOMACH & INTESTINE
  { generic: "Omeprazole", category: "Stomach & Intestine", forms: ["Capsule 10mg","Capsule 20mg","Capsule 40mg","Tablet 20mg"], rx: false },
  { generic: "Pantoprazole", category: "Stomach & Intestine", forms: ["Tablet 20mg","Tablet 40mg"], rx: false },
  { generic: "Esomeprazole", category: "Stomach & Intestine", forms: ["Tablet 20mg","Tablet 40mg","Capsule 20mg","Sachet 10mg"], rx: false },
  { generic: "Lansoprazole", category: "Stomach & Intestine", forms: ["Capsule 15mg","Capsule 30mg","Orally disintegrating tablet 15mg"], rx: false },
  { generic: "Rabeprazole", category: "Stomach & Intestine", forms: ["Tablet 10mg","Tablet 20mg"], rx: true },
  { generic: "Domperidone", category: "Stomach & Intestine", forms: ["Tablet 10mg","Oral solution 1mg/ml","Suppository 10mg","Suppository 30mg"], rx: true },
  { generic: "Metoclopramide", category: "Stomach & Intestine", forms: ["Tablet 10mg","Solution 5mg/5ml"], rx: true },
  { generic: "Loperamide", category: "Stomach & Intestine", forms: ["Capsule 2mg","Tablet 2mg","Syrup 0.2mg/ml"], rx: false },
  { generic: "Bismuth subsalicylate", category: "Stomach & Intestine", forms: ["Tablet 262mg","Suspension"], rx: false },
  { generic: "Macrogol (PEG)", category: "Stomach & Intestine", forms: ["Sachet 6.9g","Sachet 13.7g"], rx: false },
  { generic: "Lactulose", category: "Stomach & Intestine", forms: ["Syrup 667mg/ml","Sachet 10g"], rx: false },
  { generic: "Bisacodyl", category: "Stomach & Intestine", forms: ["Tablet 5mg","Suppository 10mg"], rx: false },
  { generic: "Senna", category: "Stomach & Intestine", forms: ["Tablet 7.5mg","Syrup"], rx: false },
  { generic: "Ispaghula husk", category: "Stomach & Intestine", forms: ["Sachet 3.5g"], rx: false },
  { generic: "Simethicone", category: "Stomach & Intestine", forms: ["Tablet 80mg","Suspension","Drops 40mg/ml"], rx: false },
  { generic: "Calcium carbonate (antacid)", category: "Stomach & Intestine", forms: ["Tablet 500mg","Chewable tablet 750mg"], rx: false },
  { generic: "Aluminium hydroxide", category: "Stomach & Intestine", forms: ["Tablet 400mg","Suspension"], rx: false },
  { generic: "Mesalazine", category: "Stomach & Intestine", forms: ["Tablet 400mg","Tablet 800mg","Suppository 500mg","Suppository 1g","Enema"], rx: true },
  { generic: "Hyoscine butylbromide", category: "Stomach & Intestine", forms: ["Tablet 10mg","Suppository 10mg"], rx: false },
  { generic: "Mebeverine", category: "Stomach & Intestine", forms: ["Tablet 135mg","Capsule SR 200mg"], rx: false },
  { generic: "Probiotic Saccharomyces boulardii", category: "Stomach & Intestine", forms: ["Capsule 250mg","Sachet"], rx: false },

  // ANTIBIOTICS
  { generic: "Amoxicillin", category: "Antibiotics", forms: ["Capsule 250mg","Capsule 500mg","Tablet 875mg","Powder for suspension 125mg/5ml","Powder for suspension 250mg/5ml"], rx: true },
  { generic: "Amoxicillin + Clavulanic acid", category: "Antibiotics", forms: ["Tablet 500/125mg","Tablet 875/125mg","Suspension 125/31.25mg/5ml"], rx: true },
  { generic: "Phenoxymethylpenicillin", category: "Antibiotics", forms: ["Tablet 250mg","Tablet 500mg","Powder for suspension 125mg/5ml"], rx: true },
  { generic: "Flucloxacillin", category: "Antibiotics", forms: ["Capsule 250mg","Capsule 500mg","Powder for suspension 125mg/5ml"], rx: true },
  { generic: "Azithromycin", category: "Antibiotics", forms: ["Tablet 250mg","Tablet 500mg","Powder for suspension 200mg/5ml"], rx: true },
  { generic: "Clarithromycin", category: "Antibiotics", forms: ["Tablet 250mg","Tablet 500mg","Tablet SR 500mg","Suspension 125mg/5ml"], rx: true },
  { generic: "Erythromycin", category: "Antibiotics", forms: ["Tablet 250mg","Tablet 500mg","Suspension 125mg/5ml","Gel 2%"], rx: true },
  { generic: "Doxycycline", category: "Antibiotics", forms: ["Tablet 100mg","Capsule 100mg"], rx: true },
  { generic: "Trimethoprim", category: "Antibiotics", forms: ["Tablet 100mg","Tablet 200mg","Suspension 50mg/5ml"], rx: true },
  { generic: "Co-trimoxazole", category: "Antibiotics", forms: ["Tablet 400/80mg","Tablet 800/160mg","Suspension 200/40mg/5ml"], rx: true },
  { generic: "Nitrofurantoin", category: "Antibiotics", forms: ["Capsule SR 100mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Ciprofloxacin", category: "Antibiotics", forms: ["Tablet 250mg","Tablet 500mg","Tablet 750mg","Eye drops 0.3%"], rx: true },
  { generic: "Levofloxacin", category: "Antibiotics", forms: ["Tablet 250mg","Tablet 500mg","Tablet 750mg"], rx: true },
  { generic: "Metronidazole", category: "Antibiotics", forms: ["Tablet 200mg","Tablet 400mg","Tablet 500mg","Suspension 200mg/5ml","Gel 0.75%","Suppository 500mg"], rx: true },
  { generic: "Clindamycin", category: "Antibiotics", forms: ["Capsule 150mg","Capsule 300mg","Gel 1%"], rx: true },
  { generic: "Tetracycline", category: "Antibiotics", forms: ["Capsule 250mg","Capsule 500mg"], rx: true },
  { generic: "Cefalexin", category: "Antibiotics", forms: ["Capsule 250mg","Capsule 500mg","Suspension 125mg/5ml","Suspension 250mg/5ml"], rx: true },
  { generic: "Cefuroxime", category: "Antibiotics", forms: ["Tablet 125mg","Tablet 250mg","Tablet 500mg"], rx: true },
  { generic: "Pivmecillinam", category: "Antibiotics", forms: ["Tablet 200mg","Tablet 400mg"], rx: true },
  { generic: "Fosfomycin", category: "Antibiotics", forms: ["Sachet 3g"], rx: true },
  { generic: "Minocycline", category: "Antibiotics", forms: ["Tablet 50mg","Tablet 100mg","Capsule 50mg","Capsule 100mg"], rx: true },
  { generic: "Rifampicin", category: "Antibiotics", forms: ["Capsule 150mg","Capsule 300mg","Tablet 300mg"], rx: true },

  // HEART & BLOOD PRESSURE
  { generic: "Amlodipine", category: "Heart & Blood Pressure", forms: ["Tablet 2.5mg","Tablet 5mg","Tablet 10mg"], rx: true },
  { generic: "Bisoprolol", category: "Heart & Blood Pressure", forms: ["Tablet 1.25mg","Tablet 2.5mg","Tablet 5mg","Tablet 10mg"], rx: true },
  { generic: "Metoprolol", category: "Heart & Blood Pressure", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg","Tablet SR 47.5mg","Tablet SR 95mg","Tablet SR 190mg"], rx: true },
  { generic: "Lisinopril", category: "Heart & Blood Pressure", forms: ["Tablet 2.5mg","Tablet 5mg","Tablet 10mg","Tablet 20mg","Tablet 40mg"], rx: true },
  { generic: "Ramipril", category: "Heart & Blood Pressure", forms: ["Capsule 1.25mg","Capsule 2.5mg","Capsule 5mg","Capsule 10mg"], rx: true },
  { generic: "Enalapril", category: "Heart & Blood Pressure", forms: ["Tablet 2.5mg","Tablet 5mg","Tablet 10mg","Tablet 20mg"], rx: true },
  { generic: "Perindopril", category: "Heart & Blood Pressure", forms: ["Tablet 2mg","Tablet 4mg","Tablet 8mg","Tablet 10mg"], rx: true },
  { generic: "Valsartan", category: "Heart & Blood Pressure", forms: ["Tablet 40mg","Tablet 80mg","Tablet 160mg","Tablet 320mg"], rx: true },
  { generic: "Losartan", category: "Heart & Blood Pressure", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Candesartan", category: "Heart & Blood Pressure", forms: ["Tablet 4mg","Tablet 8mg","Tablet 16mg","Tablet 32mg"], rx: true },
  { generic: "Irbesartan", category: "Heart & Blood Pressure", forms: ["Tablet 75mg","Tablet 150mg","Tablet 300mg"], rx: true },
  { generic: "Olmesartan", category: "Heart & Blood Pressure", forms: ["Tablet 10mg","Tablet 20mg","Tablet 40mg"], rx: true },
  { generic: "Telmisartan", category: "Heart & Blood Pressure", forms: ["Tablet 20mg","Tablet 40mg","Tablet 80mg"], rx: true },
  { generic: "Hydrochlorothiazide", category: "Heart & Blood Pressure", forms: ["Tablet 12.5mg","Tablet 25mg","Tablet 50mg"], rx: true },
  { generic: "Indapamide", category: "Heart & Blood Pressure", forms: ["Tablet 2.5mg","Tablet SR 1.5mg"], rx: true },
  { generic: "Furosemide", category: "Heart & Blood Pressure", forms: ["Tablet 20mg","Tablet 40mg","Tablet 80mg","Solution 10mg/ml"], rx: true },
  { generic: "Spironolactone", category: "Heart & Blood Pressure", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Carvedilol", category: "Heart & Blood Pressure", forms: ["Tablet 3.125mg","Tablet 6.25mg","Tablet 12.5mg","Tablet 25mg"], rx: true },
  { generic: "Nebivolol", category: "Heart & Blood Pressure", forms: ["Tablet 5mg"], rx: true },
  { generic: "Atenolol", category: "Heart & Blood Pressure", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Nifedipine", category: "Heart & Blood Pressure", forms: ["Tablet SR 30mg","Tablet SR 60mg","Capsule 5mg","Capsule 10mg"], rx: true },
  { generic: "Diltiazem", category: "Heart & Blood Pressure", forms: ["Tablet 60mg","Tablet SR 120mg","Tablet SR 180mg","Tablet SR 240mg","Capsule SR 90mg"], rx: true },
  { generic: "Verapamil", category: "Heart & Blood Pressure", forms: ["Tablet 40mg","Tablet 80mg","Tablet SR 120mg","Tablet SR 240mg"], rx: true },
  { generic: "Doxazosin", category: "Heart & Blood Pressure", forms: ["Tablet 1mg","Tablet 2mg","Tablet 4mg","Tablet 8mg"], rx: true },
  { generic: "Digoxin", category: "Heart & Blood Pressure", forms: ["Tablet 0.0625mg","Tablet 0.125mg","Tablet 0.25mg"], rx: true },
  { generic: "Ivabradine", category: "Heart & Blood Pressure", forms: ["Tablet 5mg","Tablet 7.5mg"], rx: true },
  { generic: "Sacubitril + Valsartan", category: "Heart & Blood Pressure", forms: ["Tablet 24/26mg","Tablet 49/51mg","Tablet 97/103mg"], rx: true },
  { generic: "Eplerenone", category: "Heart & Blood Pressure", forms: ["Tablet 25mg","Tablet 50mg"], rx: true },
  { generic: "Torasemide", category: "Heart & Blood Pressure", forms: ["Tablet 2.5mg","Tablet 5mg","Tablet 10mg"], rx: true },

  // CHOLESTEROL
  { generic: "Atorvastatin", category: "Cholesterol", forms: ["Tablet 10mg","Tablet 20mg","Tablet 40mg","Tablet 80mg"], rx: true },
  { generic: "Simvastatin", category: "Cholesterol", forms: ["Tablet 10mg","Tablet 20mg","Tablet 40mg","Tablet 80mg"], rx: true },
  { generic: "Rosuvastatin", category: "Cholesterol", forms: ["Tablet 5mg","Tablet 10mg","Tablet 20mg","Tablet 40mg"], rx: true },
  { generic: "Pravastatin", category: "Cholesterol", forms: ["Tablet 10mg","Tablet 20mg","Tablet 40mg"], rx: true },
  { generic: "Fluvastatin", category: "Cholesterol", forms: ["Capsule 20mg","Capsule 40mg","Tablet SR 80mg"], rx: true },
  { generic: "Pitavastatin", category: "Cholesterol", forms: ["Tablet 1mg","Tablet 2mg","Tablet 4mg"], rx: true },
  { generic: "Ezetimibe", category: "Cholesterol", forms: ["Tablet 10mg"], rx: true },
  { generic: "Fenofibrate", category: "Cholesterol", forms: ["Capsule 67mg","Tablet 160mg","Tablet 200mg"], rx: true },
  { generic: "Gemfibrozil", category: "Cholesterol", forms: ["Tablet 300mg","Tablet 600mg"], rx: true },
  { generic: "Colestyramine", category: "Cholesterol", forms: ["Sachet 4g"], rx: true },
  { generic: "Omega-3 fatty acids", category: "Cholesterol", forms: ["Capsule 1000mg","Capsule 500mg"], rx: false },

  // DIABETES
  { generic: "Metformin", category: "Diabetes", forms: ["Tablet 500mg","Tablet 850mg","Tablet 1000mg","Tablet SR 500mg","Tablet SR 1000mg","Oral solution 500mg/5ml"], rx: true },
  { generic: "Glimepiride", category: "Diabetes", forms: ["Tablet 1mg","Tablet 2mg","Tablet 3mg","Tablet 4mg","Tablet 6mg"], rx: true },
  { generic: "Gliclazide", category: "Diabetes", forms: ["Tablet 80mg","Tablet SR 30mg","Tablet SR 60mg"], rx: true },
  { generic: "Glipizide", category: "Diabetes", forms: ["Tablet 5mg","Tablet 10mg","Tablet SR 5mg"], rx: true },
  { generic: "Sitagliptin", category: "Diabetes", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Vildagliptin", category: "Diabetes", forms: ["Tablet 50mg"], rx: true },
  { generic: "Saxagliptin", category: "Diabetes", forms: ["Tablet 2.5mg","Tablet 5mg"], rx: true },
  { generic: "Linagliptin", category: "Diabetes", forms: ["Tablet 5mg"], rx: true },
  { generic: "Empagliflozin", category: "Diabetes", forms: ["Tablet 10mg","Tablet 25mg"], rx: true },
  { generic: "Dapagliflozin", category: "Diabetes", forms: ["Tablet 5mg","Tablet 10mg"], rx: true },
  { generic: "Canagliflozin", category: "Diabetes", forms: ["Tablet 100mg","Tablet 300mg"], rx: true },
  { generic: "Liraglutide", category: "Diabetes", forms: ["Solution for injection 6mg/ml"], rx: true },
  { generic: "Semaglutide", category: "Diabetes", forms: ["Tablet 3mg","Tablet 7mg","Tablet 14mg","Solution for injection"], rx: true },
  { generic: "Exenatide", category: "Diabetes", forms: ["Solution for injection 5mcg","Solution for injection 10mcg"], rx: true },
  { generic: "Insulin glargine", category: "Diabetes", forms: ["Solution for injection 100IE/ml","Solution for injection 300IE/ml"], rx: true },
  { generic: "Insulin detemir", category: "Diabetes", forms: ["Solution for injection 100IE/ml"], rx: true },
  { generic: "Insulin degludec", category: "Diabetes", forms: ["Solution for injection 100IE/ml","Solution for injection 200IE/ml"], rx: true },
  { generic: "Insulin aspart", category: "Diabetes", forms: ["Solution for injection 100IE/ml"], rx: true },
  { generic: "Insulin lispro", category: "Diabetes", forms: ["Solution for injection 100IE/ml","Solution for injection 200IE/ml"], rx: true },
  { generic: "Insulin isophane (NPH)", category: "Diabetes", forms: ["Suspension for injection 100IE/ml"], rx: true },
  { generic: "Insulin regular", category: "Diabetes", forms: ["Solution for injection 100IE/ml"], rx: true },
  { generic: "Pioglitazone", category: "Diabetes", forms: ["Tablet 15mg","Tablet 30mg","Tablet 45mg"], rx: true },
  { generic: "Acarbose", category: "Diabetes", forms: ["Tablet 50mg","Tablet 100mg"], rx: true },

  // SKIN & WOUNDS
  { generic: "Hydrocortisone (skin)", category: "Skin & Wounds", forms: ["Cream 0.5%","Cream 1%","Ointment 1%","Lotion 1%"], rx: false },
  { generic: "Betamethasone (skin)", category: "Skin & Wounds", forms: ["Cream 0.05%","Cream 0.1%","Ointment 0.1%","Lotion 0.1%","Scalp application"], rx: true },
  { generic: "Mometasone (skin)", category: "Skin & Wounds", forms: ["Cream 0.1%","Ointment 0.1%","Lotion 0.1%","Scalp lotion"], rx: true },
  { generic: "Fluticasone (skin)", category: "Skin & Wounds", forms: ["Cream 0.05%","Ointment 0.005%"], rx: true },
  { generic: "Methylprednisolone aceponate", category: "Skin & Wounds", forms: ["Cream 0.1%","Ointment 0.1%","Fat cream"], rx: true },
  { generic: "Clobetasol", category: "Skin & Wounds", forms: ["Cream 0.05%","Ointment 0.05%","Foam 0.05%","Shampoo 0.05%"], rx: true },
  { generic: "Clobetasone butyrate", category: "Skin & Wounds", forms: ["Cream 0.05%"], rx: false },
  { generic: "Triamcinolone (skin)", category: "Skin & Wounds", forms: ["Cream 0.025%","Cream 0.1%","Ointment 0.1%"], rx: true },
  { generic: "Desonide", category: "Skin & Wounds", forms: ["Cream 0.05%","Lotion 0.05%","Gel 0.05%"], rx: true },
  { generic: "Mupirocin", category: "Skin & Wounds", forms: ["Cream 2%","Ointment 2%","Nasal ointment 2%"], rx: true },
  { generic: "Fusidic acid", category: "Skin & Wounds", forms: ["Cream 2%","Ointment 2%","Gel 2%"], rx: true },
  { generic: "Retapamulin", category: "Skin & Wounds", forms: ["Ointment 1%"], rx: true },
  { generic: "Clotrimazole (skin)", category: "Skin & Wounds", forms: ["Cream 1%","Solution 1%","Powder 1%"], rx: false },
  { generic: "Miconazole (skin)", category: "Skin & Wounds", forms: ["Cream 2%","Powder 2%","Spray 2%"], rx: false },
  { generic: "Terbinafine (skin)", category: "Skin & Wounds", forms: ["Cream 1%","Gel 1%","Spray 1%"], rx: false },
  { generic: "Ketoconazole (skin)", category: "Skin & Wounds", forms: ["Cream 2%","Shampoo 2%"], rx: false },
  { generic: "Aciclovir (skin)", category: "Skin & Wounds", forms: ["Cream 5%"], rx: false },
  { generic: "Penciclovir", category: "Skin & Wounds", forms: ["Cream 1%"], rx: false },
  { generic: "Dexpanthenol", category: "Skin & Wounds", forms: ["Cream 5%","Ointment 5%","Spray","Lotion"], rx: false },
  { generic: "Zinc oxide", category: "Skin & Wounds", forms: ["Cream","Ointment","Paste"], rx: false },
  { generic: "Adapalene", category: "Skin & Wounds", forms: ["Gel 0.1%","Cream 0.1%","Gel 0.3%"], rx: false },
  { generic: "Benzoyl peroxide", category: "Skin & Wounds", forms: ["Gel 2.5%","Gel 5%","Gel 10%","Cream 5%"], rx: false },
  { generic: "Azelaic acid", category: "Skin & Wounds", forms: ["Cream 20%","Gel 15%"], rx: false },
  { generic: "Calcipotriol (skin)", category: "Skin & Wounds", forms: ["Ointment 50mcg/g","Scalp solution","Foam"], rx: true },
  { generic: "Coal tar", category: "Skin & Wounds", forms: ["Shampoo 2%","Ointment 5%"], rx: false },
  { generic: "Salicylic acid", category: "Skin & Wounds", forms: ["Ointment 2%","Gel 5%","Solution 12%"], rx: false },
  { generic: "Povidone-iodine", category: "Skin & Wounds", forms: ["Solution 7.5%","Solution 10%","Ointment 10%"], rx: false },
  { generic: "Chlorhexidine", category: "Skin & Wounds", forms: ["Solution 0.5%","Solution 2%","Gel 1%"], rx: false },

  // SLEEP & SEDATION
  { generic: "Zolpidem", category: "Sleep & Sedation", forms: ["Tablet 5mg","Tablet 10mg","Spray sublingual"], rx: true },
  { generic: "Zopiclone", category: "Sleep & Sedation", forms: ["Tablet 3.75mg","Tablet 7.5mg"], rx: true },
  { generic: "Zaleplon", category: "Sleep & Sedation", forms: ["Capsule 5mg","Capsule 10mg"], rx: true },
  { generic: "Temazepam", category: "Sleep & Sedation", forms: ["Tablet 10mg","Tablet 20mg","Capsule 10mg","Capsule 20mg"], rx: true },
  { generic: "Nitrazepam", category: "Sleep & Sedation", forms: ["Tablet 5mg"], rx: true },
  { generic: "Loprazolam", category: "Sleep & Sedation", forms: ["Tablet 1mg"], rx: true },
  { generic: "Lormetazepam", category: "Sleep & Sedation", forms: ["Tablet 0.5mg","Tablet 1mg","Tablet 2mg"], rx: true },
  { generic: "Diazepam", category: "Sleep & Sedation", forms: ["Tablet 2mg","Tablet 5mg","Tablet 10mg","Oral solution 2mg/5ml"], rx: true },
  { generic: "Oxazepam", category: "Sleep & Sedation", forms: ["Tablet 10mg","Tablet 15mg","Tablet 50mg"], rx: true },
  { generic: "Lorazepam", category: "Sleep & Sedation", forms: ["Tablet 0.5mg","Tablet 1mg","Tablet 2mg"], rx: true },
  { generic: "Clonazepam", category: "Sleep & Sedation", forms: ["Tablet 0.5mg","Tablet 2mg","Drops 2.5mg/ml"], rx: true },
  { generic: "Alprazolam", category: "Sleep & Sedation", forms: ["Tablet 0.25mg","Tablet 0.5mg","Tablet 1mg"], rx: true },
  { generic: "Melatonin", category: "Sleep & Sedation", forms: ["Tablet 0.5mg","Tablet 1mg","Tablet 2mg SR","Tablet 5mg","Oral solution"], rx: false },
  { generic: "Promethazine", category: "Sleep & Sedation", forms: ["Tablet 10mg","Tablet 25mg","Syrup 5mg/5ml"], rx: false },
  { generic: "Diphenhydramine", category: "Sleep & Sedation", forms: ["Tablet 25mg","Tablet 50mg","Capsule 25mg"], rx: false },
  { generic: "Doxylamine", category: "Sleep & Sedation", forms: ["Tablet 25mg"], rx: false },
  { generic: "Buspirone", category: "Sleep & Sedation", forms: ["Tablet 5mg","Tablet 10mg"], rx: true },
  { generic: "Hydroxyzine (anxiolytic)", category: "Sleep & Sedation", forms: ["Tablet 10mg","Tablet 25mg","Tablet 50mg","Syrup 10mg/5ml"], rx: true },
  { generic: "Pregabalin (anxiety)", category: "Sleep & Sedation", forms: ["Capsule 25mg","Capsule 75mg","Capsule 150mg"], rx: true },

  // ANTIDEPRESSANTS
  { generic: "Fluoxetine", category: "Antidepressants", forms: ["Capsule 10mg","Capsule 20mg","Capsule 40mg","Liquid 20mg/5ml"], rx: true },
  { generic: "Sertraline", category: "Antidepressants", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg","Oral concentrate 20mg/ml"], rx: true },
  { generic: "Citalopram", category: "Antidepressants", forms: ["Tablet 10mg","Tablet 20mg","Tablet 40mg","Drops 40mg/ml"], rx: true },
  { generic: "Escitalopram", category: "Antidepressants", forms: ["Tablet 5mg","Tablet 10mg","Tablet 20mg","Drops 20mg/ml"], rx: true },
  { generic: "Paroxetine", category: "Antidepressants", forms: ["Tablet 10mg","Tablet 20mg","Tablet 30mg","Tablet 40mg","Suspension 10mg/5ml"], rx: true },
  { generic: "Fluvoxamine", category: "Antidepressants", forms: ["Tablet 50mg","Tablet 100mg","Capsule SR 100mg","Capsule SR 150mg"], rx: true },
  { generic: "Venlafaxine", category: "Antidepressants", forms: ["Capsule SR 37.5mg","Capsule SR 75mg","Capsule SR 150mg","Tablet 37.5mg","Tablet 75mg"], rx: true },
  { generic: "Duloxetine", category: "Antidepressants", forms: ["Capsule 30mg","Capsule 60mg"], rx: true },
  { generic: "Mirtazapine", category: "Antidepressants", forms: ["Tablet 15mg","Tablet 30mg","Tablet 45mg","Orally disintegrating tablet 15mg","Orally disintegrating tablet 30mg"], rx: true },
  { generic: "Amitriptyline", category: "Antidepressants", forms: ["Tablet 10mg","Tablet 25mg","Tablet 50mg","Oral solution 25mg/5ml"], rx: true },
  { generic: "Nortriptyline", category: "Antidepressants", forms: ["Capsule 10mg","Capsule 25mg","Capsule 50mg"], rx: true },
  { generic: "Imipramine", category: "Antidepressants", forms: ["Tablet 10mg","Tablet 25mg"], rx: true },
  { generic: "Clomipramine", category: "Antidepressants", forms: ["Capsule 10mg","Capsule 25mg","Capsule 50mg"], rx: true },
  { generic: "Bupropion", category: "Antidepressants", forms: ["Tablet SR 150mg","Tablet SR 300mg"], rx: true },
  { generic: "Quetiapine", category: "Antidepressants", forms: ["Tablet 25mg","Tablet 100mg","Tablet 200mg","Tablet SR 50mg","Tablet SR 150mg","Tablet SR 300mg"], rx: true },
  { generic: "Agomelatine", category: "Antidepressants", forms: ["Tablet 25mg"], rx: true },
  { generic: "Trazodone", category: "Antidepressants", forms: ["Tablet 50mg","Tablet 100mg","Tablet SR 75mg","Tablet SR 150mg"], rx: true },
  { generic: "Moclobemide", category: "Antidepressants", forms: ["Tablet 150mg","Tablet 300mg"], rx: true },
  { generic: "Lithium carbonate", category: "Antidepressants", forms: ["Tablet SR 400mg","Tablet 250mg","Capsule 150mg"], rx: true },
  { generic: "Valproate (mood)", category: "Antidepressants", forms: ["Tablet SR 500mg","Syrup 200mg/5ml"], rx: true },
  { generic: "Lamotrigine (mood)", category: "Antidepressants", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg","Tablet 200mg","Dispersible tablet 5mg"], rx: true },

  // THYROID
  { generic: "Levothyroxine", category: "Thyroid", forms: ["Tablet 25mcg","Tablet 50mcg","Tablet 75mcg","Tablet 88mcg","Tablet 100mcg","Tablet 112mcg","Tablet 125mcg","Tablet 150mcg","Oral solution"], rx: true },
  { generic: "Liothyronine", category: "Thyroid", forms: ["Tablet 20mcg"], rx: true },
  { generic: "Carbimazole", category: "Thyroid", forms: ["Tablet 5mg","Tablet 20mg"], rx: true },
  { generic: "Propylthiouracil", category: "Thyroid", forms: ["Tablet 50mg"], rx: true },
  { generic: "Thiamazole", category: "Thyroid", forms: ["Tablet 5mg","Tablet 10mg","Tablet 20mg"], rx: true },

  // LUNGS & ASTHMA
  { generic: "Salbutamol (inhaled)", category: "Lungs & Asthma", forms: ["Inhaler 100mcg","Nebuliser solution 2.5mg/2.5ml","Nebuliser solution 5mg/2.5ml","Syrup 2mg/5ml"], rx: true },
  { generic: "Terbutaline", category: "Lungs & Asthma", forms: ["Inhaler 250mcg","Turbuhaler 500mcg","Tablet 2.5mg","Tablet 5mg"], rx: true },
  { generic: "Formoterol", category: "Lungs & Asthma", forms: ["Inhaler 12mcg","Turbuhaler 6mcg","Turbuhaler 12mcg","Capsule for inhalation 12mcg"], rx: true },
  { generic: "Salmeterol", category: "Lungs & Asthma", forms: ["Inhaler 25mcg","Accuhaler 50mcg"], rx: true },
  { generic: "Indacaterol", category: "Lungs & Asthma", forms: ["Capsule for inhalation 75mcg","Capsule for inhalation 150mcg","Capsule for inhalation 300mcg"], rx: true },
  { generic: "Budesonide (inhaled)", category: "Lungs & Asthma", forms: ["Inhaler 100mcg","Inhaler 200mcg","Turbuhaler 100mcg","Turbuhaler 200mcg","Turbuhaler 400mcg","Nebuliser suspension"], rx: true },
  { generic: "Fluticasone (inhaled)", category: "Lungs & Asthma", forms: ["Inhaler 50mcg","Inhaler 100mcg","Inhaler 250mcg","Accuhaler 100mcg","Accuhaler 250mcg","Accuhaler 500mcg"], rx: true },
  { generic: "Beclometasone (inhaled)", category: "Lungs & Asthma", forms: ["Inhaler 50mcg","Inhaler 100mcg","Inhaler 200mcg","Inhaler 250mcg"], rx: true },
  { generic: "Ciclesonide", category: "Lungs & Asthma", forms: ["Inhaler 80mcg","Inhaler 160mcg"], rx: true },
  { generic: "Budesonide + Formoterol", category: "Lungs & Asthma", forms: ["Inhaler 80/4.5mcg","Inhaler 160/4.5mcg","Inhaler 320/9mcg","Turbuhaler 80/4.5mcg","Turbuhaler 160/4.5mcg"], rx: true },
  { generic: "Fluticasone + Salmeterol", category: "Lungs & Asthma", forms: ["Inhaler 25/50mcg","Inhaler 25/125mcg","Inhaler 25/250mcg","Accuhaler 50/100mcg","Accuhaler 50/250mcg","Accuhaler 50/500mcg"], rx: true },
  { generic: "Fluticasone furoate + Vilanterol", category: "Lungs & Asthma", forms: ["Inhaler 92/22mcg","Inhaler 184/22mcg"], rx: true },
  { generic: "Tiotropium", category: "Lungs & Asthma", forms: ["Capsule for inhalation 18mcg","Soft mist inhaler 2.5mcg"], rx: true },
  { generic: "Umeclidinium", category: "Lungs & Asthma", forms: ["Inhaler 55mcg"], rx: true },
  { generic: "Glycopyrronium", category: "Lungs & Asthma", forms: ["Inhaler 44mcg","Capsule for inhalation 50mcg"], rx: true },
  { generic: "Ipratropium (inhaled)", category: "Lungs & Asthma", forms: ["Inhaler 20mcg","Nebuliser solution 250mcg/ml"], rx: true },
  { generic: "Montelukast", category: "Lungs & Asthma", forms: ["Tablet 4mg","Tablet 5mg","Tablet 10mg","Sachet 4mg"], rx: true },
  { generic: "Theophylline", category: "Lungs & Asthma", forms: ["Tablet SR 100mg","Tablet SR 200mg","Tablet SR 300mg","Tablet SR 400mg","Syrup 60mg/5ml"], rx: true },
  { generic: "Prednisolone (oral)", category: "Lungs & Asthma", forms: ["Tablet 5mg","Tablet 25mg","Oral solution 5mg/5ml"], rx: true },
  { generic: "Roflumilast", category: "Lungs & Asthma", forms: ["Tablet 250mcg","Tablet 500mcg"], rx: true },
  { generic: "Omalizumab", category: "Lungs & Asthma", forms: ["Solution for injection 75mg","Solution for injection 150mg"], rx: true },
  { generic: "Benralizumab", category: "Lungs & Asthma", forms: ["Solution for injection 30mg"], rx: true },
  { generic: "Mepolizumab", category: "Lungs & Asthma", forms: ["Powder for injection 100mg"], rx: true },

  // VITAMINS & SUPPLEMENTS
  { generic: "Vitamin D3 (cholecalciferol)", category: "Vitamins & Supplements", forms: ["Tablet 400IU","Tablet 800IU","Tablet 1000IU","Tablet 2000IU","Tablet 4000IU","Drops 400IU/drop","Oral solution 600IU/ml"], rx: false },
  { generic: "Vitamin B12 (cyanocobalamin)", category: "Vitamins & Supplements", forms: ["Tablet 1mg","Tablet 50mcg","Tablet 500mcg","Oral solution"], rx: false },
  { generic: "Folic acid", category: "Vitamins & Supplements", forms: ["Tablet 0.4mg","Tablet 0.5mg","Tablet 5mg","Syrup 2.5mg/5ml"], rx: false },
  { generic: "Iron (ferrous sulphate)", category: "Vitamins & Supplements", forms: ["Tablet 200mg","Tablet 325mg","Drops 25mg/ml","Syrup 45mg/5ml"], rx: false },
  { generic: "Iron (ferrous fumarate)", category: "Vitamins & Supplements", forms: ["Tablet 210mg","Tablet 322mg","Syrup 45mg/5ml"], rx: false },
  { generic: "Iron (ferrous gluconate)", category: "Vitamins & Supplements", forms: ["Tablet 300mg","Solution 25mg/ml"], rx: false },
  { generic: "Calcium + Vitamin D", category: "Vitamins & Supplements", forms: ["Tablet 500/400IU","Tablet 1000/800IU","Effervescent tablet","Chewable tablet"], rx: false },
  { generic: "Magnesium", category: "Vitamins & Supplements", forms: ["Tablet 375mg","Tablet 500mg","Effervescent tablet 300mg","Oral solution 300mg/5ml"], rx: false },
  { generic: "Potassium chloride", category: "Vitamins & Supplements", forms: ["Tablet SR 600mg","Tablet SR 750mg","Effervescent tablet","Powder"], rx: true },
  { generic: "Zinc", category: "Vitamins & Supplements", forms: ["Tablet 10mg","Tablet 45mg","Effervescent tablet","Oral solution"], rx: false },
  { generic: "Vitamin A", category: "Vitamins & Supplements", forms: ["Capsule 800mcg","Drops"], rx: false },
  { generic: "Vitamin C (ascorbic acid)", category: "Vitamins & Supplements", forms: ["Tablet 100mg","Tablet 250mg","Tablet 500mg","Tablet 1000mg","Effervescent tablet 1000mg"], rx: false },
  { generic: "Vitamin E (tocopherol)", category: "Vitamins & Supplements", forms: ["Capsule 100mg","Capsule 400mg","Tablet 200mg"], rx: false },
  { generic: "Vitamin K (phytomenadione)", category: "Vitamins & Supplements", forms: ["Tablet 10mg","Drops 2mg/0.1ml"], rx: false },
  { generic: "Thiamine (B1)", category: "Vitamins & Supplements", forms: ["Tablet 50mg","Tablet 100mg","Tablet 300mg"], rx: false },
  { generic: "Riboflavin (B2)", category: "Vitamins & Supplements", forms: ["Tablet 10mg","Tablet 50mg"], rx: false },
  { generic: "Niacin (B3)", category: "Vitamins & Supplements", forms: ["Tablet 100mg","Tablet 500mg SR"], rx: false },
  { generic: "Pyridoxine (B6)", category: "Vitamins & Supplements", forms: ["Tablet 10mg","Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: false },
  { generic: "Biotin (B7)", category: "Vitamins & Supplements", forms: ["Tablet 5mg","Tablet 10mg"], rx: false },
  { generic: "Selenium", category: "Vitamins & Supplements", forms: ["Tablet 55mcg","Tablet 100mcg","Tablet 200mcg"], rx: false },
  { generic: "Iodine", category: "Vitamins & Supplements", forms: ["Tablet 100mcg","Tablet 150mcg","Drops"], rx: false },

  // EYE & EAR
  { generic: "Chloramphenicol (eye)", category: "Eye & Ear", forms: ["Eye drops 0.5%","Eye ointment 1%"], rx: false },
  { generic: "Tobramycin (eye)", category: "Eye & Ear", forms: ["Eye drops 0.3%","Eye ointment 0.3%"], rx: true },
  { generic: "Gentamicin (eye)", category: "Eye & Ear", forms: ["Eye drops 0.3%","Eye ointment 0.3%"], rx: true },
  { generic: "Ciprofloxacin (eye)", category: "Eye & Ear", forms: ["Eye drops 0.3%","Eye ointment 0.3%"], rx: true },
  { generic: "Levofloxacin (eye)", category: "Eye & Ear", forms: ["Eye drops 0.5%"], rx: true },
  { generic: "Moxifloxacin (eye)", category: "Eye & Ear", forms: ["Eye drops 0.5%"], rx: true },
  { generic: "Dexamethasone (eye)", category: "Eye & Ear", forms: ["Eye drops 0.1%","Eye ointment 0.1%"], rx: true },
  { generic: "Prednisolone (eye)", category: "Eye & Ear", forms: ["Eye drops 0.5%","Eye drops 1%"], rx: true },
  { generic: "Latanoprost", category: "Eye & Ear", forms: ["Eye drops 0.005%"], rx: true },
  { generic: "Bimatoprost", category: "Eye & Ear", forms: ["Eye drops 0.01%","Eye drops 0.03%"], rx: true },
  { generic: "Travoprost", category: "Eye & Ear", forms: ["Eye drops 0.004%"], rx: true },
  { generic: "Timolol (eye)", category: "Eye & Ear", forms: ["Eye drops 0.25%","Eye drops 0.5%","Eye gel 0.1%"], rx: true },
  { generic: "Dorzolamide", category: "Eye & Ear", forms: ["Eye drops 2%"], rx: true },
  { generic: "Brimonidine", category: "Eye & Ear", forms: ["Eye drops 0.15%","Eye drops 0.2%"], rx: true },
  { generic: "Hyaluronic acid (eye)", category: "Eye & Ear", forms: ["Eye drops 0.1%","Eye drops 0.2%","Eye drops 0.18%"], rx: false },
  { generic: "Sodium cromoglicate (eye)", category: "Eye & Ear", forms: ["Eye drops 2%","Eye drops 4%"], rx: false },
  { generic: "Emedastine (eye)", category: "Eye & Ear", forms: ["Eye drops 0.05%"], rx: false },
  { generic: "Olopatadine (eye)", category: "Eye & Ear", forms: ["Eye drops 0.1%","Eye drops 0.2%"], rx: false },
  { generic: "Phenazone + Lidocaine (ear)", category: "Eye & Ear", forms: ["Ear drops"], rx: false },
  { generic: "Urea peroxide (ear)", category: "Eye & Ear", forms: ["Ear drops 5%","Ear drops 6.5%"], rx: false },
  { generic: "Acetic acid (ear)", category: "Eye & Ear", forms: ["Ear drops 2%"], rx: false },
  { generic: "Ciprofloxacin (ear)", category: "Eye & Ear", forms: ["Ear drops 0.2%","Ear drops 0.3%"], rx: true },

  // ANTICOAGULANTS
  { generic: "Acenocoumarol", category: "Anticoagulants", forms: ["Tablet 1mg","Tablet 4mg"], rx: true },
  { generic: "Warfarin", category: "Anticoagulants", forms: ["Tablet 0.5mg","Tablet 1mg","Tablet 2mg","Tablet 3mg","Tablet 5mg","Tablet 10mg"], rx: true },
  { generic: "Phenprocoumon", category: "Anticoagulants", forms: ["Tablet 3mg"], rx: true },
  { generic: "Rivaroxaban", category: "Anticoagulants", forms: ["Tablet 2.5mg","Tablet 10mg","Tablet 15mg","Tablet 20mg"], rx: true },
  { generic: "Apixaban", category: "Anticoagulants", forms: ["Tablet 2.5mg","Tablet 5mg"], rx: true },
  { generic: "Dabigatran", category: "Anticoagulants", forms: ["Capsule 75mg","Capsule 110mg","Capsule 150mg"], rx: true },
  { generic: "Edoxaban", category: "Anticoagulants", forms: ["Tablet 15mg","Tablet 30mg","Tablet 60mg"], rx: true },
  { generic: "Aspirin (cardio)", category: "Anticoagulants", forms: ["Tablet 75mg","Tablet 100mg","Tablet 300mg","Tablet EC 75mg","Tablet EC 100mg"], rx: false },
  { generic: "Clopidogrel", category: "Anticoagulants", forms: ["Tablet 75mg","Tablet 300mg"], rx: true },
  { generic: "Ticagrelor", category: "Anticoagulants", forms: ["Tablet 60mg","Tablet 90mg"], rx: true },
  { generic: "Prasugrel", category: "Anticoagulants", forms: ["Tablet 5mg","Tablet 10mg"], rx: true },
  { generic: "Dipyridamole", category: "Anticoagulants", forms: ["Tablet 25mg","Tablet 75mg","Capsule SR 200mg"], rx: true },
  { generic: "Enoxaparin", category: "Anticoagulants", forms: ["Syringe 20mg/0.2ml","Syringe 40mg/0.4ml","Syringe 60mg/0.6ml","Syringe 80mg/0.8ml"], rx: true },

  // FIRST AID
  { generic: "Povidone-iodine (wound)", category: "First Aid", forms: ["Solution 10%","Ointment 10%","Spray","Wound dressing"], rx: false },
  { generic: "Hydrogen peroxide", category: "First Aid", forms: ["Solution 3%","Gel 3%"], rx: false },
  { generic: "Chlorhexidine (wound)", category: "First Aid", forms: ["Solution 0.05%","Solution 0.5%","Gel 0.5%","Wipes"], rx: false },
  { generic: "Activated charcoal", category: "First Aid", forms: ["Capsule 250mg","Tablet 250mg","Powder","Suspension"], rx: false },
  { generic: "Oral rehydration salts", category: "First Aid", forms: ["Sachet","Powder"], rx: false },
  { generic: "Lidocaine (topical)", category: "First Aid", forms: ["Gel 2%","Ointment 5%","Spray 10%"], rx: false },
  { generic: "Adrenaline (epinephrine)", category: "First Aid", forms: ["Auto-injector 0.15mg","Auto-injector 0.3mg"], rx: true },

  // ANTIFUNGALS
  { generic: "Fluconazole", category: "Antifungals", forms: ["Capsule 50mg","Capsule 100mg","Capsule 150mg","Capsule 200mg","Suspension 50mg/5ml"], rx: false },
  { generic: "Itraconazole", category: "Antifungals", forms: ["Capsule 100mg","Oral solution 10mg/ml"], rx: true },
  { generic: "Voriconazole", category: "Antifungals", forms: ["Tablet 50mg","Tablet 200mg"], rx: true },
  { generic: "Clotrimazole (vaginal)", category: "Antifungals", forms: ["Cream 2%","Pessary 100mg","Pessary 200mg","Pessary 500mg"], rx: false },
  { generic: "Miconazole (vaginal)", category: "Antifungals", forms: ["Cream 2%","Pessary 100mg","Pessary 1200mg","Ovule 400mg"], rx: false },
  { generic: "Nystatin", category: "Antifungals", forms: ["Tablet 500,000IU","Suspension 100,000IU/ml","Cream","Pessary 100,000IU"], rx: true },
  { generic: "Terbinafine (systemic)", category: "Antifungals", forms: ["Tablet 125mg","Tablet 250mg"], rx: false },

  // ANTIVIRALS
  { generic: "Aciclovir (systemic)", category: "Antivirals", forms: ["Tablet 200mg","Tablet 400mg","Tablet 800mg","Suspension 200mg/5ml"], rx: true },
  { generic: "Valaciclovir", category: "Antivirals", forms: ["Tablet 500mg","Tablet 1000mg"], rx: true },
  { generic: "Famciclovir", category: "Antivirals", forms: ["Tablet 125mg","Tablet 250mg","Tablet 500mg"], rx: true },
  { generic: "Oseltamivir", category: "Antivirals", forms: ["Capsule 30mg","Capsule 45mg","Capsule 75mg","Suspension 6mg/ml"], rx: true },
  { generic: "Zanamivir", category: "Antivirals", forms: ["Inhaler 5mg/dose"], rx: true },
  { generic: "Nirmatrelvir + Ritonavir", category: "Antivirals", forms: ["Tablet 150/100mg"], rx: true },
  { generic: "Remdesivir", category: "Antivirals", forms: ["Solution for injection 100mg"], rx: true },

  // ANTIPARASITICS
  { generic: "Mebendazole", category: "Antiparasitics", forms: ["Tablet 100mg","Tablet 500mg","Suspension 100mg/5ml"], rx: false },
  { generic: "Albendazole", category: "Antiparasitics", forms: ["Tablet 400mg","Suspension 200mg/5ml"], rx: true },
  { generic: "Pyrantel", category: "Antiparasitics", forms: ["Tablet 125mg","Tablet 250mg","Suspension 250mg/5ml"], rx: false },
  { generic: "Permethrin", category: "Antiparasitics", forms: ["Cream 5%","Lotion 1%","Scalp lotion 1%"], rx: false },
  { generic: "Malathion", category: "Antiparasitics", forms: ["Lotion 0.5%","Shampoo 1%"], rx: false },
  { generic: "Dimethicone (head lice)", category: "Antiparasitics", forms: ["Lotion 4%","Spray 4%"], rx: false },
  { generic: "Ivermectin", category: "Antiparasitics", forms: ["Tablet 3mg","Cream 1%"], rx: true },

  // WOMEN'S HEALTH
  { generic: "Ethinylestradiol + Levonorgestrel", category: "Women's Health", forms: ["Tablet 30/150mcg","Tablet 20/100mcg"], rx: true },
  { generic: "Ethinylestradiol + Gestodene", category: "Women's Health", forms: ["Tablet 30/75mcg","Tablet 20/75mcg","Tablet 15/60mcg"], rx: true },
  { generic: "Ethinylestradiol + Desogestrel", category: "Women's Health", forms: ["Tablet 30/150mcg","Tablet 20/150mcg"], rx: true },
  { generic: "Ethinylestradiol + Norgestimate", category: "Women's Health", forms: ["Tablet 35/250mcg"], rx: true },
  { generic: "Ethinylestradiol + Drospirenone", category: "Women's Health", forms: ["Tablet 30/3mg","Tablet 20/3mg"], rx: true },
  { generic: "Ethinylestradiol + Cyproterone", category: "Women's Health", forms: ["Tablet 35/2mg"], rx: true },
  { generic: "Desogestrel (progestogen-only)", category: "Women's Health", forms: ["Tablet 75mcg"], rx: true },
  { generic: "Levonorgestrel (emergency)", category: "Women's Health", forms: ["Tablet 1.5mg","Tablet 750mcg x2"], rx: false },
  { generic: "Ulipristal (emergency)", category: "Women's Health", forms: ["Tablet 30mg"], rx: false },
  { generic: "Medroxyprogesterone", category: "Women's Health", forms: ["Tablet 2.5mg","Tablet 5mg","Tablet 10mg","Injection 150mg/ml"], rx: true },
  { generic: "Progesterone (micronised)", category: "Women's Health", forms: ["Capsule 100mg","Capsule 200mg","Vaginal gel 8%"], rx: true },
  { generic: "Norethisterone", category: "Women's Health", forms: ["Tablet 350mcg","Tablet 5mg"], rx: true },
  { generic: "Estradiol", category: "Women's Health", forms: ["Tablet 1mg","Tablet 2mg","Patch 25mcg/24h","Patch 50mcg/24h","Gel 0.5mg/dose","Gel 1mg/dose","Nasal spray"], rx: true },
  { generic: "Conjugated oestrogens", category: "Women's Health", forms: ["Tablet 0.3mg","Tablet 0.625mg","Cream"], rx: true },
  { generic: "Tibolone", category: "Women's Health", forms: ["Tablet 2.5mg"], rx: true },
  { generic: "Raloxifene", category: "Women's Health", forms: ["Tablet 60mg"], rx: true },
  { generic: "Clomifene", category: "Women's Health", forms: ["Tablet 50mg"], rx: true },

  // JOINTS & MUSCLES
  { generic: "Prednisolone (systemic)", category: "Joints & Muscles", forms: ["Tablet 1mg","Tablet 2.5mg","Tablet 5mg","Tablet 10mg","Tablet 20mg","Tablet 25mg","Soluble tablet 5mg","Oral solution 1mg/ml"], rx: true },
  { generic: "Prednisone", category: "Joints & Muscles", forms: ["Tablet 1mg","Tablet 5mg","Tablet 10mg","Tablet 20mg","Tablet 50mg"], rx: true },
  { generic: "Methylprednisolone (systemic)", category: "Joints & Muscles", forms: ["Tablet 4mg","Tablet 8mg","Tablet 16mg","Tablet 32mg","Tablet 100mg"], rx: true },
  { generic: "Dexamethasone (systemic)", category: "Joints & Muscles", forms: ["Tablet 0.5mg","Tablet 1mg","Tablet 2mg","Tablet 4mg","Oral solution 2mg/5ml"], rx: true },
  { generic: "Allopurinol", category: "Joints & Muscles", forms: ["Tablet 100mg","Tablet 200mg","Tablet 300mg"], rx: true },
  { generic: "Febuxostat", category: "Joints & Muscles", forms: ["Tablet 80mg","Tablet 120mg"], rx: true },
  { generic: "Colchicine", category: "Joints & Muscles", forms: ["Tablet 0.5mg","Tablet 1mg","Capsule 500mcg"], rx: true },
  { generic: "Methotrexate", category: "Joints & Muscles", forms: ["Tablet 2.5mg","Tablet 10mg","Solution for injection 10mg/ml"], rx: true },
  { generic: "Hydroxychloroquine", category: "Joints & Muscles", forms: ["Tablet 200mg","Tablet 400mg"], rx: true },
  { generic: "Leflunomide", category: "Joints & Muscles", forms: ["Tablet 10mg","Tablet 20mg"], rx: true },
  { generic: "Sulfasalazine", category: "Joints & Muscles", forms: ["Tablet 500mg","Tablet EC 500mg"], rx: true },
  { generic: "Cyclosporin", category: "Joints & Muscles", forms: ["Capsule 10mg","Capsule 25mg","Capsule 50mg","Capsule 100mg","Oral solution 100mg/ml"], rx: true },
  { generic: "Baclofen", category: "Joints & Muscles", forms: ["Tablet 5mg","Tablet 10mg","Tablet 25mg"], rx: true },
  { generic: "Tizanidine", category: "Joints & Muscles", forms: ["Tablet 2mg","Tablet 4mg","Capsule SR 6mg"], rx: true },
  { generic: "Methocarbamol", category: "Joints & Muscles", forms: ["Tablet 500mg","Tablet 750mg"], rx: false },
  { generic: "Carisoprodol", category: "Joints & Muscles", forms: ["Tablet 350mg"], rx: true },

  // NERVOUS SYSTEM
  { generic: "Levetiracetam", category: "Nervous System", forms: ["Tablet 250mg","Tablet 500mg","Tablet 750mg","Tablet 1000mg","Oral solution 100mg/ml"], rx: true },
  { generic: "Valproate", category: "Nervous System", forms: ["Tablet 200mg","Tablet 500mg","Tablet SR 200mg","Tablet SR 500mg","Syrup 200mg/5ml"], rx: true },
  { generic: "Lamotrigine", category: "Nervous System", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg","Tablet 200mg","Dispersible tablet 2mg","Dispersible tablet 5mg","Dispersible tablet 25mg"], rx: true },
  { generic: "Gabapentin", category: "Nervous System", forms: ["Capsule 100mg","Capsule 300mg","Capsule 400mg","Tablet 600mg","Tablet 800mg","Oral solution 50mg/ml"], rx: true },
  { generic: "Pregabalin", category: "Nervous System", forms: ["Capsule 25mg","Capsule 50mg","Capsule 75mg","Capsule 100mg","Capsule 150mg","Capsule 200mg","Capsule 225mg","Capsule 300mg","Oral solution 20mg/ml"], rx: true },
  { generic: "Carbamazepine", category: "Nervous System", forms: ["Tablet 100mg","Tablet 200mg","Tablet 400mg","Tablet SR 200mg","Tablet SR 400mg","Suspension 100mg/5ml"], rx: true },
  { generic: "Oxcarbazepine", category: "Nervous System", forms: ["Tablet 150mg","Tablet 300mg","Tablet 600mg","Suspension 300mg/5ml"], rx: true },
  { generic: "Phenytoin", category: "Nervous System", forms: ["Capsule 25mg","Capsule 50mg","Capsule 100mg","Suspension 30mg/5ml"], rx: true },
  { generic: "Topiramate", category: "Nervous System", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg","Tablet 200mg","Capsule sprinkle 15mg","Capsule sprinkle 25mg"], rx: true },
  { generic: "Zonisamide", category: "Nervous System", forms: ["Capsule 25mg","Capsule 50mg","Capsule 100mg"], rx: true },
  { generic: "Clonazepam (epilepsy)", category: "Nervous System", forms: ["Tablet 0.5mg","Tablet 2mg","Drops 2.5mg/ml"], rx: true },
  { generic: "Sodium valproate", category: "Nervous System", forms: ["Granules SR 50mg","Granules SR 100mg","Granules SR 250mg","Granules SR 500mg"], rx: true },
  { generic: "Donepezil", category: "Nervous System", forms: ["Tablet 5mg","Tablet 10mg","Orally disintegrating tablet 5mg","Orally disintegrating tablet 10mg"], rx: true },
  { generic: "Rivastigmine", category: "Nervous System", forms: ["Capsule 1.5mg","Capsule 3mg","Capsule 4.5mg","Capsule 6mg","Oral solution 2mg/ml","Patch 4.6mg/24h","Patch 9.5mg/24h"], rx: true },
  { generic: "Galantamine", category: "Nervous System", forms: ["Tablet 4mg","Tablet 8mg","Tablet 12mg","Capsule SR 8mg","Capsule SR 16mg","Capsule SR 24mg"], rx: true },
  { generic: "Memantine", category: "Nervous System", forms: ["Tablet 10mg","Tablet 20mg","Oral solution 5mg/ml"], rx: true },
  { generic: "Levodopa + Carbidopa", category: "Nervous System", forms: ["Tablet 50/12.5mg","Tablet 100/25mg","Tablet 250/25mg","Tablet SR 100/25mg","Tablet SR 200/50mg"], rx: true },
  { generic: "Levodopa + Benserazide", category: "Nervous System", forms: ["Capsule 50/12.5mg","Capsule 100/25mg","Capsule 200/50mg","Dispersible tablet 50/12.5mg","Dispersible tablet 100/25mg"], rx: true },
  { generic: "Pramipexole", category: "Nervous System", forms: ["Tablet 0.088mg","Tablet 0.18mg","Tablet 0.35mg","Tablet 0.7mg","Tablet SR 0.26mg","Tablet SR 0.52mg","Tablet SR 1.05mg","Tablet SR 2.1mg"], rx: true },
  { generic: "Ropinirole", category: "Nervous System", forms: ["Tablet 0.25mg","Tablet 0.5mg","Tablet 1mg","Tablet 2mg","Tablet 5mg","Tablet SR 2mg","Tablet SR 4mg","Tablet SR 8mg"], rx: true },
  { generic: "Amantadine", category: "Nervous System", forms: ["Tablet 100mg","Capsule 100mg","Syrup 50mg/5ml"], rx: true },

  // MIGRAINE
  { generic: "Sumatriptan", category: "Migraine", forms: ["Tablet 50mg","Tablet 100mg","Nasal spray 10mg","Nasal spray 20mg","Auto-injector 6mg"], rx: true },
  { generic: "Rizatriptan", category: "Migraine", forms: ["Tablet 5mg","Tablet 10mg","Orally disintegrating tablet 5mg","Orally disintegrating tablet 10mg"], rx: true },
  { generic: "Zolmitriptan", category: "Migraine", forms: ["Tablet 2.5mg","Tablet 5mg","Orally disintegrating tablet 2.5mg","Nasal spray 5mg"], rx: true },
  { generic: "Eletriptan", category: "Migraine", forms: ["Tablet 20mg","Tablet 40mg","Tablet 80mg"], rx: true },
  { generic: "Almotriptan", category: "Migraine", forms: ["Tablet 6.25mg","Tablet 12.5mg"], rx: true },
  { generic: "Frovatriptan", category: "Migraine", forms: ["Tablet 2.5mg"], rx: true },
  { generic: "Naratriptan", category: "Migraine", forms: ["Tablet 1mg","Tablet 2.5mg"], rx: true },
  { generic: "Propranolol (migraine)", category: "Migraine", forms: ["Tablet 10mg","Tablet 40mg","Tablet SR 80mg","Tablet SR 160mg"], rx: true },
  { generic: "Metoprolol (migraine)", category: "Migraine", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Amitriptyline (migraine)", category: "Migraine", forms: ["Tablet 10mg","Tablet 25mg"], rx: true },
  { generic: "Topiramate (migraine)", category: "Migraine", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Flunarizine", category: "Migraine", forms: ["Capsule 5mg","Capsule 10mg"], rx: true },
  { generic: "Valproate (migraine)", category: "Migraine", forms: ["Tablet 200mg","Tablet 500mg","Tablet SR 500mg"], rx: true },
  { generic: "Erenumab", category: "Migraine", forms: ["Solution for injection 70mg","Solution for injection 140mg"], rx: true },
  { generic: "Fremanezumab", category: "Migraine", forms: ["Solution for injection 225mg"], rx: true },
  { generic: "Galcanezumab", category: "Migraine", forms: ["Solution for injection 120mg"], rx: true },

  // SMOKING CESSATION
  { generic: "Nicotine patch", category: "Smoking Cessation", forms: ["Patch 7mg/24h","Patch 14mg/24h","Patch 21mg/24h","Patch 10mg/16h","Patch 15mg/16h","Patch 25mg/16h"], rx: false },
  { generic: "Nicotine gum", category: "Smoking Cessation", forms: ["Gum 2mg","Gum 4mg"], rx: false },
  { generic: "Nicotine lozenge", category: "Smoking Cessation", forms: ["Lozenge 1mg","Lozenge 1.5mg","Lozenge 2mg","Lozenge 4mg"], rx: false },
  { generic: "Nicotine inhaler", category: "Smoking Cessation", forms: ["Inhaler 10mg"], rx: false },
  { generic: "Nicotine nasal spray", category: "Smoking Cessation", forms: ["Nasal spray 500mcg/dose"], rx: false },
  { generic: "Varenicline", category: "Smoking Cessation", forms: ["Tablet 0.5mg","Tablet 1mg","Tablet 2mg SR"], rx: true },
  { generic: "Bupropion (smoking)", category: "Smoking Cessation", forms: ["Tablet SR 150mg"], rx: true },
  { generic: "Cytisine", category: "Smoking Cessation", forms: ["Tablet 1.5mg"], rx: true },

  // UROLOGY
  { generic: "Tamsulosin", category: "Urology", forms: ["Capsule SR 0.4mg","Tablet SR 0.4mg"], rx: true },
  { generic: "Alfuzosin", category: "Urology", forms: ["Tablet SR 10mg","Tablet 2.5mg"], rx: true },
  { generic: "Doxazosin (BPH)", category: "Urology", forms: ["Tablet 1mg","Tablet 2mg","Tablet 4mg","Tablet 8mg"], rx: true },
  { generic: "Finasteride", category: "Urology", forms: ["Tablet 1mg","Tablet 5mg"], rx: true },
  { generic: "Dutasteride", category: "Urology", forms: ["Capsule 0.5mg"], rx: true },
  { generic: "Oxybutynin", category: "Urology", forms: ["Tablet 2.5mg","Tablet 5mg","Syrup 2.5mg/5ml","Patch 36mg"], rx: true },
  { generic: "Solifenacin", category: "Urology", forms: ["Tablet 5mg","Tablet 10mg","Oral suspension 5mg/5ml"], rx: true },
  { generic: "Tolterodine", category: "Urology", forms: ["Tablet 1mg","Tablet 2mg","Capsule SR 2mg","Capsule SR 4mg"], rx: true },
  { generic: "Mirabegron", category: "Urology", forms: ["Tablet SR 25mg","Tablet SR 50mg"], rx: true },
  { generic: "Fesoterodine", category: "Urology", forms: ["Tablet SR 4mg","Tablet SR 8mg"], rx: true },
  { generic: "Sildenafil", category: "Urology", forms: ["Tablet 25mg","Tablet 50mg","Tablet 100mg"], rx: true },
  { generic: "Tadalafil", category: "Urology", forms: ["Tablet 2.5mg","Tablet 5mg","Tablet 10mg","Tablet 20mg"], rx: true },
  { generic: "Vardenafil", category: "Urology", forms: ["Tablet 5mg","Tablet 10mg","Tablet 20mg","Orally disintegrating tablet 10mg"], rx: true },
  { generic: "Avanafil", category: "Urology", forms: ["Tablet 50mg","Tablet 100mg","Tablet 200mg"], rx: true },
  { generic: "Desmopressin", category: "Urology", forms: ["Tablet 0.1mg","Tablet 0.2mg","Nasal spray","Oral lyophilisate 60mcg","Oral lyophilisate 120mcg","Oral lyophilisate 240mcg"], rx: true },

  // CORTICOSTEROIDS
  { generic: "Hydrocortisone (systemic)", category: "Corticosteroids", forms: ["Tablet 10mg","Tablet 20mg","Capsule SR 5mg","Capsule SR 10mg","Capsule SR 20mg"], rx: true },
  { generic: "Fludrocortisone", category: "Corticosteroids", forms: ["Tablet 0.1mg"], rx: true },
  { generic: "Betamethasone (systemic)", category: "Corticosteroids", forms: ["Tablet 0.5mg","Soluble tablet 0.5mg"], rx: true },
  { generic: "Triamcinolone (systemic)", category: "Corticosteroids", forms: ["Tablet 4mg"], rx: true },
  { generic: "Budesonide (oral)", category: "Corticosteroids", forms: ["Capsule SR 3mg","Granules SR 9mg","Tablet SR 9mg"], rx: true },

  // ORAL CARE
  { generic: "Chlorhexidine (oral)", category: "Oral Care", forms: ["Mouthwash 0.12%","Mouthwash 0.2%","Gel 1%","Spray"], rx: false },
  { generic: "Miconazole (oral)", category: "Oral Care", forms: ["Gel 20mg/g","Oral gel 24mg/ml"], rx: true },
  { generic: "Nystatin (oral)", category: "Oral Care", forms: ["Suspension 100,000IU/ml","Pastilles 100,000IU"], rx: true },
  { generic: "Benzydamine", category: "Oral Care", forms: ["Mouthwash 0.15%","Spray 0.15%"], rx: false },
  { generic: "Lignocaine (oral)", category: "Oral Care", forms: ["Gel 2%","Ointment 5%","Viscous solution 2%"], rx: false },
];

// Standalone branded combination products per country (not mappable to a single generic)
const STANDALONE_BRANDS = {
  ca: [
    // Cough & Cold
    { name: "Buckley's Complete Syrup",         generic: "DM + Guaifenesin",               category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Buckley's Complete Caplets",        generic: "DM + Guaifenesin",               category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Buckley's Mixture",                 generic: "DM + Ammonium carbonate",        category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Buckley's DM Syrup",                generic: "Dextromethorphan",               category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Benylin All-In-One Syrup",          generic: "DXM + Guaifenesin + Phenylephrine", category: "Cough & Cold",     form: "Syrup",   rx: false },
    { name: "Benylin DM Syrup",                  generic: "Dextromethorphan",               category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Benylin DM-D Syrup",                generic: "DXM + Pseudoephedrine",          category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Benylin DM-E Syrup",                generic: "DXM + Guaifenesin",              category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Benylin Extra Strength",            generic: "DXM + Guaifenesin",              category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Robitussin DM Syrup",               generic: "DXM + Guaifenesin",              category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Robitussin AC Syrup",               generic: "Codeine + Guaifenesin",          category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Robitussin CF Syrup",               generic: "DXM + Guaifenesin + Phenylephrine", category: "Cough & Cold",     form: "Syrup",   rx: false },
    { name: "NyQuil Complete Caplets",           generic: "Acetaminophen + DXM + Doxylamine", category: "Cough & Cold",     form: "Tablet",  rx: false },
    { name: "NyQuil Cold & Flu Liquid",          generic: "Acetaminophen + DXM + Doxylamine", category: "Cough & Cold",     form: "Syrup",   rx: false },
    { name: "DayQuil Cold & Flu Liquid",         generic: "Acetaminophen + DXM + Phenylephrine", category: "Cough & Cold",  form: "Syrup",   rx: false },
    { name: "DayQuil Complete Caplets",          generic: "Acetaminophen + DXM + Phenylephrine", category: "Cough & Cold",  form: "Tablet",  rx: false },
    { name: "Dristan Nasal Spray",               generic: "Oxymetazoline",                  category: "Cough & Cold",        form: "Nasal spray", rx: false },
    { name: "Otrivin Nasal Spray",               generic: "Xylometazoline",                 category: "Cough & Cold",        form: "Nasal spray", rx: false },
    { name: "Otrivin Plus Nasal Spray",          generic: "Xylometazoline + Ipratropium",   category: "Cough & Cold",        form: "Nasal spray", rx: false },
    { name: "Sudafed Sinus Advance",             generic: "Pseudoephedrine + Ibuprofen",    category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Contac Cold + Flu Day",             generic: "Acetaminophen + Pseudoephedrine",category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Sinutab Sinus Allergy",             generic: "Acetaminophen + Chlorpheniramine", category: "Cough & Cold",      form: "Tablet",  rx: false },
    { name: "Vicks Nyquil Severe",               generic: "Acetaminophen + DXM + Phenylephrine + Doxylamine", category: "Cough & Cold", form: "Syrup", rx: false },
    { name: "Vicks VapoRub",                     generic: "Camphor + Menthol + Eucalyptol", category: "Cough & Cold",        form: "Ointment", rx: false },
    { name: "Neo Citran Extra Strength",         generic: "Acetaminophen + Phenylephrine",  category: "Cough & Cold",        form: "Powder",  rx: false },
    { name: "Fisherman's Friend Lozenges",       generic: "Menthol + Eucalyptus",           category: "Cough & Cold",        form: "Lozenge", rx: false },
    { name: "Halls Menthol Drops",               generic: "Menthol",                        category: "Cough & Cold",        form: "Lozenge", rx: false },
    { name: "Strepsils Lozenges",                generic: "Amylmetacresol + Dichlorobenzyl alcohol", category: "Cough & Cold", form: "Lozenge", rx: false },
    // Allergy
    { name: "Reactine 10mg",                     generic: "Cetirizine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Reactine Rapid Dissolve",           generic: "Cetirizine",                     category: "Allergy",             form: "Orally disintegrating tablet", rx: false },
    { name: "Aerius 5mg",                        generic: "Desloratadine",                  category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Claritin 10mg",                     generic: "Loratadine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Claritin Liqui-Gels",               generic: "Loratadine",                     category: "Allergy",             form: "Capsule", rx: false },
    { name: "Benadryl Allergy Liqui-Gels",       generic: "Diphenhydramine",                category: "Allergy",             form: "Capsule", rx: false },
    { name: "Benadryl Allergy Tablets",          generic: "Diphenhydramine",                category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Flonase Allergy Relief",            generic: "Fluticasone propionate nasal",   category: "Allergy",             form: "Nasal spray", rx: false },
    { name: "Nasonex 50mcg",                     generic: "Mometasone nasal",               category: "Allergy",             form: "Nasal spray", rx: false },
    // Pain & Fever
    { name: "Tylenol Extra Strength 500mg",      generic: "Paracetamol",                    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Tylenol Regular Strength 325mg",    generic: "Paracetamol",                    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Tylenol Children's Suspension",     generic: "Paracetamol",                    category: "Pain & Fever",        form: "Suspension", rx: false },
    { name: "Tylenol Complete Cold, Cough & Flu",generic: "Acetaminophen + DXM + Phenylephrine", category: "Pain & Fever",  form: "Tablet",  rx: false },
    { name: "Advil Extra Strength 400mg",        generic: "Ibuprofen",                      category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Advil Liqui-Gels 200mg",            generic: "Ibuprofen",                      category: "Pain & Fever",        form: "Capsule", rx: false },
    { name: "Advil Cold & Sinus",                generic: "Ibuprofen + Pseudoephedrine",    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Aleve 220mg",                       generic: "Naproxen",                       category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Robaxacet",                         generic: "Methocarbamol + Paracetamol",    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Robaxisal",                         generic: "Methocarbamol + Aspirin",        category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "222 Tablets",                       generic: "ASA + Codeine + Caffeine",       category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Mersyndol with Codeine",            generic: "Paracetamol + Codeine + Doxylamine", category: "Pain & Fever",   form: "Tablet",  rx: false },
    // Stomach & Intestine
    { name: "Pepto-Bismol Liquid",               generic: "Bismuth subsalicylate",          category: "Stomach & Intestine", form: "Suspension", rx: false },
    { name: "Pepto-Bismol Chewable",             generic: "Bismuth subsalicylate",          category: "Stomach & Intestine", form: "Chewable tablet", rx: false },
    { name: "Imodium Caplets 2mg",               generic: "Loperamide",                     category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Imodium Quick Dissolve",            generic: "Loperamide",                     category: "Stomach & Intestine", form: "Orally disintegrating tablet", rx: false },
    { name: "Gaviscon Regular Strength",         generic: "Alginic acid + Aluminum hydroxide", category: "Stomach & Intestine", form: "Tablet", rx: false },
    { name: "Gaviscon Extra Strength Liquid",    generic: "Alginic acid + Magnesium carbonate", category: "Stomach & Intestine", form: "Suspension", rx: false },
    { name: "Tums Regular Strength",             generic: "Calcium carbonate",              category: "Stomach & Intestine", form: "Chewable tablet", rx: false },
    { name: "Tums Extra Strength",               generic: "Calcium carbonate",              category: "Stomach & Intestine", form: "Chewable tablet", rx: false },
    { name: "Maalox",                            generic: "Aluminum hydroxide + Magnesium hydroxide", category: "Stomach & Intestine", form: "Suspension", rx: false },
    { name: "Zantac 75",                         generic: "Famotidine",                     category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Nexium 24HR 20mg",                  generic: "Esomeprazole",                   category: "Stomach & Intestine", form: "Capsule", rx: false },
    { name: "Dulcolax Tablets 5mg",              generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Dulcolax Suppositories 10mg",       generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Suppository", rx: false },
    { name: "Senokot Tablets",                   generic: "Senna",                          category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "RestoraLAX",                        generic: "Macrogol (PEG)",                 category: "Stomach & Intestine", form: "Powder",  rx: false },
    { name: "Gravol 50mg Tablets",               generic: "Dimenhydrinate",                 category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Gravol Liquid",                     generic: "Dimenhydrinate",                 category: "Stomach & Intestine", form: "Syrup",   rx: false },
    { name: "Gravol Ginger Chewable",            generic: "Ginger root extract",            category: "Stomach & Intestine", form: "Chewable tablet", rx: false },
    { name: "Metamucil Orange Powder",           generic: "Psyllium husk",                  category: "Stomach & Intestine", form: "Powder",  rx: false },
    // Skin & Wounds
    { name: "Polysporin Ointment",               generic: "Bacitracin + Polymyxin B",       category: "Skin & Wounds",       form: "Ointment", rx: false },
    { name: "Polysporin Complete Ointment",      generic: "Bacitracin + Polymyxin B + Gramicidin", category: "Skin & Wounds", form: "Ointment", rx: false },
    { name: "Polysporin Eye/Ear Drops",          generic: "Bacitracin + Polymyxin B",       category: "Eye & Ear",           form: "Drops",   rx: false },
    { name: "Hydrocortisone Cream 0.5%",         generic: "Hydrocortisone",                 category: "Skin & Wounds",       form: "Cream",   rx: false },
    { name: "Cortate Cream 0.5%",                generic: "Hydrocortisone",                 category: "Skin & Wounds",       form: "Cream",   rx: false },
    { name: "Benadryl Itch Relief Stick",        generic: "Diphenhydramine",                category: "Skin & Wounds",       form: "Stick",   rx: false },
    { name: "Canesten Cream 1%",                 generic: "Clotrimazole",                   category: "Antifungals",         form: "Cream",   rx: false },
    { name: "Canesten Vaginal Cream",            generic: "Clotrimazole",                   category: "Women's Health",      form: "Cream",   rx: false },
    { name: "Monistat 3",                        generic: "Miconazole",                     category: "Women's Health",      form: "Cream",   rx: false },
    { name: "Monistat 7",                        generic: "Miconazole",                     category: "Women's Health",      form: "Cream",   rx: false },
    { name: "Tinactin Cream 1%",                 generic: "Tolnaftate",                     category: "Antifungals",         form: "Cream",   rx: false },
    { name: "Voltaren Emulgel 1%",               generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Voltaren Emulgel Extra Strength 2%",generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Bengay Ultra Strength Cream",       generic: "Menthol + Methyl salicylate",    category: "Joints & Muscles",    form: "Cream",   rx: false },
    { name: "Rub A535 Heat Cream",               generic: "Methyl salicylate + Menthol",    category: "Joints & Muscles",    form: "Cream",   rx: false },
    // Sleep
    { name: "Unisom SleepTabs 25mg",             generic: "Diphenhydramine",                category: "Sleep & Sedation",    form: "Tablet",  rx: false },
    { name: "Nytol 25mg",                        generic: "Diphenhydramine",                category: "Sleep & Sedation",    form: "Tablet",  rx: false },
    // Vitamins
    { name: "Centrum Complete Multivitamin",     generic: "Multivitamin",                   category: "Vitamins & Supplements", form: "Tablet", rx: false },
    { name: "Jamieson Vitamin C 500mg",          generic: "Ascorbic acid",                  category: "Vitamins & Supplements", form: "Tablet", rx: false },
    { name: "Jamieson Vitamin D3 1000IU",        generic: "Cholecalciferol",                category: "Vitamins & Supplements", form: "Tablet", rx: false },
    { name: "Webber Naturals Vitamin D 1000IU",  generic: "Cholecalciferol",                category: "Vitamins & Supplements", form: "Softgel", rx: false },
    { name: "Fish Oil Omega-3 1000mg",           generic: "Omega-3 fatty acids",            category: "Vitamins & Supplements", form: "Softgel", rx: false },
  ],
  be: [
    // Pijn & Koorts
    { name: "Dafalgan Forte 1g",                 generic: "Paracetamol",                    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Dafalgan Odis 500mg",               generic: "Paracetamol",                    category: "Pain & Fever",        form: "Smelttablet", rx: false },
    { name: "Perdolan Mono 500mg",               generic: "Paracetamol",                    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Efferalgan 500mg Bruistablet",      generic: "Paracetamol",                    category: "Pain & Fever",        form: "Bruistablet", rx: false },
    { name: "Tradonal Odis 50mg",                generic: "Tramadol",                       category: "Pain & Fever",        form: "Smelttablet", rx: true },
    { name: "Contramal 100mg",                   generic: "Tramadol",                       category: "Pain & Fever",        form: "Capsule", rx: true },
    { name: "Voltaren Emulgel 1%",               generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Voltaren Emulgel Forte 2%",         generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Nurofen 400mg Liquid Caps",         generic: "Ibuprofen",                      category: "Pain & Fever",        form: "Capsule", rx: false },
    // Hoest & Verkoudheid
    { name: "Sinutab Dag & Nacht",               generic: "Paracetamol + Pseudoephedrine",  category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Rhinathiol 5% Siroop",              generic: "Carbocisteine",                  category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Stoptussin Druppels",               generic: "Butamirate + Guaifenesin",       category: "Cough & Cold",        form: "Drops",   rx: false },
    { name: "Bisolvon Droge Hoest Siroop",       generic: "Bromhexine",                     category: "Cough & Cold",        form: "Syrup",   rx: false },
    { name: "Actifed Dag",                       generic: "Triprolidine + Pseudoephedrine", category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Vicks VapoRub",                     generic: "Kamfer + Menthol + Eucalyptus",  category: "Cough & Cold",        form: "Zalf",    rx: false },
    { name: "Strepsils Klassiek",                generic: "Amylmetacresol + Dichlorobenzyl alcohol", category: "Cough & Cold", form: "Pastille", rx: false },
    { name: "Strepsils Honing & Citroen",        generic: "Amylmetacresol + Dichlorobenzyl alcohol", category: "Cough & Cold", form: "Pastille", rx: false },
    { name: "Neo-Citran",                        generic: "Paracetamol + Phenylephrine",    category: "Cough & Cold",        form: "Poeder",  rx: false },
    { name: "Rhinospray Neusspray",              generic: "Tramazoline",                    category: "Cough & Cold",        form: "Neusspray", rx: false },
    { name: "Otrivine Neusspray 0.1%",           generic: "Xylometazoline",                 category: "Cough & Cold",        form: "Neusspray", rx: false },
    // Allergie
    { name: "Claritine 10mg",                    generic: "Loratadine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Aerius 5mg",                        generic: "Desloratadine",                  category: "Allergy",             form: "Tablet",  rx: true },
    { name: "Xyzal 5mg",                         generic: "Levocetirizine",                 category: "Allergy",             form: "Tablet",  rx: true },
    { name: "Telfast 120mg",                     generic: "Fexofenadine",                   category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Flixonase Neusspray",               generic: "Fluticasone nasaal",             category: "Allergy",             form: "Neusspray", rx: false },
    { name: "Nasonex 50mcg",                     generic: "Mometasone nasaal",              category: "Allergy",             form: "Neusspray", rx: true },
    // Maag & Darmen
    { name: "Imodium Instant 2mg",               generic: "Loperamide",                     category: "Stomach & Intestine", form: "Smelttablet", rx: false },
    { name: "Maalox Antacid Suspension",         generic: "Aluminiumhydroxide + Magnesiumhydroxide", category: "Stomach & Intestine", form: "Suspensie", rx: false },
    { name: "Gaviscon Dual Action",              generic: "Natriumalginaat + Natriumcarbonaat", category: "Stomach & Intestine", form: "Tablet", rx: false },
    { name: "Rennie Antacid",                    generic: "Calciumcarbonaat + Magnesiumcarbonaat", category: "Stomach & Intestine", form: "Kauwtablet", rx: false },
    { name: "Motilium 10mg",                     generic: "Domperidon",                     category: "Stomach & Intestine", form: "Tablet",  rx: true },
    { name: "Primperan 10mg",                    generic: "Metoclopramide",                 category: "Stomach & Intestine", form: "Tablet",  rx: true },
    { name: "Dulcolax 5mg",                      generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Dulcolax Zetpil 10mg",              generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Zetpil",  rx: false },
    { name: "Forlax 10g Sachet",                 generic: "Macrogol",                       category: "Stomach & Intestine", form: "Sachet",  rx: false },
    { name: "Colopeg Sachet",                    generic: "Macrogol",                       category: "Stomach & Intestine", form: "Sachet",  rx: false },
    { name: "Pepto-Bismol Kauwtablet",           generic: "Bismutsubsalicylaat",            category: "Stomach & Intestine", form: "Kauwtablet", rx: false },
    { name: "Eno Bruispoeder",                   generic: "Natriumcarbonaat + Natriumbicarb", category: "Stomach & Intestine", form: "Poeder", rx: false },
    // Huid
    { name: "Flamigel Wondgel",                  generic: "Carbopol hydrogel",              category: "Skin & Wounds",       form: "Gel",     rx: false },
    { name: "Betadine Ontsmettingszalf",         generic: "Povidonjood",                    category: "Skin & Wounds",       form: "Zalf",    rx: false },
    { name: "Betadine Oplossing 10%",            generic: "Povidonjood",                    category: "Skin & Wounds",       form: "Oplossing", rx: false },
    { name: "Canesten Creme 1%",                 generic: "Clotrimazol",                    category: "Antifungals",         form: "Crème",   rx: false },
    { name: "Daktarin Gel 20mg/g",               generic: "Miconazol",                      category: "Antifungals",         form: "Gel",     rx: false },
    { name: "Nizoral Shampoo 20mg/g",            generic: "Ketoconazol",                    category: "Antifungals",         form: "Shampoo", rx: false },
    { name: "Gyno-Daktarin Vaginaalcrème",       generic: "Miconazol",                      category: "Women's Health",      form: "Vaginaalcrème", rx: false },
    // Vitamines
    { name: "Davitamon D3 1000IE",               generic: "Cholecalciferol",                category: "Vitamins & Supplements", form: "Tablet", rx: false },
    { name: "Supradyn Energie Bruistablet",      generic: "Multivitamine",                  category: "Vitamins & Supplements", form: "Bruistablet", rx: false },
    { name: "Berocca Performance",               generic: "B-vitamines + Vitamine C",       category: "Vitamins & Supplements", form: "Bruistablet", rx: false },
    { name: "Omega-3 Visolie 1000mg",            generic: "Omega-3 vetzuren",               category: "Vitamins & Supplements", form: "Capsule", rx: false },
    { name: "Magnesium 375mg",                   generic: "Magnesium",                      category: "Vitamins & Supplements", form: "Tablet", rx: false },
    { name: "Arkovital Vitamine C 500mg",        generic: "Ascorbinezuur",                  category: "Vitamins & Supplements", form: "Tablet", rx: false },
    // Slaap
    { name: "Donormyl 15mg",                     generic: "Doxylamine",                     category: "Sleep & Sedation",    form: "Tablet",  rx: false },
    { name: "Noctyl 50mg",                       generic: "Diphenhydramine",                category: "Sleep & Sedation",    form: "Tablet",  rx: false },
  ],
  nl: [
    { name: "Panadol 500mg",                     generic: "Paracetamol",                    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Panadol Extra 500/65mg",            generic: "Paracetamol + Cafeïne",          category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Aleve 220mg",                       generic: "Naproxen",                       category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Voltaren Emulgel 1%",               generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Voltaren Emulgel Forte 2%",         generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Claritine 10mg",                    generic: "Loratadine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Aerius 5mg",                        generic: "Desloratadine",                  category: "Allergy",             form: "Tablet",  rx: true },
    { name: "Xyzal 5mg",                         generic: "Levocetirizine",                 category: "Allergy",             form: "Tablet",  rx: true },
    { name: "Flixonase 50mcg",                   generic: "Fluticasone nasaal",             category: "Allergy",             form: "Neusspray", rx: false },
    { name: "Nasonex 50mcg",                     generic: "Mometasone nasaal",              category: "Allergy",             form: "Neusspray", rx: true },
    { name: "Otrivin Neusspray 0.1%",            generic: "Xylometazoline",                 category: "Cough & Cold",        form: "Neusspray", rx: false },
    { name: "Imodium Instant 2mg",               generic: "Loperamide",                     category: "Stomach & Intestine", form: "Smelttablet", rx: false },
    { name: "Gaviscon Dual Action",              generic: "Natriumalginaat",                category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Rennie",                            generic: "Calciumcarbonaat",               category: "Stomach & Intestine", form: "Kauwtablet", rx: false },
    { name: "Dulcolax 5mg",                      generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Movicol Sachet",                    generic: "Macrogol",                       category: "Stomach & Intestine", form: "Sachet",  rx: false },
    { name: "Betadine Ontsmettingszalf",         generic: "Povidonjood",                    category: "Skin & Wounds",       form: "Zalf",    rx: false },
    { name: "Canesten Creme 1%",                 generic: "Clotrimazol",                    category: "Antifungals",         form: "Crème",   rx: false },
    { name: "Daktarin Gel 20mg/g",               generic: "Miconazol",                      category: "Antifungals",         form: "Gel",     rx: false },
    { name: "Strepsils Klassiek",                generic: "Amylmetacresol",                 category: "Cough & Cold",        form: "Zuigtablet", rx: false },
    { name: "Vicks VapoRub",                     generic: "Kamfer + Menthol",               category: "Cough & Cold",        form: "Zalf",    rx: false },
    { name: "Berocca Performance",               generic: "B-vitamines + Vitamine C",       category: "Vitamins & Supplements", form: "Bruistablet", rx: false },
    { name: "Davitamon D3 1000IE",               generic: "Cholecalciferol",                category: "Vitamins & Supplements", form: "Tablet", rx: false },
  ],
  de: [
    { name: "Aspirin 500mg",                     generic: "Acetylsalicylsäure",             category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Aspirin Complex",                   generic: "ASS + Pseudoephedrin",           category: "Cough & Cold",        form: "Granulat", rx: false },
    { name: "Aspirin Effect Granulat",           generic: "Acetylsalicylsäure",             category: "Pain & Fever",        form: "Granulat", rx: false },
    { name: "Voltaren Schmerzgel 1%",            generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Voltaren Schmerzgel forte 2%",      generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Ibuflam 400mg Liquid Caps",         generic: "Ibuprofen",                      category: "Pain & Fever",        form: "Weichkapsel", rx: false },
    { name: "Nurofen 400mg Weichkapseln",        generic: "Ibuprofen",                      category: "Pain & Fever",        form: "Weichkapsel", rx: false },
    { name: "Thomapyrin Classic",                generic: "ASS + Paracetamol + Coffein",    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Talvosilen 500/30mg",               generic: "Paracetamol + Codein",           category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Claritine 10mg",                    generic: "Loratadin",                      category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Aerius 5mg",                        generic: "Desloratadin",                   category: "Allergy",             form: "Tablet",  rx: true },
    { name: "Telfast 120mg",                     generic: "Fexofenadin",                    category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Flutivate Nasenspray",              generic: "Fluticason nasal",               category: "Allergy",             form: "Nasenspray", rx: false },
    { name: "Nasonex 50mcg",                     generic: "Mometason nasal",                category: "Allergy",             form: "Nasenspray", rx: true },
    { name: "Imodium akut 2mg",                  generic: "Loperamid",                      category: "Stomach & Intestine", form: "Kapsel",  rx: false },
    { name: "Gaviscon Extra",                    generic: "Natriumalginat",                 category: "Stomach & Intestine", form: "Suspension", rx: false },
    { name: "Rennie Antacidum",                  generic: "Calciumcarbonat",                category: "Stomach & Intestine", form: "Kautablette", rx: false },
    { name: "Lefax Kautabletten",                generic: "Simeticon",                      category: "Stomach & Intestine", form: "Kautablette", rx: false },
    { name: "Dulcolax 5mg",                      generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Dragée",  rx: false },
    { name: "Movicol Sachets",                   generic: "Macrogol",                       category: "Stomach & Intestine", form: "Sachets", rx: false },
    { name: "Betaisodona Salbe",                 generic: "Povidon-Jod",                    category: "Skin & Wounds",       form: "Salbe",   rx: false },
    { name: "Canesten Creme 1%",                 generic: "Clotrimazol",                    category: "Antifungals",         form: "Creme",   rx: false },
    { name: "Vicks VapoRub",                     generic: "Kampfer + Menthol + Eucalyptus", category: "Cough & Cold",        form: "Salbe",   rx: false },
    { name: "Wick DayMed Tabletten",             generic: "Paracetamol + Pseudoephedrin",   category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Wick NightMed Kapseln",             generic: "Paracetamol + Doxylamin",        category: "Cough & Cold",        form: "Kapsel",  rx: false },
    { name: "Berocca Performance",               generic: "B-Vitamine + Vitamin C",         category: "Vitamins & Supplements", form: "Brausetablette", rx: false },
  ],
  gb: [
    { name: "Panadol Advance 500mg",             generic: "Paracetamol",                    category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Calpol 120mg/5ml",                  generic: "Paracetamol",                    category: "Pain & Fever",        form: "Suspension", rx: false },
    { name: "Lemsip Max Cold & Flu",             generic: "Paracetamol + Phenylephrine",    category: "Cough & Cold",        form: "Powder",  rx: false },
    { name: "Lemsip Cold & Flu Capsules",        generic: "Paracetamol + Phenylephrine",    category: "Cough & Cold",        form: "Capsule", rx: false },
    { name: "Night Nurse Liquid",                generic: "Paracetamol + DXM + Promethazine", category: "Cough & Cold",     form: "Liquid",  rx: false },
    { name: "Day Nurse Capsules",                generic: "Paracetamol + Pseudoephedrine",  category: "Cough & Cold",        form: "Capsule", rx: false },
    { name: "Beechams All-In-One Liquid",        generic: "Guaifenesin + Phenylephrine + Paracetamol", category: "Cough & Cold", form: "Liquid", rx: false },
    { name: "Benylin Dry Coughs",                generic: "Dextromethorphan",               category: "Cough & Cold",        form: "Liquid",  rx: false },
    { name: "Benylin Chesty Coughs",             generic: "Guaifenesin",                    category: "Cough & Cold",        form: "Liquid",  rx: false },
    { name: "Piriton 4mg",                       generic: "Chlorphenamine",                 category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Clarityn 10mg",                     generic: "Loratadine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Zirtek 10mg",                       generic: "Cetirizine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Telfast 120mg",                     generic: "Fexofenadine",                   category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Nasonex 50mcg",                     generic: "Mometasone nasal",               category: "Allergy",             form: "Nasal spray", rx: true },
    { name: "Imodium Instants 2mg",              generic: "Loperamide",                     category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Gaviscon Advance Liquid",           generic: "Sodium alginate",                category: "Stomach & Intestine", form: "Liquid",  rx: false },
    { name: "Rennie Tablets",                    generic: "Calcium carbonate",              category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Dulcolax 5mg",                      generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Movicol Sachets",                   generic: "Macrogol",                       category: "Stomach & Intestine", form: "Sachet",  rx: false },
    { name: "Pepto-Bismol Liquid",               generic: "Bismuth subsalicylate",          category: "Stomach & Intestine", form: "Liquid",  rx: false },
    { name: "Betadine Antiseptic Ointment",      generic: "Povidone-iodine",                category: "Skin & Wounds",       form: "Ointment", rx: false },
    { name: "Canesten Cream 1%",                 generic: "Clotrimazole",                   category: "Antifungals",         form: "Cream",   rx: false },
    { name: "Daktarin Oral Gel",                 generic: "Miconazole",                     category: "Oral Care",           form: "Oral gel", rx: false },
    { name: "Voltarol Emulgel 1%",               generic: "Diclofenac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Deep Heat Cream",                   generic: "Menthol + Methyl salicylate",    category: "Joints & Muscles",    form: "Cream",   rx: false },
    { name: "Strepsils Original",                generic: "Amylmetacresol",                 category: "Cough & Cold",        form: "Lozenge", rx: false },
    { name: "Vicks VapoRub",                     generic: "Camphor + Menthol",              category: "Cough & Cold",        form: "Ointment", rx: false },
    { name: "Berocca Performance",               generic: "B-vitamins + Vitamin C",         category: "Vitamins & Supplements", form: "Effervescent tablet", rx: false },
  ],
  us: [
    { name: "Tylenol Extra Strength 500mg",      generic: "Acetaminophen",                  category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Tylenol PM",                        generic: "Acetaminophen + Diphenhydramine",category: "Sleep & Sedation",    form: "Tablet",  rx: false },
    { name: "Advil Liqui-Gels 200mg",            generic: "Ibuprofen",                      category: "Pain & Fever",        form: "Capsule", rx: false },
    { name: "Advil PM",                          generic: "Ibuprofen + Diphenhydramine",    category: "Sleep & Sedation",    form: "Capsule", rx: false },
    { name: "Aleve 220mg",                       generic: "Naproxen",                       category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Bayer Aspirin 325mg",               generic: "Aspirin",                        category: "Pain & Fever",        form: "Tablet",  rx: false },
    { name: "Excedrin Migraine",                 generic: "Aspirin + Acetaminophen + Caffeine", category: "Migraine",        form: "Tablet",  rx: false },
    { name: "Excedrin Extra Strength",           generic: "Aspirin + Acetaminophen + Caffeine", category: "Pain & Fever",   form: "Tablet",  rx: false },
    { name: "NyQuil Cold & Flu",                 generic: "Acetaminophen + DXM + Doxylamine", category: "Cough & Cold",     form: "Liquid",  rx: false },
    { name: "DayQuil Cold & Flu",                generic: "Acetaminophen + DXM + Phenylephrine", category: "Cough & Cold",  form: "Liquid",  rx: false },
    { name: "Robitussin DM",                     generic: "DXM + Guaifenesin",              category: "Cough & Cold",        form: "Liquid",  rx: false },
    { name: "Mucinex DM 600/30mg",               generic: "Guaifenesin + DXM",              category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Mucinex 600mg",                     generic: "Guaifenesin",                    category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Sudafed 30mg",                      generic: "Pseudoephedrine",                category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Sudafed PE 10mg",                   generic: "Phenylephrine",                  category: "Cough & Cold",        form: "Tablet",  rx: false },
    { name: "Afrin Nasal Spray",                 generic: "Oxymetazoline",                  category: "Cough & Cold",        form: "Nasal spray", rx: false },
    { name: "Claritin 10mg",                     generic: "Loratadine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Zyrtec 10mg",                       generic: "Cetirizine",                     category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Allegra 180mg",                     generic: "Fexofenadine",                   category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Benadryl 25mg",                     generic: "Diphenhydramine",                category: "Allergy",             form: "Tablet",  rx: false },
    { name: "Flonase Allergy Relief",            generic: "Fluticasone nasal",              category: "Allergy",             form: "Nasal spray", rx: false },
    { name: "Nasacort Allergy 24HR",             generic: "Triamcinolone nasal",            category: "Allergy",             form: "Nasal spray", rx: false },
    { name: "Pepto-Bismol Liquid",               generic: "Bismuth subsalicylate",          category: "Stomach & Intestine", form: "Liquid",  rx: false },
    { name: "Imodium AD 2mg",                    generic: "Loperamide",                     category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Gaviscon Regular Strength",         generic: "Alginic acid",                   category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Tums Extra Strength",               generic: "Calcium carbonate",              category: "Stomach & Intestine", form: "Chewable tablet", rx: false },
    { name: "Prilosec OTC 20mg",                 generic: "Omeprazole",                     category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "Nexium 24HR 20mg",                  generic: "Esomeprazole",                   category: "Stomach & Intestine", form: "Capsule", rx: false },
    { name: "Dulcolax 5mg",                      generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Tablet",  rx: false },
    { name: "MiraLax",                           generic: "Polyethylene glycol 3350",       category: "Stomach & Intestine", form: "Powder",  rx: false },
    { name: "Colace 100mg",                      generic: "Docusate sodium",                category: "Stomach & Intestine", form: "Capsule", rx: false },
    { name: "Neosporin Ointment",                generic: "Neomycin + Polymyxin + Bacitracin", category: "Skin & Wounds",   form: "Ointment", rx: false },
    { name: "Polysporin Ointment",               generic: "Bacitracin + Polymyxin B",       category: "Skin & Wounds",      form: "Ointment", rx: false },
    { name: "Voltaren Arthritis Pain Gel 1%",    generic: "Diclofenac",                     category: "Joints & Muscles",   form: "Gel",     rx: false },
    { name: "Bengay Ultra Strength",             generic: "Methyl salicylate + Menthol",    category: "Joints & Muscles",   form: "Cream",   rx: false },
    { name: "Canesten Cream 1%",                 generic: "Clotrimazole",                   category: "Antifungals",        form: "Cream",   rx: false },
    { name: "Monistat 1",                        generic: "Miconazole",                     category: "Women's Health",     form: "Ointment", rx: false },
    { name: "Monistat 3",                        generic: "Miconazole",                     category: "Women's Health",     form: "Cream",   rx: false },
    { name: "Unisom SleepTabs 25mg",             generic: "Doxylamine",                     category: "Sleep & Sedation",   form: "Tablet",  rx: false },
    { name: "ZzzQuil 50mg",                      generic: "Diphenhydramine",                category: "Sleep & Sedation",   form: "Liquid",  rx: false },
    { name: "Vicks VapoRub",                     generic: "Camphor + Menthol + Eucalyptol", category: "Cough & Cold",       form: "Ointment", rx: false },
    { name: "Halls Mentho-Lyptus",               generic: "Menthol",                        category: "Cough & Cold",       form: "Lozenge", rx: false },
    { name: "Strepsils",                         generic: "Amylmetacresol",                 category: "Cough & Cold",       form: "Lozenge", rx: false },
    { name: "Centrum Adults Multivitamin",       generic: "Multivitamin",                   category: "Vitamins & Supplements", form: "Tablet", rx: false },
    { name: "Nature Made Vitamin D3 1000IU",     generic: "Cholecalciferol",                category: "Vitamins & Supplements", form: "Tablet", rx: false },
    { name: "Culturelle Probiotic",              generic: "Lactobacillus rhamnosus GG",     category: "Vitamins & Supplements", form: "Capsule", rx: false },
  ],
  fr: [
    { name: "Doliprane 1000mg",                  generic: "Paracétamol",                    category: "Pain & Fever",        form: "Comprimé", rx: false },
    { name: "Efferalgan 500mg",                  generic: "Paracétamol",                    category: "Pain & Fever",        form: "Comprimé effervescent", rx: false },
    { name: "Advil 400mg",                       generic: "Ibuprofène",                     category: "Pain & Fever",        form: "Comprimé", rx: false },
    { name: "Nurofen 400mg",                     generic: "Ibuprofène",                     category: "Pain & Fever",        form: "Comprimé", rx: false },
    { name: "Aspirine UPSA 500mg",               generic: "Acide acétylsalicylique",        category: "Pain & Fever",        form: "Comprimé effervescent", rx: false },
    { name: "Voltarène Emulgel 1%",              generic: "Diclofénac",                     category: "Joints & Muscles",    form: "Gel",     rx: false },
    { name: "Clarityne 10mg",                    generic: "Loratadine",                     category: "Allergy",             form: "Comprimé", rx: false },
    { name: "Aerius 5mg",                        generic: "Desloratadine",                  category: "Allergy",             form: "Comprimé", rx: true },
    { name: "Xyzall 5mg",                        generic: "Lévocétirizine",                 category: "Allergy",             form: "Comprimé", rx: true },
    { name: "Rhinocort 64mcg",                   generic: "Budésonide nasal",               category: "Allergy",             form: "Spray nasal", rx: false },
    { name: "Imodium 2mg",                       generic: "Lopéramide",                     category: "Stomach & Intestine", form: "Gélule",  rx: false },
    { name: "Gaviscon Double Action",            generic: "Alginate de sodium",             category: "Stomach & Intestine", form: "Comprimé", rx: false },
    { name: "Rennie Citrus",                     generic: "Carbonate de calcium",           category: "Stomach & Intestine", form: "Comprimé à croquer", rx: false },
    { name: "Dulcolax 5mg",                      generic: "Bisacodyl",                      category: "Stomach & Intestine", form: "Comprimé", rx: false },
    { name: "Forlax 10g",                        generic: "Macrogol",                       category: "Stomach & Intestine", form: "Sachet",  rx: false },
    { name: "Motilium 10mg",                     generic: "Dompéridone",                    category: "Stomach & Intestine", form: "Comprimé", rx: true },
    { name: "Strepsils Classic",                 generic: "Amylmétacrésol",                 category: "Cough & Cold",        form: "Pastille", rx: false },
    { name: "Vicks VapoRub",                     generic: "Camphre + Menthol",              category: "Cough & Cold",        form: "Pommade", rx: false },
    { name: "Rhinospray 1,18mg/dose",            generic: "Tuaminoheptane",                 category: "Cough & Cold",        form: "Spray nasal", rx: false },
    { name: "Betadine Dermique 10%",             generic: "Povidone iodée",                 category: "Skin & Wounds",       form: "Solution", rx: false },
    { name: "Canesten Crème 1%",                 generic: "Clotrimazole",                   category: "Antifungals",         form: "Crème",   rx: false },
    { name: "Gyno-Pévaryl LP 150mg",             generic: "Econazole",                      category: "Women's Health",      form: "Ovule",   rx: false },
    { name: "Berocca Performance",               generic: "Vitamines B + C",                category: "Vitamins & Supplements", form: "Comprimé effervescent", rx: false },
  ],
};

// Country-specific brand name prefixes/suffixes
const COUNTRY_BRANDS = {
  be: { suffix: ['EG','Sandoz','Teva','Mylan','Arrow','Apotex','Ratiopharm','Stada','Krka'], prefix: [] },
  nl: { suffix: ['PCH','CF','Sandoz','Teva','Mylan','Accord','Apotex','Aurobindo'], prefix: [] },
  de: { suffix: ['AL','AbZ','Hexal','1A Pharma','Ratiopharm','Stada','CT','Heumann','KSK'], prefix: [] },
  fr: { suffix: ['EG','Biogaran','Mylan','Teva','Arrow','Sandoz','Zentiva','Qualimed','Ranbaxy'], prefix: [] },
  es: { suffix: ['EFG','Ratiopharm','Kern Pharma','Stada','Sandoz','Alter','Cinfa','Mylan'], prefix: [] },
  it: { suffix: ['EG','Sandoz','Mylan','Teva','Ratiopharm','Hexal','Aurobindo','Pensa'], prefix: [] },
  ch: { suffix: ['Sandoz','Spirig','Mepha','Helvepharm','Axapharm','Pharmacore'], prefix: [] },
  at: { suffix: ['Genericon','Sandoz','Teva','1A Pharma','Stada','Hexal','Ratiopharm'], prefix: [] },
  dk: { suffix: ['2care4','Orion','Alternova','Paranova','Bluefish','Nordic Drugs'], prefix: [] },
  pl: { suffix: ['Polpharma','Ranbaxy','Polfarmex','Teva','Sandoz','Mylan','Stada'], prefix: [] },
  no: { suffix: ['Orifarm','2care4','Krka','Accord','Sandoz','Orion'], prefix: [] },
  fi: { suffix: ['Orion','Leiras','Sandoz','Teva','Krka','Actavis'], prefix: [] },
  se: { suffix: ['Orifarm','Actavis','Sandoz','Teva','Krka','Mylan','Accord'], prefix: [] },
  gb: { suffix: ['Actavis','Accord','Milpharm','Wockhardt','Zentiva','Tillomed','Teva'], prefix: [] },
  ie: { suffix: ['Rowex','Clonmel','Actavis','Teva','Sandoz','Accord','Milpharm'], prefix: [] },
  pt: { suffix: ['Actavis','Sandoz','Mylan','Teva','Ratiopharm','Labesfal','Bluepharma'], prefix: [] },
  us: { suffix: ['(generic)','by Teva','by Sandoz','by Mylan','by Amneal','by Lupin','by Sun Pharma','by Aurobindo'], prefix: [] },
  ca: { suffix: ['(generic)','Teva','Sandoz','Mylan','Apotex','Pro Doctor','Jamp'], prefix: [] },
};

// Key brand names per country for common medicines
const BRAND_NAMES = {
  Paracetamol: { be:'Dafalgan|Perdolan|Efferalgan|Doliprane', nl:'Panadol|Tylenol|Finimal', de:'Tylenol|Paracetamol-ratiopharm|ben-u-ron|Perfalgan', fr:'Doliprane|Efferalgan|Panadol|Dafalgan', es:'Gelocatil|Apiretal|Panadol|Efferalgan', it:'Tachipirina|Efferalgan|Perfalgan|Panadol', ch:'Dafalgan|Panadol|Tylenol', at:'Mexalen|Tylenol|Parkemed', dk:'Panodil|Pamol|Pinex', pl:'Apap|Panadol|Codipar', no:'Paracet|Panodil|Dispril', fi:'Para-Tabs|Panadol|Pamol', se:'Alvedon|Panodil|Pamol', gb:'Panadol|Calpol|Hedex|Medinol', ie:'Panadol|Calpol|Solpadeine', pt:'Ben-u-ron|Panadol|Tylenol', us:'Tylenol|Feverall|Mapap', ca:'Tylenol|Tempra|Atasol' },
  Ibuprofen: { be:'Advil|Nurofen|Brufen|Ibupro', nl:'Advil|Nurofen|Brufen', de:'Ibuflam|Nurofen|Aktren|Dolormin', fr:'Advil|Nurofen|Brufen|Antarène', es:'Neobrufen|Ibuprofeno|Dalsy|Dolorac', it:'Moment|Brufen|Nurofen|Antalgil', ch:'Ibuflam|Brufen|Advil', at:'Nurofen|Dismenol|Dolgit', dk:'Ipren|Ibumetin|Nurofen', pl:'Ibuprom|Nurofen|MIG', no:'Ibux|Ibumetin|Brufen', fi:'Burana|Ibuxin|Ibumax', se:'Ipren|Ibumetin|Brufen', gb:'Nurofen|Calprofen|Brufen|Hedex Ibuprofen', ie:'Nurofen|Brufen|Calprofen', pt:'Brufen|Nurofen|Pediatric|Benuflam', us:'Advil|Motrin|Midol', ca:'Advil|Motrin|Robax' },
  Omeprazole: { be:'Losec|Prilosec|Mopral', nl:'Losec|Omeprazol', de:'Antra|Losec|Omep', fr:'Mopral|Zoltum|Losec', es:'Losec|Nansen|Mopral', it:'Antra|Losec|Omeprazen', ch:'Omez|Losec|Antra', at:'Losec|Omep|Gastro-Timelets', dk:'Losec|Omplexan', pl:'Gasec|Losec|Helicid', no:'Losec|Omeprazol', fi:'Losec|Omeprazol|Omezol', se:'Losec|Omestad|Prilosec', gb:'Losec|Zanprol|Mepradec', ie:'Losec|Ulzol|Mepradec', pt:'Losec|Meprotec|Omeprazol', us:'Prilosec OTC|Zegerid', ca:'Losec|Omeprazol' },
};

/**
 * Build a medicine list for a given country code
 */
function buildCountryMedicines(code) {
  const brands = COUNTRY_BRANDS[code] || COUNTRY_BRANDS.be;
  const generics = BRAND_NAMES;
  const medicines = [];

  for (const drug of GENERICS) {
    // 1. Add branded variants if available
    const brandList = (BRAND_NAMES[drug.generic] || {})[code];
    if (brandList) {
      const brandNames = brandList.split('|');
      for (const brand of brandNames) {
        for (const form of drug.forms.slice(0, 4)) {
          medicines.push({
            name: `${brand} ${form}`,
            generic: drug.generic,
            category: drug.category,
            form: form.replace(/ \d.*$/, '').trim(),
            rx: drug.rx,
          });
        }
      }
    }

    // 2. Always add generic + manufacturer suffix variants
    for (const suffix of brands.suffix.slice(0, 4)) {
      for (const form of drug.forms.slice(0, 3)) {
        const formLabel = form.replace(/ \d.*$/, '').trim();
        const strengthMatch = form.match(/(\d[\d./]*\s*(mg|mcg|g|ml|IU|IE|%))/);
        const strength = strengthMatch ? ` ${strengthMatch[0]}` : '';
        medicines.push({
          name: `${drug.generic} ${suffix}${strength}`.trim(),
          generic: drug.generic,
          category: drug.category,
          form: formLabel,
          rx: drug.rx,
        });
      }
    }
  }

  // Deduplicate by name
  const seen = new Set();
  const base = medicines.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });

  // Add standalone brands for this country (prepend so they appear first in searches)
  const standalone = (STANDALONE_BRANDS[code] || []).filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });

  return [...standalone, ...base];
}

const CATEGORIES = [
  { name: "Pain & Fever" }, { name: "Allergy" }, { name: "Antibiotics" },
  { name: "Stomach & Intestine" }, { name: "Skin & Wounds" }, { name: "Cough & Cold" },
  { name: "Eye & Ear" }, { name: "Vitamins & Supplements" }, { name: "Sleep & Sedation" },
  { name: "Heart & Blood Pressure" }, { name: "Diabetes" }, { name: "Thyroid" },
  { name: "Joints & Muscles" }, { name: "Women's Health" }, { name: "Lungs & Asthma" },
  { name: "Migraine" }, { name: "Neurology" }, { name: "Cholesterol" },
  { name: "Antidepressants" }, { name: "Smoking Cessation" }, { name: "First Aid" },
  { name: "Urology" }, { name: "Corticosteroids" }, { name: "Antiparasitics" },
  { name: "Antifungals" }, { name: "Antivirals" }, { name: "Anticoagulants" },
  { name: "Oral Care" }, { name: "Nervous System" },
];

const COUNTRY_SOURCES = {
  be: 'FAMHP / afmps.be / fagg.be',
  nl: 'CBG-MEB / geneesmiddelenrepertorium.nl',
  de: 'BfArM / dimdi.de / gelbe-liste.de',
  fr: 'ANSM / base-donnees-publique.medicaments.gouv.fr',
  es: 'AEMPS / cimassl.aemps.es',
  it: 'AIFA / farmaci.agenziafarmaco.it',
  ch: 'Swissmedic / swissmedicinfo.ch',
  at: 'BASG / ages.at / medicinebook.at',
  dk: 'DKMA / produktresume.dk',
  pl: 'URPL / rejestry.ezdrowie.gov.pl',
  no: 'NoMA / legemiddelsok.no / felleskatalogen.no',
  fi: 'Fimea / laakeinfo.fi',
  se: 'MPA / lakemedelsverket.se / fass.se',
  gb: 'MHRA / medicines.org.uk / bnf.nice.org.uk',
  ie: 'HPRA / hpra.ie',
  pt: 'INFARMED / infarmed.pt',
  us: 'FDA NDC / open.fda.gov/drug',
  ca: 'Health Canada DPD / health-products.canada.ca',
};

const COUNTRY_NAMES = {
  be:'Belgium',nl:'Netherlands',de:'Germany',fr:'France',es:'Spain',it:'Italy',
  ch:'Switzerland',at:'Austria',dk:'Denmark',pl:'Poland',no:'Norway',fi:'Finland',
  se:'Sweden',gb:'United Kingdom',ie:'Ireland',pt:'Portugal',us:'United States',ca:'Canada'
};

function generateFile(code) {
  const medicines = buildCountryMedicines(code);
  const source = COUNTRY_SOURCES[code] || 'national medicine registry';
  const name = COUNTRY_NAMES[code] || code.toUpperCase();

  const lines = [
    `// ${name} (${code.toUpperCase()}) — ${medicines.length} most-used medicines`,
    `// Source: ${source}`,
    `// Generated by generate.js — supplement with official registry data for production use`,
    ``,
    `const MEDICINES = [`,
    ...medicines.map(m =>
      `  { name: ${JSON.stringify(m.name)}, generic: ${JSON.stringify(m.generic)}, category: ${JSON.stringify(m.category)}, form: ${JSON.stringify(m.form)}, rx: ${m.rx} },`
    ),
    `];`,
    ``,
    `const CATEGORIES = ${JSON.stringify(CATEGORIES, null, 2)};`,
    ``,
    `module.exports = { MEDICINES, CATEGORIES };`,
  ];

  return lines.join('\n');
}

// Run
const fs = require('fs');
const path = require('path');
const outDir = path.join(__dirname, 'data', 'countries');

const target = process.argv[2];
const codes = target === 'all'
  ? Object.keys(COUNTRY_NAMES).filter(c => c !== 'be' && c !== 'nl') // be/nl already hand-crafted
  : target ? [target.toLowerCase()] : Object.keys(COUNTRY_NAMES).filter(c => c !== 'be' && c !== 'nl');

let total = 0;
for (const code of codes) {
  if (!COUNTRY_NAMES[code]) { console.error(`Unknown country: ${code}`); continue; }
  const content = generateFile(code);
  const outPath = path.join(outDir, `${code}.js`);
  fs.writeFileSync(outPath, content);
  const count = (content.match(/rx:/g) || []).length;
  console.log(`✅ ${code.toUpperCase()} — ${count} medicines → ${outPath}`);
  total += count;
}
console.log(`\n🎉 Done! Total medicines generated: ${total}`);
