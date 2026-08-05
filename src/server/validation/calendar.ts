import { z } from "zod";

const dateTimeInput = z.string().trim().min(1).max(64);

export const calendarRangeSchema = z.object({
  from: dateTimeInput.optional(),
  to: dateTimeInput.optional(),
});

const calendarEventFields = z.object({
  classId: z.string().min(8).max(64).optional().or(z.literal("")),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(10000).optional().or(z.literal("")),
  eventType: z.enum(["HOLIDAY", "ANNOUNCEMENT"]),
  startAt: dateTimeInput,
  endAt: dateTimeInput.optional().or(z.literal("")),
  allDay: z.boolean().default(false),
  visibility: z.enum(["ALL", "GURU", "SISWA", "WALI"]).default("ALL"),
});

function validateCalendarEvent(value: z.infer<typeof calendarEventFields>, context: z.RefinementCtx) {
  const startAt = parseInputDate(value.startAt);
  const endAt = value.endAt ? parseInputDate(value.endAt) : null;
  if (!startAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["startAt"], message: "Waktu mulai belum valid" });
  if (value.endAt && !endAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "Waktu selesai belum valid" });
  if (startAt && endAt && endAt < startAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "Waktu selesai tidak boleh sebelum waktu mulai" });
}

export const createCalendarEventSchema = calendarEventFields.superRefine(validateCalendarEvent);

export const updateCalendarEventSchema = calendarEventFields.partial().superRefine((value, context) => {
  if (value.startAt || value.endAt) {
    const startAt = parseInputDate(value.startAt);
    const endAt = value.endAt ? parseInputDate(value.endAt) : null;
    if (value.startAt && !startAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["startAt"], message: "Waktu mulai belum valid" });
    if (value.endAt && !endAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "Waktu selesai belum valid" });
    if (startAt && endAt && endAt < startAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "Waktu selesai tidak boleh sebelum waktu mulai" });
  }
});

export function parseInputDate(value: string | undefined) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+07:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
