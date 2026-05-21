from pathlib import Path

p = Path(__file__).resolve().parents[1] / "web" / "split_pool_impl.js"
t = p.read_text(encoding="utf-8")
t2 = t.replace('createElement("motion")', 'createElement("div")')
p.write_text(t2, encoding="utf-8")
print("replaced", t.count('createElement("motion")'), "occurrences")
