"""Verify every pair named in split_pool_p1p2p3_scenario_matrix.md §5."""
from audit_split_pool_pairs import audit_pair

DOC_PAIRS = [
    ("C1", "6-5", "2-2-2|3-0-2"),
    ("C1", "6-5", "2-2-2|3-1-1"),
    ("C1", "6-5", "2-2-2|2-1-2"),
    ("C1", "5-6", "2-1-2|2-2-2"),
    ("C1", "5-6", "3-0-2|2-2-2"),
    ("C1", "5-6", "3-1-1|2-2-2"),
    ("C2", "6-5", "2-1-3|1-3-1"),
    ("C2", "6-5", "3-1-2|1-2-2"),
    ("C2", "6-5", "3-1-2|1-3-1"),
    ("C2", "6-5", "3-1-2|2-1-2"),
    ("C2", "6-5", "3-1-2|2-2-1"),
    ("C2", "6-5", "2-1-3|2-2-1"),
    ("C2", "6-5", "2-1-3|1-2-2"),
    ("C2", "6-5", "2-1-3|2-1-2"),
    ("C3", "5-6", "1-2-2|3-1-2"),
    ("C3", "5-6", "1-3-1|2-1-3"),
    ("C3", "5-6", "1-3-1|3-1-2"),
    ("C3", "5-6", "2-1-2|3-1-2"),
    ("C3", "5-6", "2-2-1|3-1-2"),
    ("C3", "5-6", "2-1-2|2-1-3"),
    ("C3", "5-6", "2-2-1|2-1-3"),
    ("C3", "5-6", "1-2-2|2-1-3"),
    ("C4", "6-5", "1-3-2|0-3-2"),
    ("C4", "6-5", "1-3-2|1-2-2"),
    ("C4", "5-6", "0-3-2|1-3-2"),
    ("C4", "5-6", "1-2-2|1-3-2"),
]

FORBIDDEN_SHOULD_FAIL = [
    ("C1", "3-1-2|3-0-2", "both_t3"),
    ("C1", "3-0-2|3-1-2", "both_t3"),
]


def ar_profile_feasible(p_a: int, p_b: int) -> bool:
    """Nominal: profile AR only in P3 → need >=1 P3 slot as AR."""
    need = max(0, p_a + p_b - 4, 1)
    for b_a in range(0, p_a + 1):
        for b_b in range(0, p_b + 1):
            if b_a + b_b > 4:
                continue
            if (p_a - b_a) + (p_b - b_b) >= need:
                return True
    return False


def main() -> None:
    fails = []
    for prof, seg, pair in DOC_PAIRS:
        a, b = pair.split("|")
        c1 = prof == "C1"
        c4 = prof == "C4"
        pa, pb = int(a.split("-")[2]), int(b.split("-")[2])
        issues = audit_pair(a, b, c1_cap=c1, c4_cap=c4)
        if not ar_profile_feasible(pa, pb):
            issues.append("profile_ar_fill_nominal_p3")
        if issues:
            fails.append((prof, seg, pair, issues))

    print(f"Checked {len(DOC_PAIRS)} doc pairs")
    if fails:
        print("FAILURES:")
        for row in fails:
            print(" ", row)
    else:
        print("All doc pairs pass: sum=11, not both t=3, C1/C4 p-caps, p>=1/side, b sum<=4")

    print("\nSegment franchise counts (always >=4 each side):")
    for seg, na, nb in [("6-5", 6, 5), ("5-6", 5, 6), ("7-4", 7, 4), ("4-7", 4, 7)]:
        print(f"  {seg}: A={na} B={nb} min4={'OK' if na>=4 and nb>=4 else 'FAIL'}")

    for prof, pair, why in FORBIDDEN_SHOULD_FAIL:
        a, b = pair.split("|")
        issues = audit_pair(a, b, c1_cap=(prof == "C1"))
        print(f"Forbidden {pair}: issues={issues} (expect both_t3)")


if __name__ == "__main__":
    main()
