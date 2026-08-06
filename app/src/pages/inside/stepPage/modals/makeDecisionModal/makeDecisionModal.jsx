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

import React, { useEffect, useReducer, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames/bind';
import { useDispatch, useSelector } from 'react-redux';
import { hideModalAction, withModal } from 'controllers/modal';
import { useIntl } from 'react-intl';
import { useTracking } from 'react-tracking';
import { NOTIFICATION_TYPES, showNotification } from 'controllers/notification';
import { DarkModalLayout } from 'components/main/modal/darkModalLayout';
import { GhostButton } from 'components/buttons/ghostButton';
import { SpinningPreloader } from 'components/preloaders/spinningPreloader';
import { activeProjectSelector } from 'controllers/user';
import { getDefectTypeSelector } from 'controllers/project';
import isEqual from 'fast-deep-equal';
import { URLS } from 'common/urls';
import { fetch, isEmptyObject } from 'common/utils';
import { historyItemsSelector } from 'controllers/log';
import { linkIssueAction, postIssueAction, unlinkIssueAction } from 'controllers/step';
import { LINK_ISSUE, POST_ISSUE, UNLINK_ISSUE } from 'common/constants/actionTypes';
import { analyzerExtensionsSelector } from 'controllers/appInfo';
import { TO_INVESTIGATE_LOCATOR_PREFIX } from 'common/constants/defectTypes';
import { COMMON_LOCALE_KEYS } from 'common/constants/localization';
import { useWindowResize } from 'common/hooks';
import { MakeDecisionFooter } from './makeDecisionFooter';
import { MakeDecisionTabs } from './makeDecisionTabs';
import { MachineLearningSuggestions, SelectDefectManually, CopyFromHistoryLine } from './tabs';
import { messages } from './messages';
import {
  ACTIVE_TAB_MAP,
  ADD_FOR_ALL,
  CLEAR_FOR_ALL,
  COPY_FROM_HISTORY_LINE,
  CURRENT_EXECUTION_ONLY,
  CURRENT_LAUNCH,
  MACHINE_LEARNING_SUGGESTIONS,
  MAKE_DECISION_MODAL,
  NOT_CHANGED_FOR_ALL,
  REPLACE_FOR_ALL,
  SEARCH_MODES,
  SELECT_DEFECT_MANUALLY,
  SHOW_LOGS_BY_DEFAULT,
} from './constants';
import { ExecutionSection } from './executionSection';
import { Bench, BulkBench, distinctSavedTypeCount } from './bench';
import {
  canLlmStillAnswer,
  getAnalyzerHealthApiUrl,
  isRubricHypothesis,
} from './analyzerSuggestionMeta';
import styles from './makeDecisionModal.scss';

const cx = classNames.bind(styles);

// Middle truncation for the identity bar: long test names keep their head and
// tail (both carry meaning); the full name always rides in the title attribute.
const middleTruncate = (name, max = 76) => {
  if (typeof name !== 'string' || name.length <= max) {
    return name;
  }
  const head = Math.ceil(max * 0.6);
  const tail = max - head;
  return `${name.slice(0, head)}…${name.slice(name.length - tail)}`;
};

const MakeDecision = ({ data }) => {
  const { formatMessage } = useIntl();
  const { trackEvent } = useTracking();
  const dispatch = useDispatch();
  const activeProject = useSelector(activeProjectSelector);
  const getDefectType = useSelector(getDefectTypeSelector);
  const historyItems = useSelector(historyItemsSelector);
  const isAnalyzerAvailable = !!useSelector(analyzerExtensionsSelector).length;
  const isBulkOperation = data.items && data.items.length > 1;
  const itemData = isBulkOperation ? data.items : data.items[0];
  const clusterIds = data.items[0].clusterId
    ? Array.from(new Set(data.items.map(({ clusterId }) => clusterId)))
    : [];
  const isMLSuggestionsAvailable = !isBulkOperation || clusterIds.length === 1;
  const defectFromTIGroup = itemData.issue?.issueType.startsWith(TO_INVESTIGATE_LOCATOR_PREFIX);
  const [modalState, setModalState] = useReducer((state, newState) => ({ ...state, ...newState }), {
    decisionType: SELECT_DEFECT_MANUALLY,
    issueActionType: '',
    optionValue: isAnalyzerAvailable && defectFromTIGroup ? CURRENT_LAUNCH : CURRENT_EXECUTION_ONLY,
    searchMode: isAnalyzerAvailable && defectFromTIGroup ? SEARCH_MODES.CURRENT_LAUNCH : '',
    currentTestItems: data.items,
    testItems: [],
    selectedItems: [],
    suggestedItems: [],
    startTime: Date.now(),
    selectManualChoice: { issue: isBulkOperation ? { comment: '' } : itemData.issue },
    suggestChoice: {},
    historyChoice: historyItems.find(
      (item) =>
        item.id !== itemData.id &&
        item.issue &&
        !item.issue.issueType.startsWith(TO_INVESTIGATE_LOCATOR_PREFIX),
    ),
    commentOption: isBulkOperation ? NOT_CHANGED_FOR_ALL : REPLACE_FOR_ALL,
    extraAnalyticsParams: {
      link_name: false,
    },
  });
  const [activeTab, setActiveTab] = useState(SELECT_DEFECT_MANUALLY);
  const windowSize = useWindowResize();
  const scopeRef = useRef(null);

  // A decision that COULD become a Bench: single item + analyzer reachable. Known
  // synchronously on the first render (selector + props), so we can hold back the
  // stock UI until the suggest reply resolves and never flash the old tabs.
  const benchEligible = isAnalyzerAvailable && isMLSuggestionsAvailable && !isBulkOperation;

  const [modalHasChanges, setModalHasChanges] = useState(false);
  const [loadingMLSuggest, setLoadingMLSuggest] = useState(false);
  // Whether the ML suggest fetch has settled once. Until it does (for a Bench-
  // eligible decision) we render the Bench shell with a loader, NOT the stock tabs,
  // so the user never sees the old Make Decision flash before the Bench appears.
  const [mlResolved, setMlResolved] = useState(false);
  // True while the first reply came back empty and the analyzer says it can still
  // answer, so one more ask is on its way. Drives the Bench empty-state wording.
  const [suggestStillWorking, setSuggestStillWorking] = useState(false);

  // The Bench replaces the stock execution/suggestions area when the analyzer
  // actually spoke (non-empty suggest reply).
  const benchActive = benchEligible && modalState.suggestedItems.length > 0;
  // Bench-eligible but the reply has not settled yet: show the Bench shell + loader.
  const benchPending = benchEligible && !mlResolved;
  // Bench-eligible, reply settled, but EMPTY: the analyzer is reachable yet had
  // nothing to say (e.g. a FAILED item with no ERROR logs, so no signature). We show
  // the light Bench silent-no-signal empty state instead of the stock dark tabs, so
  // the human still gets the light manual-triage surface. Analyzer-off / unreachable
  // keeps the stock dark tabs (benchEligible is false there).
  const benchEmpty = benchEligible && mlResolved && modalState.suggestedItems.length === 0;
  // A multi-select Edit Defects call gets its own light surface: one decision
  // fanning out over the selection, manual-first, with the analyzer offer shown
  // when the whole selection shares one cluster. Not gated on the analyzer: the
  // bulk surface reads nothing per-item, so there is no state it cannot render.
  const benchBulk = isBulkOperation;
  useEffect(() => {
    let hasChanges;
    const newIssueData = modalState[ACTIVE_TAB_MAP[modalState.decisionType]].issue;
    if (
      isBulkOperation &&
      (!isMLSuggestionsAvailable || modalState.decisionType === SELECT_DEFECT_MANUALLY)
    ) {
      hasChanges =
        !!modalState.selectManualChoice.issue.issueType ||
        !!modalState.selectManualChoice.issue.comment ||
        modalState.commentOption !== NOT_CHANGED_FOR_ALL;
    } else if (isBulkOperation && isMLSuggestionsAvailable) {
      hasChanges = modalState.currentTestItems.some((item) => !isEqual(item.issue, newIssueData));
    } else {
      hasChanges = !isEqual(itemData.issue, newIssueData);
    }
    // A group-scope selection (C1 siblings or the two-tier override) is itself a
    // change worth committing even when the current item's own issue is
    // unchanged (verdict 6.4: the override pushes the armed decision out to the
    // decided members). Without this, arming the same type the item already
    // carries would leave Apply disabled and the group could never be swept. A
    // real (non-TI) defect must be armed first, so merely ticking the box does
    // not enable a To-Investigate no-op sweep.
    const armedType = newIssueData && newIssueData.issueType;
    const hasGroupScope =
      !!(modalState.selectedItems && modalState.selectedItems.length > 0) &&
      !!armedType &&
      !armedType.startsWith(TO_INVESTIGATE_LOCATOR_PREFIX);
    setModalHasChanges(hasChanges || hasGroupScope || !!modalState.issueActionType);
  }, [modalState]);

  useEffect(() => {
    if (!isMLSuggestionsAvailable) {
      setMlResolved(true);
      return undefined;
    }
    let cancelled = false;
    const timers = [];
    const url =
      clusterIds.length === 1
        ? URLS.MLSuggestionsByCluster(activeProject, clusterIds[0])
        : URLS.MLSuggestions(activeProject, itemData.id);
    // An empty reply does NOT mean the analyzer has nothing to say. It answers the
    // suggest call from what it has already worked out; for a failure it has not
    // seen before the answer is still being computed when the reply goes out, and
    // it lands seconds later. Asking once and settling on "nothing" left a reader
    // looking at an empty screen for an answer that already existed by then, and
    // only reopening the window would show it.
    //
    // So on an empty reply: ask the analyzer whether it can still answer at all
    // (same health question the explanation wait state asks, for the same reason),
    // and if it can, ask again on a fixed, short schedule. Measured on a cold
    // project, a first answer for a never-seen failure lands about 25 seconds after
    // the reply goes out, so a single 20-second retry would still be too early. Two
    // asks bracket it: one early for the quick cases, one past the measured mark.
    // The schedule is fixed and then it stops. This is not a poll, and it never
    // runs at all once the analyzer has answered.
    const RETRY_DELAYS_MS = [15000, 25000];
    const askOnce = (attempt) => {
      setLoadingMLSuggest(true);
      fetch(url)
        .then((resp) => {
          if (cancelled) {
            return;
          }
          setLoadingMLSuggest(false);
          setMlResolved(true);
          if (resp.length !== 0) {
            setSuggestStillWorking(false);
            setModalState({ suggestedItems: resp });
            return;
          }
          if (attempt >= RETRY_DELAYS_MS.length) {
            // Asked as often as we are going to: this is a real empty reply.
            setSuggestStillWorking(false);
            return;
          }
          window
            .fetch(getAnalyzerHealthApiUrl())
            .then((r) => (r.ok ? r.json() : null))
            .then((payload) => {
              if (cancelled) {
                return;
              }
              if (!canLlmStillAnswer(payload)) {
                setSuggestStillWorking(false);
                return;
              }
              setSuggestStillWorking(true);
              timers.push(
                window.setTimeout(
                  () => !cancelled && askOnce(attempt + 1),
                  RETRY_DELAYS_MS[attempt],
                ),
              );
            })
            .catch(() => !cancelled && setSuggestStillWorking(false));
        })
        .catch(() => {
          if (!cancelled) {
            setLoadingMLSuggest(false);
            setMlResolved(true);
            setSuggestStillWorking(false);
          }
        });
    };
    askOnce(0);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const prepareDataToSend = ({ isIssueAction } = {}) => {
    const { issue } = modalState[ACTIVE_TAB_MAP[activeTab]];
    const { currentTestItems, selectedItems, commentOption } = modalState;
    if (isBulkOperation) {
      return currentTestItems.map((item) => {
        let comment;
        switch (commentOption) {
          case CLEAR_FOR_ALL: {
            comment = '';
            break;
          }
          case ADD_FOR_ALL: {
            comment = `${item.issue.comment || ''}\n${issue.comment}`.trim();
            break;
          }
          case REPLACE_FOR_ALL: {
            comment = issue.comment;
            break;
          }
          default: {
            comment = item.issue.comment || '';
          }
        }
        return {
          ...(isIssueAction ? item : {}),
          testItemId: item.id,
          issue: {
            ...item.issue,
            ...issue,
            comment,
            autoAnalyzed: false,
          },
        };
      });
    }

    let newIssue = issue;

    if (activeTab === SELECT_DEFECT_MANUALLY) {
      const baseIssue = modalState.currentTestItems[0].issue;
      newIssue = Object.fromEntries(
        Object.entries(issue).filter(([key, val]) => baseIssue[key] !== val),
      );
    }

    return [...currentTestItems, ...selectedItems].map((item) => {
      const merged = {
        ...item.issue,
        ...newIssue,
        autoAnalyzed: false,
      };
      // Every item in this payload needs a defect type; the server rejects the
      // WHOLE request when one is missing. Two things conspire to drop it: on the
      // manual tab newIssue is only the fields that DIFFER from the current item's
      // issue, and a group member joins selectedItems carrying an empty issue. So
      // applying the type the current item already has left every group member
      // with no type at all and the request failed as a unit. The armed verdict is
      // the authority for the whole payload, with the item's own type as fallback.
      if (!merged.issueType) {
        merged.issueType = issue.issueType || (item.issue && item.issue.issueType);
      }
      // The comment is dropped by the same delta for the same reason, and the
      // modal promises to save it on every test the decision covers. A member
      // with no comment key at all never had one of its own, so nothing is being
      // overwritten here; an empty string is a real value the human chose and is
      // left alone.
      if (merged.comment === undefined && issue.comment) {
        merged.comment = issue.comment;
      }
      // Group-override members (verdict 9.2): keep KB provenance honest by
      // appending a short trailing note to the outgoing comment so a later reader
      // can tell a fanned-out decision from an individually triaged one. The full
      // armed comment (not the manual delta) is used so the note never lands
      // alone when the armed comment matched the current item's base.
      if (item.overrideFrom) {
        const armedComment = (issue.comment || '').trim();
        const note = `applied via group override from item ${item.overrideFrom}`;
        merged.comment = armedComment ? `${armedComment}\n${note}` : note;
        merged.issueType = issue.issueType || item.issue.issueType;
      }
      return {
        ...(isIssueAction ? { ...item, opened: SHOW_LOGS_BY_DEFAULT } : {}),
        id: item.id || item.itemId,
        testItemId: item.id || item.itemId,
        issue: merged,
      };
    });
  };
  const sendSuggestResponse = () => {
    const dataToSend = modalState.suggestedItems.map((item) => {
      if (modalState[ACTIVE_TAB_MAP[activeTab]].id === item.testItemResource.id) {
        return {
          ...item.suggestRs,
          userChoice: 1,
        };
      }
      return item.suggestRs;
    });
    fetch(URLS.choiceSuggestedItems(activeProject), {
      method: 'put',
      data: dataToSend,
    })
      .then(() => {
        dispatch(
          showNotification({
            message: formatMessage(messages.suggestedChoiceSuccess),
            type: NOTIFICATION_TYPES.SUCCESS,
          }),
        );
      })
      .catch(() => {
        dispatch(
          showNotification({
            message: formatMessage(messages.suggestedChoiceFailed),
            type: NOTIFICATION_TYPES.ERROR,
          }),
        );
      });
  };
  const saveDefect = (options) => {
    const { fetchFunc } = data;
    const issues = prepareDataToSend(options);
    const url = URLS.testItems(activeProject);

    if (modalState.suggestedItems.length > 0) {
      sendSuggestResponse();
    }

    fetch(url, {
      method: 'put',
      data: {
        issues,
      },
    })
      .then(() => {
        fetchFunc(issues);
        dispatch(
          showNotification({
            message: formatMessage(messages.updateDefectsSuccess),
            type: NOTIFICATION_TYPES.SUCCESS,
          }),
        );
      })
      .catch(() => {
        dispatch(
          showNotification({
            message: formatMessage(messages.updateDefectsFailed),
            type: NOTIFICATION_TYPES.ERROR,
          }),
        );
      });
    dispatch(hideModalAction());
  };

  const handlePostIssue = () => {
    const { postIssueEvents } = data.eventsInfo;
    dispatch(
      postIssueAction(prepareDataToSend({ isIssueAction: true }), {
        fetchFunc: data.fetchFunc,
        eventsInfo: postIssueEvents,
      }),
    );
  };
  const handleLinkIssue = () => {
    const { linkIssueEvents } = data.eventsInfo;
    dispatch(
      linkIssueAction(prepareDataToSend({ isIssueAction: true }), {
        fetchFunc: data.fetchFunc,
        eventsInfo: linkIssueEvents,
      }),
    );
  };
  const handleUnlinkIssue = () => {
    const { unlinkIssueEvents } = data.eventsInfo;
    const selectedItems = isBulkOperation
      ? prepareDataToSend({ isIssueAction: true }).filter(
          (item) => item.issue.externalSystemIssues.length > 0,
        )
      : prepareDataToSend({ isIssueAction: true });
    dispatch(
      unlinkIssueAction(selectedItems, {
        fetchFunc: data.fetchFunc,
        eventsInfo: unlinkIssueEvents,
      }),
    );
  };

  const getIssueAction = () => {
    switch (modalState.issueActionType) {
      case POST_ISSUE:
        return handlePostIssue();
      case LINK_ISSUE:
        return handleLinkIssue();
      case UNLINK_ISSUE:
        return handleUnlinkIssue();
      default:
        return false;
    }
  };

  const getOnApplyEvent = () => {
    const {
      eventsInfo: { editDefectsEvents = {} },
      items,
    } = data;

    const {
      issueActionType,
      suggestedItems,
      extraAnalyticsParams,
      selectManualChoice: {
        issue: { comment },
      },
    } = modalState;

    const hasSuggestions = !!suggestedItems.length;
    const linkName = (comment?.trim() || '') !== (itemData.issue?.comment?.trim() || '');
    const { issueType } = modalState[ACTIVE_TAB_MAP[activeTab]].issue;

    return isBulkOperation
      ? editDefectsEvents.getClickOnApplyBulkEvent(
          defectFromTIGroup,
          issueActionType,
          items,
          issueType,
          linkName,
        )
      : editDefectsEvents.getClickOnApplyEvent(
          defectFromTIGroup,
          hasSuggestions,
          activeTab,
          issueType,
          itemData.issue.issueType,
          issueActionType,
          suggestedItems,
          extraAnalyticsParams,
        );
  };

  const applyChanges = () => {
    if (isBulkOperation) {
      modalHasChanges &&
        activeTab === SELECT_DEFECT_MANUALLY &&
        (!!modalState.selectManualChoice.issue.issueType ||
          !!modalState.selectManualChoice.issue.comment ||
          modalState.commentOption === CLEAR_FOR_ALL) &&
        saveDefect();

      !isEmptyObject(modalState.suggestChoice) &&
        activeTab === MACHINE_LEARNING_SUGGESTIONS &&
        saveDefect();
    } else {
      modalHasChanges &&
        (!isEqual(itemData.issue, modalState[ACTIVE_TAB_MAP[activeTab]].issue) ||
          (modalState.selectedItems && modalState.selectedItems.length > 0)) &&
        saveDefect();
    }
    trackEvent(getOnApplyEvent());

    ((modalState.decisionType === COPY_FROM_HISTORY_LINE &&
      isEqual(itemData.issue, modalState.historyChoice.issue)) ||
      (modalState.decisionType === MACHINE_LEARNING_SUGGESTIONS &&
        isEqual(itemData.issue, modalState.suggestChoice.issue))) &&
      dispatch(hideModalAction());

    modalState.issueActionType && dispatch(hideModalAction()) && getIssueAction();
  };

  const getFooterButtons = () => ({
    okButton: (
      <GhostButton onClick={applyChanges} disabled={!modalHasChanges} color="''" appearance="topaz">
        {formatMessage(modalState.issueActionType ? messages.applyAndContinue : messages.apply)}
      </GhostButton>
    ),
    cancelButton: (
      <GhostButton
        onClick={() => dispatch(hideModalAction())}
        color="''"
        appearance="topaz"
        transparentBackground
      >
        {formatMessage(COMMON_LOCALE_KEYS.CANCEL)}
      </GhostButton>
    ),
  });

  // Accept a cold-start rubric hypothesis: route into the standard "select defect
  // manually" flow with the rubric's proposed defect type and the rationale prefilled
  // into the editable comment editor, so the user can review/edit before Apply. This
  // fixes the stock behaviour where a self-referenced rubric row would copy the item's
  // own (empty) issue and apply nothing.
  const acceptSuggestedHypothesis = ({ issueType, comment }) => {
    setModalState({
      decisionType: SELECT_DEFECT_MANUALLY,
      issueActionType: '',
      selectManualChoice: {
        issue: { ...itemData.issue, issueType, comment: comment || '' },
      },
    });
    setActiveTab(SELECT_DEFECT_MANUALLY);
  };

  const getMakeDecisionTabs = () => {
    const preparedHistoryLineItems = historyItems.filter(
      (item) =>
        item.id !== itemData.id &&
        item.issue &&
        !item.issue.issueType.startsWith(TO_INVESTIGATE_LOCATOR_PREFIX),
    );

    const tabsData = [
      {
        id: SELECT_DEFECT_MANUALLY,
        shouldShow: true,
        isOpen: activeTab === SELECT_DEFECT_MANUALLY,
        title: formatMessage(messages.selectDefectTypeManually),
        content: (
          <SelectDefectManually
            itemData={itemData}
            modalState={modalState}
            setModalState={setModalState}
            isBulkOperation={isBulkOperation}
            windowSize={windowSize}
            eventsInfo={data.eventsInfo.editDefectsEvents}
          />
        ),
      },
      {
        id: MACHINE_LEARNING_SUGGESTIONS,
        shouldShow: isMLSuggestionsAvailable,
        isOpen: activeTab === MACHINE_LEARNING_SUGGESTIONS,
        title:
          modalState.suggestChoice.suggestRs &&
          formatMessage(
            isRubricHypothesis(modalState.suggestChoice.suggestRs)
              ? messages.llmHypothesisHeader
              : messages.machineLearningSuggestions,
            {
              value: modalState.suggestChoice.suggestRs.matchScore,
            },
          ),
        content: isMLSuggestionsAvailable && (
          <MachineLearningSuggestions
            modalState={modalState}
            itemData={itemData}
            eventsInfo={data.eventsInfo.editDefectsEvents}
            onAcceptHypothesis={acceptSuggestedHypothesis}
          />
        ),
      },
    ];
    if (preparedHistoryLineItems.length > 0) {
      tabsData.push({
        id: COPY_FROM_HISTORY_LINE,
        shouldShow: !isBulkOperation,
        isOpen: activeTab === COPY_FROM_HISTORY_LINE,
        title: formatMessage(messages.copyFromHistoryLine),
        content: (
          <CopyFromHistoryLine
            items={preparedHistoryLineItems}
            itemData={itemData}
            modalState={modalState}
            setModalState={setModalState}
            windowSize={windowSize}
            eventsInfo={data.eventsInfo.editDefectsEvents}
            activeProject={activeProject}
          />
        ),
      });
    }
    return tabsData;
  };

  const hotKeyAction = {
    ctrlEnter: applyChanges,
  };

  const executionSection = (bench) => (
    <ExecutionSection
      modalState={modalState}
      setModalState={setModalState}
      isBulkOperation={isBulkOperation}
      eventsInfo={data.eventsInfo.editDefectsEvents}
      benchMode={bench}
    />
  );

  // Bench-mode dark header: the identity bar. Real item name, real status and
  // the SAVED issue type from RP entities. The stock branch keeps the plain
  // "Select defect" string.
  const getBenchHeaderTitle = () => {
    if (isBulkOperation) {
      const count = modalState.currentTestItems.length;
      const typeCount = distinctSavedTypeCount(modalState.currentTestItems);
      const sharedType =
        typeCount === 1
          ? getDefectType(
              modalState.currentTestItems.find((i) => i.issue?.issueType).issue.issueType,
            )
          : null;
      return (
        <div className={cx('bench-identity')}>
          <span className={cx('bi-cap')}>{formatMessage(messages.benchIdentityCap)}</span>
          <span className={cx('bi-name')}>
            {formatMessage(messages.benchBulkIdentityName, { count })}
          </span>
          {sharedType ? (
            <span className={cx('bi-issue')}>
              <span className={cx('bi-dot')} style={{ background: sharedType.color }} />
              {sharedType.longName}
            </span>
          ) : (
            typeCount > 1 && (
              <span className={cx('bi-status')}>
                {formatMessage(messages.benchBulkMixedTypes)}
              </span>
            )
          )}
        </div>
      );
    }
    const item = modalState.currentTestItems[0] || itemData;
    const savedType = item.issue?.issueType ? getDefectType(item.issue.issueType) : null;
    return (
      <div className={cx('bench-identity')}>
        <span className={cx('bi-cap')}>{formatMessage(messages.benchIdentityCap)}</span>
        <span className={cx('bi-name')} title={item.name}>
          {middleTruncate(item.name)}
        </span>
        {item.status && <span className={cx('bi-status')}>{item.status}</span>}
        {savedType && (
          <span className={cx('bi-issue')}>
            <span className={cx('bi-dot')} style={{ background: savedType.color }} />
            {savedType.longName}
          </span>
        )}
      </div>
    );
  };

  const benchChrome = benchActive || benchPending || benchEmpty || benchBulk;
  return (
    <DarkModalLayout
      headerTitle={benchChrome ? getBenchHeaderTitle() : formatMessage(messages.selectDefect)}
      modalHasChanges={modalHasChanges}
      hotKeyAction={hotKeyAction}
      modalNote={formatMessage(messages.modalNote)}
      sideSection={benchChrome ? null : executionSection(false)}
      footer={
        benchChrome ? null : (
          <MakeDecisionFooter
            buttons={getFooterButtons()}
            modalState={modalState}
            isBulkOperation={isBulkOperation}
            setModalState={setModalState}
            modalHasChanges={modalHasChanges}
            eventsInfo={data.eventsInfo.editDefectsEvents}
          />
        )
      }
    >
      {benchBulk ? (
        <BulkBench
          suggestedItems={modalState.suggestedItems}
          mlResolved={mlResolved}
          modalState={modalState}
          setModalState={setModalState}
          onApply={applyChanges}
          onCancel={() => dispatch(hideModalAction())}
          modalHasChanges={modalHasChanges}
          scopeSection={executionSection(true)}
          scopeRef={scopeRef}
        />
      ) : benchPending ? (
        <div className={cx('bench-pending')}>
          <SpinningPreloader />
        </div>
      ) : benchActive || benchEmpty ? (
        <Bench
          suggestedItems={modalState.suggestedItems}
          currentItem={modalState.currentTestItems[0]}
          emptyNoSignal={benchEmpty}
          emptyStillWorking={suggestStillWorking}
          modalState={modalState}
          setModalState={setModalState}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onApply={applyChanges}
          onCancel={() => dispatch(hideModalAction())}
          modalHasChanges={modalHasChanges}
          onAdoptRubric={acceptSuggestedHypothesis}
          scopeSection={executionSection(true)}
          scopeRef={scopeRef}
          scopeValue={modalState.optionValue}
          isBulkOperation={isBulkOperation}
          eventsInfo={data.eventsInfo.editDefectsEvents}
        />
      ) : (
        <MakeDecisionTabs
          tabs={getMakeDecisionTabs(windowSize)}
          toggleTab={setActiveTab}
          suggestedItems={modalState.suggestedItems}
          loadingMLSuggest={loadingMLSuggest}
          modalState={modalState}
          setModalState={setModalState}
          itemData={itemData}
          isBulkOperation={isBulkOperation}
          isAnalyzerAvailable={isAnalyzerAvailable}
          isMLSuggestionsAvailable={isMLSuggestionsAvailable}
        />
      )}
    </DarkModalLayout>
  );
};
MakeDecision.propTypes = {
  data: PropTypes.shape({
    items: PropTypes.array,
    fetchFunc: PropTypes.func,
    eventsInfo: PropTypes.object,
    clusterIds: PropTypes.arrayOf(PropTypes.number),
  }).isRequired,
};
export const MakeDecisionModal = withModal(MAKE_DECISION_MODAL)(MakeDecision);
