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

import { eraFromSpeech } from "@/components/game/voice";
describe("era switch by voice", () => {
  it("the other year said alone or as a short command switches", () => {
    for (const t of ["2026", "2026.", "En 2026", "Passons en 2026", "Retour en 2026, s'il vous plaît", "Go to 2026", "deux mille vingt-six"]) expect(eraFromSpeech(t, 1996), t).toBe(2026);
    for (const t of ["1996", "On retourne en 1996", "Switch to 1996", "mille neuf cent quatre-vingt-seize"]) expect(eraFromSpeech(t, 2026), t).toBe(1996);
  });
  it("a mention, a question or the current year does not", () => {
    for (const t of ["Je viens de 2026", "En 2026, la cabine est abîmée", "2026 ?", "Que s'est-il passé en 2026 ?", "1996"]) expect(eraFromSpeech(t, 1996), t).toBeNull();
  });
});

import { wantsToDecide } from "@/components/game/voice";
describe("opening the decision by voice", () => {
  it("explicit requests open it (en, fr)", () => {
    for (const t of ["Let's decide.", "OK, let's decide the film's fate", "I'm ready to decide", "On décide.", "Décidons maintenant", "Je suis prête à décider", "Décider du sort du film"]) expect(wantsToDecide(t), t).toBe(true);
  });
  it("questions, refusals and mere mentions do not", () => {
    for (const t of ["Should we decide?", "Not yet, let's decide later", "On ne décide pas encore", "Il faudra décider un jour, peut-être", "Décider quoi ?"]) expect(wantsToDecide(t), t).toBe(false);
  });
});

import { closeIntent } from "@/components/game/voice";
describe("closing a window by voice", () => {
  it("short acknowledgements and explicit close words", () => {
    for (const t of ["Ok", "OK.", "D'accord", "Merci", "C'est bon", "Okay, thanks", "Got it"]) expect(closeIntent(t), t).toBe("ack");
    for (const t of ["Ferme", "Fermez ça", "Close", "Cancel", "Annuler"]) expect(closeIntent(t), t).toBe("close");
  });
  it("longer speech is not a close", () => {
    for (const t of ["Ok, montre-moi le verso", "D'accord, va chercher la clé", "Ferme l'armoire", "je confirme"]) expect(closeIntent(t), t).toBeNull();
  });
});

import { showIntent } from "@/components/game/voice";
describe("showing a document by voice", () => {
  it("opens the named document", () => {
    expect(showIntent("J'ai une photo à vous montrer")).toBe("photo");
    expect(showIntent("I have a photo to show you")).toBe("photo");
    expect(showIntent("Regardez ce rapport")).toBe("archiveReport");
    expect(showIntent("Let me show you the letter")).toBe("letter");
  });
  it("mentions without showing, and negations, open nothing", () => {
    expect(showIntent("La photo est sur le bureau")).toBeNull();
    expect(showIntent("Je n'ai pas de photo à montrer")).toBeNull();
  });
});
