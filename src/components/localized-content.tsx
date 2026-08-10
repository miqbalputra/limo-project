import type { HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { resolveLocalizedContent, type LocalizedDirection } from "@/lib/localized-content";

type ContentElement = "span" | "p" | "div" | "h1" | "h2" | "h3" | "li";

type LocalizedContentProps = Omit<HTMLAttributes<HTMLElement>, "dir" | "lang"> & {
  as?: ContentElement;
  language?: string | null;
  direction?: string | null;
  text?: string | null;
  children: ReactNode;
};

type FieldOptions = {
  language?: string | null;
  direction?: LocalizedDirection;
  className?: string;
};

type ArabicInputProps = FieldOptions & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "dir" | "lang"> & {
  as?: "input";
};

type ArabicTextareaProps = FieldOptions & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "dir" | "lang"> & {
  as: "textarea";
};

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

/** Renders only the localized text as an isolated bidi island, never the surrounding UI chrome. */
export function LocalizedContent({
  as: Tag = "span",
  language,
  direction,
  text,
  className,
  children,
  ...props
}: LocalizedContentProps) {
  const locale = resolveLocalizedContent({ language, direction, text });

  return (
    <Tag
      {...props}
      lang={locale.language}
      dir={locale.direction}
      className={joinClassNames("localized-content", locale.isArabic ? "localized-content-arabic" : undefined, className)}
    >
      <bdi dir={locale.direction}>{children}</bdi>
    </Tag>
  );
}

/** Text control with predictable Arabic font/direction and auto direction for mixed responses. */
export function ArabicTextField(props: ArabicInputProps | ArabicTextareaProps) {
  const { as = "input", language, direction, className, ...fieldProps } = props;
  const locale = resolveLocalizedContent({ language, direction });
  const sharedProps = {
    ...fieldProps,
    lang: locale.language,
    dir: locale.direction,
    className: joinClassNames("localized-text-field", locale.isArabic ? "localized-content-arabic" : undefined, className),
  };

  if (as === "textarea") {
    return <textarea {...sharedProps as TextareaHTMLAttributes<HTMLTextAreaElement>} />;
  }

  return <input {...sharedProps as InputHTMLAttributes<HTMLInputElement>} />;
}
