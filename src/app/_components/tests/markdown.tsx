import type { ReactNode } from "react";

/**
 * Parses inline markdown tokens: **bold**, *italic*, `code`.
 * Order matters: match bold/code before italic so a single * doesn't collide with **.
 * Avoids lookbehind/lookahead which break on older Safari.
 */
export function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
    const result: ReactNode[] = [];
    const tokenRegex = /(\*\*(.+?)\*\*|`(.+?)`|\*([^*]+?)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIdx = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            result.push(text.slice(lastIndex, match.index));
        }

        const key = `${keyPrefix}-${partIdx++}`;
        if (match[2] !== undefined) {
            result.push(
                <strong key={key} className="font-semibold text-white">
                    {match[2]}
                </strong>
            );
        } else if (match[3] !== undefined) {
            result.push(
                <code
                    key={key}
                    className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[11px] font-mono text-white/90 border border-white/[0.06]"
                >
                    {match[3]}
                </code>
            );
        } else if (match[4] !== undefined) {
            result.push(
                <em key={key} className="italic text-white/80">
                    {match[4]}
                </em>
            );
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
    }

    return result;
}

/**
 * Renders basic markdown: bullet lists (* / -), **bold**, *italic*, `code`,
 * and newlines.
 */
export function renderMarkdown(text: string): ReactNode[] {
    const lines = text.split("\n");
    const result: ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) result.push(<br key={`br-${lineIdx}`} />);

        const bulletMatch = /^(\s*)[*-]\s+(.*)/.exec(line);
        if (bulletMatch) {
            const indent = bulletMatch[1] ?? "";
            const content = bulletMatch[2] ?? "";
            result.push(
                <span key={`li-${lineIdx}`} style={{ paddingLeft: indent.length * 8 }} className="inline-flex gap-1.5">
                    <span className="text-white/40 select-none shrink-0">•</span>
                    <span>{renderInlineMarkdown(content, `${lineIdx}`)}</span>
                </span>
            );
            return;
        }

        result.push(...renderInlineMarkdown(line, `${lineIdx}`));
    });

    return result;
}
