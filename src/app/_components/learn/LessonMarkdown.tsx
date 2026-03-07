import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface LessonMarkdownProps {
  content: string;
  sectionKey: string;
  focusModeEnabled?: boolean;
  activeFocusTarget?: string | null;
}

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

export function LessonMarkdown({
  content,
  sectionKey,
  focusModeEnabled = false,
  activeFocusTarget = null,
}: LessonMarkdownProps) {
  const cleaned = stripProtocolTokens(content);
  let focusTargetIndex = 0;

  const getFocusTargetStateClass = (targetId: string): string => {
    if (!focusModeEnabled) {
      return "lesson-focus-target";
    }

    return targetId === activeFocusTarget
      ? "lesson-focus-target lesson-focus-target--active"
      : "lesson-focus-target lesson-focus-target--inactive";
  };

  const components: Components = {
    h1: ({ node: _node, children, className, ...props }) => {
      const targetId = `${sectionKey}-focus-${focusTargetIndex}`;
      focusTargetIndex += 1;
      return (
        <h1
          {...props}
          data-focus-target={targetId}
          className={mergeClasses(
            "lesson-heading lesson-heading--hero",
            className,
          )}
        >
          <span
            className={mergeClasses(
              "lesson-heading-mark",
              getHeadingAccentClass(children),
              getMarkerVariantClass(extractTextContent(children)),
            )}
          >
            {decorateChildren(children, `${sectionKey}-h1`)}
          </span>
        </h1>
      );
    },
    h2: ({ node: _node, children, className, ...props }) => {
      const targetId = `${sectionKey}-focus-${focusTargetIndex}`;
      focusTargetIndex += 1;
      return (
        <h2
          {...props}
          data-focus-target={targetId}
          className={mergeClasses(
            "lesson-heading lesson-heading--section",
            className,
          )}
        >
          <span
            className={mergeClasses(
              "lesson-heading-mark",
              getHeadingAccentClass(children),
              getMarkerVariantClass(extractTextContent(children)),
            )}
          >
            {decorateChildren(children, `${sectionKey}-h2`)}
          </span>
        </h2>
      );
    },
    h3: ({ node: _node, children, className, ...props }) => {
      const targetId = `${sectionKey}-focus-${focusTargetIndex}`;
      focusTargetIndex += 1;
      return (
        <h3
          {...props}
          data-focus-target={targetId}
          className={mergeClasses(
            "lesson-heading lesson-heading--subsection",
            className,
          )}
        >
          <span
            className={mergeClasses(
              "lesson-heading-mark",
              getHeadingAccentClass(children),
              getMarkerVariantClass(extractTextContent(children)),
            )}
          >
            {decorateChildren(children, `${sectionKey}-h3`)}
          </span>
        </h3>
      );
    },
    h4: ({ node: _node, children, className, ...props }) => {
      const targetId = `${sectionKey}-focus-${focusTargetIndex}`;
      focusTargetIndex += 1;
      return (
        <h4
          {...props}
          data-focus-target={targetId}
          className={mergeClasses(
            "lesson-heading lesson-heading--minor",
            className,
          )}
        >
          <span
            className={mergeClasses(
              "lesson-heading-mark",
              getHeadingAccentClass(children),
              getMarkerVariantClass(extractTextContent(children)),
            )}
          >
            {decorateChildren(children, `${sectionKey}-h4`)}
          </span>
        </h4>
      );
    },
    p: ({ node: _node, children, className, ...props }) => {
      const targetId = `${sectionKey}-focus-${focusTargetIndex}`;
      focusTargetIndex += 1;

      return (
        <p
          {...props}
          data-focus-target={targetId}
          className={mergeClasses(
            getFocusTargetStateClass(targetId),
            className,
          )}
        >
          {decorateChildren(children, `${targetId}-p`)}
        </p>
      );
    },
    li: ({ node: _node, children, className, ...props }) => {
      const targetId = `${sectionKey}-focus-${focusTargetIndex}`;
      focusTargetIndex += 1;

      return (
        <li
          {...props}
          data-focus-target={targetId}
          className={mergeClasses(
            "lesson-list-item",
            getMarkerVariantClass(targetId),
            getFocusTargetStateClass(targetId),
            className,
          )}
        >
          {decorateChildren(children, `${targetId}-li`)}
        </li>
      );
    },
    blockquote: ({ node: _node, children, className, ...props }) => {
      const targetId = `${sectionKey}-focus-${focusTargetIndex}`;
      focusTargetIndex += 1;

      return (
        <blockquote
          {...props}
          data-focus-target={targetId}
          className={mergeClasses(
            getFocusTargetStateClass(targetId),
            className,
          )}
        >
          {decorateChildren(children, `${targetId}-blockquote`)}
        </blockquote>
      );
    },
    ul: ({ node: _node, className, ...props }) => (
      <ul
        {...props}
        className={mergeClasses("lesson-list lesson-list--unordered", className)}
      />
    ),
    ol: ({ node: _node, className, ...props }) => (
      <ol
        {...props}
        className={mergeClasses("lesson-list lesson-list--ordered", className)}
      />
    ),
    strong: ({ node: _node, children, className, ...props }) => (
      <strong {...props} className={mergeClasses(className)}>
        {children}
      </strong>
    ),
    em: ({ node: _node, children, className, ...props }) => (
      <em
        {...props}
        className={mergeClasses("lesson-inline-emphasis", className)}
      >
        {children}
      </em>
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
  };

  return (
    <div className="lesson-content">
      <MarkerSvgFilters />
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
