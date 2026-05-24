"""Audit split-pool pair/triplet rules (design doc §3 + XI fill constraints)."""
from __future__ import annotations

CAPS = (3, 4, 5)


def valid_triplets(n: int, bands: tuple[bool, bool, bool]) -> list[tuple[int, int, int, str]]:
    tH, rH, pH = bands
    p1, p2, p3 = CAPS
    out = []
    for t in range(p1 + 1):
        for r in range(p2 + 1):
            for p in range(p3 + 1):
                if t + r + p != n:
                    continue
                if p == 0 and p3 > 0 and n >= 1:
                    continue
                ok = True
                if tH and t < 2:
                    ok = False
                if not tH and t > 1:
                    ok = False
                if rH and r < 2:
                    ok = False
                if not rH and r > 1:
                    ok = False
                if pH and p < 2:
                    ok = False
                if not pH and p > 2:
                    ok = False
                if ok:
                    out.append((t, r, p, f"{t}-{r}-{p}"))
    return out


def p3_fill_feasible(p_a: int, p_b: int) -> tuple[bool, str]:
    """§1.1 fill exists; §1 requires p_A,p_B>=1 (min 1 P3 pick per side)."""
    if p_a < 1 or p_b < 1:
        return False, "p_side_lt_1"
    ar_star = max(0, p_a + p_b - 4)
    for b_a in range(0, p_a + 1):
        for b_b in range(0, p_b + 1):
            if b_a + b_b > 4:
                continue
            ar_slots = (p_a - b_a) + (p_b - b_b)
            if ar_slots >= ar_star:
                return True, f"ok b=({b_a},{b_b}) AR*={ar_star}"
    return False, f"no_fill AR*={ar_star}"


def audit_pair(
    sa: str, sb: str, *, c1_cap: bool = False, c4_cap: bool = False
) -> list[str]:
    ta, ra, pa = (int(x) for x in sa.split("-"))
    tb, rb, pb = (int(x) for x in sb.split("-"))
    issues = []
    if ta == 3 and tb == 3:
        issues.append("both_t3")
    if ta + ra + pa + tb + rb + pb != 11:
        issues.append("sum_not_11")
    if pa + pb > 4 and c1_cap:
        issues.append(f"c1_p_sum_{pa + pb}")
    if pa + pb > 5 and c4_cap:
        issues.append(f"c4_p_sum_{pa + pb}")
    ok, msg = p3_fill_feasible(pa, pb)
    if not ok:
        issues.append(f"p3_fill:{msg}")
    return issues


# C1 allows `2-2-2` (r=2) as approved P2-L stretch on n=6.
C1_P2_STRETCH = {"2-2-2"}
C2_B_STRETCH = {"2-1-2", "2-2-1"}
C3_A_STRETCH = {"2-1-2", "2-2-1"}


def triplet_ok(profile: str, side: str, n: int, s: str, bands: tuple[bool, bool, bool]) -> bool:
    if profile == "C1" and s in C1_P2_STRETCH:
        t, r, p = (int(x) for x in s.split("-"))
        return t + r + p == n and p >= 1
    if profile == "C2" and side == "B" and n == 5 and s in C2_B_STRETCH:
        t, r, p = (int(x) for x in s.split("-"))
        return t + r + p == n and p >= 1
    if profile == "C3" and side == "A" and n == 5 and s in C3_A_STRETCH:
        t, r, p = (int(x) for x in s.split("-"))
        return t + r + p == n and p >= 1
    return any(x[3] == s for x in valid_triplets(n, bands))


PROFILES = {
    "C1": {"A": (True, False, False), "B": (True, False, False), "c1": True},
    "C2": {"A": (True, False, True), "B": (False, True, False), "c1": False},
    "C3": {"A": (False, True, False), "B": (True, False, True), "c1": False},
    "C4": {"A": (False, True, True), "B": (False, True, True), "c1": False},
}

SEGMENTS = [
    ("6-5", 6, 5),
    ("5-6", 5, 6),
    ("7-4", 7, 4),
    ("4-7", 4, 7),
]


def all_pairs(profile: str, seg: str, na: int, nb: int) -> list[tuple[str, str, int, int, int]]:
    bands = PROFILES[profile]
    A = valid_triplets(na, bands["A"])
    B = valid_triplets(nb, bands["B"])
    c1 = bands["c1"]
    res = []
    for _, _, pa, sa in A:
        for _, _, pb, sb in B:
            ta = int(sa.split("-")[0])
            tb = int(sb.split("-")[0])
            if ta == 3 and tb == 3:
                continue
            issues = audit_pair(sa, sb, c1_cap=c1)
            ar = max(0, pa + pb - 4)
            res.append((sa, sb, pa, pb, ar, issues))
    return res


def main() -> None:
    for profile in PROFILES:
        print(f"\n{'=' * 60}\n{profile}")
        for seg, na, nb in SEGMENTS:
            pairs = all_pairs(profile, seg, na, nb)
            bad = [p for p in pairs if p[5]]
            by_ar: dict[int, list] = {}
            for p in pairs:
                by_ar.setdefault(p[4], []).append(p)
            print(
                f"  {seg}: {len(pairs)} legal pairs | "
                f"AR0={len(by_ar.get(0, []))} AR1={len(by_ar.get(1, []))} "
                f"AR2={len(by_ar.get(2, []))} AR3={len(by_ar.get(3, []))} | "
                f"bowl_fill_fail={len(bad)}"
            )
            if bad:
                for sa, sb, pa, pb, ar, iss in bad[:8]:
                    print(f"    FAIL {sa}|{sb} p=({pa},{pb}) {iss}")


if __name__ == "__main__":
    main()
