import { describe, expect, it } from "vitest";
import { endingFromSpeech, isConfirmation } from "@/components/game/voice";

describe("voice confirmation (player's own words only)", () => {
  it("accepts explicit confirmations", () => {
    for (const t of ["Je confirme.", "Oui, gardez-les.", "C’est bien ça, je valide", "D'accord"]) expect(isConfirmation(t, "fr")).toBe(true);
    for (const t of ["I confirm.", "Yes, keep them.", "That's right"]) expect(isConfirmation(t, "en")).toBe(true);
  });
  it("refuses negations and unrelated speech", () => {
    for (const t of ["Non, je ne confirme pas", "Attends, je change un mot", "Lisez la lettre"]) expect(isConfirmation(t, "fr")).toBe(false);
    for (const t of ["No, don't keep them", "Wait", "Open the cabinet"]) expect(isConfirmation(t, "en")).toBe(false);
  });
  it("names one ending, or none when ambiguous", () => {
    expect(endingFromSpeech("Je choisis la version autorisée", "fr")).toBe("public_cut");
    expect(endingFromSpeech("Confions le film aux archives", "fr")).toBe("sealed_archive");
    expect(endingFromSpeech("Screen everything, in full", "en")).toBe("broken_promise");
    expect(endingFromSpeech("Les archives ou la version autorisée ?", "fr")).toBeNull();
  });
});
