/*
 * Copyright 2025 EPAM Systems
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

import React from 'react';
import { mount } from 'enzyme';
import { IntlProvider } from 'react-intl';

const mockDefectTypes = {
  PRODUCT_BUG: [{ locator: 'pb001', longName: 'Product Bug', color: '#d32f2f' }],
  AUTOMATION_BUG: [{ locator: 'ab001', longName: 'Automation Bug', color: '#f7b500' }],
  SYSTEM_ISSUE: [{ locator: 'si001', longName: 'System Issue', color: '#0274d1' }],
  TO_INVESTIGATE: [{ locator: 'ti001', longName: 'To Investigate', color: '#ffb743' }],
};
const mockFlat = Object.values(mockDefectTypes).flat();

jest.mock('react-redux', () => ({
  useSelector: (selector) => selector({}),
}));
jest.mock('controllers/project', () => ({
  defectTypesSelector: () => mockDefectTypes,
  getDefectTypeSelector: () => (locator) => mockFlat.find((t) => t.locator === locator),
}));
jest.mock('controllers/project/selectors', () => ({
  projectInfoIdSelector: () => 7,
}));
jest.mock('components/main/markdown', () => ({
  MarkdownEditor: () => null,
}));
jest.mock('pages/inside/common/defectTypeItem', () => ({
  // eslint-disable-next-line react/prop-types
  DefectTypeItem: ({ type }) => <span data-pill={type} />,
}));

 
import { BulkBench, distinctSavedTypeCount } from './bulkBench';

const suggestRow = ({ issueType, score, modelInfo, comment, methodName }) => ({
  testItemResource: {
    id: 900,
    launchId: 55,
    issue: { issueType, comment },
  },
  suggestRs: {
    project: 7,
    launchId: 55,
    testItem: 900,
    issueType,
    matchScore: score,
    modelInfo,
    methodName,
  },
});

const makeItems = (clusterIds) =>
  clusterIds.map((clusterId, i) => ({
    id: 100 + i,
    name: `Test ${i}`,
    status: 'FAILED',
    clusterId,
    issue: { issueType: 'ti001', comment: '' },
    logs: [{ id: 1, message: 'BoomError: it broke\n  at frame' }],
  }));

const mountBulk = ({ items, suggested = [], mlResolved = true, setModalState = jest.fn() }) => {
  const modalState = {
    currentTestItems: items,
    selectManualChoice: { issue: { comment: '' } },
    commentOption: 'notChangedForAll',
  };
  const wrapper = mount(
    <IntlProvider locale="en" onError={() => {}}>
      <BulkBench
        suggestedItems={suggested}
        mlResolved={mlResolved}
        modalState={modalState}
        setModalState={setModalState}
        onApply={jest.fn()}
        onCancel={jest.fn()}
        modalHasChanges={false}
      />
    </IntlProvider>,
  );
  return { wrapper, setModalState };
};

describe('BulkBench', () => {
  beforeEach(() => {
    window.fetch = jest.fn(() => new Promise(() => {}));
  });

  it('one-cluster selection renders the three offer cards from a banded reply', () => {
    const suggested = [
      suggestRow({
        issueType: 'pb001',
        score: 90,
        modelInfo: 'gbm;ng=1;band=auto;src=human-confirmed',
        comment: 'known payment race',
      }),
      suggestRow({
        issueType: 'ab001',
        score: 88,
        modelInfo: 'gbm;ng=1;band=suggest;src=human-confirmed',
        comment: 'flaky selector',
      }),
      suggestRow({
        issueType: 'si001',
        score: 65,
        modelInfo: 'coldstart_rubric;rubric+v1;why=Connection refused points at the service.',
        methodName: 'coldstart_rubric',
      }),
      suggestRow({
        issueType: 'si001',
        score: 40,
        modelInfo: 'gbm;ng=1;band=below_suggest;src=unlabeled;ek=decline;why=too far',
      }),
    ];
    const { wrapper } = mountBulk({ items: makeItems([5, 5, 5]), suggested });
    const cards = wrapper.find('div[role="button"]').filterWhere((n) => {
      const cls = n.prop('className') || '';
      return cls.includes('check');
    });
    expect(cards).toHaveLength(3);
    const text = wrapper.text();
    expect(text).toContain('All selected tests share one failure signature.');
    expect(text).toContain('Past decision');
    expect(text).toContain('Similar failures');
    expect(text).toContain('AI guess');
    expect(text).toContain('65% guess. Not confirmed.');
    expect(text).toContain('Looked at and declined: System Issue (0.40).');
  });

  it('arming the similar card prefills the matched test comment', () => {
    const suggested = [
      suggestRow({
        issueType: 'ab001',
        score: 88,
        modelInfo: 'gbm;ng=1;band=suggest;src=human-confirmed',
        comment: 'flaky selector',
      }),
    ];
    const { wrapper, setModalState } = mountBulk({ items: makeItems([5, 5]), suggested });
    const card = wrapper
      .find('div[role="button"]')
      .filterWhere((n) => (n.prop('className') || '').includes('suggest'))
      .first();
    card.simulate('click');
    const armCall = setModalState.mock.calls.find(
      (c) => c[0].selectManualChoice && c[0].selectManualChoice.issue.issueType === 'ab001',
    );
    expect(armCall).toBeTruthy();
    expect(armCall[0].selectManualChoice.issue.comment).toBe('flaky selector');
  });

  it('a cross-cluster selection gets the honest line and no offer cards', () => {
    const { wrapper } = mountBulk({ items: makeItems([5, 6, 5]) });
    const text = wrapper.text();
    expect(text).toContain('The selected tests fail in 2 different ways.');
    expect(text).not.toContain('Past decision');
    expect(wrapper.text()).toContain('Applies to all 3 selected tests.');
  });

  it('one cluster with a settled empty reply says so once', () => {
    const { wrapper } = mountBulk({ items: makeItems([5, 5]), suggested: [], mlResolved: true });
    expect(wrapper.text()).toContain('The analyzer has nothing stored for this failure group yet.');
  });
});

describe('distinctSavedTypeCount', () => {
  it('counts distinct saved types, ignoring items without one', () => {
    expect(
      distinctSavedTypeCount([
        { issue: { issueType: 'pb001' } },
        { issue: { issueType: 'pb001' } },
        { issue: { issueType: 'ab001' } },
        { issue: {} },
      ]),
    ).toBe(2);
  });
});
