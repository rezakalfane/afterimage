/** Pure reference only: wrap with auth, scoped transaction, idempotency and projections.
 * `context` MUST come from trusted server routing, never from the request body.
 * This module has no DB, network, authentication or provider integration.
 */
import { readFileSync } from 'node:fs';
const episode = JSON.parse(readFileSync(new URL('../data/episode.json', import.meta.url), 'utf8'));
export const initialState = () => structuredClone(episode.initialState);
const rules = {
  inspect_photo: [2026, [], 'photo_seen'],
  relay_key_location: [1996, ['photo_seen'], 'key_location_shared'],
  retrieve_key: [1996, ['key_location_shared'], 'key_found'],
  open_cabinet: [1996, ['key_found'], 'cabinet_open'],
  inspect_programme: [1996, [], 'programme_seen'],
  read_letter: [1996, ['cabinet_open', 'programme_seen'], 'letter_read'],
  acknowledge_permission: [1996, ['letter_read'], 'permission_acknowledged'],
  inspect_waterline: [2026, [], 'waterline_seen'],
  relay_flood_warning: [1996, ['waterline_seen'], 'flood_warning_shared'],
  recover_cache: [2026, ['cache_preserved'], 'cache_recovered'],
  read_message: [2026, ['cache_recovered'], 'message_read'],
  read_future_letter: [2026, ['cache_recovered'], 'future_letter_read'],
};
export function transition(state, command, context = {}) {
  const fail = code => ({ok:false, code, state});
  if (!command || typeof command !== 'object' || Array.isArray(command)) return fail('INVALID_ARGUMENT');
  if (Object.keys(command).some(k => !['action','args'].includes(k))) return fail('INVALID_ARGUMENT');
  const { action, args = {} } = command;
  if (typeof action !== 'string' || !args || typeof args !== 'object' || Array.isArray(args)) return fail('INVALID_ARGUMENT');
  if (state.ending) return fail('RUN_FINISHED');
  if (!['ui','tool','ending-confirmed'].includes(context.channel)) return fail('UNTRUSTED_CHANNEL');
  if (context.channel === 'tool' && context.character !== (state.activeEra === 1996 ? 'jeanne' : 'malik')) return fail('WRONG_CHARACTER');
  if (['switch_era','confirm_message'].includes(action) && context.channel !== 'ui') return fail('UI_CONFIRMATION_REQUIRED');
  if (action === 'choose_ending' && context.channel !== 'ending-confirmed') return fail('UI_CONFIRMATION_REQUIRED');
  const s = structuredClone(state);
  const has = flag => s.flags.includes(flag);
  const need = flags => flags.every(has);
  const mark = flag => { if (!has(flag)) s.flags.push(flag); };
  const exact = keys => Object.keys(args).every(k => keys.includes(k)) && keys.every(k => Object.hasOwn(args,k));
  if (Object.hasOwn(rules, action)) {
    if (!exact([])) return fail('INVALID_ARGUMENT');
    const [era, required, flag] = rules[action];
    if (s.activeEra !== era) return fail('WRONG_ERA');
    if (!need(required)) return fail('PREREQUISITE_MISSING');
    mark(flag);
  } else if (action === 'switch_era') {
    if (!exact(['era']) || ![1996,2026].includes(args.era)) return fail('INVALID_ARGUMENT');
    s.activeEra = args.era;
  } else if (action === 'write_message') {
    if (!exact(['text']) || typeof args.text !== 'string') return fail('INVALID_ARGUMENT');
    if (s.activeEra !== 1996) return fail('WRONG_ERA');
    if (!need(['letter_read'])) return fail('PREREQUISITE_MISSING');
    if (has('cache_preserved')) return fail('MESSAGE_LOCKED');
    const text = args.text.normalize('NFC').trim();
    if (Array.from(text).length < 1 || Array.from(text).length > 240 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) return fail('INVALID_ARGUMENT');
    if (s.messageDraft !== text) {
      s.messageDraft = text; s.message = null;
      s.flags = s.flags.filter(f => f !== 'message_confirmed');
    }
  } else if (action === 'confirm_message') {
    if (!exact(['text']) || args.text !== s.messageDraft || !s.messageDraft) return fail('INVALID_ARGUMENT');
    if (s.activeEra !== 1996) return fail('WRONG_ERA');
    if (has('cache_preserved')) return fail('MESSAGE_LOCKED');
    s.message = s.messageDraft; mark('message_confirmed');
  } else if (action === 'preserve_cache') {
    if (!exact(['location']) || args.location !== 'upper_cabinet') return fail('INVALID_ARGUMENT');
    if (s.activeEra !== 1996) return fail('WRONG_ERA');
    if (!need(['cabinet_open','permission_acknowledged','flood_warning_shared','message_confirmed'])) return fail('PREREQUISITE_MISSING');
    s.storage = 'upper_cabinet'; mark('cache_preserved');
  } else if (action === 'choose_ending') {
    if (!exact(['ending']) || !episode.endings.some(e => e.id === args.ending)) return fail('INVALID_ARGUMENT');
    if (s.activeEra !== 2026) return fail('WRONG_ERA');
    if (!need(['cache_recovered','message_read','future_letter_read'])) return fail('PREREQUISITE_MISSING');
    s.ending = args.ending;
  } else if (action === 'request_hint') {
    if (!exact([])) return fail('INVALID_ARGUMENT');
    s.hintsUsed = Math.min(3, s.hintsUsed + 1);
  } else return fail('UNKNOWN_ACTION');
  s.phase = s.ending ? 'finished' : has('cache_recovered') ? 'decide' : has('cache_preserved') ? 'recover' : has('cabinet_open') ? 'preserve' : 'investigate';
  if (JSON.stringify(s) === JSON.stringify(state)) return {ok:true, changed:false, state};
  s.revision += 1;
  return {ok:true, changed:true, state:s, event:{type:action, revision:s.revision}};
}

/** Player projection: no unrevealed document text; do not serialize episode wholesale. */
export function publicView(state) {
  const has = flag => state.flags.includes(flag);
  const documents = {};
  for (const [flag,key] of [['photo_seen','photoBack'],['programme_seen','programme'],['letter_read','letter'],['waterline_seen','archiveReport']]) {
    if (has(flag)) documents[key] = episode.documents[key];
  }
  return {revision:state.revision, activeEra:state.activeEra, phase:state.phase,
    discovered:[...state.flags], documents, messageDraft:state.messageDraft,
    confirmedMessage:state.message, recoveredMessage:has('message_read') ? state.message : null,
    ending:state.ending, hintsUsed:state.hintsUsed};
}

/** Character projection is intentionally narrower than the player's notebook. */
export function characterView(state, character) {
  if (!['jeanne','malik'].includes(character)) throw new Error('Invalid character');
  const has = f => state.flags.includes(f);
  const facts = [];
  if (character === 'jeanne') {
    if (has('key_location_shared')) facts.push('Le joueur a indiqué le siège G7.');
    if (has('cabinet_open')) facts.push('L’armoire a été ouverte.');
    if (has('letter_read')) facts.push('La lettre d’Alice a été lue avec le joueur.');
    if (has('permission_acknowledged')) facts.push('Le joueur a reconnu la condition sur l’épilogue privé.');
    if (has('flood_warning_shared')) facts.push('Le joueur a averti d’un risque d’eau et conseillé l’étagère haute.');
    if (has('cache_preserved')) facts.push('La cache est protégée en haut de l’armoire ; la clé est derrière le projecteur.');
  } else {
    if (has('photo_seen')) facts.push('Le dos de la photo porte G7.');
    if (has('waterline_seen')) facts.push(episode.documents.archiveReport);
    if (has('cache_recovered')) facts.push('La cache ancienne a été retrouvée en haut de l’armoire.');
    if (has('future_letter_read')) facts.push(episode.documents.letter);
    if (state.ending) facts.push('Décision confirmée : '+state.ending);
  }
  return {character, era:character === 'jeanne' ? 1996 : 2026, revision:state.revision, facts,
    personalMessage:character === 'jeanne' ? (has('message_confirmed') ? state.message : null) : (has('message_read') ? state.message : null)};
}
