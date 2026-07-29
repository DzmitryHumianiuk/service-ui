/*
 * Copyright 2019 EPAM Systems
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

import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  defectIncludeInAa: {
    id: 'MakeDecisionModal.defectIncludeInAa',
    defaultMessage: 'defect will be included in Auto-Analysis',
  },
  defectIgnoreInAa: {
    id: 'MakeDecisionModal.defectIgnoreInAa',
    defaultMessage: 'defect will be ignored in Auto-Analysis',
  },
  and: {
    id: 'MakeDecisionModal.and',
    defaultMessage: 'and',
  },
  comment: {
    id: 'MakeDecisionModal.comment',
    defaultMessage: 'Comment',
  },
  ignoreAa: {
    id: 'MakeDecisionModal.ignoreAa',
    defaultMessage: 'Ignore in Auto Analysis',
  },
  ignoreAaShort: {
    id: 'MakeDecisionModal.ignoreAaShort',
    defaultMessage: 'Ignore in AA',
  },
  executionToChange: {
    id: 'MakeDecisionModal.executionToChange',
    defaultMessage: 'Execution to change',
  },
  applyToItem: {
    id: 'MakeDecisionModal.applyToItem',
    defaultMessage: 'Results will be applied for the Item',
  },
  applyToItems: {
    id: 'MakeDecisionModal.applyToItems',
    defaultMessage: 'Results will be applied for {itemsCount} Items',
  },
  selectDefect: {
    id: 'MakeDecisionModal.selectDefect',
    defaultMessage: 'Select defect',
  },
  selectDefectTypeManually: {
    id: 'MakeDecisionModal.selectDefectTypeManually',
    defaultMessage: 'Select defect manually',
  },
  copyFromHistoryLine: {
    id: 'MakeDecisionModal.copyFromHistoryLine',
    defaultMessage: 'Analyzed executions from the test history',
  },
  apply: {
    id: 'MakeDecisionModal.apply',
    defaultMessage: 'Apply',
  },
  applyAndContinue: {
    id: 'MakeDecisionModal.applyAndContinue',
    defaultMessage: 'Apply & Continue',
  },
  modalNote: {
    id: 'MakeDecisionModal.modalNote',
    defaultMessage: 'You have to save changes or cancel them before closing the window',
  },
  postIssueNote: {
    id: 'MakeDecisionModal.postIssueNote',
    defaultMessage:
      'After a defect type submission, you will be able to choose parameters for a new issue posting',
  },
  linkIssueNote: {
    id: 'MakeDecisionModal.linkIssueNote',
    defaultMessage:
      'After a defect type submission, you will be able to choose parameters for a new issue linking',
  },
  unlinkIssueNote: {
    id: 'MakeDecisionModal.unlinkIssueNote',
    defaultMessage: 'After a defect type submission, the current links will be unlinked',
  },
  applyFor: {
    id: 'MakeDecisionModal.applyFor',
    defaultMessage: 'Apply for:',
  },
  currentExecutionOnly: {
    id: 'MakeDecisionModal.currentExecutionOnly',
    defaultMessage: 'Current item only',
  },
  currentLaunch: {
    id: 'MakeDecisionModal.currentLaunch',
    defaultMessage: 'Similar ”To Investigate” in the launch & current item',
  },
  currentLaunchTooltip: {
    id: 'MakeDecisionModal.currentLaunchTooltip',
    defaultMessage:
      'Tests with To Investigate defect type with error logs matching selected item on 98% and more',
  },
  launchName: {
    id: 'MakeDecisionModal.launchName',
    defaultMessage: 'Similar “To Investigate” in 10 launches & current item',
  },
  lastTenLaunchesTooltip: {
    id: 'MakeDecisionModal.lastTenLaunchesTooltip',
    defaultMessage:
      'Tests with To Investigate defect type from last 10 launches with error logs matching selected item on 98% and more',
  },
  filter: {
    id: 'MakeDecisionModal.filter',
    defaultMessage: 'Similar “To Investigate” in the {filterName} & current item',
  },
  withFilterTooltip: {
    id: 'MakeDecisionModal.withFilterTooltip',
    defaultMessage:
      'Tests with To Investigate defect type from last 10 launches of the filter {filterName} with error logs matching selected item on 98% and more',
  },
  showErrorLogs: {
    id: 'MakeDecisionModal.showErrorLogs',
    defaultMessage: 'Show Error Logs',
  },
  selectedItemCount: {
    id: 'MakeDecisionModal.selectedItemCount',
    defaultMessage: '{selected}/{total} items selected',
  },
  allLoadedTIFromHistoryLine: {
    id: 'MakeDecisionModal.allLoadedTIFromHistoryLine',
    defaultMessage: '“To Investigate” from the history line & current item',
  },
  analyzerUnavailable: {
    id: 'MakeDecisionModal.analyzerUnavailable',
    defaultMessage: 'Service Analyzer is not running,',
  },
  pleaseCheck: {
    id: 'MakeDecisionModal.pleaseCheck',
    defaultMessage: 'please check',
  },
  analyzerUnavailableLink: {
    id: 'MakeDecisionModal.analyzerUnavailableLink',
    defaultMessage: 'how it could be fixed',
  },
  updateDefectsSuccess: {
    id: 'MakeDecisionModal.updateDefectsSuccess',
    defaultMessage: 'Defects have been updated',
  },
  updateDefectsFailed: {
    id: 'MakeDecisionModal.updateDefectsFailed',
    defaultMessage: 'Failed to update defects',
  },
  suggestedChoiceSuccess: {
    id: 'MakeDecisionModal.suggestedChoiceSuccess',
    defaultMessage: 'User choice of suggested item was sent for handling to ML',
  },
  suggestedChoiceFailed: {
    id: 'MakeDecisionModal.suggestedChoiceFailed',
    defaultMessage: 'The proposed item selected by the user has not been sent for processing to ML',
  },
  similarLog: {
    id: 'MakeDecisionModal.similarLog',
    defaultMessage: 'Similar Log',
  },
  noLogs: {
    id: 'MakeDecisionModal.noLogs',
    defaultMessage: 'No Logs Found x_x',
  },
  noItems: {
    id: 'MakeDecisionModal.noItems',
    defaultMessage: 'No Items',
  },
  analyzingSuggestions: {
    id: 'MakeDecisionModal.analyzingSuggestions',
    defaultMessage: 'Analyzing Suggestions',
  },
  analyzerSuggestion: {
    id: 'MakeDecisionModal.analyzerSuggestion',
    defaultMessage: 'Analyzer Suggestion',
  },
  noSuggestions: {
    id: 'MakeDecisionModal.noSuggestions',
    defaultMessage: 'No Analyzer Suggestions',
  },
  selection: {
    id: 'MakeDecisionModal.selection',
    defaultMessage: 'Selection',
  },
  manual: {
    id: 'MakeDecisionModal.manual',
    defaultMessage: 'Manual',
  },
  history: {
    id: 'MakeDecisionModal.history',
    defaultMessage: 'History',
  },
  ofTheTest: {
    id: 'MakeDecisionModal.ofTheTest',
    defaultMessage: 'of the test',
  },
  machineLearningSuggestions: {
    id: 'MakeDecisionModal.machineLearningSuggestions',
    defaultMessage: 'The execution with {value}% similarity of defect',
  },
  commentReplaceWith: {
    id: 'MakeDecisionModal.commentReplaceWith',
    defaultMessage: 'Comment will be replaced with:',
  },
  commentWillRemoved: {
    id: 'MakeDecisionModal.commentWillRemoved',
    defaultMessage: 'Comment will be removed',
  },
  commentWill: {
    id: 'MakeDecisionModal.commentWill',
    defaultMessage: 'Comments will',
  },
  notChangedForAll: {
    id: 'MakeDecisionModal.notChangedForAll',
    defaultMessage: 'not be changed for all chosen items',
  },
  clearForAll: {
    id: 'MakeDecisionModal.clearForAll',
    defaultMessage: 'be cleared for all chosen items',
  },
  addForAll: {
    id: 'MakeDecisionModal.addForAll',
    defaultMessage: 'be added for all chosen items',
  },
  replaceForAll: {
    id: 'MakeDecisionModal.replaceForAll',
    defaultMessage: 'be replaced for all chosen items with',
  },
  followingResult: {
    id: 'MakeDecisionModal.followingResult',
    defaultMessage: 'Following results will be applied for {items}',
  },
  itemsCount: {
    id: 'MakeDecisionModal.itemsCount',
    defaultMessage: '{count} Items',
  },
  item: {
    id: 'MakeDecisionModal.item',
    defaultMessage: 'the Item',
  },
  linkAddedOnNextStep: {
    id: 'MakeDecisionModal.linkAddedOnNextStep',
    defaultMessage: 'The link to Bug Tracking System will be added in the next step',
  },
  linkRemovedOnNextStep: {
    id: 'MakeDecisionModal.linkRemovedOnNextStep',
    defaultMessage: 'The link to Bug Tracking System will be removed in the next step',
  },
  linkReplacedWith: {
    id: 'MakeDecisionModal.linkReplacedWith',
    defaultMessage: 'The link to Bug Tracking System will be replaced with',
  },
  defectReplaceWith: {
    id: 'MakeDecisionModal.defectReplaceWith',
    defaultMessage: 'The defect type will be changed to',
  },
  // analyzer-ng suggestion metadata (see analyzerSuggestionMeta.js)
  suggestedDefect: {
    id: 'MakeDecisionModal.suggestedDefect',
    defaultMessage: 'Suggested defect',
  },
  llmHypothesisTab: {
    id: 'MakeDecisionModal.llmHypothesisTab',
    defaultMessage: 'LLM hypothesis',
  },
  llmHypothesisHeader: {
    id: 'MakeDecisionModal.llmHypothesisHeader',
    defaultMessage: 'LLM cold-start hypothesis · {value}% rubric confidence',
  },
  provenanceLlmHypothesis: {
    id: 'MakeDecisionModal.provenanceLlmHypothesis',
    defaultMessage: 'LLM hypothesis (provisional)',
  },
  provenanceHumanNeighbor: {
    id: 'MakeDecisionModal.provenanceHumanNeighbor',
    defaultMessage: 'human-labeled neighbor',
  },
  provenanceAutoNeighbor: {
    id: 'MakeDecisionModal.provenanceAutoNeighbor',
    defaultMessage: 'auto-labeled neighbor',
  },
  rubricWhyCaption: {
    id: 'MakeDecisionModal.rubricWhyCaption',
    defaultMessage: 'AI hypothesis: why this defect',
  },
  acceptHypothesis: {
    id: 'MakeDecisionModal.acceptHypothesis',
    defaultMessage: 'Accept & edit comment',
  },

  // ---------------------------------------------------------------------------
  // The Bench (redesign). Plain global English, NO em-dashes / long dashes in any
  // rendered string (lens-bench-english §0). Copy is quoted from lens-bench-english.md
  // and mockup-bench-rp.html, with em-dashes rewritten as plain punctuation.
  // ---------------------------------------------------------------------------
  benchIdentityCap: {
    id: 'MakeDecisionModal.benchIdentityCap',
    defaultMessage: 'Make a decision',
  },
  benchThisFailure: {
    id: 'MakeDecisionModal.benchThisFailure',
    defaultMessage: 'This failure',
  },
  benchSoloLine: {
    id: 'MakeDecisionModal.benchSoloLine',
    defaultMessage: 'No other test in this run fails this way.',
  },
  benchShowErrorLog: {
    id: 'MakeDecisionModal.benchShowErrorLog',
    defaultMessage: 'Show error log',
  },
  benchHideErrorLog: {
    id: 'MakeDecisionModal.benchHideErrorLog',
    defaultMessage: 'Hide error log',
  },
  benchStackAndContext: {
    id: 'MakeDecisionModal.benchStackAndContext',
    defaultMessage: 'Stack trace and context (ERROR level)',
  },
  benchInspectorItem: {
    id: 'MakeDecisionModal.benchInspectorItem',
    defaultMessage: 'Open full details in Inspector',
  },
  benchInspectorReason: {
    id: 'MakeDecisionModal.benchInspectorReason',
    defaultMessage: 'See the full reason in Inspector',
  },
  benchInspectorDetails: {
    id: 'MakeDecisionModal.benchInspectorDetails',
    defaultMessage: 'See details in Inspector',
  },
  benchWhy: {
    id: 'MakeDecisionModal.benchWhy',
    defaultMessage: 'why?',
  },
  // Group of identical failures (HYBRID)
  benchGroupHead: {
    id: 'MakeDecisionModal.benchGroupHead',
    defaultMessage: 'This exact failure shows up in {count} tests in this run.',
  },
  benchGroupFraction: {
    id: 'MakeDecisionModal.benchGroupFraction',
    defaultMessage: '{count} of the {failed} failed tests in this run share this signature.',
  },
  benchBurstFraction: {
    id: 'MakeDecisionModal.benchBurstFraction',
    defaultMessage:
      '{pct}% of the failed tests in this Launch fail with this exact signature ({count} of {failed}).',
  },
  benchBurstRule: {
    id: 'MakeDecisionModal.benchBurstRule',
    defaultMessage:
      'When one signature covers more than {gate}% of a Launch, the cause is usually one {label}, not {count} separate bugs.',
  },
  benchBurstApplySi: {
    id: 'MakeDecisionModal.benchBurstApplySi',
    defaultMessage: 'Apply System Issue',
  },
  benchBurstPanelTitle: {
    id: 'MakeDecisionModal.benchBurstPanelTitle',
    defaultMessage: 'Apply System Issue to the burst group',
  },
  benchBurstPanelScope: {
    id: 'MakeDecisionModal.benchBurstPanelScope',
    defaultMessage:
      'Will be applied to {breadth} tests: this one and {others} more from this burst group.',
  },
  benchBurstPanelOnlySelf: {
    id: 'MakeDecisionModal.benchBurstPanelOnlySelf',
    defaultMessage: 'Only this test is in the apply list right now.',
  },
  benchBurstPanelPartial: {
    id: 'MakeDecisionModal.benchBurstPanelPartial',
    defaultMessage:
      '{missing} of the {count} group tests are not in the apply list: they are already investigated or were not found by the log search.',
  },
  benchBurstPanelBack: {
    id: 'MakeDecisionModal.benchBurstPanelBack',
    defaultMessage: 'Back',
  },
  benchProvFromBurst: {
    id: 'MakeDecisionModal.benchProvFromBurst',
    defaultMessage: 'set from the burst context',
  },
  benchBurstHonesty: {
    id: 'MakeDecisionModal.benchBurstHonesty',
    defaultMessage:
      'This is run context. The checks below scored this test on its own and did not use the group.',
  },
  benchGroupShowing: {
    id: 'MakeDecisionModal.benchGroupShowing',
    defaultMessage: 'Showing {shown} of {count}.',
  },
  benchGroupShowTests: {
    id: 'MakeDecisionModal.benchGroupShowTests',
    defaultMessage: 'Show the tests',
  },
  benchGroupHideTests: {
    id: 'MakeDecisionModal.benchGroupHideTests',
    defaultMessage: 'Hide the tests',
  },
  benchGroupPointer: {
    id: 'MakeDecisionModal.benchGroupPointer',
    defaultMessage: 'Apply one decision to similar tests when you commit',
  },
  benchGroupThisTest: {
    id: 'MakeDecisionModal.benchGroupThisTest',
    defaultMessage: '(this test)',
  },
  // Bench heading
  benchCap: {
    id: 'MakeDecisionModal.benchCap',
    defaultMessage: 'The analyzer checked this three ways, strongest first',
  },

  // ---------------------------------------------------------------------------
  // Decision story block (Act 1). Deterministic narration of what the analyzer
  // recorded, sourced from the journey decision block only. Copy verbatim from
  // mdm-logic-VERDICT.md sections 4.1-4.3 and mirrored in mockup-mdm-states.html.
  // {defect} = project defect type name, {p} = calibrated confidence (2dp),
  // {x} = log similarity (alike), {rel} = prebuilt relative-time string.
  // ---------------------------------------------------------------------------
  benchStoryCap: {
    id: 'MakeDecisionModal.benchStoryCap',
    defaultMessage: 'What the analyzer did',
  },
  benchStorySrcData: {
    id: 'MakeDecisionModal.benchStorySrcData',
    defaultMessage: 'from analyzer data',
  },
  benchStorySrcAi: {
    id: 'MakeDecisionModal.benchStorySrcAi',
    defaultMessage: 'written by AI',
  },
  benchStoryTime: {
    id: 'MakeDecisionModal.benchStoryTime',
    defaultMessage: 'decided {rel}',
  },
  // Headlines per outcome (verdict 4.2). O1/O2/O3 share one headline; O5/O6/O7
  // share one headline. Reuse the shared key for the sibling outcomes.
  benchStoryHeadO1: {
    id: 'MakeDecisionModal.benchStoryHeadO1',
    defaultMessage: 'Applied on its own: {defect}.',
  },
  // Prefix-only variant of benchStoryHeadO1: the defect is rendered as a
  // defect-label pill (a React element) alongside, so it cannot be an ICU
  // placeholder value (this RP's formatMessage crashes on element values).
  benchStoryHeadAppliedPre: {
    id: 'MakeDecisionModal.benchStoryHeadAppliedPre',
    defaultMessage: 'Applied on its own:',
  },
  benchStoryHeadO4: {
    id: 'MakeDecisionModal.benchStoryHeadO4',
    defaultMessage: 'Found a likely answer, did not apply it.',
  },
  benchStoryHeadO5: {
    id: 'MakeDecisionModal.benchStoryHeadO5',
    defaultMessage: 'Looked, but did not apply anything.',
  },
  benchStoryHeadO8: {
    id: 'MakeDecisionModal.benchStoryHeadO8',
    defaultMessage: "Nothing in this project's history matched.",
  },
  benchStoryHeadO9: {
    id: 'MakeDecisionModal.benchStoryHeadO9',
    defaultMessage: 'Not analyzed yet.',
  },
  benchStoryHeadO9b: {
    id: 'MakeDecisionModal.benchStoryHeadO9b',
    defaultMessage: "Could not load the analyzer's record.",
  },
  // Reason lines per outcome (verdict 4.2). O10 has no reason (silent hero owns it).
  benchStoryReasonO1: {
    id: 'MakeDecisionModal.benchStoryReasonO1',
    defaultMessage: 'This exact failure was decided before. Confidence {p}, above the 0.75 auto line.',
  },
  benchStoryReasonO2: {
    id: 'MakeDecisionModal.benchStoryReasonO2',
    defaultMessage:
      'It matched a known pattern from this project. Confidence {p}, above the 0.75 auto line.',
  },
  benchStoryReasonO3: {
    id: 'MakeDecisionModal.benchStoryReasonO3',
    defaultMessage: 'The trained model was sure. Confidence {p}, above the 0.75 auto line.',
  },
  benchStoryReasonO4: {
    id: 'MakeDecisionModal.benchStoryReasonO4',
    defaultMessage:
      'Best answer: {defect} at confidence {p}. Under the 0.75 auto line, so the call is yours.',
  },
  benchStoryReasonO5: {
    id: 'MakeDecisionModal.benchStoryReasonO5',
    defaultMessage: 'The best candidate reached confidence {p}, under the 0.45 suggest line.',
  },
  benchStoryReasonO6: {
    id: 'MakeDecisionModal.benchStoryReasonO6',
    defaultMessage: 'The nearest match shares only common boilerplate lines. That is not real evidence.',
  },
  benchStoryReasonO7: {
    id: 'MakeDecisionModal.benchStoryReasonO7',
    defaultMessage: 'No rule or model was confident enough.',
  },
  benchStoryReasonO8: {
    id: 'MakeDecisionModal.benchStoryReasonO8',
    defaultMessage: 'The AI wrote a first guess instead. It is on offer below, not applied.',
  },
  benchStoryReasonO9: {
    id: 'MakeDecisionModal.benchStoryReasonO9',
    defaultMessage: 'The analyzer has no decision recorded for this item.',
  },
  benchStoryReasonO9b: {
    id: 'MakeDecisionModal.benchStoryReasonO9b',
    defaultMessage: 'Open Inspector to see the decision history.',
  },
  benchStoryBridge: {
    id: 'MakeDecisionModal.benchStoryBridge',
    defaultMessage:
      "Alike is not confident: {x} measures how similar the log text is, while {p} is the analyzer's confidence that the matched defect is right, and it stayed below the 0.45 suggest line.",
  },
  benchStoryBridgeUnlabeled: {
    id: 'MakeDecisionModal.benchStoryBridgeUnlabeled',
    defaultMessage: 'The closest matches have no confirmed defect behind them.',
  },
  benchStoryExplCap: {
    id: 'MakeDecisionModal.benchStoryExplCap',
    defaultMessage: 'Explanation',
  },
  benchEarlyMarkTitle: {
    id: 'MakeDecisionModal.benchEarlyMarkTitle',
    defaultMessage:
      'Early result. This test was analyzed right after it finished, while the launch was still running. The analysis at launch finish may revise it.',
  },
  benchStoryExplPending: {
    id: 'MakeDecisionModal.benchStoryExplPending',
    defaultMessage: 'Writing the explanation. This usually takes less than a minute.',
  },
  benchStoryMore: {
    id: 'MakeDecisionModal.benchStoryMore',
    defaultMessage: 'Show more',
  },
  benchStoryLess: {
    id: 'MakeDecisionModal.benchStoryLess',
    defaultMessage: 'Show less',
  },

  // ---------------------------------------------------------------------------
  // Offers region head + banner (Act 2). Copy verbatim from mdm-logic-VERDICT.md
  // section 5 and mirrored in mockup-mdm-states.html. Decision fact from the
  // journey decision route, offers fact from the live reply. {defect}, {other}.
  // ---------------------------------------------------------------------------
  benchOffersCap: {
    id: 'MakeDecisionModal.benchOffersCap',
    defaultMessage: 'What the analyzer offers now',
  },
  benchBannerB1: {
    id: 'MakeDecisionModal.benchBannerB1',
    defaultMessage: "The analyzer decided: {defect}. Today's check agrees.",
  },
  benchBannerB1Help: {
    id: 'MakeDecisionModal.benchBannerB1Help',
    defaultMessage: 'Press <k>Enter</k> to keep it, or pick another type below.',
  },
  benchBannerB2: {
    id: 'MakeDecisionModal.benchBannerB2',
    defaultMessage: "The analyzer decided: {defect}. Today's check leans {other}.",
  },
  benchBannerB2Help: {
    id: 'MakeDecisionModal.benchBannerB2Help',
    defaultMessage: 'Compare the offers below, then keep or change the label.',
  },
  benchBannerB2e: {
    id: 'MakeDecisionModal.benchBannerB2e',
    defaultMessage: "The analyzer decided: {defect}. Today's check found no match.",
  },
  benchBannerB2eHelp: {
    id: 'MakeDecisionModal.benchBannerB2eHelp',
    defaultMessage: 'The label stands unless you change it.',
  },
  benchBannerB3: {
    id: 'MakeDecisionModal.benchBannerB3',
    defaultMessage: 'No auto decision. The offers lean {defect}.',
  },
  benchBannerB3Help: {
    id: 'MakeDecisionModal.benchBannerB3Help',
    defaultMessage: 'Press <k>Enter</k> to arm it, <k>Enter</k> again to apply.',
  },
  benchBannerB4e: {
    id: 'MakeDecisionModal.benchBannerB4e',
    defaultMessage: 'No auto decision. The analyzer leans {defect}; other offers disagree.',
  },
  benchBannerB4eHelp: {
    id: 'MakeDecisionModal.benchBannerB4eHelp',
    defaultMessage: 'Press <k>Enter</k> to arm its pick, or read the rivals first.',
  },
  benchBannerB4: {
    id: 'MakeDecisionModal.benchBannerB4',
    defaultMessage: 'No auto decision. The offers point different ways.',
  },
  benchBannerB4Help: {
    id: 'MakeDecisionModal.benchBannerB4Help',
    defaultMessage: 'Read both sides, then pick.',
  },
  benchBannerB5: {
    id: 'MakeDecisionModal.benchBannerB5',
    defaultMessage: 'No auto decision. The lead offer is an AI guess, not a match.',
  },
  benchBannerB5Help: {
    id: 'MakeDecisionModal.benchBannerB5Help',
    defaultMessage: 'Read it before you use it.',
  },
  benchBannerB6u: {
    id: 'MakeDecisionModal.benchBannerB6u',
    defaultMessage: 'No auto decision. Close look-alikes exist, but none has a confirmed defect.',
  },
  benchBannerB6uHelp: {
    id: 'MakeDecisionModal.benchBannerB6uHelp',
    defaultMessage: 'Compare the logs, then decide.',
  },
  benchBannerB6: {
    id: 'MakeDecisionModal.benchBannerB6',
    defaultMessage: 'No auto decision, and nothing to offer.',
  },
  benchBannerB6Help: {
    id: 'MakeDecisionModal.benchBannerB6Help',
    defaultMessage: 'Everything it found is below the line, in the dock. You decide.',
  },
  benchBannerB6s: {
    id: 'MakeDecisionModal.benchBannerB6s',
    defaultMessage: 'No auto decision, and no offer the model stands behind.',
  },
  benchBannerB6sHelp: {
    id: 'MakeDecisionModal.benchBannerB6sHelp',
    defaultMessage: 'The offer below matches on log text only. This one is your call.',
  },
  benchBannerB6n: {
    id: 'MakeDecisionModal.benchBannerB6n',
    defaultMessage: 'No auto decision, and nothing to offer.',
  },
  benchBannerB6nHelp: {
    id: 'MakeDecisionModal.benchBannerB6nHelp',
    defaultMessage: 'You decide.',
  },
  benchBannerBF: {
    id: 'MakeDecisionModal.benchBannerBF',
    defaultMessage: 'The offers lean {defect}.',
  },
  benchBannerBFHelp: {
    id: 'MakeDecisionModal.benchBannerBFHelp',
    defaultMessage: 'Pick a card or a defect type.',
  },
  // The three checks
  benchCheckPast: {
    id: 'MakeDecisionModal.benchCheckPast',
    defaultMessage: 'Past decision',
  },
  benchCheckPastRole: {
    id: 'MakeDecisionModal.benchCheckPastRole',
    defaultMessage: 'A person already decided this exact same failure.',
  },
  benchCheckPastRolePerson: {
    id: 'MakeDecisionModal.benchCheckPastRolePerson',
    defaultMessage: '{who} decided this exact same failure.',
  },
  benchCheckPastInRun: {
    id: 'MakeDecisionModal.benchCheckPastInRun',
    defaultMessage: 'In {run}',
  },
  benchCheckPastNoMatch: {
    id: 'MakeDecisionModal.benchCheckPastNoMatch',
    defaultMessage: 'No exact match found.',
  },
  benchCheckPastNoMatchProv: {
    id: 'MakeDecisionModal.benchCheckPastNoMatchProv',
    defaultMessage: 'Nothing in history has the same error fingerprint.',
  },
  benchCheckPastStrong: {
    id: 'MakeDecisionModal.benchCheckPastStrong',
    defaultMessage: 'Strong enough to apply on its own.',
  },
  benchCheckSimilar: {
    id: 'MakeDecisionModal.benchCheckSimilar',
    defaultMessage: 'Similar failures',
  },
  benchCheckSimilarRole: {
    id: 'MakeDecisionModal.benchCheckSimilarRole',
    defaultMessage: 'Failures that look like this one, from a trained model.',
  },
  benchCheckSimilarNone: {
    id: 'MakeDecisionModal.benchCheckSimilarNone',
    defaultMessage: 'No similar failures cleared the bar.',
  },
  benchCheckAi: {
    id: 'MakeDecisionModal.benchCheckAi',
    defaultMessage: 'AI guess',
  },
  benchCheckAiRole: {
    id: 'MakeDecisionModal.benchCheckAiRole',
    defaultMessage: 'With no earlier match, the AI reasons from a set of rules.',
  },
  benchEmptyInspector: {
    id: 'MakeDecisionModal.benchEmptyInspector',
    defaultMessage: 'See what the analyzer is doing with this test',
  },
  benchCheckAiRule: {
    id: 'MakeDecisionModal.benchCheckAiRule',
    defaultMessage: 'Rule matched: {rule}.',
  },
  benchCheckAiNone: {
    id: 'MakeDecisionModal.benchCheckAiNone',
    defaultMessage: 'No AI guess for this failure.',
  },
  benchCheckAiOrigin: {
    id: 'MakeDecisionModal.benchCheckAiOrigin',
    defaultMessage: 'No earlier match to lean on.',
  },
  benchNotConfirmed: {
    id: 'MakeDecisionModal.benchNotConfirmed',
    defaultMessage: 'not confirmed',
  },
  benchTagHypothesis: {
    id: 'MakeDecisionModal.benchTagHypothesis',
    defaultMessage: 'hypothesis',
  },
  benchHypothesisNote: {
    id: 'MakeDecisionModal.benchHypothesisNote',
    defaultMessage: 'No confident match yet. This is an early guess from rules. Check it before you decide.',
  },
  benchHypothesisRoleOff: {
    id: 'MakeDecisionModal.benchHypothesisRoleOff',
    defaultMessage: 'The AI guess feature is turned off for this project, so this guess will not update.',
  },
  benchUseThisGuess: {
    id: 'MakeDecisionModal.benchUseThisGuess',
    defaultMessage: 'Use this guess',
  },
  benchUseThisAnswer: {
    id: 'MakeDecisionModal.benchUseThisAnswer',
    defaultMessage: 'Use this answer',
  },
  benchSameAnswer: {
    id: 'MakeDecisionModal.benchSameAnswer',
    defaultMessage: 'same answer',
  },
  benchCompareLogs: {
    id: 'MakeDecisionModal.benchCompareLogs',
    defaultMessage: 'Compare logs',
  },
  // Card arming (mockup-mdm-states): a whole card is the arm target. The "leading"
  // chip marks the card a bare Enter would arm first; the armed note appears on
  // the card once it is loaded into the verdict.
  benchLeadingChip: {
    id: 'MakeDecisionModal.benchLeadingChip',
    defaultMessage: 'leading',
  },
  benchLeadingChipTitle: {
    id: 'MakeDecisionModal.benchLeadingChipTitle',
    defaultMessage: 'The lean. A bare Enter arms this card first.',
  },
  benchArmedNote: {
    id: 'MakeDecisionModal.benchArmedNote',
    defaultMessage: 'Armed. Apply commits {defect}.',
  },
  benchArmedNotBacked: {
    id: 'MakeDecisionModal.benchArmedNotBacked',
    defaultMessage: 'The model did not back this offer. You are deciding on your own.',
  },
  // Band phrases (next to any number)
  benchBandAuto: {
    id: 'MakeDecisionModal.benchBandAuto',
    defaultMessage: 'Will apply on its own',
  },
  benchBandSuggest: {
    id: 'MakeDecisionModal.benchBandSuggest',
    defaultMessage: 'Suggested, please confirm',
  },
  benchBandAbstain: {
    id: 'MakeDecisionModal.benchBandAbstain',
    defaultMessage: 'Not sure, your call',
  },
  benchBandRubric: {
    id: 'MakeDecisionModal.benchBandRubric',
    defaultMessage: 'A guess, check it first',
  },
  benchAlike: {
    id: 'MakeDecisionModal.benchAlike',
    defaultMessage: '{score} alike.',
  },
  // Similarity card only: names the number as a LOG similarity (cosine), so it is
  // never read as a model confidence. The abstain card keeps benchAlike.
  benchLogsAlike: {
    id: 'MakeDecisionModal.benchLogsAlike',
    defaultMessage: 'Logs {score} alike.',
  },
  benchLogsAlikeBut: {
    id: 'MakeDecisionModal.benchLogsAlikeBut',
    defaultMessage: 'Logs {score} alike, but {what}.',
  },
  benchMismatchIdentifiers: {
    id: 'MakeDecisionModal.benchMismatchIdentifiers',
    defaultMessage: 'no shared identifiers',
  },
  benchMismatchStatusCodes: {
    id: 'MakeDecisionModal.benchMismatchStatusCodes',
    defaultMessage: 'different status codes',
  },
  benchMismatchTemplates: {
    id: 'MakeDecisionModal.benchMismatchTemplates',
    defaultMessage: 'no shared log lines',
  },
  benchMismatchJoin: {
    id: 'MakeDecisionModal.benchMismatchJoin',
    defaultMessage: '{first} and {second}',
  },
  benchTagNotBacked: {
    id: 'MakeDecisionModal.benchTagNotBacked',
    defaultMessage: 'Not backed',
  },
  benchTagModelAgrees: {
    id: 'MakeDecisionModal.benchTagModelAgrees',
    defaultMessage: 'Model agrees',
  },
  benchSimilarRoleUnbacked: {
    id: 'MakeDecisionModal.benchSimilarRoleUnbacked',
    defaultMessage: 'Found by log search. The model did not confirm it.',
  },
  benchSimilarRoleBacked: {
    id: 'MakeDecisionModal.benchSimilarRoleBacked',
    defaultMessage: 'Failures that look like this one, confirmed by the model.',
  },
  benchModelNoCall: {
    id: 'MakeDecisionModal.benchModelNoCall',
    defaultMessage: 'The model made no call here ({p}, needs {tau}).',
  },
  benchModelNoCallPlain: {
    id: 'MakeDecisionModal.benchModelNoCallPlain',
    defaultMessage: 'The model made no call on this failure.',
  },
  benchModelDiffers: {
    id: 'MakeDecisionModal.benchModelDiffers',
    defaultMessage: 'The model called this {other} instead ({p}).',
  },
  benchModelDiffersPlain: {
    id: 'MakeDecisionModal.benchModelDiffersPlain',
    defaultMessage: 'The model called this {other} instead.',
  },
  benchModelBacks: {
    id: 'MakeDecisionModal.benchModelBacks',
    defaultMessage: 'The model backs this at {p}.',
  },
  // Sits on the defect pill's own line, so it costs no extra line on the card.
  // The verdict line above says what the model decided about the failure; this
  // says how much the model believes the defect type on the pill next to it.
  benchOfferedLabelP: {
    id: 'MakeDecisionModal.benchOfferedLabelP',
    defaultMessage: 'model {p}',
  },
  benchOfferedLabelPTitle: {
    id: 'MakeDecisionModal.benchOfferedLabelPTitle',
    defaultMessage:
      'How much the model believes this defect type, from 0 to 1. It is not how well the logs match.',
  },
  benchThinEvidence: {
    id: 'MakeDecisionModal.benchThinEvidence',
    defaultMessage:
      'Only {n} earlier {n, plural, one {failure} other {failures}} to compare against.',
  },
  benchScopeGroupToggle: {
    id: 'MakeDecisionModal.benchScopeGroupToggle',
    defaultMessage:
      'Also apply to {count} more {count, plural, one {test} other {tests}} with the same failure signature',
  },
  benchScopeGroupDecided: {
    id: 'MakeDecisionModal.benchScopeGroupDecided',
    defaultMessage:
      '({count} more in this group are already decided and will be left alone.)',
  },
  benchScopeThisOnly: {
    id: 'MakeDecisionModal.benchScopeThisOnly',
    defaultMessage: 'This decision applies to this test only.',
  },
  // silent-no-signal empty state (gpos-silent-VERDICT copy, verbatim)
  benchWaitCap: {
    id: 'MakeDecisionModal.benchWaitCap',
    defaultMessage: 'ANSWER ON ITS WAY',
  },
  benchWaitTitle: {
    id: 'MakeDecisionModal.benchWaitTitle',
    defaultMessage: 'The analyzer is still working on this one',
  },
  benchWaitTitleTip: {
    id: 'MakeDecisionModal.benchWaitTitleTip',
    defaultMessage:
      'The analyzer answers fast from what it already knows. A failure it has not seen before takes a few more seconds to work out. This screen updates on its own.',
  },
  benchWaitBody: {
    id: 'MakeDecisionModal.benchWaitBody',
    defaultMessage:
      'It read the error logs and is working out an answer for this failure. That takes a few seconds the first time a failure like this shows up. You do not need to reopen this window: it updates on its own when the answer lands.',
  },
  benchWaitNext: {
    id: 'MakeDecisionModal.benchWaitNext',
    defaultMessage: 'Wait a few seconds, or choose a defect type below and Apply.',
  },
  benchWaitNote: {
    id: 'MakeDecisionModal.benchWaitNote',
    defaultMessage: 'Your own decision always wins. The analyzer never overwrites it.',
  },
  benchNoHistoryCap: {
    id: 'MakeDecisionModal.benchNoHistoryCap',
    defaultMessage: 'NOTHING TO COMPARE WITH',
  },
  benchNoHistoryTitle: {
    id: 'MakeDecisionModal.benchNoHistoryTitle',
    defaultMessage: 'No past failure to match this one against',
  },
  benchNoHistoryTitleTip: {
    id: 'MakeDecisionModal.benchNoHistoryTitleTip',
    defaultMessage:
      'The analyzer suggests a defect type by matching a failure against ones people already decided in this project. There are none like this yet.',
  },
  benchNoHistoryBody: {
    id: 'MakeDecisionModal.benchNoHistoryBody',
    defaultMessage:
      'The analyzer read the error logs, but this project has no decided failure that looks like this one, so it has nothing to point at. This is normal in a new project or for a new kind of failure.',
  },
  benchNoHistoryNext: {
    id: 'MakeDecisionModal.benchNoHistoryNext',
    defaultMessage: 'Choose a defect type below, add a reason if it helps, then Apply.',
  },
  benchNoHistoryNote: {
    id: 'MakeDecisionModal.benchNoHistoryNote',
    defaultMessage:
      'Your decision becomes the match for the next failure like this one, so the next run gets a suggestion.',
  },
  benchSilentCap: {
    id: 'MakeDecisionModal.benchSilentCap',
    defaultMessage: 'NO ANALYZER SIGNAL',
  },
  benchSilentTitle: {
    id: 'MakeDecisionModal.benchSilentTitle',
    defaultMessage: 'No error logs to analyze',
  },
  benchSilentTitleTip: {
    id: 'MakeDecisionModal.benchSilentTitleTip',
    defaultMessage:
      'The analyzer builds its answer from ERROR-level logs. This test has none, so it has nothing to suggest. Pick a defect type yourself.',
  },
  benchSilentBody: {
    id: 'MakeDecisionModal.benchSilentBody',
    defaultMessage:
      'This test failed but recorded no ERROR-level logs. The analyzer reads the error text to find matching failures, so with no error logs there is nothing for it to match and no answer to suggest here. This one is a manual call.',
  },
  benchSilentNext: {
    id: 'MakeDecisionModal.benchSilentNext',
    defaultMessage: 'Choose a defect type below, add a reason if it helps, then Apply.',
  },
  benchSilentNote: {
    id: 'MakeDecisionModal.benchSilentNote',
    defaultMessage:
      'The analyzer only reads ERROR-level logs. Any lower-level logs or a screenshot may still be on the item if you want more context.',
  },
  benchDecidedByInRun: {
    id: 'MakeDecisionModal.benchDecidedByInRun',
    defaultMessage: '{who} decided this in {run}',
  },
  benchDecidedBy: {
    id: 'MakeDecisionModal.benchDecidedBy',
    defaultMessage: '{who} decided this in an earlier run',
  },
  benchDecidedRun: {
    id: 'MakeDecisionModal.benchDecidedRun',
    defaultMessage: 'launch #{number}',
  },
  benchDecidedSomePerson: {
    id: 'MakeDecisionModal.benchDecidedSomePerson',
    defaultMessage: 'A person',
  },
  benchDecidedTheAnalyzer: {
    id: 'MakeDecisionModal.benchDecidedTheAnalyzer',
    defaultMessage: 'The analyzer',
  },
  benchAiGuessPct: {
    id: 'MakeDecisionModal.benchAiGuessPct',
    defaultMessage: "The AI's own guess ({pct}%). Check it first.",
  },
  // The line + declined dock
  benchLineLabel: {
    id: 'MakeDecisionModal.benchLineLabel',
    defaultMessage: 'Decision boundary',
  },
  benchLineTooltip: {
    id: 'MakeDecisionModal.benchLineTooltip',
    defaultMessage:
      'Below this line the analyzer does not suggest an answer. These lines are shown only for you to judge.',
  },
  benchDockToggle: {
    id: 'MakeDecisionModal.benchDockToggle',
    defaultMessage: 'The analyzer said no to these ({count})',
  },
  benchDockNote: {
    id: 'MakeDecisionModal.benchDockNote',
    defaultMessage: 'Shown only so you can decide.',
  },
  benchDockTooWeak: {
    id: 'MakeDecisionModal.benchDockTooWeak',
    defaultMessage: 'Too weak to suggest ({score}).',
  },
  // The synthesized declined row (ek=decline) speaks the CONFIDENCE scale, never
  // alike (verdict MS7 / migration item 5). Plain below-line rows keep benchDockTooWeak.
  benchDockDeclineConf: {
    id: 'MakeDecisionModal.benchDockDeclineConf',
    defaultMessage: 'Confidence {p}, under the 0.45 suggest line.',
  },
  benchDockChoose: {
    id: 'MakeDecisionModal.benchDockChoose',
    defaultMessage: 'Choose this myself',
  },
  benchDockBestScore: {
    id: 'MakeDecisionModal.benchDockBestScore',
    defaultMessage: 'Best candidate scored {score}. That is below the bar. See the list below.',
  },
  // AI decision summary (the stage band)
  benchAiSumRubricToggle: {
    id: 'MakeDecisionModal.benchAiSumRubricToggle',
    defaultMessage: 'The AI guess reasons differently. Show.',
  },
  benchAiSumToComment: {
    id: 'MakeDecisionModal.benchAiSumToComment',
    defaultMessage: 'Add this reason to the comment',
  },
  benchStageNotSureSub: {
    id: 'MakeDecisionModal.benchStageNotSureSub',
    defaultMessage:
      'The list it said no to is open below the line. Read this test log, put a look-alike next to it to check, then pick a defect type yourself. You can also use the AI guess and edit the comment.',
  },
  benchStageReviewNote: {
    id: 'MakeDecisionModal.benchStageReviewNote',
    defaultMessage: 'Edit the comment, then apply.',
  },
  benchStageAgreeCap: {
    id: 'MakeDecisionModal.benchStageAgreeCap',
    defaultMessage: 'Why the analyzer thinks this (written by AI)',
  },
  // Compare
  benchCmpTitle: {
    id: 'MakeDecisionModal.benchCmpTitle',
    defaultMessage: 'Is this the same failure?',
  },
  benchCmpClose: {
    id: 'MakeDecisionModal.benchCmpClose',
    defaultMessage: 'Close compare',
  },
  benchCmpHelp: {
    id: 'MakeDecisionModal.benchCmpHelp',
    defaultMessage:
      'Green lines match. Highlighted lines differ. If the key error line matches, it is likely the same failure.',
  },
  benchCmpSame: {
    id: 'MakeDecisionModal.benchCmpSame',
    defaultMessage: 'Same in both',
  },
  benchCmpDiff: {
    id: 'MakeDecisionModal.benchCmpDiff',
    defaultMessage: 'Different',
  },
  benchCmpLeft: {
    id: 'MakeDecisionModal.benchCmpLeft',
    defaultMessage: 'This failure',
  },
  benchCmpLeftSuffix: {
    id: 'MakeDecisionModal.benchCmpLeftSuffix',
    defaultMessage: '(the item under analysis)',
  },
  benchCmpRight: {
    id: 'MakeDecisionModal.benchCmpRight',
    defaultMessage: 'The one you picked',
  },
  benchCmpOnlyHere: {
    id: 'MakeDecisionModal.benchCmpOnlyHere',
    defaultMessage: 'only here',
  },
  benchCmpOnlyThere: {
    id: 'MakeDecisionModal.benchCmpOnlyThere',
    defaultMessage: 'only there',
  },
  benchCmpNoLog: {
    id: 'MakeDecisionModal.benchCmpNoLog',
    defaultMessage: 'This candidate has no error log to compare.',
  },
  benchCmpNotSame: {
    id: 'MakeDecisionModal.benchCmpNotSame',
    defaultMessage: 'Not the same failure?',
  },
  benchCmpManual: {
    id: 'MakeDecisionModal.benchCmpManual',
    defaultMessage: 'Choose a defect type yourself',
  },
  benchCmpKeyMatch: {
    id: 'MakeDecisionModal.benchCmpKeyMatch',
    defaultMessage: 'The key error line matches.',
  },
  benchCmpKeyDiff: {
    id: 'MakeDecisionModal.benchCmpKeyDiff',
    defaultMessage: 'The key error lines are different.',
  },
  // Verdict bar
  benchVbDefect: {
    id: 'MakeDecisionModal.benchVbDefect',
    defaultMessage: 'Defect:',
  },
  benchVbChooseDefect: {
    id: 'MakeDecisionModal.benchVbChooseDefect',
    defaultMessage: 'Choose a defect type',
  },
  benchVbPickAnswer: {
    id: 'MakeDecisionModal.benchVbPickAnswer',
    defaultMessage: 'Pick your answer',
  },
  benchVbApplyTo: {
    id: 'MakeDecisionModal.benchVbApplyTo',
    defaultMessage: 'Apply to:',
  },
  benchVbFanout: {
    id: 'MakeDecisionModal.benchVbFanout',
    defaultMessage: 'Apply to all {count}',
  },
  benchVbChooseMyself: {
    id: 'MakeDecisionModal.benchVbChooseMyself',
    defaultMessage: 'Choose myself',
  },
  benchManualHead: {
    id: 'MakeDecisionModal.benchManualHead',
    defaultMessage: 'Pick a defect type',
  },
  benchManualHelp: {
    id: 'MakeDecisionModal.benchManualHelp',
    defaultMessage: 'Pick the defect type that fits this failure.',
  },
  benchCmtAddReason: {
    id: 'MakeDecisionModal.benchCmtAddReason',
    defaultMessage: 'Add a reason',
  },
  benchCmtPrefillNote: {
    id: 'MakeDecisionModal.benchCmtPrefillNote',
    defaultMessage: 'Filled from the AI reason. Change it if you want.',
  },
  benchCmtPlaceholder: {
    id: 'MakeDecisionModal.benchCmtPlaceholder',
    defaultMessage: 'Why this defect? (optional)',
  },
  // Provenance tag on the verdict selector
  // Source tags (verdict 6.1). One per armed source; render only when a type is
  // in the field. The abstain suffix is appended, never baked in.
  benchProvYouPicked: {
    id: 'MakeDecisionModal.benchProvYouPicked',
    defaultMessage: 'you picked this',
  },
  benchProvFromAi: {
    id: 'MakeDecisionModal.benchProvFromAi',
    defaultMessage: 'from AI guess, not confirmed',
  },
  benchProvFromSimilarity: {
    id: 'MakeDecisionModal.benchProvFromSimilarity',
    defaultMessage: 'from Similar failures, logs {score} alike',
  },
  benchProvFromPrecedent: {
    id: 'MakeDecisionModal.benchProvFromPrecedent',
    defaultMessage: 'from Past decision',
  },
  benchProvDockAdopt: {
    id: 'MakeDecisionModal.benchProvDockAdopt',
    defaultMessage: 'from a declined suggestion, your call',
  },
  // Appended to a Past decision / Similar failures tag when the decision route
  // itself abstained (ruling C4; no p* here, its home is the story reason line).
  benchProvAbstainSuffix: {
    id: 'MakeDecisionModal.benchProvAbstainSuffix',
    defaultMessage: 'analyzer did not apply this',
  },
  // Shown at the comment when a re-arm kept the human's edited text instead of
  // overwriting it with the new source's prefill (dirty rule, verdict 6.1).
  benchProvCommentKept: {
    id: 'MakeDecisionModal.benchProvCommentKept',
    defaultMessage: 'comment kept from your edit',
  },
  // Recap
  benchRecapThisItem: {
    id: 'MakeDecisionModal.benchRecapThisItem',
    defaultMessage: 'This will be applied to this item.',
  },
  // Amber recap fragment when a human arms an offer the analyzer itself did not
  // apply on its own (verdict 6.5, ruling C4).
  benchRecapAbstain: {
    id: 'MakeDecisionModal.benchRecapAbstain',
    defaultMessage: 'The analyzer did not apply this on its own.',
  },
  benchRecapGroup: {
    id: 'MakeDecisionModal.benchRecapGroup',
    defaultMessage: 'This will apply to all {count} matching tests in this run.',
  },
  benchRecapWarnConfirm: {
    id: 'MakeDecisionModal.benchRecapWarnConfirm',
    defaultMessage: 'Your own choice (the analyzer said no). Click the highlighted type to confirm.',
  },
  benchRecapWarnCovers: {
    id: 'MakeDecisionModal.benchRecapWarnCovers',
    defaultMessage: 'Your own choice (the analyzer said no) applies to {count} items.',
  },
  benchBurstRecapWarn: {
    id: 'MakeDecisionModal.benchBurstRecapWarn',
    defaultMessage:
      'You are about to mark several tests as Product Bug. In this run, {count} of {failed} failures share this exact signature. That usually points to one system issue. Check again before you apply.',
  },

  // ---- Stage 3: recap matrix fragments (verdict 6.5) -----------------------
  // One sentence assembled from fragments; zero fragments omitted; the worst
  // warning wins the color. Each fragment is a clause joined with a space.
  benchRecapBase: {
    id: 'MakeDecisionModal.benchRecapBase',
    defaultMessage: 'Will set {type} on this test.',
  },
  benchRecapFragComment: {
    id: 'MakeDecisionModal.benchRecapFragComment',
    defaultMessage: 'and save your comment.',
  },
  benchRecapFragGroup: {
    id: 'MakeDecisionModal.benchRecapFragGroup',
    defaultMessage: 'and {count} more with the same failure signature.',
  },
  benchRecapFragGroupCap: {
    id: 'MakeDecisionModal.benchRecapFragGroupCap',
    defaultMessage: 'and {shown} of {total} more with the same failure signature.',
  },
  benchRecapFragTierA: {
    id: 'MakeDecisionModal.benchRecapFragTierA',
    defaultMessage:
      'Overwrites {count, plural, one {# analyzer label} other {# analyzer labels}}.',
  },
  benchRecapFragTierBSame: {
    id: 'MakeDecisionModal.benchRecapFragTierBSame',
    defaultMessage:
      'Restates {count, plural, one {# human decision} other {# human decisions}}.',
  },
  benchRecapFragTierBDiff: {
    id: 'MakeDecisionModal.benchRecapFragTierBDiff',
    defaultMessage:
      'Replaces {count, plural, one {# human decision} other {# human decisions}} of a different type, decided by {names}.',
  },
  benchRecapFragTierBDiffNoNames: {
    id: 'MakeDecisionModal.benchRecapFragTierBDiffNoNames',
    defaultMessage:
      'Replaces {count, plural, one {# human decision} other {# human decisions}} of a different type.',
  },
  benchRecapNames2: {
    id: 'MakeDecisionModal.benchRecapNames2',
    defaultMessage: '{a} and {b}',
  },
  benchRecapNamesMore: {
    id: 'MakeDecisionModal.benchRecapNamesMore',
    defaultMessage: '{a}, {b} and others',
  },

  // ---- Stage 3: two-tier override expander (verdict 6.4) --------------------
  benchOverrideReview: {
    id: 'MakeDecisionModal.benchOverrideReview',
    defaultMessage: 'Already decided: {count, plural, one {# test} other {# tests}}.',
  },
  benchOverrideReviewCap: {
    id: 'MakeDecisionModal.benchOverrideReviewCap',
    defaultMessage: 'Already decided: {shown} of {total} tests.',
  },
  benchOverrideReviewAction: {
    id: 'MakeDecisionModal.benchOverrideReviewAction',
    defaultMessage: 'Review',
  },
  benchOverrideCollapse: {
    id: 'MakeDecisionModal.benchOverrideCollapse',
    defaultMessage: 'Collapse',
  },
  benchOverrideIncluded: {
    id: 'MakeDecisionModal.benchOverrideIncluded',
    defaultMessage: '{included} included',
  },
  benchOverrideArmFirst: {
    id: 'MakeDecisionModal.benchOverrideArmFirst',
    defaultMessage: 'pick a verdict first',
  },
  benchOverrideLoading: {
    id: 'MakeDecisionModal.benchOverrideLoading',
    defaultMessage: 'Loading decisions...',
  },
  benchOverrideTierAHead: {
    id: 'MakeDecisionModal.benchOverrideTierAHead',
    defaultMessage: 'Decided by the analyzer',
  },
  benchOverrideTierBHead: {
    id: 'MakeDecisionModal.benchOverrideTierBHead',
    defaultMessage: 'Decided by people',
  },
  benchOverrideTierAToggle: {
    id: 'MakeDecisionModal.benchOverrideTierAToggle',
    defaultMessage:
      'Include {count, plural, one {# test} other {# tests}} the analyzer decided. Your decision will overwrite the machine labels.',
  },
  benchOverrideTierADecidedBy: {
    id: 'MakeDecisionModal.benchOverrideTierADecidedBy',
    defaultMessage: 'decided by the analyzer',
  },
  benchOverrideDecidedBy: {
    id: 'MakeDecisionModal.benchOverrideDecidedBy',
    defaultMessage: 'decided by {who}',
  },
  benchOverrideDecidedEarlier: {
    id: 'MakeDecisionModal.benchOverrideDecidedEarlier',
    defaultMessage: 'decided earlier',
  },
  benchOverrideSameType: {
    id: 'MakeDecisionModal.benchOverrideSameType',
    defaultMessage: 'same type',
  },
  benchOverrideDiffType: {
    id: 'MakeDecisionModal.benchOverrideDiffType',
    defaultMessage: 'different type',
  },
  benchOverrideCommentReplace: {
    id: 'MakeDecisionModal.benchOverrideCommentReplace',
    defaultMessage: 'Your comment will replace theirs on the included tests.',
  },
});
