"""dedupe a list — trivial-domain canary target (C-001-004b corpus)."""


def dedupe(items):
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    data = [i % (n // 2) for i in range(n)]
    print(len(dedupe(data)))
