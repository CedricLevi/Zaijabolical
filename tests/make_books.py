"""Builds small test cookbooks (EPUB and PDF) in very different layouts, with original text written for these tests.
Run: python tests/make_books.py   ->  tests/fixtures/books/
The books are only for the import tests; nothing from them is added to the app."""
import io, os, zipfile, random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "books")
os.makedirs(OUT, exist_ok=True)

def photo(seed, w=900, h=700, big=True):
    """a fake food photo: noisy plate on a table (noise keeps the JPEG above the 'decoration' size)"""
    rnd = random.Random(seed)
    im = Image.new("RGB", (w, h), (rnd.randint(150, 220), rnd.randint(120, 190), rnd.randint(90, 160)))
    d = ImageDraw.Draw(im)
    d.ellipse((w * .15, h * .12, w * .85, h * .9), fill=(250, 248, 240))
    for _ in range(900 if big else 30):
        x, y, r = rnd.randint(int(w * .25), int(w * .75)), rnd.randint(int(h * .22), int(h * .8)), rnd.randint(4, 22)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255)))
    b = io.BytesIO(); im.save(b, "JPEG", quality=92); return b.getvalue()

def ornament():
    im = Image.new("RGB", (120, 20), (255, 255, 255)); ImageDraw.Draw(im).line((0, 10, 120, 10), fill=(120, 80, 40), width=3)
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()

def epub(path, title, docs, images, nav):
    """docs: [(filename, xhtml body)], images: {name: bytes}, nav: [(title, href, children)]"""
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        items = "".join(f'<item id="d{i}" href="text/{n}" media-type="application/xhtml+xml"/>' for i, (n, _) in enumerate(docs))
        items += "".join(f'<item id="i{i}" href="images/{n}" media-type="image/{"png" if n.endswith("png") else "jpeg"}"/>' for i, n in enumerate(images))
        items += '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
        spine = "".join(f'<itemref idref="d{i}"/>' for i in range(len(docs)))
        z.writestr("OEBPS/content.opf", f'<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>{title}</dc:title><dc:creator>Test Kitchen</dc:creator><dc:identifier id="id">test-{title}</dc:identifier></metadata><manifest>{items}</manifest><spine>{spine}</spine></package>')
        def li(entries):
            return "<ol>" + "".join(f'<li><a href="text/{h}">{t}</a>{li(c) if c else ""}</li>' for t, h, c in entries) + "</ol>"
        z.writestr("OEBPS/nav.xhtml", f'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc">{li(nav)}</nav></body></html>')
        for n, body in docs:
            z.writestr(f"OEBPS/text/{n}", f'<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title><script>var tracking=1;</script></head><body>{body}</body></html>')
        for n, data in images.items():
            z.writestr(f"OEBPS/images/{n}", data, compress_type=zipfile.ZIP_STORED)

# ---------------------------------------------------------------- 1. tagged book (classes on every part)
R1 = [
    ("Smoky Black Bean Soup", "Serves 4 · Time: 40 minutes", "A weeknight soup that tastes like it simmered all day.",
     ["2 tablespoons olive oil", "1 large onion, diced", "3 cloves garlic, minced", "2 (15-ounce) cans black beans, drained and rinsed",
      "4 cups vegetable broth", "1 teaspoon smoked paprika", "½ teaspoon ground cumin", "Salt and pepper to taste"],
     ["Warm the oil in a soup pot over medium heat. Add the onion and cook until soft, about 7 minutes.",
      "Add the garlic, paprika and cumin and stir for 1 minute.", "Add the beans and broth, bring to a simmer and cook for 20 minutes.",
      "Blend half of the soup, stir it back in and season with salt and pepper."]),
    ("Peanut Tofu Noodles", "Serves 4 · Time: 30 minutes", "Chewy noodles in a gingery peanut sauce.",
     ["1 (14-ounce) block extra-firm tofu, pressed and cubed", "8 ounces rice noodles", "⅓ cup peanut butter", "3 tablespoons soy sauce",
      "1 tablespoon maple syrup", "1 tablespoon grated ginger", "2 cups shredded red cabbage"],
     ["Bake the tofu at 400°F for 25 minutes, turning once.", "Cook the noodles according to the package and rinse with cold water.",
      "Whisk the peanut butter, soy sauce, maple syrup and ginger with ¼ cup hot water.", "Toss everything together with the cabbage."]),
    ("Lemony Lentil Salad", "Serves 6 · Time: 35 minutes (15 active)", "Keeps for days in the fridge.",
     ["1 cup green lentils", "1 cucumber, diced", "1 cup cherry tomatoes, halved", "¼ cup olive oil", "Juice of 1 lemon", "2 tablespoons chopped parsley"],
     ["Simmer the lentils in plenty of water for 20 minutes until tender, then drain and cool.",
      "Whisk the oil and lemon juice, toss with the lentils and vegetables and finish with parsley."]),
    ("Honey Butter Carrots", "Serves 4 · Time: 25 minutes", "A side from a friend's family cookbook.",
     ["1 pound carrots, sliced", "2 tablespoons butter", "1 tablespoon honey", "Pinch of salt"],
     ["Steam the carrots until just tender, about 10 minutes.", "Melt the butter with the honey, toss with the carrots and salt."]),
]
def tagged_doc(t, y, head, ings, steps):
    return (f'<section class="chapter"><div class="decoration"><img class="ornament" src="../images/orn.png" alt=""/></div>'
            f'<h2 class="recipe-title">{t}</h2><div class="recipe"><p class="yield">{y}</p><div class="headnote"><p>{head}</p></div>'
            f'<div class="ingredients">' + "".join(f'<p class="ingredient">{i}</p>' for i in ings) + '</div>'
            f'<div class="procedure">' + "".join(f'<p class="step">{s}</p>' for s in steps) + '</div>'
            f'<p class="recipe-note">Tip: leftovers freeze well.</p></div></section>')
docs, images = [("intro.xhtml", "<h1>Introduction</h1><p>" + "This is a test book about cooking. " * 30 + "</p>")], {"orn.png": ornament()}
nav = [("Introduction", "intro.xhtml", [])]
chapter_docs = []
for k, r in enumerate(R1):
    docs.append((f"r{k}.xhtml", tagged_doc(*r)))
    chapter_docs.append((r[0], f"r{k}.xhtml", []))
    if k in (0, 1):   # a full-page photo right after the recipe it shows
        images[f"p{k}.jpg"] = photo(k)
        docs.append((f"photo{k}.xhtml", f'<div class="image_full"><img src="../images/p{k}.jpg" alt="Book image"/></div>'))
nav.append(("Soups, Bowls and Sides", "r0.xhtml", chapter_docs))
epub(os.path.join(OUT, "tagged.epub"), "Tagged Test Kitchen", docs, images, nav)

# ---------------------------------------------------------------- 2. headings and lists, several recipes per page, photo inside recipe
R2 = [
    ("Overnight Oats with Berries", "Makes 2 jars", ["1 cup rolled oats", "1 cup soy milk", "2 tablespoons chia seeds", "1 cup mixed berries"],
     ["Stir the oats, soy milk and chia seeds together in two jars.", "Top with berries, cover and refrigerate overnight."]),
    ("Chickpea Scramble", "Serves 2. Prep time 5 minutes, cook time 10 minutes", ["1 cup chickpea flour", "1 cup water", "½ teaspoon turmeric", "1 green onion, sliced"],
     ["Whisk the chickpea flour, water and turmeric into a smooth batter.", "Cook in an oiled skillet, stirring, until set, about 8 minutes, then add the green onion."]),
]
body = "<h1>Breakfast</h1><p>" + "Mornings should be easy. " * 3 + "</p>"
for k, (t, y, ings, steps) in enumerate(R2):
    images[f"b{k}.jpg"] = photo(10 + k)
    body += (f"<h2>{t}</h2><p><em>{y}</em></p><figure><img src='../images/b{k}.jpg' alt='{t}'/><figcaption>{t}</figcaption></figure>"
             f"<h3>Ingredients</h3><ul>" + "".join(f"<li>{i}</li>" for i in ings) + "</ul><h3>Method</h3><ol>" + "".join(f"<li>{s}</li>" for s in steps) + "</ol>")
epub(os.path.join(OUT, "headings.epub"), "Morning Book", [("breakfast.xhtml", body)], {f"b{k}.jpg": images[f"b{k}.jpg"] for k in range(2)},
     [("Breakfast", "breakfast.xhtml", [])])

# ---------------------------------------------------------------- 3. no tags, no headings: bold-paragraph titles, plus one recipe written as prose
body = ("<p class='ct'>SAUCES</p><p>Sauces make everything better.</p>"
        "<p class='rt'><b>Green Tahini Sauce</b></p><p>Makes about 1 cup</p><p>½ cup tahini</p><p>⅓ cup water</p><p>1 cup fresh cilantro</p><p>1 clove garlic</p>"
        "<p>Blend everything until smooth and bright green, adding more water if it is too thick to pour.</p>"
        "<p class='rt'><b>Quick Pickled Onions</b></p><p>Makes 1 jar</p><p>1 red onion, thinly sliced</p><p>¾ cup apple cider vinegar</p><p>1 teaspoon sugar</p><p>1 teaspoon salt</p>"
        "<p>Pack the onion into a jar. Warm the vinegar with the sugar and salt until dissolved, pour it over and leave for 30 minutes.</p>"
        "<p class='rt'><b>Grandma's Garlic Bread Crumbs</b></p><p>For these you want a cup of stale bread blitzed into crumbs, two tablespoons of olive oil and a clove of garlic. "
        "Toast it all in a pan until golden. Makes enough for two pasta dinners and serves 4 people.</p>")
epub(os.path.join(OUT, "plain.epub"), "Plain Sauces", [("sauces.xhtml", body)], {}, [("Sauces", "sauces.xhtml", [])])

# ---------------------------------------------------------------- 4. PDF: big titles, two columns, a photo on the page, a full-page photo
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
pdf_path = os.path.join(OUT, "book.pdf")
c = canvas.Canvas(pdf_path, pagesize=letter)
W, H = letter
c.setTitle("PDF Test Cookbook")
def recipe_page(title, yld, ings, steps, img=None):
    c.setFont("Helvetica-Bold", 24); c.drawString(54, H - 80, title)
    c.setFont("Helvetica-Oblique", 11); c.drawString(54, H - 104, yld)
    y = H - 140
    if img:
        c.drawImage(ImageReader(io.BytesIO(img)), W / 2 + 10, H - 360, width=W / 2 - 64, height=220)
    c.setFont("Helvetica-Bold", 12); c.drawString(54, y, "Ingredients"); y -= 18
    c.setFont("Helvetica", 11)
    for i in ings: c.drawString(54, y, i); y -= 15
    y -= 12; c.setFont("Helvetica-Bold", 12); c.drawString(54, y, "Method"); y -= 18; c.setFont("Helvetica", 11)
    for n, s in enumerate(steps, 1):
        words, line = (f"{n}. " + s).split(), ""
        for w in words:
            if c.stringWidth(line + " " + w, "Helvetica", 11) > (W / 2 - 70 if img and y > H - 380 else W - 108): c.drawString(54, y, line.strip()); y -= 14; line = ""
            line += " " + w
        c.drawString(54, y, line.strip()); y -= 20
    c.setFont("Helvetica", 9); c.drawString(W / 2, 30, str(c.getPageNumber()))
    c.showPage()
c.setFont("Helvetica-Bold", 30); c.drawString(54, H - 200, "PDF Test Cookbook"); c.showPage()
recipe_page("Roasted Chickpea Wraps", "Serves 4 | Total time: 45 minutes",
            ["2 cans chickpeas, drained", "1 tablespoon olive oil", "1 teaspoon smoked paprika", "4 large tortillas", "2 cups spinach", "½ cup hummus"],
            ["Heat the oven to 425°F. Toss the chickpeas with the oil and paprika and roast for 25 minutes.",
             "Spread each tortilla with hummus, add spinach and chickpeas and roll up tightly."], img=photo(30))
recipe_page("Coconut Red Lentil Curry", "Serves 6 | Time: 50 minutes",
            ["1½ cups red lentils", "1 (13.5-ounce) can coconut milk", "3 cups water", "2 tablespoons curry powder", "1 onion, chopped", "2 cups chopped kale"],
            ["Soften the onion in a large pot with a splash of water for 5 minutes.",
             "Add the lentils, coconut milk, water and curry powder and simmer for 25 minutes, stirring often.",
             "Stir in the kale until wilted and season to taste."])
c.drawImage(ImageReader(io.BytesIO(photo(31, 900, 1150))), 36, 36, width=W - 72, height=H - 72); c.showPage()   # full-page photo of the curry
c.save()
print("books written to", OUT)

# ---------------------------------------------------------------- 5. schema.org microdata, ingredients in a table, title on the page before
body1 = "<h1>Baked Sweet Potato Fries</h1><p>Crispy without a fryer.</p>"
body2 = ("<div itemscope='' itemtype='http://schema.org/Recipe'><p itemprop='recipeYield'>Serves 3</p>"
         "<table><tr itemprop='recipeIngredient'><td>2</td><td>large sweet potatoes, cut into sticks</td></tr>"
         "<tr itemprop='recipeIngredient'><td>1 tbsp</td><td>cornstarch</td></tr><tr itemprop='recipeIngredient'><td>1 tbsp</td><td>olive oil</td></tr>"
         "<tr itemprop='recipeIngredient'><td>½ tsp</td><td>garlic powder</td></tr></table>"
         "<ol><li itemprop='recipeInstructions'>Heat the oven to 425°F and line a baking sheet with parchment.</li>"
         "<li itemprop='recipeInstructions'>Toss the potatoes with cornstarch, then oil and garlic powder, and bake for 30 minutes, flipping halfway.</li></ol></div>")
epub(os.path.join(OUT, "microdata.epub"), "Side Dishes", [("fries1.xhtml", body1), ("fries2.xhtml", body2)], {}, [("Sides", "fries1.xhtml", [])])
print("microdata book written")
