from dedupe import dedupe


def main():
    assert dedupe([]) == []
    assert dedupe([1, 1, 1]) == [1]
    assert dedupe([3, 1, 3, 2, 1]) == [3, 1, 2]
    assert dedupe(["a", "b", "a"]) == ["a", "b"]
    print("ok 4 assertions")


main()
