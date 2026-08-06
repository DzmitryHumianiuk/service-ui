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

/*
 * The bulk Bench: the light surface for a multi-select Edit Defects call.
 *
 * A Unique Errors cluster and the analyzer's launch group are the SAME set:
 * both come from the error-hash `_group()` (the cluster route mints its id
 * from the group representative's error_hash). So a selection that sits in
 * one cluster is a decision about one failure group, and it gets the group
 * anatomy: the shared failure's group count from the representative's
 * Inspector journey, the analyzer's story when it already decided, and the
 * same three-check offer cards the single Bench shows (classified from the
 * cluster suggest reply, which carries the full band contract). A selection
 * spanning several clusters gets no group pretense: an honest line and the
 * manual verdict bar.
 *
 * The commit path is the stock bulk path, wire-identical: selectManualChoice
 * + commentOption + applyChanges. Arming a card only prefills that choice.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Parser from 'html-react-parser';
import classNames from 'classnames/bind';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { defectTypesSelector, getDefectTypeSelector } from 'controllers/project';
import { projectInfoIdSelector } from 'controllers/project/selectors';
import { DefectTypeItem } from 'pages/inside/common/defectTypeItem';
import { MarkdownEditor } from 'components/main/markdown';
import OpenInNewTabIcon from 'common/img/open-in-new-tab-inline.svg';
import { COMMON_LOCALE_KEYS } from 'common/constants/localization';
import { messages } from '../messages';
import {
  ADD_FOR_ALL,
  CLEAR_FOR_ALL,
  NOT_CHANGED_FOR_ALL,
  REPLACE_FOR_ALL,
  SELECT_DEFECT_MANUALLY,
} from '../constants';
import {
  BANDS,
  PROVENANCE,
  getInspectorJourneyApiUrl,
  getInspectorJourneyUrl,
  getInspectorJourneyUrlForItem,
  isRubricHypothesis,
  parseBand,
  parseExplanation,
  parseProvenance,
} from '../analyzerSuggestionMeta';
import styles from './bench.scss';

const cx = classNames.bind(styles);

const middleTruncate = (name, max = 88) => {
  if (!name || name.length <= max) {
    return name;
  }
  const head = Math.ceil((max - 3) / 2);
  const tail = Math.floor((max - 3) / 2);
  return `${name.slice(0, head)}...${name.slice(name.length - tail)}`;
};

const firstErrorLine = (logs) => {
  const message = (logs || []).map((log) => log.message || '').find((m) => m.length);
  return message ? message.split('\n').find((l) => l.length) || '' : '';
};

const scoreToAlike = (matchScore) =>
  typeof matchScore === 'number' ? (matchScore / 100).toFixed(2) : '';

const CornerLink = ({ href, label }) =>
  href ? (
    <a
      className={cx('insp-link', 'corner')}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {label}{' '}
      <span className={cx('insp-ico')} aria-hidden>
        {Parser(OpenInNewTabIcon)}
      </span>
    </a>
  ) : null;
CornerLink.propTypes = { href: PropTypes.string, label: PropTypes.string };
CornerLink.defaultProps = { href: null, label: '' };

export const BulkBench = ({
  suggestedItems,
  mlResolved,
  modalState,
  setModalState,
  onApply,
  onCancel,
  modalHasChanges,
  scopeSection,
  scopeRef,
}) => {
  const { formatMessage } = useIntl();
  const getDefectType = useSelector(getDefectTypeSelector);
  const defectTypes = useSelector(defectTypesSelector);
  // Frozen to the mount frame for the same reason as the single Bench (ng51):
  // an in-app navigation updates redux immediately while the modal's items are
  // fixed at open, and the journey fetch must never pair a fresh project with
  // the items of the previous page.
  const liveProjectId = useSelector(projectInfoIdSelector);
  const [projectId] = useState(liveProjectId);

  const items = useMemo(() => modalState.currentTestItems || [], [
    modalState.currentTestItems,
  ]);
  const armedIssue = modalState.selectManualChoice.issue || {};
  const armedType = armedIssue.issueType || '';
  const comment = armedIssue.comment || '';

  const [pickerOpen, setPickerOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentKey, setCommentKey] = useState(0);
  const [optOpen, setOptOpen] = useState(false);
  const [commentDirty, setCommentDirty] = useState(false);
  const [commentKept, setCommentKept] = useState(false);
  // null | 'you' | 'past' | 'similar' | 'ai' — where the armed type came from.
  // Drives the ring on the armed card and the small provenance tag only.
  const [armedFrom, setArmedFrom] = useState(null);
  const [prefillNote, setPrefillNote] = useState(null); // 'offer' | 'ai' | null
  const pickerWrapRef = useRef(null);
  const optWrapRef = useRef(null);

  const defectName = (locator) => getDefectType(locator)?.longName || locator || '';
  const defectColor = (locator) => getDefectType(locator)?.color || '#76839b';

  // One cluster selected = one exact failure group; several = no group pretense.
  const clusterIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.clusterId).filter(Boolean))),
    [items],
  );
  const oneGroup = clusterIds.length === 1;
  const manyGroups = clusterIds.length > 1;

  // ---- the representative's journey: group size + the analyzer's own story ----
  // Fetched only when the selection is one failure group; the journey belongs to
  // the first selected member, and the grouping/decision it carries describe the
  // shared failure signature (same `_group()` on the analyzer side).
  const [journey, setJourney] = useState(null);
  const repItem = items[0] || null;
  const repItemId = repItem && (repItem.id || repItem.itemId);
  useEffect(() => {
    if (!oneGroup) {
      return undefined;
    }
    const apiUrl = getInspectorJourneyApiUrl(projectId, repItemId);
    if (!apiUrl) {
      return undefined;
    }
    let cancelled = false;
    window
      .fetch(apiUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setJourney(d && typeof d === 'object' ? d : null);
        }
      })
      .catch(() => {
        // No record or unreachable: the group line and story are simply omitted.
        if (!cancelled) {
          setJourney(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, repItemId, oneGroup]);

  const decision = journey?.decision || null;
  // The story line renders only for a real auto decision whose label resolves to
  // a project defect type (ng40 lesson: resolve from the specific locator).
  const storyDefect =
    decision && decision.band === 'auto' && decision.predicted_label
      ? getDefectType(decision.predicted_label)
      : null;

  // ---- classify the cluster suggest rows into the three checks --------------
  // Same reading as the single Bench: band=auto row is the precedent, band=
  // suggest rows are the similar failures, the rubric row is the AI guess, and
  // below-line rows were looked at and declined.
  const parsed = useMemo(
    () =>
      (suggestedItems || []).map((s) => ({
        res: s.testItemResource,
        suggestRs: s.suggestRs,
        band: parseBand(s.suggestRs),
        rubric: isRubricHypothesis(s.suggestRs),
        issueType: s.suggestRs.issueType,
        score: s.suggestRs.matchScore,
        explanation: parseExplanation(s.suggestRs),
        provenance: parseProvenance(s.suggestRs),
      })),
    [suggestedItems],
  );
  const rubricRow = parsed.find((p) => p.rubric) || null;
  const classical = parsed.filter((p) => !p.rubric);
  const precedentRow = classical.find((p) => p.band === BANDS.AUTO) || null;
  const topSuggest = classical.find((p) => p.band === BANDS.SUGGEST) || null;
  const belowRows = classical.filter((p) => p.band === BANDS.BELOW_SUGGEST);
  const hasOffers = !!(precedentRow || topSuggest || rubricRow);

  // Outside click closes the floating panels.
  useEffect(() => {
    const onDocClick = (e) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
      if (optWrapRef.current && !optWrapRef.current.contains(e.target)) {
        setOptOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Same rule as the stock bulk footer: no comment text limits the options to
  // "not changed" / "cleared"; typed text limits them to "added" / "replaced".
  const untouchedOptions = [NOT_CHANGED_FOR_ALL, CLEAR_FOR_ALL];
  const touchedOptions = [ADD_FOR_ALL, REPLACE_FOR_ALL];
  const commentOptions = comment ? touchedOptions : untouchedOptions;
  useEffect(() => {
    if (!comment && touchedOptions.includes(modalState.commentOption)) {
      setModalState({ commentOption: NOT_CHANGED_FOR_ALL });
    }
    if (comment && untouchedOptions.includes(modalState.commentOption)) {
      setModalState({ commentOption: ADD_FOR_ALL });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment]);

  const armType = (issueType, from, extras = {}) => {
    setModalState({
      decisionType: SELECT_DEFECT_MANUALLY,
      issueActionType: '',
      selectManualChoice: { issue: { ...armedIssue, issueType, ...extras } },
    });
    setArmedFrom(from);
  };

  // Card arm: the whole card is the target (verdict 6.1). The matched test's own
  // saved comment (or the AI rationale) prefills the reason ONLY while the human
  // has not typed one; an edited comment is kept and says so (dirty rule).
  const adoptCard = (row, kind) => () => {
    const prefill = kind === 'ai' ? row.explanation : row.res?.issue?.comment;
    if (!commentDirty && prefill) {
      armType(row.issueType, kind, { comment: prefill });
      setPrefillNote(kind === 'ai' ? 'ai' : 'offer');
      setCommentKept(false);
      setCommentOpen(true);
      setCommentKey((k) => k + 1);
    } else {
      armType(row.issueType, kind);
      if (commentDirty && comment) {
        setCommentKept(true);
      }
    }
  };
  const armOnCardClick = (fn) => (e) => {
    if (e.target.closest('a, button')) {
      return;
    }
    fn();
  };

  const setComment = (value) => {
    setCommentDirty(true);
    setCommentKept(false);
    setPrefillNote(null);
    setModalState({
      decisionType: SELECT_DEFECT_MANUALLY,
      selectManualChoice: { issue: { ...armedIssue, comment: (value || '').trim() } },
    });
  };

  const renderPill = (locator) =>
    locator ? <DefectTypeItem type={locator} className={cx('defect-pill')} /> : null;

  const provTag = () => {
    if (!armedType || !armedFrom) {
      return null;
    }
    let text;
    if (armedFrom === 'past') {
      text = formatMessage(messages.benchProvFromPrecedent);
    } else if (armedFrom === 'similar') {
      text = formatMessage(messages.benchProvFromSimilarity, {
        score: scoreToAlike(topSuggest && topSuggest.score),
      });
    } else if (armedFrom === 'ai') {
      text = formatMessage(messages.benchProvFromAi);
    } else {
      text = formatMessage(messages.benchProvYouPicked);
    }
    return <span className={cx('prov-tag', { picked: armedFrom === 'you' })}>{text}</span>;
  };

  const similarSrcLine = (row) => {
    if (row.provenance === PROVENANCE.HUMAN) {
      return formatMessage(messages.benchBulkDecidedByPerson);
    }
    if (row.provenance === PROVENANCE.AUTO) {
      return formatMessage(messages.benchBulkDecidedAuto);
    }
    return formatMessage(messages.benchBulkUnlabeled);
  };

  const recapText = armedType
    ? [
        formatMessage(messages.benchBulkRecap, {
          defect: defectName(armedType),
          count: items.length,
        }),
        modalState.commentOption !== NOT_CHANGED_FOR_ALL
          ? `${formatMessage(messages.commentWill)} ${formatMessage(
              messages[modalState.commentOption],
            )}.`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  const declinedList = belowRows
    .map((r) => `${defectName(r.issueType)} (${scoreToAlike(r.score)})`)
    .join(', ');

  return (
    <div className={cx('bench-modal')}>
      {/* the selection: every test this one decision will touch */}
      <div className={cx('band', 'band-grey', 'bulk-list')}>
        <div className={cx('bl-cap')}>{formatMessage(messages.benchBulkListCap)}</div>
        {/* The cue comes from the selection itself (one cluster = one exact
            failure signature). The journey's launch_group is NOT used for the
            count: it is persisted per analyze batch and can undercount the
            cluster the page shows. */}
        {oneGroup && (
          <div className={cx('bl-group-line')}>
            {formatMessage(messages.benchBulkOneGroup)}
          </div>
        )}
        {manyGroups && (
          <div className={cx('bl-group-line', 'many')}>
            {formatMessage(messages.benchBulkManyGroups, { count: clusterIds.length })}
          </div>
        )}
        <div className={cx('bl-rows')}>
          {items.map((item) => {
            const saved = item.issue?.issueType ? getDefectType(item.issue.issueType) : null;
            const logLine = firstErrorLine(item.logs);
            return (
              <div className={cx('bl-row')} key={item.id}>
                <div className={cx('bl-line')}>
                  <span className={cx('bl-name')} title={item.name}>
                    {middleTruncate(item.name)}
                  </span>
                  {item.status && <span className={cx('bl-status')}>{item.status}</span>}
                  {saved && (
                    <span className={cx('bl-type')}>
                      <span className={cx('dot')} style={{ background: saved.color }} />
                      {saved.longName}
                    </span>
                  )}
                </div>
                {logLine && <div className={cx('bl-log')}>{logLine}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* one failure group: the analyzer's story + the three offer checks */}
      {oneGroup && (hasOffers || storyDefect || mlResolved) && (
        <div className={cx('band', 'band-white', 'bench-region')}>
          {storyDefect && (
            <div className={cx('region-head', 'agree')}>
              <span className={cx('headline')}>
                {formatMessage(messages.benchBulkStoryAuto, { defect: storyDefect.longName })}
              </span>
              <CornerLink
                href={getInspectorJourneyUrlForItem(projectId, repItem)}
                label={formatMessage(messages.benchBulkInspector)}
              />
            </div>
          )}
          {hasOffers ? (
            <>
              <div className={cx('offers-cap')}>
                {formatMessage(messages.benchBulkOffersCap)}
              </div>
              <div className={cx('bench-row')}>
                {precedentRow && (
                  <div
                    className={cx('check', 'auto', 'actionable', { armed: armedFrom === 'past' })}
                    role="button"
                    tabIndex={0}
                    onClick={armOnCardClick(adoptCard(precedentRow, 'past'))}
                  >
                    <span className={cx('edge')} />
                    <CornerLink
                      href={getInspectorJourneyUrl(precedentRow.suggestRs)}
                      label={formatMessage(messages.benchWhy)}
                    />
                    <div className={cx('method')}>
                      <span className={cx('gl')}>◆</span> {formatMessage(messages.benchCheckPast)}
                    </div>
                    <div className={cx('role')}>{formatMessage(messages.benchBulkPastRole)}</div>
                    <div className={cx('verd-pill')}>{renderPill(precedentRow.issueType)}</div>
                    <div className={cx('strength')}>
                      {formatMessage(messages.benchCheckPastStrong)}
                    </div>
                  </div>
                )}
                {topSuggest && (
                  <div
                    className={cx('check', 'suggest', 'actionable', {
                      armed: armedFrom === 'similar',
                    })}
                    role="button"
                    tabIndex={0}
                    onClick={armOnCardClick(adoptCard(topSuggest, 'similar'))}
                  >
                    <span className={cx('edge')} />
                    <CornerLink
                      href={getInspectorJourneyUrl(topSuggest.suggestRs)}
                      label={formatMessage(messages.benchWhy)}
                    />
                    <div className={cx('method')}>
                      <span className={cx('gl')}>≈</span>{' '}
                      {formatMessage(messages.benchCheckSimilar)}
                    </div>
                    <div className={cx('role')}>
                      {formatMessage(messages.benchCheckSimilarRole)}
                    </div>
                    <div className={cx('verd-pill')}>{renderPill(topSuggest.issueType)}</div>
                    <div className={cx('strength')}>
                      {formatMessage(messages.benchLogsAlike, {
                        score: scoreToAlike(topSuggest.score),
                      })}
                    </div>
                    <div className={cx('prov')}>{similarSrcLine(topSuggest)}</div>
                  </div>
                )}
                {rubricRow && (
                  <div
                    className={cx('check', 'rubric', 'actionable', { armed: armedFrom === 'ai' })}
                    role="button"
                    tabIndex={0}
                    onClick={armOnCardClick(adoptCard(rubricRow, 'ai'))}
                  >
                    <span className={cx('edge')} />
                    <div className={cx('method')}>
                      <span className={cx('gl')}>✳</span> {formatMessage(messages.benchCheckAi)}
                    </div>
                    <div className={cx('role')}>{formatMessage(messages.benchCheckAiRole)}</div>
                    <div className={cx('verd-pill')}>
                      {renderPill(rubricRow.issueType)}
                      <span className={cx('bo-alike')}>
                        {formatMessage(messages.benchBulkAiPct, {
                          pct: Math.round(rubricRow.score || 0),
                        })}
                      </span>
                    </div>
                    {rubricRow.explanation && (
                      <div className={cx('bo-expl')}>{rubricRow.explanation}</div>
                    )}
                  </div>
                )}
              </div>
              {belowRows.length > 0 && (
                <div className={cx('bulk-declined')}>
                  {formatMessage(messages.benchBulkDeclined, { list: declinedList })}
                </div>
              )}
            </>
          ) : (
            // The story banner above IS the stored answer; saying "nothing
            // stored" under it would be a lie. The line renders only when the
            // analyzer has neither a decision nor an offer for this group.
            !storyDefect && (
              <div className={cx('bulk-no-offers')}>
                {formatMessage(messages.benchBulkNoOffers)}
              </div>
            )
          )}
        </div>
      )}

      {/* the verdict bar: same picker, comment and commit the Bench uses */}
      <div className={cx('band', 'band-white', 'verdict-bar')}>
        <div className={cx('vb-verdict-row')}>
          <span className={cx('flabel')}>{formatMessage(messages.benchVbDefect)}</span>
          <span className={cx('picker-anchor')} ref={pickerWrapRef}>
            <span
              className={cx('defect-select', { empty: !armedType })}
              onClick={() => setPickerOpen((o) => !o)}
              role="button"
              tabIndex={0}
            >
              {armedType ? (
                <>
                  <span className={cx('dot')} style={{ background: defectColor(armedType) }} />
                  {defectName(armedType)}
                </>
              ) : (
                formatMessage(messages.benchVbChooseDefect)
              )}
              <span className={cx('caret')} aria-hidden>
                ▾
              </span>
            </span>
            {pickerOpen && (
              <div className={cx('picker-pop')}>
                <div className={cx('picker-head')}>{formatMessage(messages.benchManualHead)}</div>
                <div className={cx('pick-groups')}>
                  {Object.keys(defectTypes).map((group) => (
                    <div className={cx('pill-row')} key={group}>
                      {defectTypes[group].map((t) => (
                        <button
                          type="button"
                          key={t.locator}
                          className={cx('pick-pill', { sel: armedType === t.locator })}
                          onClick={() => {
                            armType(t.locator, 'you');
                            setPickerOpen(false);
                          }}
                        >
                          <span className={cx('dot')} style={{ background: t.color }} />
                          {t.longName}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div className={cx('manual-help')}>{formatMessage(messages.benchManualHelp)}</div>
              </div>
            )}
          </span>
          {provTag()}
        </div>

        {/* comment: collapsed row; in bulk the fan-out rule sits next to the editor */}
        {commentOpen ? (
          <div className={cx('comment-pane')}>
            <div className={cx('cmt-head')}>
              <span>{formatMessage(messages.comment)}</span>
              <span className={cx('cmt-opt-anchor')} ref={optWrapRef}>
                <button
                  type="button"
                  className={cx('cmt-opt-btn')}
                  onClick={() => setOptOpen((o) => !o)}
                >
                  {formatMessage(messages.commentWill)}{' '}
                  {formatMessage(messages[modalState.commentOption])}
                  <span className={cx('caret')} aria-hidden>
                    ▾
                  </span>
                </button>
                {optOpen && (
                  <div className={cx('cmt-opt-pop')}>
                    {commentOptions.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={cx('cmt-opt-item', {
                          sel: modalState.commentOption === option,
                        })}
                        onClick={() => {
                          setModalState({ commentOption: option });
                          setOptOpen(false);
                        }}
                      >
                        {formatMessage(messages.commentWill)} {formatMessage(messages[option])}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            </div>
            {prefillNote && (
              <div className={cx('cmt-prefill-note')}>
                {formatMessage(
                  prefillNote === 'ai'
                    ? messages.benchCmtPrefillNote
                    : messages.benchBulkCmtFromOffer,
                )}
              </div>
            )}
            {commentKept && (
              <div className={cx('cmt-prefill-note')}>
                {formatMessage(messages.benchProvCommentKept)}
              </div>
            )}
            <MarkdownEditor
              key={commentKey}
              value={comment}
              onChange={setComment}
              placeholder={formatMessage(messages.benchCmtPlaceholder)}
            />
          </div>
        ) : (
          <button
            type="button"
            className={cx('cmt-collapsed')}
            onClick={() => {
              setCommentOpen(true);
              setCommentKey((k) => k + 1);
            }}
          >
            <span aria-hidden>+</span> {formatMessage(messages.benchCmtAddReason)}
          </button>
        )}

        {/* commit row: bulk scope left, Cancel + Apply right */}
        <div className={cx('commit-row')}>
          <div className={cx('commit-left')}>
            {/* executionSection stays mounted (renders nothing here) only for the
                bulkLastLogs fetch that feeds the selection list above. */}
            <div className={cx('exec-mount')} ref={scopeRef}>
              {scopeSection}
            </div>
            <span className={cx('scope-only')}>
              {formatMessage(messages.benchBulkScopeAll, { count: items.length })}
            </span>
          </div>
          <div className={cx('commit-actions')}>
            <button type="button" className={cx('btn', 'btn-ghost')} onClick={onCancel}>
              {formatMessage(COMMON_LOCALE_KEYS.CANCEL)}
            </button>
            <button
              type="button"
              className={cx('btn', 'btn-teal')}
              disabled={!modalHasChanges}
              onClick={onApply}
            >
              {formatMessage(messages.apply)}
            </button>
          </div>
        </div>
        {recapText && <div className={cx('vb-recap')}>{recapText}</div>}
      </div>
    </div>
  );
};
BulkBench.propTypes = {
  suggestedItems: PropTypes.array,
  mlResolved: PropTypes.bool,
  modalState: PropTypes.object.isRequired,
  setModalState: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  modalHasChanges: PropTypes.bool,
  scopeSection: PropTypes.node,
  scopeRef: PropTypes.object,
};
BulkBench.defaultProps = {
  suggestedItems: [],
  mlResolved: false,
  modalHasChanges: false,
  scopeSection: null,
  scopeRef: null,
};

// The one honest mixed-type marker for the dark identity bar, computed where the
// header is built (makeDecisionModal). Exported so the count logic lives once.
export const distinctSavedTypeCount = (items) =>
  new Set((items || []).map((i) => i.issue?.issueType).filter(Boolean)).size;
