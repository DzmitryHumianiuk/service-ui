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
 * One decision fans out over every selected test, so the single-item anatomy
 * (journey, story, three advisors) does not apply here. What remains is the
 * selection itself, the analyzer offer for the shared failure group when the
 * whole selection is one Unique Errors cluster, and the same manual verdict
 * bar the Bench uses. The commit path is the stock bulk path, wire-identical:
 * selectManualChoice + commentOption + applyChanges.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames/bind';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { defectTypesSelector, getDefectTypeSelector } from 'controllers/project';
import { MarkdownEditor } from 'components/main/markdown';
import { COMMON_LOCALE_KEYS } from 'common/constants/localization';
import { messages } from '../messages';
import {
  ADD_FOR_ALL,
  CLEAR_FOR_ALL,
  NOT_CHANGED_FOR_ALL,
  REPLACE_FOR_ALL,
  SELECT_DEFECT_MANUALLY,
} from '../constants';
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

export const BulkBench = ({
  suggestedItems,
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

  const items = modalState.currentTestItems || [];
  const armedIssue = modalState.selectManualChoice.issue || {};
  const armedType = armedIssue.issueType || '';
  const comment = armedIssue.comment || '';

  const [pickerOpen, setPickerOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentKey, setCommentKey] = useState(0);
  const [optOpen, setOptOpen] = useState(false);
  // 'you' when the type came from the picker, 'offer' when an analyzer offer
  // row was clicked. Drives the small provenance tag only, never the payload.
  const [armedFrom, setArmedFrom] = useState('');
  const pickerWrapRef = useRef(null);
  const optWrapRef = useRef(null);

  const defectName = (locator) => getDefectType(locator)?.longName || locator || '';
  const defectColor = (locator) => getDefectType(locator)?.color || '#76839b';

  // The analyzer offer rows: one per offered defect type, best similarity wins.
  // Offers exist only when the whole selection shares one cluster (the parent
  // fetches URLS.MLSuggestionsByCluster then); otherwise this list is empty.
  const offers = useMemo(() => {
    const byType = new Map();
    (suggestedItems || []).forEach((s) => {
      const issueType = s.suggestRs?.issueType;
      if (!issueType) {
        return;
      }
      const prev = byType.get(issueType);
      if (!prev || (s.suggestRs.matchScore || 0) > (prev.score || 0)) {
        byType.set(issueType, { issueType, score: s.suggestRs.matchScore });
      }
    });
    return Array.from(byType.values());
  }, [suggestedItems]);

  // Outside click closes the floating panels (the modal's Esc handling is the
  // dark layout's own).
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
  // The stored option is flipped to the matching default when the text state
  // crosses that line, so the payload never carries a stale combination.
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

  const armType = (issueType, from) => {
    setModalState({
      decisionType: SELECT_DEFECT_MANUALLY,
      issueActionType: '',
      selectManualChoice: { issue: { ...armedIssue, issueType } },
    });
    setArmedFrom(from);
  };

  const setComment = (value) => {
    setModalState({
      decisionType: SELECT_DEFECT_MANUALLY,
      selectManualChoice: { issue: { ...armedIssue, comment: (value || '').trim() } },
    });
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

  return (
    <div className={cx('bench-modal')}>
      {/* the selection: every test this one decision will touch */}
      <div className={cx('band', 'band-grey', 'bulk-list')}>
        <div className={cx('bl-cap')}>{formatMessage(messages.benchBulkListCap)}</div>
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

      {/* the analyzer offer for the shared failure group (single-cluster only) */}
      {offers.length > 0 && (
        <div className={cx('band', 'band-white', 'bulk-offer')}>
          <div className={cx('bo-head')}>{formatMessage(messages.benchBulkOfferHead)}</div>
          <div className={cx('bo-sub')}>{formatMessage(messages.benchBulkOfferSub)}</div>
          <div className={cx('bo-rows')}>
            {offers.map((offer) => (
              <button
                type="button"
                key={offer.issueType}
                className={cx('bo-row', {
                  armed: armedFrom === 'offer' && armedType === offer.issueType,
                })}
                onClick={() => armType(offer.issueType, 'offer')}
              >
                <span className={cx('dot')} style={{ background: defectColor(offer.issueType) }} />
                <span className={cx('bo-name')}>{defectName(offer.issueType)}</span>
                {scoreToAlike(offer.score) && (
                  <span className={cx('bo-alike')}>
                    {formatMessage(messages.benchLogsAlike, { score: scoreToAlike(offer.score) })}
                  </span>
                )}
              </button>
            ))}
          </div>
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
          {armedType && armedFrom && (
            <span className={cx('prov-tag')}>
              {formatMessage(
                armedFrom === 'offer' ? messages.benchProvFromOffer : messages.benchProvYouPicked,
              )}
            </span>
          )}
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
  modalHasChanges: false,
  scopeSection: null,
  scopeRef: null,
};

// The one honest mixed-type marker for the dark identity bar, computed where the
// header is built (makeDecisionModal). Exported so the count logic lives once.
export const distinctSavedTypeCount = (items) =>
  new Set((items || []).map((i) => i.issue?.issueType).filter(Boolean)).size;
