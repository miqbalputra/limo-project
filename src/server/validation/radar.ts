import { z } from "zod";

import { cuidSchema } from "./common";

export const radarInterventionSchema = z.object({
  siswaId: cuidSchema,
});
