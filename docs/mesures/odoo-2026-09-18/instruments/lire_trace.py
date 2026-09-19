import json, sys
et = None; rows = {}
order = []
for l in open(sys.argv[1]):
    d = json.loads(l)
    if 'etape' in d:
        et = d['etape']; order.append(et); rows.setdefault(et, []); continue
    rows[et].append(f"{d['type']}|search={d['search']!r}|{d['path']}|{'public' if d['public'] else 'uid'+str(d['uid'])}|n={d['count']}|{d['ms']}ms|{d['callers'][-1] if d['callers'] else ''}")
for e in order:
    print(f"{e:32s} {len(rows[e])} appel(s)")
    for r in rows[e]:
        print('      ', r)
