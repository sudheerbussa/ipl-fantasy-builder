#!/usr/bin/env python3
"""Validate C4 whitelist pairs against band rules (§5.3). Run from scripts/."""
from audit_split_pool_pairs import audit_pair, valid_triplets, PROFILES

# Must match web/split_pool_catalog.js PAIRS.C4
C4_WHITELIST = {
    "65": ["1-3-2|0-3-2", "1-3-2|1-2-2"],
    "56": ["0-3-2|1-3-2", "1-2-2|1-3-2"],
}

SEG_NA_NB = {"65": (6, 5), "56": (5, 6)}


def main() -> None:
    bands = PROFILES["C4"]
    print("C4 profile rules (validated)")
    print("  Bands: P1 L (t<=1), P2 H (r>=2), P3 H (p>=2) both franchises")
    print("  Cap: p_A + p_B <= 5")
    print("  Segments: 6-5, 5-6 only")
    print("  Per-franchise unique players needed: t+r+p on that side\n")

    all_legal = set()
    for seg, (na, nb) in SEG_NA_NB.items():
        a_list = valid_triplets(na, bands["A"])
        b_list = valid_triplets(nb, bands["B"])
        legal = set()
        for _, _, _, sa in a_list:
            for _, _, _, sb in b_list:
                if int(sa[0]) == 3 and int(sb[0]) == 3:
                    continue
                if audit_pair(sa, sb, c4_cap=True):
                    continue
                legal.add(f"{sa}|{sb}")
        all_legal |= legal
        print(f"Segment {seg} ({na}/{nb}): {len(legal)} legal band-compliant pairs")

    print("\nWhitelist audit:")
    ok = True
    for seg, pairs in C4_WHITELIST.items():
        for p in pairs:
            a, b = p.split("|")
            issues = audit_pair(a, b, c4_cap=True)
            ta, ra, pa = (int(x) for x in a.split("-"))
            tb, rb, pb = (int(x) for x in b.split("-"))
            ar = max(0, pa + pb - 4)
            uniq_a, uniq_b = ta + ra + pa, tb + rb + pb
            status = "OK" if not issues and p in all_legal else "FAIL"
            if status != "OK":
                ok = False
            print(
                f"  [{status}] {seg} {p}  AR*={ar}  "
                f"uniqA={uniq_a} uniqB={uniq_b}  issues={issues or '-'}"
            )
    if ok:
        print("\nAll whitelist pairs pass band + fill rules.")
    else:
        print("\nSome whitelist pairs FAILED audit.")


if __name__ == "__main__":
    main()
