export function FormFieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors || errors.length === 0) return null;

  return <p id={id} role="alert" className="text-theme-xs text-error-700">{errors.join(" ")}</p>;
}
