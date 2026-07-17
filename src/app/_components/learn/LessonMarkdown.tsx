import {
  Children,
  cloneElement,
  createElement,
  isValidElement,
  createContext,
  useContext,
  useState,
  useCallback,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { Element, Root, RootContent } from "hast";

interface LessonMarkdownProps {
  content: string;
  sectionKey: string;
  focusModeEnabled?: boolean;
  activeFocusTargets?: Set<string>;
  blockAppendages?: Record<number, ReactNode>;
}

type MarkdownElement = Element | undefined;
type MarkdownTextTag = "h1" | "h2" | "h3" | "h4" | "p" | "li" | "blockquote";
type MarkdownComponentProps<Tag extends MarkdownTextTag> =
  ComponentPropsWithoutRef<Tag> & ExtraProps;

function isElementNode(node: RootContent): node is Element {
  return node.type === "element";
}

function getBlockIndex(node: MarkdownElement): number | null {
  const rawValue = node?.properties["data-block-index"];

  const candidate = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (typeof candidate === "number") {
    return candidate;
  }

  if (typeof candidate === "string") {
    const parsed = Number.parseInt(candidate, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

const rehypeBlockIndex = () => {
  return (tree: Root) => {
    let index = 0;
    for (const child of tree.children ?? []) {
      if (isElementNode(child)) {
        child.properties ??= {};
        child.properties["data-block-index"] = String(index);
        index++;
      }
    }
  };
};

const DECORATED_TEXT_PATTERN = new RegExp(
  [
    String.raw`\([^()]+\)`,
    String.raw`[$€£¥]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:[KMBkmb]|thousand|million|billion|trillion))?`,
    String.raw`\b\d{1,4}(?:[/-]\d{1,2}(?:[/-]\d{2,4})?)\b`,
    String.raw`\b\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?\b`,
    String.raw`\b\d[\d,]*(?:\.\d+)?%`,
    String.raw`\b\d[\d,]*(?:\.\d+)?\s?percent\b`,
    String.raw`\b\d[\d,]*(?:\.\d+)?(?:-[A-Za-z]+(?:-[A-Za-z]+)*)\b`,
    String.raw`\b\d[\d,]*(?:\.\d+)?[A-Za-z]+\b`,
    String.raw`\b\d[\d,]*(?:\.\d+)?\b`,
  ].join("|"),
  "gi",
);
const HEADING_ACCENTS = [
  "lesson-heading--azure",
  "lesson-heading--violet",
  "lesson-heading--emerald",
  "lesson-heading--amber",
] as const;
const MARKER_VARIANTS = [
  "lesson-marker-variant-a",
  "lesson-marker-variant-b",
  "lesson-marker-variant-c",
  "lesson-marker-variant-d",
] as const;
const TEXT_DECORATION_BLOCKLIST = new Set(["code", "pre", "kbd"]);

function stripProtocolTokens(text: string): string {
  return text
    .replace(/\[INPUT_REQUEST:\s*[^\]]+\]/g, "")
    .replace(/\[LESSON_COMPLETE\]/g, "")
    .trim();
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.trunc((hash << 5) - hash + value.charCodeAt(index));
  }

  return Math.abs(hash);
}

function extractTextContent(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return extractTextContent(child.props.children);
      }

      return "";
    })
    .join("");
}

function getHeadingAccentClass(children: ReactNode): string {
  const headingText = extractTextContent(children).trim();
  const accentIndex = headingText.length === 0
    ? 0
    : hashString(headingText) % HEADING_ACCENTS.length;

  return HEADING_ACCENTS[accentIndex]!;
}

function getMarkerVariantClass(value: string): string {
  const markerIndex = value.length === 0
    ? 0
    : hashString(value) % MARKER_VARIANTS.length;

  return MARKER_VARIANTS[markerIndex]!;
}

function getDataPillKind(token: string): "date" | "price" | "number" {
  if (/[$€£¥]/.test(token)) {
    return "price";
  }

  if (/[/-]|:/.test(token) || /^(?:19|20)\d{2}$/.test(token)) {
    return "date";
  }

  return "number";
}

function decorateText(text: string, keyPrefix: string): ReactNode[] {
  const decoratedNodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(DECORATED_TEXT_PATTERN)) {
    const token = match[0];
    const tokenIndex = match.index ?? 0;

    if (tokenIndex > lastIndex) {
      decoratedNodes.push(text.slice(lastIndex, tokenIndex));
    }

    if (token.startsWith("(")) {
      decoratedNodes.push(
        <span key={`${keyPrefix}-${tokenIndex}`} className="lesson-parenthetical">
          {token}
        </span>,
      );
    } else {
      const kind = getDataPillKind(token);

      decoratedNodes.push(
        <span
          key={`${keyPrefix}-${tokenIndex}`}
          className={`lesson-data-pill lesson-data-pill--${kind} ${getMarkerVariantClass(token)}`}
        >
          {token}
        </span>,
      );
    }

    lastIndex = tokenIndex + token.length;
  }

  if (lastIndex < text.length) {
    decoratedNodes.push(text.slice(lastIndex));
  }

  return decoratedNodes;
}

function decorateChildren(children: ReactNode, keyPrefix: string): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child === "string") {
      const decorated = decorateText(child, `${keyPrefix}-${index}`);
      return decorated.length === 1 ? decorated[0] : decorated;
    }

    if (typeof child === "number") {
      const decorated = decorateText(String(child), `${keyPrefix}-${index}`);
      return decorated.length === 1 ? decorated[0] : decorated;
    }

    if (isValidElement<{ children?: ReactNode }>(child)) {
      if (
        typeof child.type === "string"
        && TEXT_DECORATION_BLOCKLIST.has(child.type)
      ) {
        return child;
      }

      return cloneElement(
        child,
        undefined,
        decorateChildren(child.props.children, `${keyPrefix}-${index}`),
      );
    }

    return child;
  });
}

function mergeClasses(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

/** Fractal-noise displacement filters so marker highlights look like ink, not boxes. */
const MARKER_FILTERS = [
  { id: "marker-rough-a", baseFrequency: "0.04 0.08", numOctaves: 4, seed: 2, scale: 3 },
  { id: "marker-rough-b", baseFrequency: "0.035 0.095", numOctaves: 3, seed: 7, scale: 3.5 },
  { id: "marker-rough-c", baseFrequency: "0.03 0.07", numOctaves: 4, seed: 13, scale: 2.8 },
  { id: "marker-rough-d", baseFrequency: "0.045 0.085", numOctaves: 3, seed: 19, scale: 3.2 },
] as const;

function MarkerSvgFilters() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
      aria-hidden="true"
    >
      <defs>
        {MARKER_FILTERS.map(({ id, baseFrequency, numOctaves, seed, scale }) => (
          <filter
            key={id}
            id={id}
            x="-5%"
            y="-20%"
            width="110%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={baseFrequency}
              numOctaves={numOctaves}
              seed={seed}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

const BlockAppendagesContext = createContext<Record<number, ReactNode>>({});
const FocusContext = createContext<{ focusModeEnabled: boolean; activeFocusTargets: Set<string>; sectionKey: string }>({
  focusModeEnabled: false,
  activeFocusTargets: new Set(),
  sectionKey: "",
});

function AppendageSlot({ node }: { node: MarkdownElement }) {
  const appendages = useContext(BlockAppendagesContext);
  const blockIndex = getBlockIndex(node);
  if (blockIndex === null) return null;
  const appendage = appendages[blockIndex];
  if (!appendage) return null;
  return <div className="my-2 flex flex-col">{appendage}</div>;
}

function useFocusState(node: MarkdownElement, children: ReactNode) {
  const { focusModeEnabled, activeFocusTargets, sectionKey } = useContext(FocusContext);
  const blockIndex = getBlockIndex(node);
  const textHash = hashString(extractTextContent(children));
  const targetId = `${sectionKey}-focus-${blockIndex ?? textHash}`;

  let stateClass = "lesson-focus-target";
  if (focusModeEnabled) {
    stateClass = activeFocusTargets.has(targetId)
      ? "lesson-focus-target lesson-focus-target--active"
      : "lesson-focus-target lesson-focus-target--inactive";
  }
  return { targetId, stateClass, sectionKey };
}

const HEADING_LEVEL_CLASS = {
  h1: "lesson-heading--hero",
  h2: "lesson-heading--section",
  h3: "lesson-heading--subsection",
  h4: "lesson-heading--minor",
} as const;

type HeadingTag = keyof typeof HEADING_LEVEL_CLASS;

function createHeadingComponent(tag: HeadingTag) {
  const levelClass = HEADING_LEVEL_CLASS[tag];

  return function Heading({
    node,
    children,
    className,
    ...props
  }: MarkdownComponentProps<HeadingTag>) {
    const { targetId, stateClass, sectionKey } = useFocusState(node, children);
    const headingText = extractTextContent(children);

    return (
      <>
        {createElement(
          tag,
          {
            ...props,
            "data-focus-target": targetId,
            className: mergeClasses("lesson-heading", levelClass, stateClass, className),
          },
          <span
            className={mergeClasses(
              "lesson-heading-mark",
              getHeadingAccentClass(children),
              getMarkerVariantClass(headingText),
            )}
          >
            {decorateChildren(children, `${sectionKey}-${tag}`)}
          </span>,
        )}
        <AppendageSlot node={node} />
      </>
    );
  };
}

function Paragraph({ node, children, className, ...props }: MarkdownComponentProps<"p">) {
  const { targetId, stateClass } = useFocusState(node, children);
  return (
    <>
      <p
        {...props}
        data-focus-target={targetId}
        className={mergeClasses(stateClass, className)}
      >
        {decorateChildren(children, `${targetId}-p`)}
      </p>
      <AppendageSlot node={node} />
    </>
  );
}

function ListItem({ node, children, className, ...props }: MarkdownComponentProps<"li">) {
  const { targetId, stateClass } = useFocusState(node, children);
  return (
    <li
      {...props}
      data-focus-target={targetId}
      className={mergeClasses("lesson-list-item", getMarkerVariantClass(targetId), stateClass, className)}
    >
      {decorateChildren(children, `${targetId}-li`)}
    </li>
  );
}

function Blockquote({ node, children, className, ...props }: MarkdownComponentProps<"blockquote">) {
  const { targetId, stateClass } = useFocusState(node, children);
  return (
    <>
      <blockquote
        {...props}
        data-focus-target={targetId}
        className={mergeClasses(stateClass, className)}
      >
        {decorateChildren(children, `${targetId}-blockquote`)}
      </blockquote>
      <AppendageSlot node={node} />
    </>
  );
}

function CodeBlockWithCopy({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group/code">
      <div className="flex items-center justify-between px-4 pt-2 pb-0 text-[10px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.1em] text-white/25">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="text-white/25 hover:text-white/60 transition-colors text-[10px] tracking-[0.1em] uppercase cursor-pointer"
          type="button"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "13px",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-geist-mono)" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

const markdownComponents: Components = {
  h1: createHeadingComponent("h1"),
  h2: createHeadingComponent("h2"),
  h3: createHeadingComponent("h3"),
  h4: createHeadingComponent("h4"),
  p: Paragraph,
  li: ListItem,
  blockquote: Blockquote,
  ul: ({ node, className, ...props }) => (
    <>
      <ul {...props} className={mergeClasses("lesson-list lesson-list--unordered", className)} />
      <AppendageSlot node={node} />
    </>
  ),
  ol: ({ node, className, ...props }) => (
    <>
      <ol {...props} className={mergeClasses("lesson-list lesson-list--ordered", className)} />
      <AppendageSlot node={node} />
    </>
  ),
  strong: ({ node: _node, children, className, ...props }) => (
    <strong {...props} className={mergeClasses(className)}>{children}</strong>
  ),
  em: ({ node: _node, children, className, ...props }) => (
    <em {...props} className={mergeClasses("lesson-inline-emphasis", className)}>{children}</em>
  ),
  a: ({ node: _node, children, className, href, ...props }) => {
    const isExternalLink = href?.startsWith("http") ?? false;
    return (
      <a
        {...props}
        href={href}
        className={mergeClasses(className)}
        target={isExternalLink ? "_blank" : undefined}
        rel={isExternalLink ? "noreferrer noopener" : undefined}
      >
        {children}
      </a>
    );
  },
  pre: ({ node, children, className, ...props }) => (
    <>
      <pre {...props} className={mergeClasses("relative group", className)}>
        {children}
      </pre>
      <AppendageSlot node={node} />
    </>
  ),
  code: ({ node: _node, children, className, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const language = match?.[1];
    const codeStr = extractTextContent(children).replace(/\n$/, "");

    // Inline code (no language class, not inside pre)
    if (!language) {
      return <code {...props} className={className}>{children}</code>;
    }

    return <CodeBlockWithCopy language={language} code={codeStr} />;
  },
};

const remarkPlugins = [remarkGfm];
const rehypePluginsList = [rehypeBlockIndex];

export function LessonMarkdown({
  content,
  sectionKey,
  focusModeEnabled = false,
  activeFocusTargets = new Set(),
  blockAppendages,
}: LessonMarkdownProps) {
  const cleaned = stripProtocolTokens(content);

  return (
    <FocusContext.Provider value={{ focusModeEnabled, activeFocusTargets, sectionKey }}>
      <BlockAppendagesContext.Provider value={blockAppendages ?? {}}>
        <div className="lesson-content">
          <MarkerSvgFilters />
          <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePluginsList} components={markdownComponents}>
            {cleaned}
          </ReactMarkdown>
        </div>
      </BlockAppendagesContext.Provider>
    </FocusContext.Provider>
  );
}
