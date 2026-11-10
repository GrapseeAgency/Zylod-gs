#!/usr/bin/env python3
"""t298 pass 2 — the metas' summary/bullets still describe the OLD curated
body; make them state the REAL data source (honest metadata doctrine)."""
import re, sys

ROOT = "/home/z/my-project/android/app/src/main/java/com/zylod/wholesale/ui/screens"

SCREENS = [
    ("agriculture-food", "AgricultureFoodScreen", "AgricultureFood"),
    ("automotive", "AutomotiveScreen", "Automotive"),
    ("beauty-personal-care", "BeautyPersonalCareScreen", "BeautyPersonalCare"),
    ("books-stationery", "BooksStationeryScreen", "BooksStationery"),
    ("construction", "ConstructionScreen", "Construction"),
    ("electronics", "ElectronicsScreen", "Electronics"),
    ("furniture", "FurnitureScreen", "Furniture"),
    ("garments", "GarmentsScreen", "Garments"),
    ("gifts-crafts", "GiftsCraftsScreen", "GiftsCrafts"),
    ("home-garden", "HomeGardenScreen", "HomeGarden"),
    ("jewelry", "JewelryScreen", "Jewelry"),
    ("led-lighting", "LedLightingScreen", "LedLighting"),
    ("medical-supplies", "MedicalSuppliesScreen", "MedicalSupplies"),
    ("mobile-accessories", "MobileAccessoriesScreen", "MobileAccessories"),
    ("packaging", "PackagingScreen", "Packaging"),
    ("promotional-items", "PromotionalItemsScreen", "PromotionalItems"),
    ("spices", "SpicesScreen", "Spices"),
    ("sports-fitness", "SportsFitnessScreen", "SportsFitness"),
    ("textiles-fabrics", "TextilesFabricsScreen", "TextilesFabrics"),
    ("toys", "ToysScreen", "Toys"),
]

for pid, screen, prefix in SCREENS:
    path = f"{ROOT}/{screen}.kt"
    src = open(path).read()

    # Summary: one honest sentence naming the row's real source.
    summary = (
        f"{prefix} — the native category browse: the grid streams the "
        f"category's REAL products from the Zylod API "
        f"(api/products?limit=24&category={pid}), the same scoped data the "
        f"web's category page renders."
    )
    src, n1 = re.subn(
        r'override val summary = "[^"]*"',
        'override val summary = ' + '"' + summary + '"',
        src,
    )

    # First bullet: no longer curated bullets.
    src, n2 = re.subn(
        r'"Curated native content — no fabricated server data, ever\.",',
        '"Live category grid — the server\'s own scoped rows, never fabricated.",',
        src,
    )
    if n1 != 1 or n2 != 1:
        print(f"WARN {screen}: summary x{n1} bullet x{n2}", file=sys.stderr)
    open(path, "w").write(src)

print("pass2 done")
