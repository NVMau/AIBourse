import { PriceProvenance, toProvenance, validateProvenance } from "./provenance";

export type ProvenanceResponse = {
  recordId: string;
  data: PriceProvenance;
};

export class InMemoryProvenanceStore {
  private readonly byRecordId = new Map<string, PriceProvenance>();

  upsert(input: Partial<PriceProvenance>) {
    const p = toProvenance(input);
    const validation = validateProvenance(p);
    if (!validation.ok) {
      throw new Error(`Invalid provenance payload: ${validation.errors.join("; ")}`);
    }

    this.byRecordId.set(p.recordId, p);
    return p;
  }

  getByRecordId(recordId: string): ProvenanceResponse | null {
    const data = this.byRecordId.get(recordId) ?? null;
    if (!data) return null;
    return { recordId, data };
  }

  listByModel(modelId: string) {
    return Array.from(this.byRecordId.values()).filter((p) => p.modelId === modelId);
  }
}

/**
 * REST contract (to implement in HTTP framework):
 *
 * GET /api/provenance/:recordId
 * 200 -> ProvenanceResponse
 * 404 -> { error: "not_found" }
 *
 * GET /api/models/:modelId/provenance
 * 200 -> PriceProvenance[]
 */
