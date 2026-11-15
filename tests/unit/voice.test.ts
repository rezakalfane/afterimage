// Voice confirmation: only an explicit affirmative utterance confirms; anything ambiguous does not.
import { describe, expect, it } from "vitest";
import { endingFromSpeech, isConfirmation, sameTarget } from "@/components/game/voice";

describe("message confirmation", () => {
  it("accepts explicit confirmations (with fillers or politeness)", () => {
    for (const t of ["Je confirme.", "Oui, je confirme.", "Euh… oui, je confirme, merci.", "Je les confie à Jeanne.", "Gardez-les.", "C’est confirmé"]) expect(isConfirmation(t, "fr"), t).toBe(true);
    for (const t of ["I confirm.", "Yes, I confirm.", "Um, okay, I confirm them, thanks.", "Keep them.", "Confirmed"]) expect(isConfirmation(t, "en"), t).toBe(true);
  });
  it("refuses negations, hesitation, questions, quotes and loose mentions", () => {
    for (const t of [
      "Je ne confirme pas.",
      "Oui… attends.",
      "Si je dis je confirme, que se passe-t-il ?",
      "Le personnage a dit je confirme.",
      "Jeanne dit : je confirme",
      "Oui",
      "D'accord",
      "Je confirme que la clé est sous le siège G7 et j'aimerais aussi qu'on regarde la lettre",
      "Peut-être, je confirme",
      "Non non, je confirme pas",
    ]) expect(isConfirmation(t, "fr"), t).toBe(false);
    for (const t of [
      "I don't confirm.",
      "Yes… wait.",
      "If I say I confirm, what happens?",
      "The character said I confirm.",
      "Yes",
      "Okay",
      "Maybe I confirm",
      "No, I do not confirm",
    ]) expect(isConfirmation(t, "en"), t).toBe(false);
  });
});

describe("ending: explicit selection, then a separate explicit confirmation", () => {
  it("selects one ending only when the player explicitly chooses it", () => {
    expect(endingFromSpeech("Je choisis la version autorisée", "fr")).toBe("public_cut");
    expect(endingFromSpeech("Je préfère confier le film aux archives", "fr")).toBe("sealed_archive");
    expect(endingFromSpeech("I choose to screen everything, in full", "en")).toBe("broken_promise");
  });
  it("never selects on a mention, a question, a negation or an ambiguity", () => {
    for (const t of ["Les archives ?", "Les archives ou la version autorisée", "Je ne choisis pas les archives", "Jeanne parlait des archives", "Que se passe-t-il si je choisis les archives ?"]) expect(endingFromSpeech(t, "fr"), t).toBeNull();
    for (const t of ["The archives?", "I don't choose the archives", "What if I choose the authorised version?"]) expect(endingFromSpeech(t, "en"), t).toBeNull();
  });
  it("ending confirmations use the same strict phrases", () => {
    expect(isConfirmation("Je confirme ce choix", "fr", "ending")).toBe(true);
    expect(isConfirmation("Oui, c'est mon choix", "fr", "ending")).toBe(true);
    expect(isConfirmation("Si je confirme, c'est définitif ?", "fr", "ending")).toBe(false);
  });
});

describe("confirmation target binding", () => {
  const base = { kind: "message" as const, content: "Les étoiles.", revision: 12, session: "lease_a", since: 0 };
  it("any change of kind, content, revision or session invalidates it", () => {
    expect(sameTarget(base, { ...base, since: 99 })).toBe(true);
    expect(sameTarget(base, { ...base, content: "Les étoiles !" })).toBe(false);
    expect(sameTarget(base, { ...base, revision: 13 })).toBe(false);
    expect(sameTarget(base, { ...base, session: "lease_b" })).toBe(false);
    expect(sameTarget(base, { ...base, kind: "ending" })).toBe(false);
    expect(sameTarget(base, null)).toBe(false);
  });
});
