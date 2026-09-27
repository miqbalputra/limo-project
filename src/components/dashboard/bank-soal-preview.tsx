import { LocalizedContent } from "@/components/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";

export type BankSoalPreviewOption = { label: string; content: string; isCorrect: boolean };

export type BankSoalPreviewData = {
  type: string;
  question: string;
  stimulusText?: string | null;
  mediaUrl?: string | null;
  expectedAnswer?: string | null;
  structuredPayload?: unknown;
  rubric?: unknown;
  explanation?: string | null;
  language?: string | null;
  direction?: string | null;
  cognitiveLevel?: string | null;
  skill?: string | null;
  difficulty?: string | null;
  standard?: string | null;
  assessmentType?: string | null;
  options?: BankSoalPreviewOption[];
  kelasLabel?: string | null;
};

const OPTION_TYPES = ["PILIHAN_GANDA", "MULTI_SELECT"];
const MANUAL_TYPES = ["SPEAKING", "WRITING", "ROLEPLAY", "ESAI", "GAMBAR", "LISTENING", "READING"];

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(url);
}

function readPairs(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const raw = (payload as { pairs?: unknown }).pairs;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const left = String((entry as { left?: unknown }).left ?? "").trim();
      const right = String((entry as { right?: unknown }).right ?? "").trim();
      return left && right ? { left, right } : null;
    })
    .filter((entry): entry is { left: string; right: string } => Boolean(entry));
}

function readSequence(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const raw = (payload as { items?: unknown }).items;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function readRubric(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const raw = (payload as { criteria?: unknown }).criteria;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const name = String((entry as { name?: unknown }).name ?? "").trim();
      const max = Number((entry as { max?: unknown }).max ?? 0);
      return name ? { name, max } : null;
    })
    .filter((entry): entry is { name: string; max: number } => Boolean(entry));
}

function Badge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "info" | "success" | "warning" }) {
  const classes = {
    neutral: "bg-gray-100 text-gray-600",
    info: "bg-limo-blue-50 text-limo-blue-700",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-800",
  }[tone];
  return <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${classes}`}>{children}</span>;
}

export function BankSoalPreview({ data }: { data: BankSoalPreviewData }) {
  const options = data.options ?? [];
  const correctOptions = options.filter((option) => option.isCorrect);
  const pairs = readPairs(data.structuredPayload);
  const sequence = readSequence(data.structuredPayload);
  const rubric = readRubric(data.rubric);
  const usesOptions = OPTION_TYPES.includes(data.type);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="tailadmin-card p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{formatUiLabel(data.type)}</Badge>
          {data.cognitiveLevel ? <Badge tone="success">{formatUiLabel(data.cognitiveLevel)}</Badge> : null}
          {data.skill ? <Badge tone="warning">{formatUiLabel(data.skill)}</Badge> : null}
          {data.difficulty ? <Badge>{formatUiLabel(data.difficulty)}</Badge> : null}
          {data.assessmentType ? <Badge>{formatUiLabel(data.assessmentType)}</Badge> : null}
          {data.standard ? <Badge tone="info">{data.standard}</Badge> : null}
        </div>

        <p className="mt-3 text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">
          Tampilan siswa · {data.kelasLabel || "Umum / lintas kelas"}
        </p>

        {data.stimulusText ? (
          <LocalizedContent as="p" text={data.stimulusText} language={data.language} direction={data.direction} className="mt-4 rounded-xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">
            {data.stimulusText}
          </LocalizedContent>
        ) : null}

        {data.mediaUrl ? (
          <div className="mt-3">
            {isImageUrl(data.mediaUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.mediaUrl} alt="Media soal" className="max-h-72 rounded-xl border border-gray-200" />
            ) : (
              <a href={data.mediaUrl} className="text-theme-sm font-semibold text-limo-blue-700 underline" target="_blank" rel="noopener noreferrer">Buka media (audio/berkas)</a>
            )}
          </div>
        ) : null}

        <LocalizedContent as="p" text={data.question} language={data.language} direction={data.direction} className="mt-4 text-base font-semibold leading-8 text-gray-900">
          {data.question}
        </LocalizedContent>

        {usesOptions ? (
          <ul className="mt-4 grid gap-2">
            {options.map((option) => (
              <li key={option.label} className={`flex items-start gap-3 rounded-xl border p-3 text-theme-sm ${option.isCorrect ? "border-success-200 bg-success-50" : "border-gray-200"}`}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-gray-300 text-theme-xs font-bold text-gray-600">{option.label}</span>
                <LocalizedContent text={option.content} language={data.language} direction="auto" className="min-w-0 text-gray-800">{option.content}</LocalizedContent>
                {option.isCorrect ? <span className="ms-auto shrink-0 text-theme-xs font-semibold text-success-700">kunci</span> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {data.type === "BENAR_SALAH" ? (
          <div className="mt-4 grid gap-2 text-theme-sm text-gray-700 sm:grid-cols-2">
            <span className="rounded-xl border border-gray-200 p-3">Benar</span>
            <span className="rounded-xl border border-gray-200 p-3">Salah</span>
          </div>
        ) : null}

        {["ISIAN_SINGKAT", "CLOZE"].includes(data.type) ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-3 text-theme-sm text-gray-500">Siswa mengetik jawaban singkat di sini.</p>
        ) : null}

        {pairs.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Item</p>
              <ol className="mt-2 grid gap-2 text-theme-sm text-gray-800">
                {pairs.map((pair, index) => <li key={index}><LocalizedContent text={pair.left} language={data.language} direction="auto">{pair.left}</LocalizedContent></li>)}
              </ol>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Pasangan</p>
              <ol className="mt-2 grid gap-2 text-theme-sm text-gray-800">
                {pairs.map((pair, index) => <li key={index}><LocalizedContent text={pair.right} language={data.language} direction="auto">{pair.right}</LocalizedContent></li>)}
              </ol>
            </div>
          </div>
        ) : null}

        {sequence.length > 0 ? (
          <ol className="mt-4 grid gap-2 text-theme-sm text-gray-800">
            {sequence.map((item, index) => <li key={index} className="rounded-xl border border-gray-200 p-3">{index + 1}. <LocalizedContent text={item} language={data.language} direction="auto">{item}</LocalizedContent></li>)}
          </ol>
        ) : null}

        {MANUAL_TYPES.includes(data.type) ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-3 text-theme-sm text-gray-500">Jawaban siswa dinilai manual oleh guru{rubric.length > 0 ? " memakai rubrik di samping." : "."}</p>
        ) : null}
      </section>

      <aside className="tailadmin-card grid gap-4 self-start p-5">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Khusus guru</p>
          <h2 className="mt-1 font-semibold text-gray-900">Kunci &amp; pembahasan</h2>
        </div>

        {correctOptions.length > 0 ? (
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Opsi benar</p>
            <ul className="mt-2 grid gap-1 text-theme-sm text-success-700">
              {correctOptions.map((option) => <li key={option.label}><span className="font-semibold">{option.label}.</span> <LocalizedContent text={option.content} language={data.language} direction="auto">{option.content}</LocalizedContent></li>)}
            </ul>
          </div>
        ) : null}

        {data.expectedAnswer ? (
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Kunci jawaban</p>
            <p className="mt-2 text-theme-sm text-gray-800"><LocalizedContent text={data.expectedAnswer} language={data.language} direction="auto">{data.expectedAnswer}</LocalizedContent></p>
          </div>
        ) : null}

        {pairs.length > 0 ? (
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Pasangan benar</p>
            <ul className="mt-2 grid gap-1 text-theme-sm text-gray-800">
              {pairs.map((pair, index) => (
                <li key={index}><LocalizedContent text={pair.left} language={data.language} direction="auto">{pair.left}</LocalizedContent> → <LocalizedContent text={pair.right} language={data.language} direction="auto">{pair.right}</LocalizedContent></li>
              ))}
            </ul>
          </div>
        ) : null}

        {sequence.length > 0 ? (
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Urutan benar</p>
            <ol className="mt-2 grid gap-1 text-theme-sm text-gray-800">
              {sequence.map((item, index) => <li key={index}>{index + 1}. <LocalizedContent text={item} language={data.language} direction="auto">{item}</LocalizedContent></li>)}
            </ol>
          </div>
        ) : null}

        {rubric.length > 0 ? (
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Rubrik penilaian</p>
            <ul className="mt-2 grid gap-1 text-theme-sm text-gray-800">
              {rubric.map((criterion) => <li key={criterion.name} className="flex justify-between gap-3"><span>{criterion.name}</span><span className="font-semibold">{criterion.max}</span></li>)}
            </ul>
          </div>
        ) : null}

        {data.explanation ? (
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Pembahasan</p>
            <p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-gray-700"><LocalizedContent text={data.explanation} language={data.language} direction="auto">{data.explanation}</LocalizedContent></p>
          </div>
        ) : null}

        {correctOptions.length === 0 && !data.expectedAnswer && pairs.length === 0 && sequence.length === 0 && rubric.length === 0 && !data.explanation ? (
          <p className="text-theme-sm text-gray-500">Belum ada kunci atau pembahasan pada soal ini.</p>
        ) : null}
      </aside>
    </div>
  );
}
