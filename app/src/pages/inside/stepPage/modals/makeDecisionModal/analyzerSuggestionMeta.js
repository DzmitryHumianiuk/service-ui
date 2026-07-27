/*
 * Copyright 2021 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Helpers that read the analyzer-ng metadata carried on a suggestion's `suggestRs`
 * object (RP's SuggestInfo). All parsing is deliberately defensive: a legacy /
 * stock analyzer emits a `modelInfo` that does not match these shapes, in which
 * case every helper returns an empty / null value and the UI renders nothing extra.
 *
 * Cold-start rubric provisional row (analyzer-ng, image mk18):
 *   methodName = 'coldstart_rubric'
 *   issueType  = <rubric locator> (proposed defect type)
 *   matchScore = rubric pseudo-confidence (NOT a similarity score)
 *   modelInfo  = "coldstart_rubric;{model_ver};why={explanation}"
 *
 * Classical row:
 *   methodName = 'suggestion' | 'auto_analysis'
 *   modelInfo  = "analyzer-ng;gbm=..;emb=..;kb_mode=..;src=<provenance>"
 *                where src = human-confirmed | auto-analyzed | ...
 */

export const COLDSTART_RUBRIC_METHOD = 'coldstart_rubric';

export const PROVENANCE = {
  RUBRIC: 'rubric',
  HUMAN: 'human',
  AUTO: 'auto',
};

// analyzer-ng confidence bands (lens-contract §2.1 / §5). Ride inside modelInfo as a
// `band=` token (stripped by stock service-api if sent as a first-class key). The Bench
// renders each band with its own plain-English phrase and card accent.
export const BANDS = {
  AUTO: 'auto',
  SUGGEST: 'suggest',
  BELOW_SUGGEST: 'below_suggest',
  RUBRIC: 'rubric',
};

// decision.py thresholds (lens-contract §3.2). Used only for the legacy fallback below,
// never to fabricate a below_suggest verdict from a stock analyzer.
const TAU_SUGGEST = 0.45;

export const isRubricHypothesis = (suggestRs) =>
  !!suggestRs && suggestRs.methodName === COLDSTART_RUBRIC_METHOD;

// True only for an analyzer-ng v1 reply (`ng=1` token present in modelInfo). Lets the
// Bench light up below_suggest chrome ONLY when the analyzer actually spoke the v1
// contract — a legacy/stock reply never gets the new below-band section (defensive).
export const parseNgVersion = (suggestRs) => {
  const modelInfo = suggestRs && suggestRs.modelInfo;
  return typeof modelInfo === 'string' && /(?:^|;)ng=1(?:;|$)/.test(modelInfo);
};

// The per-row confidence band. Rubric wins by methodName. For a v1 reply we read the
// explicit `band=` token. For a legacy reply we NEVER guess `below_suggest`: we return
// 'suggest' when matchScore clears the bar, else null (renders as a plain stock card).
export const parseBand = (suggestRs) => {
  if (isRubricHypothesis(suggestRs)) {
    return BANDS.RUBRIC;
  }
  const modelInfo = suggestRs && suggestRs.modelInfo;
  if (typeof modelInfo === 'string') {
    const match = modelInfo.match(/(?:^|;)band=([a-z_]+)(?:;|$)/);
    if (match) {
      const band = match[1];
      if (
        band === BANDS.AUTO ||
        band === BANDS.SUGGEST ||
        band === BANDS.BELOW_SUGGEST ||
        band === BANDS.RUBRIC
      ) {
        return band;
      }
    }
  }
  // Legacy fallback: only distinguish suggest vs unknown by the displayed matchScore.
  const score = suggestRs && suggestRs.matchScore;
  if (typeof score === 'number') {
    return score / 100 >= TAU_SUGGEST ? BANDS.SUGGEST : null;
  }
  return null;
};

export const isBelowSuggest = (suggestRs) => parseBand(suggestRs) === BANDS.BELOW_SUGGEST;

// Row-0 calibrated probability (`conf=` token, 0..1). Distinct from matchScore. Returns
// null when absent (secondary/below rows omit it — do not invent one).
export const parseConfidence = (suggestRs) => {
  const modelInfo = suggestRs && suggestRs.modelInfo;
  if (typeof modelInfo !== 'string') {
    return null;
  }
  const match = modelInfo.match(/(?:^|;)conf=([0-9.]+)(?:;|$)/);
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
};

// Explanation kind: match | decline | rubric (`ek=` token). Drives the tone of the
// explanation block (a `decline` explanation is warning-toned "why the analyzer said no").
export const parseExplKind = (suggestRs) => {
  const modelInfo = suggestRs && suggestRs.modelInfo;
  if (typeof modelInfo !== 'string') {
    return null;
  }
  const match = modelInfo.match(/(?:^|;)ek=([a-z]+)(?:;|$)/);
  return match ? match[1] : null;
};

// Grounded explanation text. Rubric carries it as the `why=` remainder; classical rows
// carry it the same way (why= is always the last token). Shared with parseRubricWhy.
export const parseExplanation = (suggestRs) => parseRubricWhy(suggestRs && suggestRs.modelInfo);

// Everything after the first `why=` token in modelInfo — the free-text rationale
// may itself contain `;` or `=`, so we take the remainder verbatim.
export const parseRubricWhy = (modelInfo) => {
  if (typeof modelInfo !== 'string') {
    return '';
  }
  const marker = 'why=';
  const idx = modelInfo.indexOf(marker);
  if (idx === -1) {
    return '';
  }
  return modelInfo.slice(idx + marker.length).trim();
};

// The model version token (2nd `;`-separated segment) of a rubric modelInfo, e.g.
// "coldstart_rubric;rubric+2026.07;why=..." -> "rubric+2026.07". Used only for a tooltip.
export const parseRubricModelVer = (modelInfo) => {
  if (typeof modelInfo !== 'string') {
    return '';
  }
  const parts = modelInfo.split(';');
  return parts.length > 1 ? parts[1].trim() : '';
};

// One of PROVENANCE.* or null. Rubric wins by methodName; classical rows are read
// from the `src=` token of modelInfo. Unknown / legacy shapes -> null (render nothing).
export const parseProvenance = (suggestRs) => {
  if (isRubricHypothesis(suggestRs)) {
    return PROVENANCE.RUBRIC;
  }
  const modelInfo = suggestRs && suggestRs.modelInfo;
  if (typeof modelInfo !== 'string') {
    return null;
  }
  const match = modelInfo.match(/src=([^;]+)/);
  if (!match) {
    return null;
  }
  const src = match[1].trim();
  if (src === 'human-confirmed') {
    return PROVENANCE.HUMAN;
  }
  if (src === 'auto-analyzed') {
    return PROVENANCE.AUTO;
  }
  return null;
};

// Inspector "journey" deep link built from fields already present on every suggestRs
// (numeric `project` id, `launchId`, `testItem`). Returns null when a required id is
// missing so the UI can hide the link rather than emit a broken permalink
// (lens-contract §4.2). Opened in a new window with rel="noopener noreferrer".
export const getInspectorJourneyUrl = ({ project, launchId, testItem } = {}) => {
  if (!project || !launchId || !testItem) {
    return null;
  }
  return `/inspector/#view=journey&project=${project}&launch=${launchId}&item=${testItem}`;
};

// Same journey link, addressed from the current test item under analysis. The numeric
// project id must come from projectInfoIdSelector (activeProjectSelector is the name).
export const getInspectorJourneyUrlForItem = (projectId, item) => {
  if (!projectId || !item || !item.launchId || !(item.id || item.itemId)) {
    return null;
  }
  return `/inspector/#view=journey&project=${projectId}&launch=${item.launchId}&item=${
    item.id || item.itemId
  }`;
};

// Same-origin Inspector journey API. Serves the exact-signature launch group
// (analyzer.launch_group) so the Bench group cue shows the same number and the
// same members as the Inspector's grouping card.
export const getInspectorJourneyApiUrl = (projectId, itemId) => {
  if (!projectId || !itemId) {
    return null;
  }
  return `/inspector/api/item/${projectId}/${itemId}/journey`;
};

// Same-origin proxy to the analyzer's own health. Used to decide whether an
// explanation is still on its way: the analyzer writes the decision at once and
// fills the explanation afterwards, so a missing explanation means either "still
// being written" or "not coming at all", and only the live LLM state tells the
// two apart.
export const getAnalyzerHealthApiUrl = () => '/inspector/api/analyzer-health';

// True when the analyzer can still produce an explanation right now. Reads the
// health payload defensively: anything unexpected means "do not promise text".
export const canLlmStillAnswer = (healthPayload) => {
  const llm = healthPayload && healthPayload.health && healthPayload.health.llm;
  if (!llm || typeof llm !== 'object') {
    return false;
  }
  return !!llm.enabled && !!llm.available && llm.breaker_state !== 'open';
};

// ---------------------------------------------------------------------------
// Empty analyzer reply: which of the three causes to tell the reader about.
//
// An empty reply used to be reported as "no ERROR logs to analyze" in every case.
// That is right for one cause and wrong for the two common ones. The analyzer
// answers the suggest call from what it has already worked out, so the first look
// at a fresh failure gets an empty reply while the logs are there and the answer
// is seconds away; and a project with no decided failures like this one has
// nothing to point at however good the logs are. Naming the wrong cause sends
// people looking for missing logs that are not missing.
//
//   'working'   - keep quiet about causes: the analyzer read the logs and is still
//                 working, or we do not know yet (journey not resolved). Saying
//                 "still working" is the only claim safe to make before the facts
//                 are in, and it is the one that is true most of the time.
//   'noHistory' - the analyzer read the logs, nothing left to wait for, but this
//                 project has no decided failure to match against.
//   'noLogs'    - the real silent case: no ERROR logs, so no signature at all.
// ---------------------------------------------------------------------------
export const EMPTY_REPLY_WORKING = 'working';
export const EMPTY_REPLY_NO_HISTORY = 'noHistory';
export const EMPTY_REPLY_NO_LOGS = 'noLogs';

export const emptyReplyVariant = ({ journeyResolved, stillWorking, analyzerReadLogs }) => {
  if (!journeyResolved || stillWorking) {
    return EMPTY_REPLY_WORKING;
  }
  return analyzerReadLogs ? EMPTY_REPLY_NO_HISTORY : EMPTY_REPLY_NO_LOGS;
};

// ---------------------------------------------------------------------------
// Launch context (burst) trigger. The analyzer computes the burst signal
// (grouping.dominant); si_prior is only a fallback for payloads where the
// boolean is absent. The UI never re-derives thresholds beyond this constant
// and never shows si_prior raw.
// ---------------------------------------------------------------------------
export const BENCH_BURST_SI_PRIOR = 0.6;

export const isBurstGroup = (grouping) => {
  if (!grouping) {
    return false;
  }
  if (grouping.dominant === true) {
    return true;
  }
  if (grouping.dominant === undefined || grouping.dominant === null) {
    return typeof grouping.si_prior === 'number' && grouping.si_prior >= BENCH_BURST_SI_PRIOR;
  }
  return false;
};

// Analyzer defect-group labels -> RP defect group typeRef, for the freshness
// gate below. Unknown vocabulary maps to null (the check is skipped, since an
// unreadable label is not evidence of staleness).
const DECISION_LABEL_TO_GROUP = {
  pb: 'PRODUCT_BUG',
  ab: 'AUTOMATION_BUG',
  si: 'SYSTEM_ISSUE',
  ti: 'TO_INVESTIGATE',
  nd: 'NO_DEFECT',
  product_bug: 'PRODUCT_BUG',
  automation_bug: 'AUTOMATION_BUG',
  system_issue: 'SYSTEM_ISSUE',
  to_investigate: 'TO_INVESTIGATE',
  no_defect: 'NO_DEFECT',
};

// The set of RP defect-group typeRefs, for the label-sanity check below.
const _GROUP_SET = new Set(Object.values(DECISION_LABEL_TO_GROUP));

// The decision's own predicted defect GROUP (typeRef), read first from the
// payload's `predicted_group` and falling back to mapping `predicted_label`.
// null when neither resolves (the label-sanity check is then skipped).
const _decisionGroup = (decision) => {
  if (!decision) {
    return null;
  }
  const g =
    typeof decision.predicted_group === 'string' ? decision.predicted_group.toUpperCase().trim() : '';
  if (g && _GROUP_SET.has(g)) {
    return g;
  }
  const rawLabel =
    typeof decision.predicted_label === 'string' ? decision.predicted_label.toLowerCase().trim() : '';
  return DECISION_LABEL_TO_GROUP[rawLabel] || null;
};

// Defect groups named IN FREE TEXT (the LLM explanation). Best-effort scan by the
// group's English name; returns every group mentioned so a multi-group explanation
// ("not a product bug, but a system issue") is judged on the whole set, not the first hit.
const _GROUP_NAME_PATTERNS = [
  ['PRODUCT_BUG', /\bproduct bug\b/i],
  ['AUTOMATION_BUG', /\bautomation bug\b/i],
  ['SYSTEM_ISSUE', /\bsystem issue\b/i],
  ['TO_INVESTIGATE', /\bto[\s_-]?investigate\b/i],
  ['NO_DEFECT', /\bno defect\b/i],
];
const _groupsNamedIn = (text) => {
  if (typeof text !== 'string' || !text) {
    return [];
  }
  return _GROUP_NAME_PATTERNS.filter(([, re]) => re.test(text)).map(([g]) => g);
};

/*
 * Fold a line onto the analyzer's own masking vocabulary so a quote and a log
 * line can be compared.
 *
 * The two sides arrive in different shapes. The item's log lines are RAW
 * ("expected response to have status code 200 but got 400"), while an explainer
 * quote was produced from the analyzer's already MASKED signature ("... status
 * code <NUM> but got <NUM>"). Running both through this function lands them on
 * the same string.
 *
 * The rules mirror MASKING_RULES in src/analyzer_ng/ml/drain.py, in the same
 * order (URL, IP, UUID, HEX, PATH, NUM). Tokens that are already masked contain
 * no digits, slashes or scheme, so they pass through untouched, which makes the
 * function idempotent and safe to run over either side.
 *
 * Earlier this replaced digits with 'N' instead, so a quote holding <NUM> could
 * never equal a log line holding 200. Since the quote gate fails closed, that
 * hid the explanation on every failure whose message carries a number, which is
 * most of them.
 */
export const normalizeLine = (line) =>
  String(line == null ? '' : line)
    .replace(/https?:\/\/[^\s"'<>]+/g, '<URL>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g, '<IP>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .replace(/\b0[xX][0-9a-fA-F]+\b|\b[0-9a-fA-F]{16,}\b/g, '<HEX>')
    .replace(/(?:[A-Za-z]:)?(?:[\\/][\w.-]+){2,}/g, '<PATH>')
    // Plain digits last, so the rules above keep their own tokens. No lookbehind
    // here on purpose: it is applied to both sides equally, and older Safari
    // does not support lookbehind in a regular expression.
    .replace(/\d+(?:\.\d+)?/g, '<NUM>')
    .replace(/\s+/g, ' ')
    .trim();

/*
 * Reoriented freshness gate (verdict 4.4). It NO LONGER compares the cached
 * decision against the live suggest reply — live disagreement is Act 2 / banner
 * content, never a reason to hide Act 1. This gate governs ONLY whether the AI
 * paragraph inside the decision story renders; rows 1 to 3 of the story always show.
 *
 * All checks are UI-side and must all pass:
 *   1. `decision.explanation` is a non-empty string.
 *   2. Pairing: the explanation is this decision record's OWN field, so it is
 *      paired by construction. If versioned decision ids / model_ver are ever
 *      threaded through to the explainer event, match them here; absent that,
 *      pass (best-effort, no live-reply comparison).
 *   3. Quote grounding: if the explainer carried quoted lines, at least one must
 *      match the item's own current log. Encoded by `quoteMatched`, which the
 *      caller computes via normalizeLine equal-or-substring (true = a quote
 *      matched, false = quotes exist and none matched -> FAIL CLOSED, null = the
 *      explainer carried no quotes -> skip). This is the surviving staleness tripwire.
 *   4. Label sanity: a defect group named in the explanation must equal the
 *      decision's own predicted group. Skip when either side is absent.
 *
 * Params:
 *   journeyDecision - journey payload `decision` block (or null)
 *   liveTopGroup    - typeRef of the live top row's group. Accepted for signature
 *                     stability with the hub; deliberately UNUSED (comparing the
 *                     decision to the live reply is exactly the behaviour 4.4 deletes).
 *   quoteMatched    - see check 3
 */
export const isDecisionFresh = (journeyDecision, liveTopGroup, quoteMatched) => {
  const decision = journeyDecision;
  // (1) explanation present
  if (!decision || typeof decision.explanation !== 'string' || !decision.explanation.trim()) {
    return false;
  }
  // (3) quote grounding: fail closed only when quotes exist and none matched.
  if (quoteMatched === false) {
    return false;
  }
  // (4) label sanity: the explanation's named group(s) must include the decision's own group.
  const labelGroup = _decisionGroup(decision);
  const named = _groupsNamedIn(decision.explanation);
  if (labelGroup && named.length && !named.includes(labelGroup)) {
    return false;
  }
  return true;
};

// Two-decimal confidence string, or null when the field cannot be resolved (never
// fabricate a number; the caller omits the confidence clause when this is null).
const _fmtConfidence = (value) => {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n.toFixed(2);
};

// A plain-English relative-time string ("2 hours ago") from an ISO timestamp, or
// null when unresolvable. Never invents a value: an unparseable stamp or a stamp
// more than a minute in the future (clock skew) returns null so the "decided {rel}"
// label is simply omitted rather than guessed (risk R5).
const relativeTimeFrom = (iso) => {
  if (!iso) {
    return null;
  }
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return null;
  }
  const deltaSec = (Date.now() - then) / 1000;
  if (deltaSec < -60) {
    return null;
  }
  const s = Math.max(0, deltaSec);
  const ago = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (s < 45) {
    return 'just now';
  }
  if (s < 2700) {
    return ago(Math.max(1, Math.round(s / 60)), 'minute');
  }
  if (s < 79200) {
    return ago(Math.max(1, Math.round(s / 3600)), 'hour');
  }
  if (s < 2160000) {
    return ago(Math.max(1, Math.round(s / 86400)), 'day');
  }
  if (s < 27648000) {
    return ago(Math.max(1, Math.round(s / 2592000)), 'month');
  }
  return ago(Math.max(1, Math.round(s / 31536000)), 'year');
};

// Decision-story message keys per outcome (verdict 4.2). Headlines that are word
// for word identical share ONE key (the lowest-numbered): O1/O2/O3 all print
// "Applied on its own: {defect}." and O5/O6/O7 all print "Looked, but did not
// apply anything." (contract A collapse rule). Reason lines are per outcome.
const _STORY_KEYS = {
  O1: { headKey: 'benchStoryHeadO1', reasonKey: 'benchStoryReasonO1' },
  O2: { headKey: 'benchStoryHeadO1', reasonKey: 'benchStoryReasonO2' },
  O3: { headKey: 'benchStoryHeadO1', reasonKey: 'benchStoryReasonO3' },
  O4: { headKey: 'benchStoryHeadO4', reasonKey: 'benchStoryReasonO4' },
  O5: { headKey: 'benchStoryHeadO5', reasonKey: 'benchStoryReasonO5' },
  O6: { headKey: 'benchStoryHeadO5', reasonKey: 'benchStoryReasonO6' },
  O7: { headKey: 'benchStoryHeadO5', reasonKey: 'benchStoryReasonO7' },
  O8: { headKey: 'benchStoryHeadO8', reasonKey: 'benchStoryReasonO8' },
  O9: { headKey: 'benchStoryHeadO9', reasonKey: 'benchStoryReasonO9' },
  O9b: { headKey: 'benchStoryHeadO9b', reasonKey: 'benchStoryReasonO9b' },
};

/*
 * Act 1 decision story (verdict 4.1 / 4.2). Deterministic, decision-fields only.
 * Returns the outcome id (O1..O9b), the message keys for its headline and reason
 * line, the placeholder bag, a relative timestamp, and the AI-paragraph candidate.
 *
 * Input is the journey `decision` block:
 *   - null / non-object            -> O9  (never analyzed, no record)
 *   - marker { fetchError: true }  -> O9b (the journey fetch itself failed; the hub
 *     passes this shape so O9 and O9b are distinguishable, per contract D step 1)
 *   - a real decision block        -> O1..O8 from band / method / abstain_reason
 *
 * O10 (silent, zero ERROR logs) is NOT produced here: it is a layout-level branch
 * (the shipped ng37 hero) the hub short-circuits before ever calling this.
 *
 * params carries only the placeholders each outcome's copy uses. `defectGroup` is a
 * defect-group typeRef (e.g. 'PRODUCT_BUG'); the hub maps it to the {defect} display
 * name before formatMessage (this pure helper has no defect-type dictionary). `p` is
 * the two-decimal confidence string. Unresolvable fields are omitted, never invented.
 *
 * hasAi / aiText / quotes describe the AI-paragraph CANDIDATE only; the caller still
 * gates its render through isDecisionFresh(). O8 (cold start) is excluded because its
 * explanation IS the rubric why, already owned by the AI guess card (verdict 4.1).
 */
export const deriveDecisionStory = (journeyDecision) => {
  const decision = journeyDecision;

  // O9b: the journey fetch failed (marker object from the hub).
  if (decision && (decision.fetchError === true || decision.error === true)) {
    return {
      outcomeId: 'O9b',
      headKey: 'benchStoryHeadO9b',
      reasonKey: 'benchStoryReasonO9b',
      params: {},
      timeRel: null,
      hasAi: false,
      aiText: '',
      quotes: [],
    };
  }
  // O9: no decision record at all.
  if (!decision || typeof decision !== 'object') {
    return {
      outcomeId: 'O9',
      headKey: 'benchStoryHeadO9',
      reasonKey: 'benchStoryReasonO9',
      params: {},
      timeRel: null,
      hasAi: false,
      aiText: '',
      quotes: [],
    };
  }

  const band = typeof decision.band === 'string' ? decision.band : null;
  const method = typeof decision.method === 'string' ? decision.method : null;
  const reason = typeof decision.abstain_reason === 'string' ? decision.abstain_reason : null;
  const hasProvisional = !!decision.coldstart;
  const defectGroup = _decisionGroup(decision);
  const p = _fmtConfidence(decision.confidence);

  let outcomeId;
  if (band === BANDS.AUTO) {
    if (method === 'hash') {
      outcomeId = 'O1';
    } else if (method === 'kb') {
      outcomeId = 'O2';
    } else {
      outcomeId = 'O3';
    }
  } else if (band === BANDS.SUGGEST) {
    outcomeId = 'O4';
  } else {
    // abstain (payload band 'abstain', or a defensive 'below_suggest')
    if ((method === 'rule_cold' || method === 'coldstart') && hasProvisional) {
      outcomeId = 'O8';
    } else if (reason === 'gbm_boilerplate_only_neighbor') {
      outcomeId = 'O6';
    } else if (reason === 'no_confident_rule') {
      outcomeId = 'O7';
    } else if (reason === 'gbm_below_suggest') {
      outcomeId = 'O5';
    } else if (p != null) {
      // generic abstain with a resolvable top-candidate confidence: O5 can cite it honestly
      outcomeId = 'O5';
    } else {
      outcomeId = 'O7';
    }
  }

  const params = {};
  if (defectGroup && (outcomeId === 'O1' || outcomeId === 'O2' || outcomeId === 'O3' || outcomeId === 'O4')) {
    params.defectGroup = defectGroup;
  }
  if (p != null && ['O1', 'O2', 'O3', 'O4', 'O5'].indexOf(outcomeId) !== -1) {
    params.p = p;
  }

  const aiText =
    outcomeId !== 'O8' && typeof decision.explanation === 'string' ? decision.explanation.trim() : '';
  const quotes = Array.isArray(decision.quotes)
    ? decision.quotes.filter((q) => typeof q === 'string' && q.trim().length)
    : [];

  const keys = _STORY_KEYS[outcomeId];
  return {
    outcomeId,
    headKey: keys.headKey,
    reasonKey: keys.reasonKey,
    params,
    timeRel: relativeTimeFrom(decision.created_at),
    hasAi: !!aiText,
    aiText,
    quotes,
  };
};

// Banner message keys per id (verdict 5). Helper key is the headline key + 'Help'.
const _BANNER_HEAD = {
  B1: 'benchBannerB1',
  B2: 'benchBannerB2',
  B2e: 'benchBannerB2e',
  B3: 'benchBannerB3',
  B4e: 'benchBannerB4e',
  B4: 'benchBannerB4',
  B5: 'benchBannerB5',
  B6u: 'benchBannerB6u',
  B6: 'benchBannerB6',
  B6s: 'benchBannerB6s',
  B6n: 'benchBannerB6n',
  BF: 'benchBannerBF',
};
const _banner = (id, params) => ({
  id,
  headKey: _BANNER_HEAD[id],
  helpKey: `${_BANNER_HEAD[id]}Help`,
  params: params || {},
});

/*
 * Act 2 banner head (verdict 5). One headline + one helper. The DECISION fact comes
 * from the journey decision route only, the OFFERS fact from the live reply only, so
 * an abstain can never render an "agrees" banner (the ng37 live-reply bug).
 *
 * decisionOutcome - the decision fact, shaped by the hub from deriveDecisionStory plus
 *   the decision block: { id, band, defect, group, rubric }
 *     id     - outcome id 'O1'..'O9b'
 *     band   - 'auto' | 'suggest' | 'abstain' | 'none' (none for O9 / O9b)
 *     defect - the decision's predicted defect display NAME (for {defect} in auto banners)
 *     group  - the decision's predicted defect group typeRef (for same/different tests)
 *     rubric - true when the decision is a cold-start rubric provisional (routes B5)
 * offers - the live-reply fact, shaped by the hub:
 *     empty        - the reply has no offer rows at all
 *     hasVouched   - at least one vouched (confirmed-label) offer >= 0.45
 *     converge     - vouched offers converge on one group (informational)
 *     split        - vouched offers split across defect groups
 *     unlabeledOnly- only unlabeled twins >= 0.45 (no confirmed defect behind them)
 *     rubricLeads  - a cold-start rubric card leads the offers (MS8)
 *     dockRows     - dock rows exist (offers below the 0.45 line)
 *     leanGroup    - typeRef of the group the offers lean toward (informational)
 *     leanDefect   - display NAME of the leaned defect (for {defect})
 *     topGroup     - typeRef of the live top offer's group (auto same/different test)
 *     topDefect    - display NAME of the live top offer (for {other})
 *
 * Returns { id, headKey, helpKey, params } or null when no banner renders (silent B7,
 * or a no-record state with nothing on offer, where the O9 story stands alone).
 * All display names are supplied resolved by the hub; this helper never resolves names.
 */
export const deriveBanner = ({ decisionOutcome, offers } = {}) => {
  const dec = decisionOutcome || {};
  const off = offers || {};
  const band = dec.band || (dec.id === 'O9' || dec.id === 'O9b' ? 'none' : null);

  // No decision record (O9 / O9b): the modal cannot attest what the analyzer did, so
  // the banner drops the "No auto decision" prefix and only relays the offers (BF).
  if (band === 'none') {
    const nothingOnOffer =
      off.empty || (!off.hasVouched && !off.unlabeledOnly && !off.rubricLeads && !off.dockRows);
    if (nothingOnOffer) {
      return null;
    }
    return _banner('BF', { defect: off.leanDefect || null, split: !!off.split });
  }

  // Auto decision: the only family that may say "decided" / "agrees".
  if (band === BANDS.AUTO) {
    if (off.empty) {
      return _banner('B2e', { defect: dec.defect || null });
    }
    if (off.topGroup && dec.group && off.topGroup === dec.group) {
      return _banner('B1', { defect: dec.defect || null });
    }
    return _banner('B2', { defect: dec.defect || null, other: off.topDefect || null });
  }

  // Cold-start rubric leads (MS8, both variants).
  if (off.rubricLeads || dec.id === 'O8' || dec.rubric === true) {
    return _banner('B5', {});
  }

  // The leading offer carries a confirmed label, but the model did not stand behind
  // it and nothing beyond the log text matched. Applies to every non-auto decision:
  // naming the side the offers lean would lend that side a backing the reply does
  // not support, and the lean is the only side a single neighbour can have.
  if (off.similarityOnly) {
    return _banner('B6s', {});
  }

  // Endorsed suggest.
  if (band === BANDS.SUGGEST) {
    if (off.split) {
      return _banner('B4e', { defect: dec.defect || off.leanDefect || null });
    }
    return _banner('B3', { defect: off.leanDefect || dec.defect || null });
  }

  // Abstain family (band 'abstain' / 'below_suggest', or an unknown non-auto band).
  if (off.hasVouched) {
    return off.split ? _banner('B4', {}) : _banner('B3', { defect: off.leanDefect || null });
  }
  if (off.unlabeledOnly) {
    return _banner('B6u', {});
  }
  if (off.dockRows) {
    return _banner('B6', {});
  }
  return _banner('B6n', {});
};

// True for the synthesized declined dock row (the ek=decline token). The Bench labels
// this row on the CONFIDENCE scale ("confidence {p}, under the 0.45 suggest line"),
// never "alike" (verdict MS7 / migration item 5). Plain below-line rows keep "alike".
export const isDeclineRow = (suggestRs) => parseExplKind(suggestRs) === 'decline';

// ---------------------------------------------------------------------------
// Does the model stand behind this offer?
//
// matchScore is a log similarity, not a belief that the label transfers. Dense
// e5 cosines sit near 0.9 for any two stack traces out of one suite, so a lone
// neighbour can lead the offers while the model that scored it refused to move.
// Everything below reads facts the reply and the journey already carry, decides
// which of them are safe to state, and leaves the card as it ships today when
// the analyzer is one whose reply we cannot read.
// ---------------------------------------------------------------------------

// The row's feature vector as { name: number }. The reply carries the names and
// the values as two ';'-separated strings of equal length; anything else (stock
// analyzer, truncated payload, mismatched lengths) yields an empty object, and
// every reader below then adds nothing to the card.
export const parseFeatures = (suggestRs) => {
  const names = suggestRs && suggestRs.modelFeatureNames;
  const values = suggestRs && suggestRs.modelFeatureValues;
  if (typeof names !== 'string' || typeof values !== 'string' || !names || !values) {
    return {};
  }
  const nameParts = names.split(';');
  const valueParts = values.split(';');
  if (nameParts.length !== valueParts.length) {
    return {};
  }
  const out = {};
  for (let i = 0; i < nameParts.length; i += 1) {
    const key = nameParts[i].trim();
    const n = Number.parseFloat(valueParts[i]);
    if (key && Number.isFinite(n)) {
      out[key] = n;
    }
  }
  return out;
};

// The journey is not consistent about how it names a defect: the nested classical
// row carries the short code ('ti'), while the decision on record carries the RP
// locator ('pb001'). _decisionGroup only understands the short form, so strip a
// locator down to its prefix before asking it.
const _groupFromLocator = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.trim().toLowerCase().match(/^([a-z]+)\d+$/);
  return match ? DECISION_LABEL_TO_GROUP[match[1]] || null : null;
};

// The classical (retrieval + model) verdict for this item, from the journey.
// The decision on record can be the cold-start guess, which keeps the classical
// row it did not displace in a nested `classical` block; when the record is the
// classical answer itself, it is its own verdict. Returns null when neither
// resolves, and the caller then states nothing about backing.
export const classicalVerdict = (journeyDecision) => {
  if (!journeyDecision || typeof journeyDecision !== 'object') {
    return null;
  }
  const nested = journeyDecision.classical;
  const row = nested && typeof nested === 'object' ? nested : journeyDecision;
  if (row === journeyDecision) {
    const method = typeof row.method === 'string' ? row.method : '';
    if (method === 'coldstart' || method === 'rule_cold') {
      return null;
    }
  }
  const group =
    _decisionGroup(row) || _groupFromLocator(row.predicted_label) || _groupFromLocator(row.predicted_group);
  const confidence = typeof row.confidence === 'number' ? row.confidence : null;
  const band = typeof row.band === 'string' ? row.band : null;
  if (!group && confidence === null && !band) {
    return null;
  }
  return { group, confidence, band };
};

export const BACKING = {
  // The model chose this same defect group. The card may lead.
  BACKED: 'backed',
  // The model made no call at all on this failure.
  NOT_BACKED: 'notBacked',
  // The model made a call, for a different defect group than this offer.
  DIFFERS: 'differs',
  // Not an analyzer-ng v1 reply, or no classical verdict to read. Say nothing
  // new: the card renders exactly as it shipped before this change.
  UNKNOWN: 'unknown',
};

const ABSTAIN_BANDS = ['abstain', BANDS.BELOW_SUGGEST];

/*
 * Backing state for one offer row.
 *
 * ng1        - parseNgVersion(suggestRs). False for a stock/legacy analyzer.
 * offerGroup - defect group typeRef of the offered label.
 * classical  - classicalVerdict(journeyDecision).
 *
 * Returns { state, confidence, otherGroup }. `confidence` is the model's own
 * number, which belongs to ITS answer and never to the offer: for NOT_BACKED it
 * is the confidence of the call it declined to make. Null when unresolvable, and
 * the caller then drops the number rather than inventing one.
 */
export const deriveOfferBacking = ({ ng1, offerGroup, classical } = {}) => {
  if (!ng1 || !classical) {
    return { state: BACKING.UNKNOWN, confidence: null, otherGroup: null };
  }
  const { group, confidence, band } = classical;
  const belowLine = !!band && ABSTAIN_BANDS.indexOf(band) !== -1;
  // To Investigate is not a defect the model picked, it is the model declining to
  // pick one. It can hold that answer confidently and land in the suggest band,
  // which is why the band alone cannot be trusted to spot an abstain. The number
  // is only worth printing when the model fell under the line, where it explains
  // the silence; above the line it is confidence in "no call" and reads as the
  // opposite of what it means, so it is dropped.
  if (group === 'TO_INVESTIGATE') {
    return { state: BACKING.NOT_BACKED, confidence: belowLine ? confidence : null, otherGroup: null };
  }
  if (belowLine) {
    return { state: BACKING.NOT_BACKED, confidence, otherGroup: null };
  }
  if (!group || !offerGroup) {
    return { state: BACKING.UNKNOWN, confidence: null, otherGroup: null };
  }
  if (group === offerGroup) {
    return { state: BACKING.BACKED, confidence, otherGroup: null };
  }
  return { state: BACKING.DIFFERS, confidence, otherGroup: group };
};

// Clause ids for "what does not match", most concrete first.
export const MISMATCH = {
  IDENTIFIERS: 'identifiers',
  STATUS_CODES: 'statusCodes',
  TEMPLATES: 'templates',
};

// At most two clauses, and only ones the features can honestly support. The
// `*_present` companions exist precisely because a zero overlap means "nothing
// to compare" as often as it means "compared and different"; without the
// companion at 1 the clause is not stated. The exception fingerprint is left
// out on purpose: a suggest-band match differs there by construction, so naming
// it would be noise on every card.
export const deriveMismatchClauses = (features) => {
  const f = features || {};
  const out = [];
  if (f.identifiers_present === 1 && f.identifier_jaccard_top1 === 0) {
    out.push(MISMATCH.IDENTIFIERS);
  }
  if (f.status_codes_present === 1 && f.status_codes_match_top1 === 0) {
    out.push(MISMATCH.STATUS_CODES);
  }
  if (out.length < 2 && f.top1_jaccard === 0) {
    out.push(MISMATCH.TEMPLATES);
  }
  return out.slice(0, 2);
};

// How many earlier failures the retrieval had to compare against. n_candidates
// is stored as len(candidates)/20, so it saturates at 20; the count is only
// worth saying when it is small enough to explain a thin answer, which is why
// anything above the threshold returns null and the card stays quiet.
export const THIN_EVIDENCE_MAX = 5;

export const evidenceBaseCount = (features) => {
  const raw = features && features.n_candidates;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  const n = Math.round(raw * 20);
  if (n < 1 || n > THIN_EVIDENCE_MAX) {
    return null;
  }
  return n;
};

// True when the offers the banner is about rest on similarity alone: the model
// made no call and the top offer has nothing beyond the log text agreeing with
// it. The banner then names that state instead of picking the side the offers
// happen to lean, which is the only side it has.
export const offersRestOnSimilarityAlone = ({ backingState, mismatchClauses } = {}) =>
  backingState === BACKING.NOT_BACKED && (mismatchClauses || []).length > 0;
