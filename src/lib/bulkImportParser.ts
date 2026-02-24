export type BulkImportPiece = {
    title?: string;
    content: string;
    source?: string;
};

function decodeVisibleEscapes(value: string): string {
    return value
        .replaceAll(String.raw`\r`, "\r")
        .replaceAll(String.raw`\n`, "\n")
        .replaceAll(String.raw`\t`, "\t");
}

function parseCsvRows(csvText: string): string[][] {
    const input = csvText.replace(/^\uFEFF/, "");
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < input.length; i += 1) {
        const char = input[i] ?? "";

        if (inQuotes) {
            if (char === '"') {
                const next = input[i + 1] ?? "";
                if (next === '"') {
                    cell += '"';
                    i += 1;
                    continue;
                }
                inQuotes = false;
                continue;
            }

            cell += char;
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ",") {
            row.push(cell);
            cell = "";
            continue;
        }

        if (char === "\n") {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
            continue;
        }

        if (char === "\r") {
            continue;
        }

        cell += char;
    }

    row.push(cell);
    rows.push(row);

    return rows.filter((currentRow, index) => {
        if (currentRow.some((entry) => entry.trim() !== "")) return true;
        return index === 0;
    });
}

export function appearsToBeCsvWithWrongHeaders(text: string): boolean {
    const rows = parseCsvRows(text);
    if (rows.length === 0) return false;

    const header = rows[0] ?? [];
    if (header.length < 2) return false;

    const normalized = header.map((cell) => cell.trim().toLowerCase());
    const hasExpectedWords = normalized.some((cell) => cell === "content" || cell === "name");
    const hasExpectedOrder = normalized[0] === "content" && normalized[1] === "name";
    return hasExpectedWords && !hasExpectedOrder;
}

export function parseCsvKnowledgePieces(csvText: string, source?: string): BulkImportPiece[] | null {
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) return null;

    const header = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
    if (header[0] !== "content" || header[1] !== "name") {
        return null;
    }

    const pieces: BulkImportPiece[] = [];
    for (const row of rows.slice(1)) {
        const content = (row[0] ?? "").trim();
        if (!content) continue;

        const title = (row[1] ?? "").trim() || undefined;
        pieces.push({
            content,
            title,
            source,
        });
    }

    return pieces;
}

export function parseDelimiterKnowledgePieces(text: string, delimiter: string, source?: string): BulkImportPiece[] {
    const parsedDelimiter = decodeVisibleEscapes(delimiter);
    if (!parsedDelimiter) return [];

    const escapedDelimiter = parsedDelimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const splitRegex = new RegExp(escapedDelimiter);

    return text
        .split(splitRegex)
        .map((piece) => piece.trim())
        .filter((piece) => piece.length > 0)
        .map((content) => ({
            content,
            source,
        }));
}
