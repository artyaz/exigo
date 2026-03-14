import {
  Children,
  cloneElement,
  isValidElement,
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface LessonMarkdownProps {
  content: string;
  sectionKey: string;
  focusModeEnabled?: boolean;
  activeFocusTargets?: Set<string>;
  blockAppendages?: Record<number, ReactNode>;
}

const rehypeBlockIndex = () => {
  return (tree: any) => {
    let index = 0;
    for (const child of tree.children || []) {
      if (child.type === 'element') {
        child.properties = child.properties || {};
        child.properties['data-block-index'] = String(index);
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

/**
 * Inline SVG filters that use fractal noise displacement to break the
 * pixel-perfect rectangular edges of CSS backgrounds into natural,
 * wavy boundaries — like real highlighter ink on paper.
 * Each variant uses a different noise seed / frequency / scale so
 * every highlighted element looks slightly different.
 */
function MarkerSvgFilters() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id="marker-rough-a"
          x="-5%"
          y="-20%"
          width="110%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04 0.08"
            numOctaves={4}
            seed={2}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={3}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          id="marker-rough-b"
          x="-5%"
          y="-20%"
          width="110%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035 0.095"
            numOctaves={3}
            seed={7}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={3.5}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          id="marker-rough-c"
          x="-5%"
          y="-20%"
          width="110%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03 0.07"
            numOctaves={4}
            seed={13}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={2.8}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          id="marker-rough-d"
          x="-5%"
          y="-20%"
          width="110%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045 0.085"
            numOctaves={3}
            seed={19}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={3.2}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
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

function AppendageSlot({ node }: { node: any }) {
  const blockIndexStr = node?.properties?.['data-block-index'];
  const appendages = useContext(BlockAppendagesContext);
  if (blockIndexStr === undefined) return null;
  const blockIndex = parseInt(blockIndexStr as string, 10);
  const appendage = appendages[blockIndex];
  if (!appendage) return null;
  return <div className="my-2 flex flex-col">{appendage}</div>;
}

function useFocusState(node: any, children: ReactNode) {
  const { focusModeEnabled, activeFocusTargets, sectionKey } = useContext(FocusContext);
  const blockIndexStr = node?.properties?.['data-block-index'];
  const textHash = hashString(extractTextContent(children));
  const targetId = `${sectionKey}-focus-${blockIndexStr ?? textHash}`;

  let stateClass = "lesson-focus-target";
  if (focusModeEnabled) {
    stateClass = activeFocusTargets.has(targetId)
      ? "lesson-focus-target lesson-focus-target--active"
      : "lesson-focus-target lesson-focus-target--inactive";
  }
  return { targetId, stateClass, sectionKey };
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
  h1: ({ node, children, className, ...props }) => {
    const { targetId, stateClass, sectionKey } = useFocusState(node, children);
    return (
      <>
        <h1
          {...props}
          data-focus-target={targetId}
          className={mergeClasses("lesson-heading lesson-heading--hero", stateClass, className)}
        >
          <span className={mergeClasses("lesson-heading-mark", getHeadingAccentClass(children), getMarkerVariantClass(extractTextContent(children)))}>
            {decorateChildren(children, `${sectionKey}-h1`)}
          </span>
        </h1>
        <AppendageSlot node={node} />
      </>
    );
  },
  h2: ({ node, children, className, ...props }) => {
    const { targetId, stateClass, sectionKey } = useFocusState(node, children);
    return (
      <>
        <h2
          {...props}
          data-focus-target={targetId}
          className={mergeClasses("lesson-heading lesson-heading--section", stateClass, className)}
        >
          <span className={mergeClasses("lesson-heading-mark", getHeadingAccentClass(children), getMarkerVariantClass(extractTextContent(children)))}>
            {decorateChildren(children, `${sectionKey}-h2`)}
          </span>
        </h2>
        <AppendageSlot node={node} />
      </>
    );
  },
  h3: ({ node, children, className, ...props }) => {
    const { targetId, stateClass, sectionKey } = useFocusState(node, children);
    return (
      <>
        <h3
          {...props}
          data-focus-target={targetId}
          className={mergeClasses("lesson-heading lesson-heading--subsection", stateClass, className)}
        >
          <span className={mergeClasses("lesson-heading-mark", getHeadingAccentClass(children), getMarkerVariantClass(extractTextContent(children)))}>
            {decorateChildren(children, `${sectionKey}-h3`)}
          </span>
        </h3>
        <AppendageSlot node={node} />
      </>
    );
  },
  h4: ({ node, children, className, ...props }) => {
    const { targetId, stateClass, sectionKey } = useFocusState(node, children);
    return (
      <>
        <h4
          {...props}
          data-focus-target={targetId}
          className={mergeClasses("lesson-heading lesson-heading--minor", stateClass, className)}
        >
          <span className={mergeClasses("lesson-heading-mark", getHeadingAccentClass(children), getMarkerVariantClass(extractTextContent(children)))}>
            {decorateChildren(children, `${sectionKey}-h4`)}
          </span>
        </h4>
        <AppendageSlot node={node} />
      </>
    );
  },
  p: ({ node, children, className, ...props }) => {
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
  },
  li: ({ node, children, className, ...props }) => {
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
  },
  blockquote: ({ node, children, className, ...props }) => {
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
  },
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
    const codeStr = String(children).replace(/\n$/, "");

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
      <BlockAppendagesContext.Provider value={blockAppendages || {}}>
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
