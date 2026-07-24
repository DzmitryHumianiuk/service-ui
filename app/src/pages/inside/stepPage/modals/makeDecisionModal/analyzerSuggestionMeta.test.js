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

import { isDecisionFresh, normalizeLine } from './analyzerSuggestionMeta';

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
