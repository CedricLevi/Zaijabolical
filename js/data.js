/* Zaijabolical data: nutrient catalogue, default settings, starter pantry & recipes.
   Nutrient targets follow US Dietary Reference Intakes (NIH ODS) for women 19-30,
   with iron x1.8 and zinc x1.5 for a vegan diet. All targets are editable in Settings. */
(function (Z) {
Z.NUTRIENTS = [
 {
  "key": "kcal",
  "name": "Calories",
  "unit": "kcal",
  "group": "Macros",
  "kind": "info",
  "target": null,
  "usda": [
   1008,
   2048,
   2047
  ],
  "usda_nums": [
   "208",
   "958",
   "957"
  ]
 },
 {
  "key": "protein",
  "name": "Protein",
  "unit": "g",
  "group": "Macros",
  "kind": "macro",
  "target": 140,
  "usda": [
   1003
  ],
  "usda_nums": [
   "203"
  ],
  "weight": 3.0
 },
 {
  "key": "carbs",
  "name": "Carbohydrate",
  "unit": "g",
  "group": "Macros",
  "kind": "macro",
  "target": 350,
  "usda": [
   1005,
   1050
  ],
  "usda_nums": [
   "205",
   "205.2"
  ],
  "weight": 2.0
 },
 {
  "key": "fat",
  "name": "Fat",
  "unit": "g",
  "group": "Macros",
  "kind": "macro",
  "target": 70,
  "usda": [
   1004
  ],
  "usda_nums": [
   "204"
  ],
  "weight": 2.0
 },
 {
  "key": "fiber",
  "name": "Fiber",
  "unit": "g",
  "group": "Macros",
  "kind": "min",
  "target": 25,
  "usda": [
   1079
  ],
  "usda_nums": [
   "291"
  ]
 },
 {
  "key": "satfat",
  "name": "Saturated fat",
  "unit": "g",
  "group": "Macros",
  "kind": "limit",
  "target": 28,
  "usda": [
   1258
  ],
  "usda_nums": [
   "606"
  ],
  "note": "Limit: under ~10% of calories."
 },
 {
  "key": "ala",
  "name": "Omega-3 (ALA)",
  "unit": "g",
  "group": "Macros",
  "kind": "min",
  "target": 1.1,
  "usda": [
   1404,
   1270
  ],
  "usda_nums": [
   "851",
   "619"
  ],
  "advice": "1 Tbsp ground flaxseed (~2.3 g) or chia seeds (~1.8 g) covers it."
 },
 {
  "key": "epa_dha",
  "name": "Omega-3 (EPA+DHA)",
  "unit": "mg",
  "group": "Macros",
  "kind": "min",
  "target": 250,
  "usda": [],
  "usda_nums": [],
  "supplement_only": true,
  "note": "No official RDA; 250 mg/day is a common recommendation. Plant foods contain essentially none.",
  "advice": "Algae-oil omega-3, 250-500 mg EPA+DHA daily (the vegan source of what fish oil provides).",
  "dose": {
   "amount": 300,
   "label": "Algae oil (EPA+DHA)"
  }
 },
 {
  "key": "vit_a",
  "name": "Vitamin A",
  "unit": "µg RAE",
  "group": "Vitamins",
  "kind": "min",
  "target": 700,
  "usda": [
   1106
  ],
  "usda_nums": [
   "320"
  ],
  "note": "Plant beta-carotene has no upper limit; the UL applies only to preformed (supplement) vitamin A.",
  "advice": "Sweet potato, carrots, pumpkin, dark leafy greens."
 },
 {
  "key": "vit_c",
  "name": "Vitamin C",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 75,
  "ul": 2000,
  "ul_scope": "total",
  "usda": [
   1162
  ],
  "usda_nums": [
   "401"
  ],
  "advice": "Bell peppers, citrus, broccoli, strawberries - pair with iron-rich meals."
 },
 {
  "key": "vit_d",
  "name": "Vitamin D",
  "unit": "µg",
  "group": "Vitamins",
  "kind": "min",
  "target": 15,
  "ul": 100,
  "ul_scope": "total",
  "usda": [
   1114
  ],
  "usda_nums": [
   "328"
  ],
  "advice": "Vegan D3 (lichen) or D2, 15-25 µg (600-1,000 IU) daily. A blood test (25-OH vitamin D) tells you if she needs more.",
  "dose": {
   "amount": 25,
   "label": "Vegan D3 (1,000 IU)"
  }
 },
 {
  "key": "vit_e",
  "name": "Vitamin E",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 15,
  "ul": 1000,
  "ul_scope": "supplement",
  "usda": [
   1109
  ],
  "usda_nums": [
   "323"
  ],
  "advice": "Sunflower seeds, almonds, peanut butter, avocado."
 },
 {
  "key": "vit_k",
  "name": "Vitamin K",
  "unit": "µg",
  "group": "Vitamins",
  "kind": "min",
  "target": 90,
  "usda": [
   1185
  ],
  "usda_nums": [
   "430"
  ],
  "advice": "Kale, spinach, broccoli, cabbage."
 },
 {
  "key": "thiamin",
  "name": "Thiamin (B1)",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 1.1,
  "usda": [
   1165
  ],
  "usda_nums": [
   "404"
  ],
  "advice": "Whole grains, beans, sunflower seeds, nutritional yeast."
 },
 {
  "key": "riboflavin",
  "name": "Riboflavin (B2)",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 1.1,
  "usda": [
   1166
  ],
  "usda_nums": [
   "405"
  ],
  "advice": "Fortified soy milk, almonds, mushrooms, nutritional yeast."
 },
 {
  "key": "niacin",
  "name": "Niacin (B3)",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 14,
  "ul": 35,
  "ul_scope": "supplement",
  "usda": [
   1167
  ],
  "usda_nums": [
   "406"
  ],
  "advice": "Peanuts, whole grains, mushrooms, tempeh."
 },
 {
  "key": "pantothenic",
  "name": "Pantothenic acid (B5)",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 5,
  "usda": [
   1170
  ],
  "usda_nums": [
   "410"
  ],
  "advice": "Mushrooms, avocado, whole grains, legumes."
 },
 {
  "key": "b6",
  "name": "Vitamin B6",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 1.3,
  "ul": 100,
  "ul_scope": "total",
  "usda": [
   1175
  ],
  "usda_nums": [
   "415"
  ],
  "advice": "Chickpeas, potatoes, bananas, fortified cereals."
 },
 {
  "key": "folate",
  "name": "Folate",
  "unit": "µg DFE",
  "group": "Vitamins",
  "kind": "min",
  "target": 400,
  "ul": 1000,
  "ul_scope": "supplement",
  "usda": [
   1190,
   1177
  ],
  "usda_nums": [
   "435",
   "417"
  ],
  "note": "The UL applies only to synthetic folic acid, not food folate.",
  "advice": "Lentils, chickpeas, edamame, leafy greens."
 },
 {
  "key": "b12",
  "name": "Vitamin B12",
  "unit": "µg",
  "group": "Vitamins",
  "kind": "min",
  "target": 2.4,
  "usda": [
   1178
  ],
  "usda_nums": [
   "418"
  ],
  "note": "Plants don't make B12. Only fortified foods or a supplement provide it.",
  "advice": "Non-negotiable on a vegan diet: a B12 supplement (commonly 25-100 µg cyanocobalamin daily, or 1,000-2,000 µg once or twice a week).",
  "dose": {
   "amount": 50,
   "label": "B12 (cyanocobalamin)"
  },
  "always_recommend": true
 },
 {
  "key": "choline",
  "name": "Choline",
  "unit": "mg",
  "group": "Vitamins",
  "kind": "min",
  "target": 425,
  "ul": 3500,
  "ul_scope": "total",
  "usda": [
   1180
  ],
  "usda_nums": [
   "421"
  ],
  "note": "USDA choline data is incomplete for many foods, so this may read low.",
  "advice": "Soy foods (tofu, soy milk, edamame), quinoa, broccoli, Brussels sprouts. A 250 mg choline supplement is an option if consistently short."
 },
 {
  "key": "calcium",
  "name": "Calcium",
  "unit": "mg",
  "group": "Minerals",
  "kind": "min",
  "target": 1000,
  "ul": 2500,
  "ul_scope": "total",
  "usda": [
   1087
  ],
  "usda_nums": [
   "301"
  ],
  "advice": "Calcium-set tofu and fortified soy milk first. If still short, calcium citrate in doses of 500 mg or less, taken apart from iron-rich meals.",
  "dose": {
   "amount": 300,
   "label": "Calcium citrate"
  }
 },
 {
  "key": "iron",
  "name": "Iron",
  "unit": "mg",
  "group": "Minerals",
  "kind": "min",
  "target": 32,
  "ul": 45,
  "ul_scope": "total",
  "usda": [
   1089
  ],
  "usda_nums": [
   "303"
  ],
  "note": "Default is 1.8x the standard 18 mg because plant (non-heme) iron is absorbed less well.",
  "advice": "Lentils, tofu, tempeh, pumpkin seeds - eat them with vitamin C. Only supplement iron if bloodwork (ferritin) shows it's low; excess iron is harmful."
 },
 {
  "key": "magnesium",
  "name": "Magnesium",
  "unit": "mg",
  "group": "Minerals",
  "kind": "min",
  "target": 310,
  "ul": 350,
  "ul_scope": "supplement",
  "usda": [
   1090
  ],
  "usda_nums": [
   "304"
  ],
  "note": "The 350 mg UL applies to supplements only, not food.",
  "advice": "Pumpkin seeds, almonds, black beans, whole grains."
 },
 {
  "key": "phosphorus",
  "name": "Phosphorus",
  "unit": "mg",
  "group": "Minerals",
  "kind": "min",
  "target": 700,
  "ul": 4000,
  "ul_scope": "total",
  "usda": [
   1091
  ],
  "usda_nums": [
   "305"
  ],
  "advice": "Abundant in legumes, grains and seeds."
 },
 {
  "key": "potassium",
  "name": "Potassium",
  "unit": "mg",
  "group": "Minerals",
  "kind": "min",
  "target": 2600,
  "usda": [
   1092
  ],
  "usda_nums": [
   "306"
  ],
  "advice": "Potatoes, beans, bananas, leafy greens. Don't supplement potassium without a doctor."
 },
 {
  "key": "sodium",
  "name": "Sodium",
  "unit": "mg",
  "group": "Minerals",
  "kind": "limit",
  "target": 2300,
  "usda": [
   1093
  ],
  "usda_nums": [
   "307"
  ],
  "note": "Limit: under 2,300 mg/day. Salt added at the table isn't counted unless it's in the recipe."
 },
 {
  "key": "zinc",
  "name": "Zinc",
  "unit": "mg",
  "group": "Minerals",
  "kind": "min",
  "target": 12,
  "ul": 40,
  "ul_scope": "total",
  "usda": [
   1095
  ],
  "usda_nums": [
   "309"
  ],
  "note": "Default is 1.5x the standard 8 mg because phytates in plant foods reduce absorption.",
  "advice": "Pumpkin & hemp seeds, chickpeas, oats, cashews. Soaking/sprouting legumes improves absorption; 8-15 mg zinc supplement if consistently short.",
  "dose": {
   "amount": 10,
   "label": "Zinc"
  }
 },
 {
  "key": "copper",
  "name": "Copper",
  "unit": "µg",
  "group": "Minerals",
  "kind": "min",
  "target": 900,
  "ul": 10000,
  "ul_scope": "total",
  "usda": [
   1098
  ],
  "usda_nums": [
   "312"
  ],
  "advice": "Cashews, lentils, dark chocolate, mushrooms."
 },
 {
  "key": "manganese",
  "name": "Manganese",
  "unit": "mg",
  "group": "Minerals",
  "kind": "min",
  "target": 1.8,
  "ul": 11,
  "ul_scope": "supplement",
  "usda": [
   1101
  ],
  "usda_nums": [
   "315"
  ],
  "note": "Whole-grain vegan diets often get 8-12 mg from food alone, which is normal; the 11 mg limit matters for supplements, so don't take extra manganese.",
  "advice": "Whole grains, oats, nuts - usually easy on a vegan diet."
 },
 {
  "key": "selenium",
  "name": "Selenium",
  "unit": "µg",
  "group": "Minerals",
  "kind": "min",
  "target": 55,
  "ul": 400,
  "ul_scope": "total",
  "usda": [
   1103
  ],
  "usda_nums": [
   "317"
  ],
  "advice": "1-2 Brazil nuts a day covers it. Don't make it a handful - selenium is toxic in excess.",
  "dose": {
   "amount": 55,
   "label": "1-2 Brazil nuts"
  }
 },
 {
  "key": "iodine",
  "name": "Iodine",
  "unit": "µg",
  "group": "Minerals",
  "kind": "min",
  "target": 150,
  "ul": 1100,
  "ul_scope": "total",
  "usda": [
   1100
  ],
  "usda_nums": [
   "314"
  ],
  "note": "USDA has almost no iodine data and plant foods are low, so expect this to read near zero.",
  "advice": "A 150 µg potassium iodide supplement, or about 1/2 tsp of iodized salt a day. Avoid kelp supplements (doses are unreliable).",
  "dose": {
   "amount": 150,
   "label": "Iodine (potassium iodide)"
  },
  "always_recommend": true
 }
];
Z.DEFAULT_SETTINGS = {
 "targets": {
  "kcal": {
   "target": null,
   "enabled": false
  },
  "protein": {
   "target": 140,
   "enabled": true
  },
  "carbs": {
   "target": 350,
   "enabled": true
  },
  "fat": {
   "target": 70,
   "enabled": true
  },
  "fiber": {
   "target": 25,
   "enabled": true
  },
  "satfat": {
   "target": 28,
   "enabled": true
  },
  "ala": {
   "target": 1.1,
   "enabled": true
  },
  "epa_dha": {
   "target": 250,
   "enabled": true
  },
  "vit_a": {
   "target": 700,
   "enabled": true
  },
  "vit_c": {
   "target": 75,
   "enabled": true
  },
  "vit_d": {
   "target": 15,
   "enabled": true
  },
  "vit_e": {
   "target": 15,
   "enabled": true
  },
  "vit_k": {
   "target": 90,
   "enabled": true
  },
  "thiamin": {
   "target": 1.1,
   "enabled": true
  },
  "riboflavin": {
   "target": 1.1,
   "enabled": true
  },
  "niacin": {
   "target": 14,
   "enabled": true
  },
  "pantothenic": {
   "target": 5,
   "enabled": true
  },
  "b6": {
   "target": 1.3,
   "enabled": true
  },
  "folate": {
   "target": 400,
   "enabled": true
  },
  "b12": {
   "target": 2.4,
   "enabled": true
  },
  "choline": {
   "target": 425,
   "enabled": true
  },
  "calcium": {
   "target": 1000,
   "enabled": true
  },
  "iron": {
   "target": 32,
   "enabled": true
  },
  "magnesium": {
   "target": 310,
   "enabled": true
  },
  "phosphorus": {
   "target": 700,
   "enabled": true
  },
  "potassium": {
   "target": 2600,
   "enabled": true
  },
  "sodium": {
   "target": 2300,
   "enabled": true
  },
  "zinc": {
   "target": 12,
   "enabled": true
  },
  "copper": {
   "target": 900,
   "enabled": true
  },
  "manganese": {
   "target": 1.8,
   "enabled": true
  },
  "selenium": {
   "target": 55,
   "enabled": true
  },
  "iodine": {
   "target": 150,
   "enabled": true
  }
 },
 "usda_api_key": "",
 "supplements": [],
 "structure": {
  "Breakfast": [
   1,
   1
  ],
  "Main": [
   2,
   3
  ],
  "Snack": [
   0,
   2
  ],
  "Side": [
   0,
   2
  ],
  "Add-on": [
   0,
   3
  ]
 },
 "week": {
  "prep_day": "Sunday",
  "start_day": "Monday",
  "min_recipes": 3,
  "max_recipes": 4,
  "max_days_per_recipe": 7,
  "min_distinct": 3,
  "max_distinct": 6
 },
 "profile": {
  "name": "",
  "weight_lb": 140
 },
 "tracker": {
  "good_day": 85,
  "good_days_per_week": 5,
  "weeks_per_sticker": 4
 }
};
Z.STARTER_PANTRY = [
 {
  "key": "tofu",
  "name": "Tofu, firm (calcium-set)",
  "query": "tofu raw firm prepared with calcium sulfate",
  "must": [
   "tofu",
   "firm",
   "calcium sulfate"
  ],
  "avoid": [
   "fried",
   "dried"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Tofu & Plant Protein",
  "portions": [
   {
    "label": "block (14 oz)",
    "grams": 397
   },
   {
    "label": "cup",
    "grams": 252
   }
  ],
  "verify": false
 },
 {
  "key": "tempeh",
  "name": "Tempeh",
  "query": "tempeh",
  "must": [
   "tempeh"
  ],
  "avoid": [
   "cooked"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Tofu & Plant Protein",
  "portions": [
   {
    "label": "package (8 oz)",
    "grams": 227
   },
   {
    "label": "cup",
    "grams": 166
   }
  ],
  "verify": false
 },
 {
  "key": "tvp",
  "name": "TVP (textured soy protein, dry)",
  "query": "soy flour defatted",
  "must": [
   "soy flour",
   "defatted"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Tofu & Plant Protein",
  "portions": [
   {
    "label": "cup",
    "grams": 96
   }
  ],
  "verify": true
 },
 {
  "key": "edamame",
  "name": "Edamame, frozen, shelled",
  "query": "edamame frozen prepared",
  "must": [
   "edamame"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Frozen",
  "portions": [
   {
    "label": "cup",
    "grams": 155
   }
  ],
  "verify": false
 },
 {
  "key": "soymilk",
  "name": "Soy milk, fortified (calcium, A, D)",
  "query": "soymilk original and vanilla with added calcium vitamins A and D",
  "must": [
   "soymilk",
   "calcium"
  ],
  "avoid": [
   "unfortified"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Dairy-Free & Fridge",
  "portions": [
   {
    "label": "cup",
    "grams": 243
   }
  ],
  "verify": true
 },
 {
  "key": "pea_protein",
  "name": "Pea protein powder",
  "query": "pea protein powder unflavored",
  "must": [
   "pea protein"
  ],
  "avoid": [],
  "types": [
   "Branded"
  ],
  "aisle": "Tofu & Plant Protein",
  "portions": [
   {
    "label": "scoop",
    "grams": 30
   }
  ],
  "verify": true
 },
 {
  "key": "nooch",
  "name": "Nutritional yeast (fortified)",
  "query": "nutritional yeast flakes",
  "must": [
   "nutritional yeast"
  ],
  "avoid": [],
  "types": [
   "Branded"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 4
   },
   {
    "label": "cup",
    "grams": 60
   }
  ],
  "verify": true
 },
 {
  "key": "gluten",
  "name": "Vital wheat gluten",
  "query": "vital wheat gluten",
  "must": [
   "gluten"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Tofu & Plant Protein",
  "portions": [
   {
    "label": "cup",
    "grams": 120
   },
   {
    "label": "tbsp",
    "grams": 8
   }
  ],
  "verify": false
 },
 {
  "key": "chickpeas",
  "name": "Chickpeas, cooked/canned (drained)",
  "query": "chickpeas garbanzo mature seeds cooked boiled without salt",
  "must": [
   "chickpeas",
   "cooked"
  ],
  "avoid": [
   "with salt"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Beans & Legumes",
  "portions": [
   {
    "label": "can, drained",
    "grams": 240
   },
   {
    "label": "cup",
    "grams": 164
   }
  ],
  "verify": false
 },
 {
  "key": "black_beans",
  "name": "Black beans, cooked/canned (drained)",
  "query": "beans black mature seeds cooked boiled without salt",
  "must": [
   "black",
   "cooked"
  ],
  "avoid": [
   "with salt",
   "turtle"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Beans & Legumes",
  "portions": [
   {
    "label": "can, drained",
    "grams": 240
   },
   {
    "label": "cup",
    "grams": 172
   }
  ],
  "verify": false
 },
 {
  "key": "kidney_beans",
  "name": "Kidney beans, cooked/canned (drained)",
  "query": "beans kidney red mature seeds cooked boiled without salt",
  "must": [
   "kidney",
   "cooked"
  ],
  "avoid": [
   "with salt"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Beans & Legumes",
  "portions": [
   {
    "label": "can, drained",
    "grams": 240
   },
   {
    "label": "cup",
    "grams": 177
   }
  ],
  "verify": false
 },
 {
  "key": "lentils",
  "name": "Lentils, cooked",
  "query": "lentils mature seeds cooked boiled without salt",
  "must": [
   "lentils",
   "cooked"
  ],
  "avoid": [
   "with salt",
   "sprouted"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Beans & Legumes",
  "portions": [
   {
    "label": "cup",
    "grams": 198
   }
  ],
  "verify": false
 },
 {
  "key": "red_lentils",
  "name": "Red lentils, dry",
  "query": "lentils pink or red raw",
  "must": [
   "lentils",
   "raw"
  ],
  "avoid": [
   "sprouted"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Beans & Legumes",
  "portions": [
   {
    "label": "cup",
    "grams": 192
   }
  ],
  "verify": false
 },
 {
  "key": "peanut_butter",
  "name": "Peanut butter, natural",
  "query": "peanut butter smooth style without salt",
  "must": [
   "peanut butter"
  ],
  "avoid": [
   "reduced fat"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "tbsp",
    "grams": 16
   }
  ],
  "verify": false
 },
 {
  "key": "oats",
  "name": "Rolled oats",
  "query": "oats whole grain rolled old fashioned",
  "must": [
   "oats"
  ],
  "avoid": [
   "instant",
   "cooked"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Grains & Pasta",
  "portions": [
   {
    "label": "cup",
    "grams": 81
   }
  ],
  "verify": false
 },
 {
  "key": "brown_rice",
  "name": "Brown rice, dry",
  "query": "rice brown long-grain raw",
  "must": [
   "rice",
   "brown",
   "raw"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Grains & Pasta",
  "portions": [
   {
    "label": "cup",
    "grams": 185
   }
  ],
  "verify": false
 },
 {
  "key": "quinoa",
  "name": "Quinoa, dry",
  "query": "quinoa uncooked",
  "must": [
   "quinoa",
   "uncooked"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Grains & Pasta",
  "portions": [
   {
    "label": "cup",
    "grams": 170
   }
  ],
  "verify": false
 },
 {
  "key": "ww_pasta",
  "name": "Whole-wheat pasta, dry",
  "query": "pasta whole wheat dry",
  "must": [
   "pasta",
   "whole",
   "dry"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Grains & Pasta",
  "portions": [
   {
    "label": "cup (dry)",
    "grams": 92
   }
  ],
  "verify": false
 },
 {
  "key": "soba",
  "name": "Soba noodles, dry",
  "query": "noodles japanese soba dry",
  "must": [
   "soba",
   "dry"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Grains & Pasta",
  "portions": [
   {
    "label": "bundle (3 oz)",
    "grams": 85
   }
  ],
  "verify": false
 },
 {
  "key": "tortilla",
  "name": "Whole-wheat tortilla (large)",
  "query": "tortilla whole wheat",
  "must": [
   "tortilla"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy",
   "Branded"
  ],
  "aisle": "Grains & Pasta",
  "portions": [
   {
    "label": "tortilla",
    "grams": 70
   }
  ],
  "verify": true
 },
 {
  "key": "sweet_potato",
  "name": "Sweet potato",
  "query": "sweet potato raw unprepared",
  "must": [
   "sweet potato",
   "raw"
  ],
  "avoid": [
   "leaves"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "medium",
    "grams": 130
   },
   {
    "label": "cup, cubed",
    "grams": 133
   }
  ],
  "verify": false
 },
 {
  "key": "broccoli",
  "name": "Broccoli",
  "query": "broccoli raw",
  "must": [
   "broccoli",
   "raw"
  ],
  "avoid": [
   "chinese",
   "raab",
   "leaves",
   "stalks"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "cup, chopped",
    "grams": 91
   },
   {
    "label": "head",
    "grams": 608
   }
  ],
  "verify": false
 },
 {
  "key": "spinach",
  "name": "Spinach",
  "query": "spinach raw",
  "must": [
   "spinach",
   "raw"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "cup",
    "grams": 30
   }
  ],
  "verify": false
 },
 {
  "key": "kale",
  "name": "Kale",
  "query": "kale raw",
  "must": [
   "kale",
   "raw"
  ],
  "avoid": [
   "scotch"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "cup, chopped",
    "grams": 20
   }
  ],
  "verify": false
 },
 {
  "key": "onion",
  "name": "Onion",
  "query": "onions raw",
  "must": [
   "onions",
   "raw"
  ],
  "avoid": [
   "spring",
   "sweet",
   "dehydrated",
   "young green"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "medium",
    "grams": 110
   },
   {
    "label": "cup, chopped",
    "grams": 160
   }
  ],
  "verify": false
 },
 {
  "key": "garlic",
  "name": "Garlic",
  "query": "garlic raw",
  "must": [
   "garlic",
   "raw"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "clove",
    "grams": 3
   }
  ],
  "verify": false
 },
 {
  "key": "ginger",
  "name": "Ginger root",
  "query": "ginger root raw",
  "must": [
   "ginger",
   "raw"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "tbsp",
    "grams": 6
   }
  ],
  "verify": false
 },
 {
  "key": "bell_pepper",
  "name": "Red bell pepper",
  "query": "peppers sweet red raw",
  "must": [
   "sweet",
   "red",
   "raw"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "medium",
    "grams": 119
   },
   {
    "label": "cup, chopped",
    "grams": 149
   }
  ],
  "verify": false
 },
 {
  "key": "carrot",
  "name": "Carrot",
  "query": "carrots raw",
  "must": [
   "carrots",
   "raw"
  ],
  "avoid": [
   "baby"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "medium",
    "grams": 61
   },
   {
    "label": "cup, chopped",
    "grams": 128
   }
  ],
  "verify": false
 },
 {
  "key": "mushrooms",
  "name": "White mushrooms",
  "query": "mushrooms white raw",
  "must": [
   "mushrooms",
   "white",
   "raw"
  ],
  "avoid": [
   "exposed",
   "uv"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "cup, sliced",
    "grams": 70
   }
  ],
  "verify": false
 },
 {
  "key": "banana",
  "name": "Banana",
  "query": "bananas raw",
  "must": [
   "bananas",
   "raw"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "medium",
    "grams": 118
   }
  ],
  "verify": false
 },
 {
  "key": "blueberries",
  "name": "Blueberries, frozen",
  "query": "blueberries frozen unsweetened",
  "must": [
   "blueberries",
   "frozen"
  ],
  "avoid": [
   "frozen, sweetened"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Frozen",
  "portions": [
   {
    "label": "cup",
    "grams": 155
   }
  ],
  "verify": false
 },
 {
  "key": "lemon_juice",
  "name": "Lemon juice",
  "query": "lemon juice raw",
  "must": [
   "lemon juice"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Produce",
  "portions": [
   {
    "label": "tbsp",
    "grams": 15
   }
  ],
  "verify": false
 },
 {
  "key": "crushed_tomatoes",
  "name": "Crushed tomatoes, canned",
  "query": "tomatoes crushed canned",
  "must": [
   "tomatoes",
   "crushed"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "can (28 oz)",
    "grams": 794
   },
   {
    "label": "cup",
    "grams": 242
   }
  ],
  "verify": false
 },
 {
  "key": "tomato_paste",
  "name": "Tomato paste",
  "query": "tomato products canned paste without salt added",
  "must": [
   "paste"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 16
   }
  ],
  "verify": false
 },
 {
  "key": "chia",
  "name": "Chia seeds",
  "query": "seeds chia seeds dried",
  "must": [
   "chia"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "tbsp",
    "grams": 12
   }
  ],
  "verify": false
 },
 {
  "key": "flax",
  "name": "Ground flaxseed",
  "query": "seeds flaxseed",
  "must": [
   "flaxseed"
  ],
  "avoid": [
   "oil"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "tbsp",
    "grams": 7
   }
  ],
  "verify": false
 },
 {
  "key": "hemp",
  "name": "Hemp hearts",
  "query": "seeds hemp seed hulled",
  "must": [
   "hemp"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "tbsp",
    "grams": 10
   }
  ],
  "verify": false
 },
 {
  "key": "pumpkin_seeds",
  "name": "Pumpkin seeds (pepitas)",
  "query": "seeds pumpkin and squash seed kernels dried",
  "must": [
   "pumpkin",
   "kernels"
  ],
  "avoid": [
   "roasted",
   "salt"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "tbsp",
    "grams": 9
   },
   {
    "label": "cup",
    "grams": 129
   }
  ],
  "verify": false
 },
 {
  "key": "brazil_nuts",
  "name": "Brazil nuts",
  "query": "nuts brazilnuts dried unblanched",
  "must": [
   "brazilnuts"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "nut",
    "grams": 5
   }
  ],
  "verify": false
 },
 {
  "key": "sesame",
  "name": "Sesame seeds",
  "query": "seeds sesame seeds whole dried",
  "must": [
   "sesame",
   "whole"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "tbsp",
    "grams": 9
   }
  ],
  "verify": false
 },
 {
  "key": "tahini",
  "name": "Tahini",
  "query": "seeds sesame butter tahini",
  "must": [
   "tahini"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Nuts & Seeds",
  "portions": [
   {
    "label": "tbsp",
    "grams": 15
   }
  ],
  "verify": false
 },
 {
  "key": "olive_oil",
  "name": "Olive oil",
  "query": "oil olive salad or cooking",
  "must": [
   "olive"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 13.5
   },
   {
    "label": "tsp",
    "grams": 4.5
   }
  ],
  "verify": false
 },
 {
  "key": "soy_sauce",
  "name": "Soy sauce, reduced sodium",
  "query": "soy sauce low sodium",
  "must": [
   "soy sauce"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 16
   }
  ],
  "verify": true
 },
 {
  "key": "maple",
  "name": "Maple syrup",
  "query": "syrups maple",
  "must": [
   "maple"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 20
   }
  ],
  "verify": false
 },
 {
  "key": "dates",
  "name": "Medjool dates",
  "query": "dates medjool",
  "must": [
   "medjool"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "date",
    "grams": 24
   }
  ],
  "verify": false
 },
 {
  "key": "cocoa",
  "name": "Cocoa powder, unsweetened",
  "query": "cocoa dry powder unsweetened",
  "must": [
   "cocoa",
   "unsweetened"
  ],
  "avoid": [
   "dutch",
   "alkali"
  ],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 5.4
   }
  ],
  "verify": false
 },
 {
  "key": "coconut_milk",
  "name": "Coconut milk, canned",
  "query": "nuts coconut milk canned",
  "must": [
   "coconut milk",
   "canned"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "cup",
    "grams": 226
   },
   {
    "label": "can (13.5 oz)",
    "grams": 400
   }
  ],
  "verify": false
 },
 {
  "key": "broth",
  "name": "Vegetable broth, low sodium",
  "query": "soup vegetable broth ready to serve",
  "must": [
   "vegetable",
   "broth"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "cup",
    "grams": 240
   }
  ],
  "verify": true
 },
 {
  "key": "salsa",
  "name": "Salsa",
  "query": "sauce salsa ready-to-serve",
  "must": [
   "salsa"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 16
   },
   {
    "label": "cup",
    "grams": 259
   }
  ],
  "verify": false
 },
 {
  "key": "cornstarch",
  "name": "Cornstarch",
  "query": "cornstarch",
  "must": [
   "cornstarch"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tbsp",
    "grams": 8
   }
  ],
  "verify": false
 },
 {
  "key": "salt",
  "name": "Salt (iodized)",
  "query": "salt table",
  "must": [
   "salt",
   "table"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tsp",
    "grams": 6
   }
  ],
  "verify": false
 },
 {
  "key": "cumin",
  "name": "Ground cumin",
  "query": "spices cumin seed",
  "must": [
   "cumin"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tsp",
    "grams": 2.1
   }
  ],
  "verify": false
 },
 {
  "key": "chili_powder",
  "name": "Chili powder",
  "query": "spices chili powder",
  "must": [
   "chili powder"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tsp",
    "grams": 2.7
   }
  ],
  "verify": false
 },
 {
  "key": "curry_powder",
  "name": "Curry powder",
  "query": "spices curry powder",
  "must": [
   "curry"
  ],
  "avoid": [],
  "types": [
   "Foundation",
   "SR Legacy"
  ],
  "aisle": "Pantry & Spices",
  "portions": [
   {
    "label": "tsp",
    "grams": 2
   }
  ],
  "verify": false
 }
];
Z.STARTER_RECIPES = [
 {
  "seed_key": "Tofu Scramble Breakfast Burritos",
  "name": "Tofu Scramble Breakfast Burritos",
  "category": "Breakfast",
  "servings": 6,
  "ingredients": [
   {
    "key": "tofu",
    "amount": 2,
    "unit": "block (14 oz)",
    "note": "pressed, crumbled"
   },
   {
    "key": "black_beans",
    "amount": 1,
    "unit": "can, drained",
    "note": ""
   },
   {
    "key": "bell_pepper",
    "amount": 2,
    "unit": "medium",
    "note": "diced"
   },
   {
    "key": "onion",
    "amount": 1,
    "unit": "medium",
    "note": "diced"
   },
   {
    "key": "spinach",
    "amount": 4,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "nooch",
    "amount": 4,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "olive_oil",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "cumin",
    "amount": 2,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "chili_powder",
    "amount": 1,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "salt",
    "amount": 0.5,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "salsa",
    "amount": 6,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "tortilla",
    "amount": 6,
    "unit": "tortilla",
    "note": ""
   }
  ],
  "steps": "1. Heat the oil in a large skillet. Cook onion and pepper 5 min until soft.\n2. Add crumbled tofu, cumin, chili powder, salt and nutritional yeast. Cook 8 min, stirring, until lightly golden.\n3. Stir in black beans and spinach until the spinach wilts. Let the filling cool completely (prevents soggy burritos).\n4. Divide onto tortillas, add 1 Tbsp salsa each, roll tightly and wrap each in foil or parchment.\n5. Fridge: up to 4 days. Freezer: up to 3 months.\n6. Reheat: from fridge, microwave 1.5-2 min or skillet; from frozen, microwave 3-4 min (unwrapped, in a damp paper towel), flipping halfway.",
  "prep_min": 15,
  "cook_min": 20,
  "fridge_days": 4,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "high-protein",
   "grab-and-go"
  ],
  "notes": ""
 },
 {
  "seed_key": "Blueberry Protein Overnight Oats",
  "name": "Blueberry Protein Overnight Oats",
  "category": "Breakfast",
  "servings": 5,
  "ingredients": [
   {
    "key": "oats",
    "amount": 2.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "soymilk",
    "amount": 3.75,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "pea_protein",
    "amount": 2.5,
    "unit": "scoop",
    "note": ""
   },
   {
    "key": "chia",
    "amount": 5,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "flax",
    "amount": 5,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "hemp",
    "amount": 5,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "peanut_butter",
    "amount": 5,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "blueberries",
    "amount": 2.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "maple",
    "amount": 2.5,
    "unit": "tbsp",
    "note": ""
   }
  ],
  "steps": "1. In a big bowl, whisk soy milk, protein powder and maple syrup until smooth.\n2. Stir in oats, chia, flax and hemp.\n3. Divide into 5 jars. Top each with 1/2 cup blueberries and 1 Tbsp peanut butter.\n4. Refrigerate at least 6 hours. Eat cold or microwave 1-2 min.\n5. Keeps 4 days in the fridge - texture suffers if frozen, so the planner keeps these early in the week.",
  "prep_min": 10,
  "cook_min": 0,
  "fridge_days": 4,
  "freezes": false,
  "max_per_day": 1,
  "tags": [
   "no-cook"
  ],
  "notes": ""
 },
 {
  "seed_key": "Red Lentil, Chickpea & Tofu Coconut Curry",
  "name": "Red Lentil, Chickpea & Tofu Coconut Curry",
  "category": "Main",
  "servings": 6,
  "ingredients": [
   {
    "key": "red_lentils",
    "amount": 1.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "chickpeas",
    "amount": 2,
    "unit": "can, drained",
    "note": ""
   },
   {
    "key": "tofu",
    "amount": 1,
    "unit": "block (14 oz)",
    "note": "cubed"
   },
   {
    "key": "coconut_milk",
    "amount": 1,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "crushed_tomatoes",
    "amount": 1,
    "unit": "can (28 oz)",
    "note": ""
   },
   {
    "key": "broth",
    "amount": 3,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "onion",
    "amount": 1,
    "unit": "cup, chopped",
    "note": ""
   },
   {
    "key": "garlic",
    "amount": 4,
    "unit": "clove",
    "note": ""
   },
   {
    "key": "ginger",
    "amount": 1,
    "unit": "tbsp",
    "note": "grated"
   },
   {
    "key": "curry_powder",
    "amount": 6,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "cumin",
    "amount": 1,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "spinach",
    "amount": 6,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "lemon_juice",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "salt",
    "amount": 1,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "brown_rice",
    "amount": 2,
    "unit": "cup",
    "note": "cooked separately"
   }
  ],
  "steps": "1. Start the rice: 2 cups brown rice + 4 cups water, simmer covered 40-45 min.\n2. Meanwhile, sauté onion 5 min in a splash of broth. Add garlic, ginger, curry powder and cumin; cook 1 min.\n3. Add lentils, tomatoes, broth and coconut milk. Simmer 20 min until lentils are soft.\n4. Add chickpeas and tofu; simmer 5 min. Stir in spinach, lemon juice and salt.\n5. Portion curry and rice into 6 containers. Freezes very well (up to 3 months).",
  "prep_min": 15,
  "cook_min": 45,
  "fridge_days": 4,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "freezer-friendly",
   "one-pot"
  ],
  "notes": ""
 },
 {
  "seed_key": "Tempeh Bolognese with Whole-Wheat Pasta",
  "name": "Tempeh Bolognese with Whole-Wheat Pasta",
  "category": "Main",
  "servings": 6,
  "ingredients": [
   {
    "key": "tempeh",
    "amount": 2,
    "unit": "package (8 oz)",
    "note": "crumbled"
   },
   {
    "key": "red_lentils",
    "amount": 0.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "crushed_tomatoes",
    "amount": 1,
    "unit": "can (28 oz)",
    "note": ""
   },
   {
    "key": "tomato_paste",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "onion",
    "amount": 1,
    "unit": "medium",
    "note": "finely diced"
   },
   {
    "key": "carrot",
    "amount": 2,
    "unit": "medium",
    "note": "finely diced"
   },
   {
    "key": "mushrooms",
    "amount": 2,
    "unit": "cup, sliced",
    "note": "chopped"
   },
   {
    "key": "garlic",
    "amount": 4,
    "unit": "clove",
    "note": ""
   },
   {
    "key": "olive_oil",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "soy_sauce",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "nooch",
    "amount": 3,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "salt",
    "amount": 0.5,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "ww_pasta",
    "amount": 450,
    "unit": "g",
    "note": ""
   }
  ],
  "steps": "1. Heat oil; cook onion, carrot and mushrooms 8 min. Add crumbled tempeh and soy sauce; brown 5 min.\n2. Add garlic and tomato paste, cook 1 min. Add crushed tomatoes, red lentils and 1.5 cups water.\n3. Simmer 20 min, stirring, until lentils melt into the sauce. Stir in nutritional yeast and salt.\n4. Cook pasta 1 min short of al dente (it softens on reheating). Toss with a little sauce so it doesn't clump.\n5. Portion pasta + sauce into 6 containers. Freezes well; add a splash of water when reheating.",
  "prep_min": 15,
  "cook_min": 35,
  "fridge_days": 4,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "freezer-friendly"
  ],
  "notes": ""
 },
 {
  "seed_key": "Black Bean, Sweet Potato & TVP Chili",
  "name": "Black Bean, Sweet Potato & TVP Chili",
  "category": "Main",
  "servings": 6,
  "ingredients": [
   {
    "key": "tvp",
    "amount": 1.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "black_beans",
    "amount": 2,
    "unit": "can, drained",
    "note": ""
   },
   {
    "key": "kidney_beans",
    "amount": 1,
    "unit": "can, drained",
    "note": ""
   },
   {
    "key": "sweet_potato",
    "amount": 2,
    "unit": "medium",
    "note": "1/2-inch cubes"
   },
   {
    "key": "crushed_tomatoes",
    "amount": 1,
    "unit": "can (28 oz)",
    "note": ""
   },
   {
    "key": "broth",
    "amount": 2,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "onion",
    "amount": 1,
    "unit": "medium",
    "note": ""
   },
   {
    "key": "bell_pepper",
    "amount": 2,
    "unit": "medium",
    "note": ""
   },
   {
    "key": "garlic",
    "amount": 4,
    "unit": "clove",
    "note": ""
   },
   {
    "key": "chili_powder",
    "amount": 6,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "cumin",
    "amount": 2,
    "unit": "tsp",
    "note": ""
   },
   {
    "key": "cocoa",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "olive_oil",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "quinoa",
    "amount": 1,
    "unit": "cup",
    "note": "rinsed"
   },
   {
    "key": "salt",
    "amount": 1,
    "unit": "tsp",
    "note": ""
   }
  ],
  "steps": "1. Heat oil; cook onion and peppers 5 min. Add garlic, chili powder, cumin and cocoa; cook 1 min.\n2. Add tomatoes, broth, sweet potato, quinoa, TVP, beans and 2 cups water.\n3. Simmer 30 min, partly covered, until sweet potato is tender and quinoa is cooked. Add water if it gets too thick.\n4. Season with salt. Cool, portion into 6 containers. Freezes for 3+ months.",
  "prep_min": 15,
  "cook_min": 35,
  "fridge_days": 4,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "freezer-friendly",
   "one-pot"
  ],
  "notes": ""
 },
 {
  "seed_key": "Teriyaki Tofu & Edamame Rice Bowls",
  "name": "Teriyaki Tofu & Edamame Rice Bowls",
  "category": "Main",
  "servings": 5,
  "ingredients": [
   {
    "key": "tofu",
    "amount": 2,
    "unit": "block (14 oz)",
    "note": "pressed, cubed"
   },
   {
    "key": "edamame",
    "amount": 2.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "broccoli",
    "amount": 5,
    "unit": "cup, chopped",
    "note": ""
   },
   {
    "key": "carrot",
    "amount": 2,
    "unit": "medium",
    "note": "sliced"
   },
   {
    "key": "brown_rice",
    "amount": 1.75,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "soy_sauce",
    "amount": 5,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "maple",
    "amount": 3,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "garlic",
    "amount": 3,
    "unit": "clove",
    "note": ""
   },
   {
    "key": "ginger",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "cornstarch",
    "amount": 2,
    "unit": "tbsp",
    "note": "1 for tofu, 1 for sauce"
   },
   {
    "key": "olive_oil",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "sesame",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   }
  ],
  "steps": "1. Cook rice (1.75 cups rice + 3.5 cups water, ~45 min).\n2. Toss tofu with the oil and 1 Tbsp cornstarch; bake at 425°F for 25 min, flipping once.\n3. Roast broccoli and carrots on a second tray for the last 15 min.\n4. Sauce: whisk soy sauce, maple, garlic, ginger, the other 1 Tbsp cornstarch and 1/3 cup water; simmer 2 min until glossy.\n5. Toss tofu in sauce. Build 5 bowls: rice, tofu, broccoli, carrots, 1/2 cup edamame, sesame seeds.\n6. Fridge 4 days, or freeze (broccoli softens a little).",
  "prep_min": 20,
  "cook_min": 45,
  "fridge_days": 4,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "high-protein"
  ],
  "notes": ""
 },
 {
  "seed_key": "Peanut Soba Noodles with Tempeh",
  "name": "Peanut Soba Noodles with Tempeh",
  "category": "Main",
  "servings": 5,
  "ingredients": [
   {
    "key": "soba",
    "amount": 400,
    "unit": "g",
    "note": ""
   },
   {
    "key": "tempeh",
    "amount": 2,
    "unit": "package (8 oz)",
    "note": "sliced"
   },
   {
    "key": "edamame",
    "amount": 2,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "carrot",
    "amount": 2,
    "unit": "medium",
    "note": "julienned"
   },
   {
    "key": "bell_pepper",
    "amount": 2,
    "unit": "medium",
    "note": "sliced"
   },
   {
    "key": "peanut_butter",
    "amount": 5,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "soy_sauce",
    "amount": 3,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "lemon_juice",
    "amount": 3,
    "unit": "tbsp",
    "note": "or lime"
   },
   {
    "key": "maple",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "ginger",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "garlic",
    "amount": 2,
    "unit": "clove",
    "note": ""
   },
   {
    "key": "sesame",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   }
  ],
  "steps": "1. Steam tempeh slices 10 min (removes bitterness), then pan-sear with 1 Tbsp of the soy sauce until browned.\n2. Cook soba per package, rinse under cold water, drain well.\n3. Whisk peanut butter, remaining soy sauce, lemon juice, maple, ginger, garlic and 4-6 Tbsp warm water.\n4. Toss noodles, vegetables and edamame with sauce; top with tempeh and sesame seeds. Portion into 5 containers.\n5. Eat cold or room temp. Best within 4 days - soba doesn't freeze well.",
  "prep_min": 20,
  "cook_min": 20,
  "fridge_days": 4,
  "freezes": false,
  "max_per_day": 2,
  "tags": [
   "no-reheat"
  ],
  "notes": ""
 },
 {
  "seed_key": "Lemony Lentil Quinoa Power Salad",
  "name": "Lemony Lentil Quinoa Power Salad",
  "category": "Main",
  "servings": 5,
  "ingredients": [
   {
    "key": "lentils",
    "amount": 3,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "quinoa",
    "amount": 1.25,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "chickpeas",
    "amount": 1,
    "unit": "can, drained",
    "note": ""
   },
   {
    "key": "kale",
    "amount": 5,
    "unit": "cup, chopped",
    "note": ""
   },
   {
    "key": "bell_pepper",
    "amount": 1,
    "unit": "medium",
    "note": ""
   },
   {
    "key": "pumpkin_seeds",
    "amount": 8,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "olive_oil",
    "amount": 3,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "tahini",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "lemon_juice",
    "amount": 4,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "garlic",
    "amount": 1,
    "unit": "clove",
    "note": ""
   },
   {
    "key": "salt",
    "amount": 0.75,
    "unit": "tsp",
    "note": ""
   }
  ],
  "steps": "1. Cook quinoa (1.25 cups + 2.5 cups water, 15 min), cool.\n2. Massage kale with 1 tsp of the oil and a pinch of salt for 1 minute (keeps it tender for days).\n3. Whisk tahini, lemon juice, remaining oil, garlic, salt and 2-3 Tbsp water.\n4. Toss everything except pumpkin seeds; portion into 5 containers and top with seeds.\n5. Fridge 4 days. Doesn't freeze.",
  "prep_min": 20,
  "cook_min": 15,
  "fridge_days": 4,
  "freezes": false,
  "max_per_day": 2,
  "tags": [
   "no-reheat",
   "iron + vitamin C"
  ],
  "notes": ""
 },
 {
  "seed_key": "Roasted Garlic Broccoli & Sweet Potatoes",
  "name": "Roasted Garlic Broccoli & Sweet Potatoes",
  "category": "Side",
  "servings": 6,
  "ingredients": [
   {
    "key": "sweet_potato",
    "amount": 4,
    "unit": "medium",
    "note": "cubed"
   },
   {
    "key": "broccoli",
    "amount": 6,
    "unit": "cup, chopped",
    "note": ""
   },
   {
    "key": "olive_oil",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "garlic",
    "amount": 3,
    "unit": "clove",
    "note": ""
   },
   {
    "key": "lemon_juice",
    "amount": 1,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "salt",
    "amount": 0.5,
    "unit": "tsp",
    "note": ""
   }
  ],
  "steps": "1. Toss sweet potatoes with half the oil and salt; roast at 425°F for 15 min.\n2. Add broccoli, garlic and remaining oil; roast 15 more minutes.\n3. Squeeze lemon over, cool, portion. Fridge 4 days.",
  "prep_min": 10,
  "cook_min": 30,
  "fridge_days": 4,
  "freezes": false,
  "max_per_day": 2,
  "tags": [
   "vitamin A",
   "vitamin C"
  ],
  "notes": ""
 },
 {
  "seed_key": "PB Chocolate Protein Energy Bites",
  "name": "PB Chocolate Protein Energy Bites",
  "category": "Snack",
  "servings": 8,
  "ingredients": [
   {
    "key": "oats",
    "amount": 1.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "peanut_butter",
    "amount": 8,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "pea_protein",
    "amount": 3,
    "unit": "scoop",
    "note": ""
   },
   {
    "key": "dates",
    "amount": 8,
    "unit": "date",
    "note": "pitted"
   },
   {
    "key": "cocoa",
    "amount": 3,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "chia",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "flax",
    "amount": 2,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "soymilk",
    "amount": 0.25,
    "unit": "cup",
    "note": ""
   }
  ],
  "steps": "1. Pulse dates in a food processor until a paste forms.\n2. Add everything else and pulse until it holds together when pressed (add soy milk 1 Tbsp at a time if dry).\n3. Roll into 24 balls (1 serving = 3 bites). Fridge 1 week or freeze 3 months.",
  "prep_min": 20,
  "cook_min": 0,
  "fridge_days": 7,
  "freezes": true,
  "max_per_day": 1,
  "tags": [
   "no-cook"
  ],
  "notes": ""
 },
 {
  "seed_key": "Berry Spinach Protein Smoothie Packs",
  "name": "Berry Spinach Protein Smoothie Packs",
  "category": "Snack",
  "servings": 5,
  "ingredients": [
   {
    "key": "banana",
    "amount": 5,
    "unit": "medium",
    "note": "sliced, frozen in the pack"
   },
   {
    "key": "blueberries",
    "amount": 2.5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "spinach",
    "amount": 5,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "pea_protein",
    "amount": 5,
    "unit": "scoop",
    "note": ""
   },
   {
    "key": "flax",
    "amount": 5,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "soymilk",
    "amount": 5,
    "unit": "cup",
    "note": "added when blending"
   }
  ],
  "steps": "1. Fill 5 freezer bags, each with 1 sliced banana, 1/2 cup blueberries, 1 cup spinach, 1 scoop protein and 1 Tbsp flax.\n2. Freeze flat.\n3. To serve: empty a pack into the blender with 1 cup soy milk and blend 60 seconds.",
  "prep_min": 10,
  "cook_min": 0,
  "fridge_days": 7,
  "freezes": true,
  "max_per_day": 1,
  "tags": [
   "freezer pack"
  ],
  "notes": "The packs live in the freezer, so they're good any day of the week."
 },
 {
  "seed_key": "Fresh Fruit (banana + berries)",
  "name": "Fresh Fruit (banana + berries)",
  "category": "Snack",
  "servings": 1,
  "ingredients": [
   {
    "key": "banana",
    "amount": 1,
    "unit": "medium",
    "note": ""
   },
   {
    "key": "blueberries",
    "amount": 0.5,
    "unit": "cup",
    "note": "thawed, or any fresh berries"
   }
  ],
  "steps": "No prep - keep bananas on the counter and berries in the freezer. Easy carbs and potassium.",
  "prep_min": 0,
  "cook_min": 0,
  "fridge_days": 7,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "no-prep",
   "carbs"
  ],
  "notes": ""
 },
 {
  "seed_key": "Simple Brown Rice",
  "name": "Simple Brown Rice",
  "category": "Side",
  "servings": 6,
  "ingredients": [
   {
    "key": "brown_rice",
    "amount": 2,
    "unit": "cup",
    "note": ""
   },
   {
    "key": "salt",
    "amount": 0.25,
    "unit": "tsp",
    "note": ""
   }
  ],
  "steps": "1. Rinse rice. Bring 2 cups rice + 4 cups water + salt to a boil.\n2. Cover, simmer on low 40-45 min, then rest 10 min covered.\n3. Cool quickly (spread on a tray), portion into 6 containers (~2/3 cup cooked each). Freezes well.",
  "prep_min": 5,
  "cook_min": 45,
  "fridge_days": 4,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "carbs"
  ],
  "notes": ""
 },
 {
  "seed_key": "Brazil Nuts (selenium)",
  "name": "Brazil Nuts (selenium)",
  "category": "Add-on",
  "servings": 15,
  "ingredients": [
   {
    "key": "brazil_nuts",
    "amount": 30,
    "unit": "nut",
    "note": ""
   }
  ],
  "steps": "1 serving = 2 Brazil nuts. Don't eat more than ~4 a day (selenium becomes too much).",
  "prep_min": 0,
  "cook_min": 0,
  "fridge_days": 30,
  "freezes": true,
  "max_per_day": 1,
  "tags": [
   "micronutrient boost"
  ],
  "notes": ""
 },
 {
  "seed_key": "Pumpkin & Hemp Seed Topper",
  "name": "Pumpkin & Hemp Seed Topper",
  "category": "Add-on",
  "servings": 7,
  "ingredients": [
   {
    "key": "pumpkin_seeds",
    "amount": 14,
    "unit": "tbsp",
    "note": ""
   },
   {
    "key": "hemp",
    "amount": 7,
    "unit": "tbsp",
    "note": ""
   }
  ],
  "steps": "Mix and store in a jar. 1 serving = 3 Tbsp - sprinkle on bowls, oats or salads. Zinc, iron, magnesium.",
  "prep_min": 2,
  "cook_min": 0,
  "fridge_days": 30,
  "freezes": true,
  "max_per_day": 1,
  "tags": [
   "micronutrient boost"
  ],
  "notes": ""
 },
 {
  "seed_key": "Glass of Fortified Soy Milk",
  "name": "Glass of Fortified Soy Milk",
  "category": "Add-on",
  "servings": 1,
  "ingredients": [
   {
    "key": "soymilk",
    "amount": 1,
    "unit": "cup",
    "note": ""
   }
  ],
  "steps": "1 cup. Shake the carton well - the added calcium settles to the bottom.",
  "prep_min": 0,
  "cook_min": 0,
  "fridge_days": 7,
  "freezes": true,
  "max_per_day": 2,
  "tags": [
   "calcium",
   "vitamin D"
  ],
  "notes": ""
 }
];
})(globalThis.Z = globalThis.Z || {});
