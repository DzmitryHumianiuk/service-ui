/*
 *  Copyright 2026 EPAM Systems
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  BACKING,
  EMPTY_REPLY_NO_HISTORY,
  EMPTY_REPLY_NO_LOGS,
  EMPTY_REPLY_WORKING,
  MISMATCH,
  classicalVerdict,
  deriveBanner,
  deriveMismatchClauses,
  deriveOfferBacking,
  emptyReplyVariant,
  evidenceBaseCount,
  isDecisionFresh,
  normalizeLine,
  offersRestOnSimilarityAlone,
  parseFeatures,
} from './analyzerSuggestionMeta';

// The explainer quotes the analyzer's MASKED signature, while the item's log
// lines are raw. Both go through normalizeLine before the quote gate compares
// them, so masked and raw forms of the same line have to land on one string.
describe('normalizeLine masking parity with the analyzer', () => {
  const pairs = [
    [
      'expected response to have status code 200 but got 400',
      'expected response to have status code <NUM> but got <NUM>',
    ],
    ['connection refused to 10.0.12.7:5432', 'connection refused to <IP>'],
    [
      'run 8f14e45f-ceea-467a-9c2f-0b0b0b0b0b0b failed',
      'run <UUID> failed',
    ],
    ['pointer 0x7ffee3b0 is null', 'pointer <HEX> is null'],
    ['cannot read /opt/app/fixtures/case.json', 'cannot read <PATH>'],
  ];

  it.each(pairs)('folds a raw line and its masked quote together: %s', (raw, masked) => {
    expect(normalizeLine(raw)).toBe(normalizeLine(masked));
  });

  it('is idempotent, so running it over an already masked quote changes nothing', () => {
    const masked = 'expected response to have status code <NUM> but got <NUM>';
    expect(normalizeLine(normalizeLine(masked))).toBe(normalizeLine(masked));
  });

  it('still tells genuinely different lines apart', () => {
    expect(normalizeLine('connection refused')).not.toBe(normalizeLine('assertion failed'));
  });

  it('survives an empty or missing line', () => {
    expect(normalizeLine('')).toBe('');
    expect(normalizeLine(null)).toBe('');
    expect(normalizeLine(undefined)).toBe('');
  });
});

// The measured item-4207 case: the analyzer abstained below the suggest line and
// the explainer quoted a masked log line. Before the parity fix the quote could
// never match, the gate failed closed, and the modal showed no reasoning at all.
describe('isDecisionFresh with a masked quote', () => {
  const decision = {
    explanation:
      'The analyzer declined to classify the failure because the model probability (0.321) stayed below the suggest threshold (0.45).',
    predicted_label: 'ti',
    predicted_group: 'ti',
  };
  const logLine = 'expected response to have status code 200 but got 400';
  const quote = 'expected response to have status code <NUM> but got <NUM>';

  const quoteMatches = (q, line) => {
    const nq = normalizeLine(q);
    const nl = normalizeLine(line);
    return nl === nq || (nq.length > 0 && nl.includes(nq));
  };

  it('grounds a masked quote against the raw log line', () => {
    expect(quoteMatches(quote, logLine)).toBe(true);
    expect(isDecisionFresh(decision, null, quoteMatches(quote, logLine))).toBe(true);
  });

  it('still fails closed when the quote belongs to another failure', () => {
    const foreign = 'java.lang.NullPointerException on account owner';
    expect(quoteMatches(foreign, logLine)).toBe(false);
    expect(isDecisionFresh(decision, null, quoteMatches(foreign, logLine))).toBe(false);
  });

  it('skips grounding when the explainer carried no quotes at all', () => {
    expect(isDecisionFresh(decision, null, null)).toBe(true);
  });
});

describe('emptyReplyVariant', () => {
  it('says "still working" before the journey has resolved', () => {
    expect(
      emptyReplyVariant({ journeyResolved: false, stillWorking: false, analyzerReadLogs: false }),
    ).toBe(EMPTY_REPLY_WORKING);
  });

  it('says "still working" while another ask is on its way', () => {
    expect(
      emptyReplyVariant({ journeyResolved: true, stillWorking: true, analyzerReadLogs: true }),
    ).toBe(EMPTY_REPLY_WORKING);
  });

  it('never blames missing logs when the analyzer did read logs', () => {
    expect(
      emptyReplyVariant({ journeyResolved: true, stillWorking: false, analyzerReadLogs: true }),
    ).toBe(EMPTY_REPLY_NO_HISTORY);
  });

  it('keeps the silent case for an item with no error logs at all', () => {
    expect(
      emptyReplyVariant({ journeyResolved: true, stillWorking: false, analyzerReadLogs: false }),
    ).toBe(EMPTY_REPLY_NO_LOGS);
  });
});

// The live reply that started this: project live-check-01, item 6239. One test
// was labelled by hand, so retrieval had exactly one neighbour and offered it at
// 0.91 while the model that scored it stayed out at 0.32.
const LIVE_NAMES =
  'top1_cosine;top1_jaccard;n_candidates;status_codes_present;status_codes_match_top1;' +
  'identifiers_present;identifier_jaccard_top1';
const LIVE_VALUES = '0.906802;0.000000;0.050000;1.000000;0.000000;1.000000;0.000000';

describe('parseFeatures', () => {
  it('reads the row feature vector off the reply', () => {
    const f = parseFeatures({ modelFeatureNames: LIVE_NAMES, modelFeatureValues: LIVE_VALUES });
    expect(f.top1_cosine).toBeCloseTo(0.9068, 4);
    expect(f.identifier_jaccard_top1).toBe(0);
    expect(f.n_candidates).toBeCloseTo(0.05, 4);
  });

  it('returns nothing when names and values disagree in length', () => {
    expect(parseFeatures({ modelFeatureNames: 'a;b', modelFeatureValues: '1' })).toEqual({});
  });

  it('returns nothing for a stock reply that carries no vector', () => {
    expect(parseFeatures({ modelInfo: 'legacy' })).toEqual({});
  });
});

describe('classicalVerdict', () => {
  it('reads the nested classical row when the decision on record is the guess', () => {
    expect(
      classicalVerdict({
        method: 'coldstart',
        predicted_label: 'pb001',
        confidence: 0.65,
        classical: { predicted_label: 'ti', confidence: 0.321, band: 'abstain' },
      }),
    ).toEqual({ group: 'TO_INVESTIGATE', confidence: 0.321, band: 'abstain' });
  });

  it('uses the record itself when it is the classical answer', () => {
    expect(classicalVerdict({ method: 'gbm', predicted_label: 'pb001', confidence: 0.8, band: 'auto' })).toEqual(
      { group: 'PRODUCT_BUG', confidence: 0.8, band: 'auto' },
    );
  });

  it('has no verdict when the only record is a guess with nothing nested', () => {
    expect(classicalVerdict({ method: 'coldstart', predicted_label: 'pb001', confidence: 0.65 })).toBeNull();
  });
});

describe('deriveOfferBacking', () => {
  const abstained = { group: 'TO_INVESTIGATE', confidence: 0.321, band: 'abstain' };

  it('says not backed when the model made no call, and keeps its number', () => {
    expect(
      deriveOfferBacking({ ng1: true, offerGroup: 'SYSTEM_ISSUE', classical: abstained }),
    ).toEqual({ state: BACKING.NOT_BACKED, confidence: 0.321, otherGroup: null });
  });

  it('says backed when the model chose the same defect group', () => {
    expect(
      deriveOfferBacking({
        ng1: true,
        offerGroup: 'PRODUCT_BUG',
        classical: { group: 'PRODUCT_BUG', confidence: 0.71, band: 'suggest' },
      }).state,
    ).toBe(BACKING.BACKED);
  });

  it('names the other group when the model chose a different one', () => {
    expect(
      deriveOfferBacking({
        ng1: true,
        offerGroup: 'SYSTEM_ISSUE',
        classical: { group: 'PRODUCT_BUG', confidence: 0.71, band: 'suggest' },
      }),
    ).toEqual({ state: BACKING.DIFFERS, confidence: 0.71, otherGroup: 'PRODUCT_BUG' });
  });

  it('stays silent for a stock analyzer whose reply cannot be read', () => {
    expect(deriveOfferBacking({ ng1: false, offerGroup: 'SYSTEM_ISSUE', classical: abstained }).state).toBe(
      BACKING.UNKNOWN,
    );
  });

  it('stays silent when there is no classical verdict at all', () => {
    expect(deriveOfferBacking({ ng1: true, offerGroup: 'SYSTEM_ISSUE', classical: null }).state).toBe(
      BACKING.UNKNOWN,
    );
  });
});

describe('deriveMismatchClauses', () => {
  it('names both mismatches on the live reply', () => {
    const f = parseFeatures({ modelFeatureNames: LIVE_NAMES, modelFeatureValues: LIVE_VALUES });
    expect(deriveMismatchClauses(f)).toEqual([MISMATCH.IDENTIFIERS, MISMATCH.STATUS_CODES]);
  });

  it('never claims a mismatch when there was nothing to compare', () => {
    expect(
      deriveMismatchClauses({
        identifiers_present: 0,
        identifier_jaccard_top1: 0,
        status_codes_present: 0,
        status_codes_match_top1: 0,
        top1_jaccard: 0.4,
      }),
    ).toEqual([]);
  });

  it('falls back to log lines when identifiers and status codes agree', () => {
    expect(
      deriveMismatchClauses({
        identifiers_present: 1,
        identifier_jaccard_top1: 0.8,
        status_codes_present: 1,
        status_codes_match_top1: 1,
        top1_jaccard: 0,
      }),
    ).toEqual([MISMATCH.TEMPLATES]);
  });

  it('says nothing when everything that could be compared matched', () => {
    expect(
      deriveMismatchClauses({
        identifiers_present: 1,
        identifier_jaccard_top1: 0.9,
        status_codes_present: 1,
        status_codes_match_top1: 1,
        top1_jaccard: 0.6,
      }),
    ).toEqual([]);
  });

  it('shows at most two clauses', () => {
    expect(
      deriveMismatchClauses({
        identifiers_present: 1,
        identifier_jaccard_top1: 0,
        status_codes_present: 1,
        status_codes_match_top1: 0,
        top1_jaccard: 0,
      }),
    ).toHaveLength(2);
  });
});

describe('evidenceBaseCount', () => {
  it('turns the stored fraction back into a count', () => {
    expect(evidenceBaseCount({ n_candidates: 0.05 })).toBe(1);
  });

  it('stays quiet once the pool is big enough to speak for itself', () => {
    expect(evidenceBaseCount({ n_candidates: 0.5 })).toBeNull();
    expect(evidenceBaseCount({ n_candidates: 1 })).toBeNull();
  });

  it('says nothing when the feature is missing or empty', () => {
    expect(evidenceBaseCount({})).toBeNull();
    expect(evidenceBaseCount({ n_candidates: 0 })).toBeNull();
  });
});

describe('offersRestOnSimilarityAlone', () => {
  it('is true only when the model made no call and nothing else matched', () => {
    expect(
      offersRestOnSimilarityAlone({
        backingState: BACKING.NOT_BACKED,
        mismatchClauses: [MISMATCH.IDENTIFIERS],
      }),
    ).toBe(true);
  });

  it('is false when the model made no call but the evidence lines up', () => {
    expect(
      offersRestOnSimilarityAlone({ backingState: BACKING.NOT_BACKED, mismatchClauses: [] }),
    ).toBe(false);
  });

  it('is false whenever the model did back the offer', () => {
    expect(
      offersRestOnSimilarityAlone({
        backingState: BACKING.BACKED,
        mismatchClauses: [MISMATCH.IDENTIFIERS],
      }),
    ).toBe(false);
  });
});

// Caught on the stand: the model can hold "To Investigate" confidently enough to
// land in the suggest band. That is still no defect call, and reading the band
// alone rendered it as "the model called this To Investigate instead (0.63)".
describe('deriveOfferBacking treats To Investigate as no call, not a rival answer', () => {
  it('says no call for a confident To Investigate in the suggest band', () => {
    expect(
      deriveOfferBacking({
        ng1: true,
        offerGroup: 'SYSTEM_ISSUE',
        classical: { group: 'TO_INVESTIGATE', confidence: 0.6315789, band: 'suggest' },
      }),
    ).toEqual({ state: BACKING.NOT_BACKED, confidence: null, otherGroup: null });
  });

  it('keeps the number when To Investigate sat under the suggest line', () => {
    expect(
      deriveOfferBacking({
        ng1: true,
        offerGroup: 'SYSTEM_ISSUE',
        classical: { group: 'TO_INVESTIGATE', confidence: 0.321, band: 'abstain' },
      }),
    ).toEqual({ state: BACKING.NOT_BACKED, confidence: 0.321, otherGroup: null });
  });

  it('still reports a real rival defect as a difference', () => {
    expect(
      deriveOfferBacking({
        ng1: true,
        offerGroup: 'SYSTEM_ISSUE',
        classical: { group: 'AUTOMATION_BUG', confidence: 0.7, band: 'suggest' },
      }).state,
    ).toBe(BACKING.DIFFERS);
  });
});

// The banner must not name the side a lone unbacked neighbour leans, in either
// the suggest or the abstain family. On the stand the decision on record was the
// cold-start guess in the suggest band, so the abstain branch alone was not enough.
describe('deriveBanner with an offer the model did not back', () => {
  const offers = {
    hasVouched: true,
    similarityOnly: true,
    leanDefect: 'System Issue',
    leanGroup: 'SYSTEM_ISSUE',
  };

  it('names the state, not the lean, when the decision sits in the suggest band', () => {
    expect(
      deriveBanner({
        decisionOutcome: { id: 'O4', band: 'suggest', defect: 'Product Bug', group: 'PRODUCT_BUG' },
        offers,
      }).id,
    ).toBe('B6s');
  });

  it('names the state, not the lean, when the decision abstained', () => {
    expect(
      deriveBanner({ decisionOutcome: { id: 'O5', band: 'abstain' }, offers }).id,
    ).toBe('B6s');
  });

  it('still names the lean when the evidence behind the offer holds up', () => {
    expect(
      deriveBanner({
        decisionOutcome: { id: 'O5', band: 'abstain' },
        offers: { ...offers, similarityOnly: false },
      }).id,
    ).toBe('B3');
  });

  it('never touches an auto decision', () => {
    expect(
      deriveBanner({
        decisionOutcome: { id: 'O1', band: 'auto', defect: 'Product Bug', group: 'PRODUCT_BUG' },
        offers: { ...offers, topGroup: 'PRODUCT_BUG' },
      }).id,
    ).toBe('B1');
  });
});
