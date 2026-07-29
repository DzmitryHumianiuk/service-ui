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
 * The Bench: a data-driven re-skin of the Make Decision execution/suggestions area.
 * It reads the SAME live data the stock modal already loads (currentTestItems[0].logs
 * from bulkLastLogs, suggestedItems from URLS.MLSuggestions, plus one Inspector journey
 * fetch) and commits through the SAME wire-identical path (selectManualChoice /
 * suggestChoice + applyChanges), so no analyzer round-trip or save behaviour changes.
 * Only the presentation and the way a decision is reached are new.
 * Design authority: docs/consilium-make-decision/gpos-VERDICT2.md.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Parser from 'html-react-parser';
import classNames from 'classnames/bind';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { defectTypesSelector, getDefectTypeSelector } from 'controllers/project';
import { projectInfoIdSelector } from 'controllers/project/selectors';
import { activeProjectSelector } from 'controllers/user';
import { DefectTypeItem } from 'pages/inside/common/defectTypeItem';
import { MarkdownEditor } from 'components/main/markdown';
import { ENTER_KEY_CODE, ESCAPE_KEY_CODE } from 'common/constants/keyCodes';
import { fetch } from 'common/utils';
import { URLS } from 'common/urls';
import OpenInNewTabIcon from 'common/img/open-in-new-tab-inline.svg';
import { COMMON_LOCALE_KEYS } from 'common/constants/localization';
import { DEFECT_TYPES_MAP, TO_INVESTIGATE_LOCATOR_PREFIX } from 'common/constants/defectTypes';
import { messages } from '../messages';
import {
  ACTIVE_TAB_MAP,
  ERROR_LOGS_SIZE,
  MACHINE_LEARNING_SUGGESTIONS,
  SELECT_DEFECT_MANUALLY,
} from '../constants';
import {
  BACKING,
  BANDS,
  MISMATCH,
  PROVENANCE,
  canLlmStillAnswer,
  classicalVerdict,
  deriveBanner,
  deriveJourneyOwnGuess,
  deriveMismatchClauses,
  deriveOfferBacking,
  emptyReplyVariant,
  evidenceBaseCount,
  actOneExplanation,
  groundQuote,
  offersRestOnSimilarityAlone,
  parseFeatures,
  getAnalyzerHealthApiUrl,
  deriveDecisionStory,
  getInspectorJourneyApiUrl,
  getInspectorJourneyUrl,
  getInspectorJourneyUrlForItem,
  isBurstGroup,
  isDecisionFresh,
  isDeclineRow,
  isRubricHypothesis,
  normalizeLine,
  parseBand,
  parseConfidence,
  parseExplanation,
  parseExplKind,
  parseNgVersion,
  parseOfferedLabelProbability,
  parseProvenance,
} from '../analyzerSuggestionMeta';
import styles from './bench.scss';

const cx = classNames.bind(styles);

// ---- log helpers (client-side v1 raw-line diff, tokens masked for ALIGNMENT only) ----
const toLines = (logs) =>
  (logs || [])
    .slice(0, ERROR_LOGS_SIZE)
    .flatMap((log) =>
      (log.message || '')
        .split('\n')
        .filter((t) => t.length)
        .map((text) => ({ text, id: log.id })),
    );

const scoreToAlike = (matchScore) =>
  typeof matchScore === 'number' ? (matchScore / 100).toFixed(2) : '';

// Banner tint by id (verdict 5, mockup .banner classes): lean states wear the
// topaz `.agree` tint, differ states the amber `.unsure` tint, every other id the
// neutral grey region-head. The banner reuses the .region-head/.headline layout.
const BANNER_TINT = { B1: 'agree', B3: 'agree', B2: 'unsure', B4e: 'unsure' };

// The analyzer's burst share gate (grouping.BURST_X = 0.4: a fresh fingerprint
// covering more than 40% of the launch's failures reads as one system issue).
const BENCH_BURST_SHARE_GATE_PCT = 40;

// R1 sub-line: exception class from the first error line, file:line from the first
// stack frame. Rendered only when actually found in the parsed log (real data only).
const EXC_CLASS_RE = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:Exception|Error|Failure))\b/;
const FRAME_LOC_RE = /\(([\w$.-]+:\d+)\)/;
const parseFailureSub = (lines) => {
  if (!lines.length) {
    return '';
  }
  const clsMatch = lines[0].text.match(EXC_CLASS_RE);
  let loc = '';
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].text.match(FRAME_LOC_RE);
    if (m) {
      loc = m[1];
      break;
    }
  }
  return [clsMatch && clsMatch[1], loc].filter(Boolean).join(' · ');
};

const InspectorLink = ({ href, label, corner }) =>
  href ? (
    <a
      className={cx('insp-link', { corner })}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}{' '}
      <span className={cx('insp-ico')} aria-hidden>
        {Parser(OpenInNewTabIcon)}
      </span>
    </a>
  ) : null;
InspectorLink.propTypes = { href: PropTypes.string, label: PropTypes.string, corner: PropTypes.bool };
InspectorLink.defaultProps = { href: null, label: '', corner: false };

export const Bench = ({
  suggestedItems,
  currentItem,
  emptyNoSignal,
  emptyStillWorking,
  modalState,
  setModalState,
  activeTab,
  setActiveTab,
  onApply,
  onCancel,
  modalHasChanges,
  onAdoptRubric,
  scopeSection,
  scopeRef,
  isBulkOperation,
}) => {
  const { formatMessage } = useIntl();
  const getDefectType = useSelector(getDefectTypeSelector);
  const defectTypes = useSelector(defectTypesSelector);
  // Freeze the numeric project id to this modal's mount frame. The item the modal
  // acts on (modalState.currentTestItems, set once at open) is frozen too, so the
  // project must be pinned to the SAME frame. Reading it live from redux caused a
  // soft-navigation desync: on an in-app route change the redux project id updates
  // immediately while the item prop still holds the previously-viewed item, so the
  // journey fetch issued a mismatched pair (fresh project + stale item), 404'd, and
  // mislabelled the item as a no-record decision (O9). Case: migrated-project/5302
  // opened after viewing webshop-ui/2958 fetched /item/{newProject}/2958 → 404.
  const liveProjectId = useSelector(projectInfoIdSelector);
  const [projectId] = useState(liveProjectId);
  const activeProject = useSelector(activeProjectSelector);

  // Log-view deep link for an "item N" mention in the summary: the item's own RP
  // log page, built from its resource path (ancestor chain incl. self) + launchId.
  // A number whose resource we do not have stays plain text (no fabricated link).
  const getItemLogUrl = (res) => {
    if (!res || !res.launchId || !res.path) {
      return null;
    }
    const pathSlashes = String(res.path).replace(/\./g, '/');
    return `/ui/#${activeProject}/launches/all/${res.launchId}/${pathSlashes}/log`;
  };

  const [compare, setCompare] = useState(null); // { res, logs, suggestRs } | null
  const [logOpen, setLogOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [focusDock, setFocusDock] = useState(null);
  const [dockHighlight, setDockHighlight] = useState(''); // defect longName (lower) or ''
  const [verdictProv, setVerdictProv] = useState(null); // {key, params, picked, chosen}
  const [prefillNote, setPrefillNote] = useState(false);
  const [commentDirty, setCommentDirty] = useState(false); // human edited the comment
  const [commentKept, setCommentKept] = useState(false); // re-arm kept the edited text
  const [commentKey, setCommentKey] = useState(0); // forces MarkdownEditor re-mount on prefill
  const [commentOpen, setCommentOpen] = useState(false); // collapsed "Add a reason" row
  const [pickerOpen, setPickerOpen] = useState(false); // floating defect picker panel
  const [storyAiOpen, setStoryAiOpen] = useState(false); // Act 1 AI paragraph Show more
  const [aiOverflow, setAiOverflow] = useState(false); // AI paragraph clamps past 3 lines
  const aiBodyRef = useRef(null);
  const [burstApply, setBurstApply] = useState(false); // C2 focused apply flow
  const [siPickOpen, setSiPickOpen] = useState(false); // SI subtype dropdown in the panel
  const burstPanelRef = useRef(null);
  const siPickRef = useRef(null);
  // Per-neighbour decision provenance fetched from RP: { [itemId]: { user, launchNumber } }.
  // user = the person who set that neighbour's defect (activity log); launchNumber = its
  // run number. Real data only: a missing user/number simply omits that part.
  const [decidedInfo, setDecidedInfo] = useState({});

  // ---- Stage 3: two-tier group override (verdict 6.4) ----------------------
  // tiOn = the C1 "also apply to N still-TI siblings" checkbox. overrideOpen =
  // the decided-members expander. tierAOn = the one auto-decided toggle. tierBIds
  // = the per-member human-decided checkboxes. overrideLive = live RP item
  // resources fetched on first expand (ruling C6: tier is re-derived from live
  // issue + autoAnalyzed, never the analyzer mirror). These three scope inputs
  // (tiOn, tierAOn, tierBIds) compose modalState.selectedItems.
  const [tiOn, setTiOn] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [tierAOn, setTierAOn] = useState(false);
  const [tierBIds, setTierBIds] = useState({});
  const [overrideLive, setOverrideLive] = useState(null); // null = not fetched yet
  const [overrideLoading, setOverrideLoading] = useState(false);

  const defectName = (locator) => getDefectType(locator)?.longName || locator || '';
  const defectColor = (locator) => getDefectType(locator)?.color || '#76839b';

  // ---- classify the analyzer rows into the three checks --------------------
  const parsed = useMemo(
    () =>
      (suggestedItems || []).map((s) => ({
        res: s.testItemResource,
        logs: s.logs,
        suggestRs: s.suggestRs,
        band: parseBand(s.suggestRs),
        rubric: isRubricHypothesis(s.suggestRs),
        issueType: s.suggestRs.issueType,
        score: s.suggestRs.matchScore,
        conf: parseConfidence(s.suggestRs),
        explanation: parseExplanation(s.suggestRs),
        explKind: parseExplKind(s.suggestRs),
        provenance: parseProvenance(s.suggestRs),
        ng: parseNgVersion(s.suggestRs),
      })),
    [suggestedItems],
  );

  const rubricRow = parsed.find((p) => p.rubric) || null;
  const classical = parsed.filter((p) => !p.rubric);
  const autoRow = classical.find((p) => p.band === BANDS.AUTO) || null;
  const suggestRows = classical.filter((p) => p.band === BANDS.SUGGEST);
  const belowRows = classical.filter((p) => p.band === BANDS.BELOW_SUGGEST);
  const precedentRow = autoRow;
  const topSuggest = suggestRows[0] || null;

  // Resolve the real decider + run number for each decision-card neighbour (the
  // matched item). subject_name of the newest user "updateItem" activity is the
  // person; the launch fetch gives the run number. Skipped for unlabelled rows.
  useEffect(() => {
    const rows = [precedentRow, topSuggest].filter(
      (r) => r && (r.provenance === PROVENANCE.HUMAN || r.provenance === PROVENANCE.AUTO),
    );
    let cancelled = false;
    rows.forEach((r) => {
      const id = r.res && r.res.id;
      const launchId = r.res && r.res.launchId;
      if (!id || decidedInfo[id] !== undefined) {
        return;
      }
      const info = {};
      const done = () => {
        if (!cancelled) {
          setDecidedInfo((prev) => ({ ...prev, [id]: info }));
        }
      };
      const activityP =
        r.provenance === PROVENANCE.HUMAN
          ? fetch(URLS.logItemActivity(activeProject, id))
              .then((resp) => {
                const items = (resp && resp.content) || [];
                const hit = items.find(
                  (a) => a.subject_type === 'user' && a.event_name === 'updateItem',
                );
                if (hit) {
                  info.user = hit.subject_name;
                }
              })
              .catch(() => {})
          : Promise.resolve();
      const launchP = launchId
        ? fetch(URLS.launch(activeProject, launchId))
            .then((l) => {
              if (l && l.number != null) {
                info.launchNumber = l.number;
              }
            })
            .catch(() => {})
        : Promise.resolve();
      Promise.all([activityP, launchP]).then(done);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precedentRow && precedentRow.res && precedentRow.res.id, topSuggest && topSuggest.res && topSuggest.res.id]);


  // ---- the current verdict (the choice that Apply will send) ---------------
  const activeChoice = modalState[ACTIVE_TAB_MAP[activeTab]] || {};
  const currentIssue = activeChoice.issue || {};
  const decided = !!(verdictProv && verdictProv.chosen && currentIssue.issueType);

  // ---- the one journey fetch: grouping + decision + llm ---------------------
  // Sourced from the Inspector journey API (analyzer.launch_group), NOT from the
  // fuzzy logSearch list that feeds the Apply-to scope control: the context band
  // must show the same number and members as the Inspector's grouping card, and
  // the same payload carries the cached decision + explainer used by the AI
  // decision summary. One fetch per item, whole payload kept.
  const [journey, setJourney] = useState(null);
  // Status-aware journey fetch (migration item 6): O9 (no record) and O9b (fetch
  // failed) must be distinguishable, so the old silent catch(() => {}) is gone. A
  // 404 is a clean no-record (O9); any other non-ok status, a network error, or an
  // unparseable body is a real failure (O9b, journeyError). journeyResolved gates
  // the story so a late fetch never flashes a wrong O9 headline before it settles.
  const [journeyError, setJourneyError] = useState(false);
  const [journeyResolved, setJourneyResolved] = useState(false);
  // One extra journey read while an explanation is still being written (see the
  // wait state below). Bumped at most once, so this can never become a poll.
  const [journeyRetry, setJourneyRetry] = useState(0);
  const currentItemId = currentItem?.id || currentItem?.itemId;
  useEffect(() => {
    const apiUrl = getInspectorJourneyApiUrl(projectId, currentItemId);
    if (isBulkOperation) {
      return undefined;
    }
    if (!apiUrl) {
      // No addressable journey (missing project/item id): treat as a clean
      // no-record (O9), never a fetch failure.
      setJourney(null);
      setJourneyError(false);
      setJourneyResolved(true);
      return undefined;
    }
    let cancelled = false;
    setJourneyResolved(false);
    setJourneyError(false);
    window
      .fetch(apiUrl)
      .then((r) => {
        if (r.ok) {
          return r.json();
        }
        if (r.status === 404) {
          // The analyzer has no journey for this item: a clean no-record (O9).
          return null;
        }
        const err = new Error(`journey fetch failed: ${r.status}`);
        err.isFetchError = true;
        throw err;
      })
      .then((d) => {
        if (!cancelled) {
          setJourney(d && typeof d === 'object' ? d : null);
          setJourneyResolved(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Network error / non-404 status / bad JSON: O9b, not O9.
          setJourney(null);
          setJourneyError(true);
          setJourneyResolved(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, currentItemId, isBulkOperation, journeyRetry]);

  const grouping = journey?.grouping || null;
  const groupMembers = (grouping?.members || []).filter((m) => !m.is_self);
  const groupCount = grouping?.member_count || 0;
  const failedCount =
    Number.isInteger(grouping?.launch_failed_count) && grouping.launch_failed_count > 0
      ? grouping.launch_failed_count
      : 0;
  const burst = groupCount > 1 && isBurstGroup(grouping);
  const showGroup = !isBulkOperation && groupCount > 1;
  const soloConfirmed = !isBulkOperation && grouping?.member_count === 1;

  // ---- gestures ------------------------------------------------------------
  const bumpComment = () => setCommentKey((k) => k + 1);

  // The comment that would be sent right now (the active tab's issue comment).
  // Used by the dirty rule: a re-arm keeps this over the new source's prefill.
  const currentComment = () => {
    const active = modalState[ACTIVE_TAB_MAP[activeTab]];
    return (active && active.issue && active.issue.comment) || '';
  };

  const adoptClassical = (row) => {
    // The open log comparison belongs to the card it was opened from. Selecting a
    // different card leaves it on screen next to a verdict it says nothing about,
    // where it reads as evidence for that verdict. Selecting the same card again
    // keeps it, since there it is still the comparison being talked about.
    dropStaleCompare(row);
    const issue = {
      ...(row.res.issue || {}),
      issueType: row.issueType,
    };
    // Comment prefill (verdict 6.1 dirty rule): while pristine, take the SUGGESTED
    // ITEM's own saved human comment (never the AI summary). Once the human has
    // edited the comment, a re-arm keeps that edit instead and flags it kept.
    const prefill = row.res.issue?.comment || '';
    const keepEdited = commentDirty;
    const comment = keepEdited ? currentComment() : prefill;
    if (comment) {
      issue.comment = comment;
    } else {
      delete issue.comment;
    }
    setModalState({
      ...modalState,
      decisionType: MACHINE_LEARNING_SUGGESTIONS,
      issueActionType: '',
      suggestChoice: {
        ...row.res,
        logs: row.logs,
        suggestRs: row.suggestRs,
        issue,
      },
    });
    setActiveTab(MACHINE_LEARNING_SUGGESTIONS);
    setDockHighlight('');
    setPrefillNote(false);
    setCommentKept(keepEdited && !!comment);
    setCommentOpen(!!comment);
    setVerdictProv(
      row.band === BANDS.AUTO
        ? { key: 'benchProvFromPrecedent', chosen: true }
        : {
            key: 'benchProvFromSimilarity',
            params: { score: scoreToAlike(row.score) },
            chosen: true,
          },
    );
    bumpComment();
  };

  const adoptRubric = (row) => {
    // The AI guess never owns a comparison, so any open one belongs to another
    // card and has to go.
    dropStaleCompare(row);
    // Dirty rule (verdict 6.1): pristine takes the rubric why with the "written by
    // AI, edit before applying" note; once edited, keep the human's comment.
    const keepEdited = commentDirty;
    const kept = currentComment();
    onAdoptRubric({ issueType: row.issueType, comment: keepEdited ? kept : row.explanation || '' });
    setActiveTab(SELECT_DEFECT_MANUALLY);
    setDockHighlight('');
    setPrefillNote(!keepEdited && !!row.explanation);
    setCommentKept(keepEdited && !!kept);
    setCommentOpen(keepEdited ? !!kept : !!row.explanation);
    setVerdictProv({ key: 'benchProvFromAi', chosen: true });
    bumpComment();
  };

  const selectManual = (issueType) => {
    const base =
      modalState.decisionType === SELECT_DEFECT_MANUALLY
        ? modalState.selectManualChoice.issue
        : currentItem?.issue || {};
    setModalState({
      ...modalState,
      decisionType: SELECT_DEFECT_MANUALLY,
      issueActionType: '',
      selectManualChoice: { issue: { ...base, issueType } },
    });
    setActiveTab(SELECT_DEFECT_MANUALLY);
    const fromDock = !!dockHighlight && defectName(issueType).toLowerCase() === dockHighlight;
    setDockHighlight('');
    setPrefillNote(false);
    setVerdictProv(
      fromDock
        ? { key: 'benchProvDockAdopt', picked: true, chosen: true }
        : { key: 'benchProvYouPicked', picked: true, chosen: true },
    );
  };

  const dockAdopt = (row, e) => {
    e && e.stopPropagation();
    // highlight-only: never selects a defect the analyzer said no to. Apply stays
    // disabled until the human explicitly clicks the highlighted type (Enter can't fire).
    setModalState({
      ...modalState,
      decisionType: SELECT_DEFECT_MANUALLY,
      issueActionType: '',
      selectManualChoice: { issue: { ...(currentItem?.issue || {}) } },
    });
    setActiveTab(SELECT_DEFECT_MANUALLY);
    setDockHighlight(defectName(row.issueType).toLowerCase());
    setPrefillNote(false);
    setVerdictProv({ key: 'benchProvDockAdopt', pending: true });
    setPickerOpen(true);
  };

  // Honest comment contract: text present means saved, empty means nothing saved.
  // An empty editor strips issue.comment from the outgoing payload (unless the item
  // had a saved comment, in which case emptying is an explicit clear).
  const setComment = (value) => {
    // A user edit makes the comment dirty: later re-arms keep this text over the
    // new source's prefill (verdict 6.1). Clears the kept-note (it is fresh now).
    setCommentDirty(true);
    setCommentKept(false);
    const comment = (value || '').trim();
    const applyComment = (baseIssue) => {
      const issue = { ...(baseIssue || {}) };
      if (comment) {
        issue.comment = comment;
      } else if (currentItem?.issue?.comment) {
        issue.comment = '';
      } else {
        delete issue.comment;
      }
      return issue;
    };
    if (activeTab === MACHINE_LEARNING_SUGGESTIONS) {
      setModalState({
        suggestChoice: {
          ...modalState.suggestChoice,
          issue: applyComment(modalState.suggestChoice.issue),
        },
      });
    } else {
      setModalState({
        decisionType: SELECT_DEFECT_MANUALLY,
        selectManualChoice: {
          issue: applyComment(modalState.selectManualChoice.issue),
        },
      });
    }
  };

  const openCompare = (row) => {
    setFocusDock(null);
    setCompare(row);
  };
  const closeCompare = () => setCompare(null);
  // Close a comparison that was opened from a different card than the one now
  // being selected. Same card: keep it, it is still the one under discussion.
  const dropStaleCompare = (row) => {
    if (compare && compare !== row) {
      closeCompare();
    }
  };
  // "Compare logs" toggles: a second click on the same card's button closes the
  // compare view; clicking another card's button switches to it.
  const toggleCompare = (row) => (compare === row ? closeCompare() : openCompare(row));

  // ---- keyboard (verdict 6.2 / 6.3) ----------------------------------------
  // Enter: two-step, arm the state's lean then apply. Esc: one layer per press,
  // innermost first. keyupSinceArm makes a held key unable to arm-and-apply in a
  // single gesture (risk R2): the arming press sets it false, the next keyup
  // restores it, and only then can the apply step run.
  const keyupSinceArm = useRef(true);
  const keyCtx = useRef({});
  useEffect(() => {
    keyCtx.current = {
      compare,
      pickerOpen,
      siPickOpen,
      overrideOpen,
      burstApply,
      modalHasChanges,
      onApply,
      enterLeanRow,
      armViaEnter: (row) => {
        keyupSinceArm.current = false;
        adoptClassical(row);
      },
      closeCompare,
      closePicker: () => setPickerOpen(false),
      closeSiPick: () => setSiPickOpen(false),
      closeOverride: () => setOverrideOpen(false),
      closeBurst: () => setBurstApply(false),
    };
  });
  useEffect(() => {
    const handler = (e) => {
      const c = keyCtx.current;
      const inEditor =
        e.target &&
        (['INPUT', 'TEXTAREA'].includes(e.target.tagName) ||
          e.target.isContentEditable ||
          (e.target.closest && e.target.closest('.CodeMirror')));
      if (e.keyCode === ESCAPE_KEY_CODE) {
        // Layer stack (innermost first, verdict 6.3): SI subtype popover,
        // compare view, floating picker, override expander, burst panel. Each Esc
        // closes exactly one and stops, beating DarkModalLayout's bubble-phase
        // document handler.
        if (c.siPickOpen || c.compare || c.pickerOpen || c.overrideOpen || c.burstApply) {
          e.stopImmediatePropagation();
          e.preventDefault();
          if (c.siPickOpen) {
            c.closeSiPick();
          } else if (c.compare) {
            c.closeCompare();
          } else if (c.pickerOpen) {
            c.closePicker();
          } else if (c.overrideOpen) {
            c.closeOverride();
          } else {
            c.closeBurst();
          }
          return;
        }
        // Editor guard: with no layer open, a first Esc from inside the comment
        // editor blurs it (the next Esc then starts closing the modal).
        if (inEditor && e.target && e.target.blur) {
          e.stopImmediatePropagation();
          e.preventDefault();
          e.target.blur();
        }
        return;
      }
      if (e.keyCode !== ENTER_KEY_CODE) {
        return;
      }
      if (e.repeat) {
        // Auto-repeat from a held key never advances the two-step (risk R2).
        return;
      }
      // Ctrl/Cmd+Enter applies from anywhere, including inside an editor.
      if (e.ctrlKey || e.metaKey) {
        if (c.modalHasChanges && keyupSinceArm.current) {
          e.preventDefault();
          c.onApply();
        }
        return;
      }
      if (e.shiftKey || e.altKey || inEditor) {
        return;
      }
      // A picker or the SI popover is open: Enter is inert (step 2).
      if (c.pickerOpen || c.siPickOpen) {
        return;
      }
      if (c.modalHasChanges) {
        // Apply, but only once a keyup has cleared the arming press.
        if (keyupSinceArm.current) {
          e.preventDefault();
          c.onApply();
        }
        return;
      }
      if (c.enterLeanRow) {
        // First press arms the lean through the same path a click uses.
        e.preventDefault();
        c.armViaEnter(c.enterLeanRow);
      }
    };
    const onKeyUp = (e) => {
      if (e.keyCode === ENTER_KEY_CODE) {
        keyupSinceArm.current = true;
      }
    };
    document.addEventListener('keydown', handler, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
      document.removeEventListener('keyup', onKeyUp, true);
    };
  }, []);

  // ---- floating picker: outside click closes -------------------------------
  const pickerWrapRef = useRef(null);
  useEffect(() => {
    if (!pickerOpen) {
      return undefined;
    }
    const onDown = (e) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  // ---- render helpers ------------------------------------------------------
  const errorLines = toLines(currentItem?.logs);
  const headerLine = errorLines[0]?.text || '';
  const restLines = errorLines.slice(1);
  const failureSub = parseFailureSub(errorLines);

  // ---- Act 1 decision story + Act 2 offers facts ---------------------------
  // The story is derived from the journey decision block ONLY (never the live
  // reply): the ng37 "agree on abstain" bug came from mixing the two. The AI
  // paragraph is gated separately by the reoriented isDecisionFresh.
  const journeyDecision = journey?.decision || null;
  const hasDecisionRecord = !!journeyDecision;
  // Cold-start hypothesis kept on the journey record. The live suggest reply
  // loses the rubric row as soon as newer classical rows displace it (or the
  // guess feature is off), while the journey still remembers the guess; this is
  // the only source for the AI card in that case.
  const journeyRubric = journeyDecision?.rubric_hypothesis || null;
  // Third source for the AI card: the decision on record IS the guess. Neither
  // source above carries it then, because the live reply drops its rubric row as
  // soon as a labelled neighbour outranks it, and rubric_hypothesis is only
  // filled when a classical row displaced the guess. Without this the modal
  // printed the guess in the story at the top ("Best answer: Product Bug at
  // confidence 0.65") and denied it in the card below ("No AI guess for this
  // failure").
  const journeyOwnGuess = deriveJourneyOwnGuess(journeyDecision, journeyRubric);
  // The rubric rule behind the guess, by its reader-facing name. The analyzer
  // stores the name next to the id so nothing here has to keep a copy of the
  // rubric; rows written before the name existed carry the id only, and then the
  // card keeps its generic line rather than showing "R6" at a reader.
  const guessRuleName = (block) => {
    const name = block && typeof block.rule_name === 'string' ? block.rule_name.trim() : '';
    return name || '';
  };
  const decisionRuleName = guessRuleName(journeyDecision?.coldstart);
  const hypothesisRuleName = guessRuleName(journeyRubric?.coldstart);
  const aiRoleLine = (ruleName) =>
    ruleName
      ? formatMessage(messages.benchCheckAiRule, { rule: ruleName })
      : formatMessage(messages.benchCheckAiRole);
  const decisionHasExplanation = !!(
    journeyDecision &&
    typeof journeyDecision.explanation === 'string' &&
    journeyDecision.explanation.trim()
  );
  // Wait state for a missing explanation. The analyzer writes the decision at
  // once and fills the explanation afterwards, so "no explanation yet" can mean
  // either "still being written" or "not coming at all". Ask the analyzer which
  // one it is: historically more than half of all explainer runs ended with the
  // breaker open, and a spinner that promises text which never arrives is worse
  // than no spinner. Timings come from the same source: on this data a written
  // explanation lands well inside a minute for a single item, so the wait is
  // capped rather than open ended, and no exact number is shown to the reader.
  //   null      - nothing to wait for (or the question does not apply)
  //   'waiting' - the analyzer is able to answer and has not answered yet
  //   'none'    - no explanation is coming, or waiting has been given up
  const [explanationWait, setExplanationWait] = useState(null);
  useEffect(() => {
    if (isBulkOperation || !journeyResolved || journeyError) {
      return undefined;
    }
    if (!hasDecisionRecord || decisionHasExplanation) {
      setExplanationWait(null);
      return undefined;
    }
    let cancelled = false;
    const timers = [];
    window
      .fetch(getAnalyzerHealthApiUrl())
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled) {
          return;
        }
        if (!canLlmStillAnswer(payload)) {
          setExplanationWait('none');
          return;
        }
        setExplanationWait('waiting');
        if (journeyRetry === 0) {
          // One re-read, so an explanation that lands while the modal is open
          // still shows up without the reader having to close and reopen it.
          timers.push(window.setTimeout(() => !cancelled && setJourneyRetry(1), 20000));
        }
        timers.push(window.setTimeout(() => !cancelled && setExplanationWait('none'), 60000));
      })
      .catch(() => {
        // Health unknown: say nothing rather than promise an answer.
        if (!cancelled) {
          setExplanationWait('none');
        }
      });
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [
    isBulkOperation,
    journeyResolved,
    journeyError,
    hasDecisionRecord,
    decisionHasExplanation,
    journeyRetry,
    currentItemId,
  ]);
  const explainerEvent =
    (journey?.llm?.events || []).find((ev) => ev && ev.role === 'explainer') || null;
  // Analyzer images after the quote split write quoted_log_lines (log quotes
  // only); cached outputs up to 90 days old still carry the single quoted_lines
  // field. Read both. quoted_fact_values is never matched against the log: fact
  // values are not log lines, and treating them as such is what used to poison
  // the grounding check.
  const quotedLines = (
    explainerEvent?.output?.quoted_log_lines ||
    explainerEvent?.output?.quoted_lines ||
    []
  ).filter((q) => typeof q === 'string' && q.trim().length);
  const normLog = useMemo(() => errorLines.map((l) => normalizeLine(l.text)), [
    currentItem?.logs,
  ]);
  const quoteInfos = quotedLines.map((q) => ({
    text: q,
    idx: groundQuote(normalizeLine(q), normLog),
  }));
  // Quote grounding for the freshness gate: true = a quote matched this item's own
  // log, false = quotes exist and none matched (fail closed), null = no quotes.
  // Act 1 now shows the explainer's own text (see actOneExplanation), so the
  // explainer's quotes are evidence for exactly the paragraph on screen.
  const quoteMatched = quoteInfos.length ? quoteInfos.some((q) => q.idx >= 0) : null;

  // Group typeRef -> its display name (the {defect} in the story/banner). The base
  // subtype (locator ...001) carries the canonical group name; fall back to first.
  const groupDisplayName = (typeRef) => {
    const arr = typeRef ? defectTypes[typeRef] : null;
    if (!arr || !arr.length) {
      return null;
    }
    const base = arr.find((t) => t.locator && /0*1$/.test(t.locator)) || arr[0];
    return base.longName || null;
  };
  const groupRef = (locator) => getDefectType(locator)?.typeRef || null;
  const isTiLocator = (locator) =>
    typeof locator === 'string' && locator.startsWith(TO_INVESTIGATE_LOCATOR_PREFIX);

  // Act 1 story from the journey decision block. journeyError -> O9b (fetch failed),
  // a clean no-record -> O9. null until the fetch settles so no wrong headline flashes.
  const decisionStory = journeyResolved
    ? deriveDecisionStory(journeyError ? { fetchError: true } : journeyDecision)
    : null;

  // The live top offer (for the auto agree/differ test and the freshness gate's
  // liveTopGroup arg, which isDecisionFresh accepts but no longer compares against).
  const liveTopRow = autoRow || topSuggest || belowRows[0] || null;
  const liveTopGroupRef = liveTopRow ? groupRef(liveTopRow.issueType) : null;

  // The paragraph under "What the analyzer did" is the analyzer's account of its
  // OWN decision, so it comes from the row that decision was written about, not
  // from whichever row happens to be newest. A cold-start guess explains why the
  // test failed, which belongs to the AI guess card and to the comment when that
  // guess is adopted; putting it here told the wrong story and told it twice.
  const actOne = actOneExplanation(journeyDecision);

  // AI paragraph gate (rows 1-3 always render): text present and it passes the
  // reoriented freshness check, judged against the row that text belongs to.
  const aiFresh =
    !!decisionStory && !!actOne.text && isDecisionFresh(actOne.row, liveTopGroupRef, quoteMatched);

  // Measure the clamped AI paragraph so "Show more" appears only when the text
  // truly overflows the 3-line clamp. Measure only while collapsed (open unclamps,
  // so scrollHeight == clientHeight there); keep the last measured value when open.
  const aiText = actOne.text;
  useEffect(() => {
    if (!aiFresh || storyAiOpen) {
      return;
    }
    const el = aiBodyRef.current;
    if (el) {
      setAiOverflow(el.scrollHeight > el.clientHeight + 2);
    }
  }, [aiFresh, storyAiOpen, aiText]);

  // Offer rows at or above the 0.45 suggest line (by ALIKE similarity; band auto /
  // suggest always count), split into vouched (a confirmed non-TI defect behind
  // them) and unlabeled (still To Investigate look-alikes). Dock rows sit below.
  const alikeOf = (row) => (typeof row.score === 'number' ? row.score / 100 : 0);
  const offerRows = classical.filter(
    (r) => r.band === BANDS.AUTO || r.band === BANDS.SUGGEST || alikeOf(r) >= 0.45,
  );
  const vouchedRows = offerRows.filter((r) => r.issueType && !isTiLocator(r.issueType));
  const unlabeledRows = offerRows.filter((r) => !r.issueType || isTiLocator(r.issueType));
  const vouchedGroups = new Set(vouchedRows.map((r) => groupRef(r.issueType)).filter(Boolean));
  const leanRow = vouchedRows[0] || autoRow || topSuggest || null;

  // Does the model stand behind the offer the cards lead with? matchScore is a log
  // similarity, so a single neighbour can lead on text alone while the model that
  // scored it refused to move. Read once here and reused by the card and the banner
  // so the two can never say different things about the same offer.
  const classicalCall = classicalVerdict(journeyDecision);
  const topSuggestFeatures = topSuggest ? parseFeatures(topSuggest.suggestRs) : {};
  const topSuggestBacking = deriveOfferBacking({
    ng1: topSuggest ? parseNgVersion(topSuggest.suggestRs) : false,
    offerGroup: topSuggest ? groupRef(topSuggest.issueType) : null,
    classical: classicalCall,
  });
  const topSuggestMismatch = deriveMismatchClauses(topSuggestFeatures);
  const topSuggestEvidence = evidenceBaseCount(topSuggestFeatures);

  const offers = {
    empty: parsed.length === 0,
    similarityOnly: offersRestOnSimilarityAlone({
      backingState: topSuggestBacking.state,
      mismatchClauses: topSuggestMismatch,
    }),
    hasVouched: vouchedRows.length > 0,
    converge: vouchedRows.length > 0 && vouchedGroups.size === 1,
    split: vouchedGroups.size > 1,
    unlabeledOnly: vouchedRows.length === 0 && unlabeledRows.length > 0,
    rubricLeads: !!rubricRow,
    dockRows: belowRows.length > 0,
    leanGroup: leanRow ? groupRef(leanRow.issueType) : null,
    leanDefect: leanRow ? defectName(leanRow.issueType) : null,
    topGroup: liveTopRow ? groupRef(liveTopRow.issueType) : null,
    topDefect: liveTopRow ? defectName(liveTopRow.issueType) : null,
  };

  // Enter lean (verdict 6.2 / ruling C3): a lean exists only when the decision
  // route itself named an answer (auto O1-O3, or a suggest endorsement O4), or
  // it abstained (O5-O7) and every vouched offer converges on one group. Every
  // other state (no record, split, rubric-only, dock-only) has no lean and a
  // bare Enter never guesses. The row is armed through the same adoptClassical
  // path a click uses, so feedback and provenance stay identical.
  const storyOutcomeId = decisionStory ? decisionStory.outcomeId : null;
  // A row may only lead when the model agrees with it. The lead is what a bare
  // Enter arms, so ranking it by log similarity handed the default to whatever
  // neighbour happened to sit on top, including one the model had refused to
  // move on. O1-O3 are auto decisions the analyzer applied itself, so agreement
  // is not in question there. Everywhere else, no agreement means no lead: the
  // modal pre-selects nothing and the banner already says the call is human.
  const backingOf = (row) =>
    deriveOfferBacking({
      ng1: row ? parseNgVersion(row.suggestRs) : false,
      offerGroup: row ? groupRef(row.issueType) : null,
      classical: classicalCall,
    }).state;
  const mayLead = (row) => !!row && backingOf(row) !== BACKING.NOT_BACKED && backingOf(row) !== BACKING.DIFFERS;
  let enterLeanRow = null;
  if (['O1', 'O2', 'O3'].includes(storyOutcomeId) && precedentRow) {
    enterLeanRow = precedentRow;
  } else if (storyOutcomeId === 'O4' && mayLead(topSuggest)) {
    enterLeanRow = topSuggest;
  } else if (
    ['O5', 'O6', 'O7'].includes(storyOutcomeId) &&
    offers.converge &&
    mayLead(vouchedRows[0])
  ) {
    enterLeanRow = vouchedRows[0];
  }

  // The decision fact for the banner (journey route only): O1-O3 -> auto, O4 ->
  // suggest, O5-O8 -> abstain, O9/O9b -> none. rubric routes B5.
  const outcomeBand = (id) => {
    if (id === 'O1' || id === 'O2' || id === 'O3') {
      return BANDS.AUTO;
    }
    if (id === 'O4') {
      return BANDS.SUGGEST;
    }
    if (id === 'O9' || id === 'O9b') {
      return 'none';
    }
    return 'abstain';
  };
  // Resolve the decision's own defect from its specific locator (predicted_label)
  // via the SAME defectName / groupRef the offers use, so the story name actually
  // resolves ("pb001" -> "Product Bug") and the auto banner's same-group test
  // (B1 vs B2) compares like-for-like typeRefs, not a short group code against a
  // typeRef. A TI locator (abstain) yields no decision defect; the headline needs
  // none there and the group falls back to the story's short code for any legacy use.
  const decisionLocator =
    journeyDecision && typeof journeyDecision.predicted_label === 'string'
      ? journeyDecision.predicted_label
      : null;
  const decisionHasDefect = !!decisionLocator && !isTiLocator(decisionLocator);
  const storyDefectName = decisionHasDefect
    ? defectName(decisionLocator)
    : decisionStory && decisionStory.params.defectGroup
    ? groupDisplayName(decisionStory.params.defectGroup)
    : null;
  const decisionGroupRef = decisionHasDefect ? groupRef(decisionLocator) : null;
  const decisionOutcome = decisionStory
    ? {
        id: decisionStory.outcomeId,
        band: outcomeBand(decisionStory.outcomeId),
        defect: storyDefectName,
        group: decisionGroupRef,
        rubric: decisionStory.outcomeId === 'O8',
      }
    : null;
  const banner = decisionStory ? deriveBanner({ decisionOutcome, offers }) : null;
  const storyParams = decisionStory
    ? { defect: storyDefectName, p: decisionStory.params.p }
    : {};
  // O1/O2/O3 share the "Applied on its own: {defect}." headline; render the
  // defect as a pill instead of an ICU value (element-as-value crashes here).
  const headAsPill =
    !!decisionStory &&
    ['O1', 'O2', 'O3'].includes(decisionStory.outcomeId) &&
    decisionHasDefect;

  // ---- Stage 2 arming (verdict 6.1) ----------------------------------------
  // armedSource drives three visibles: the persistent topaz ring on the card
  // that was armed, the source tag next to the defect field, and the comment
  // prefill. verdictProv stays the single arm record; the card key is derived
  // from its message key so no second source of truth can drift.
  const armedCard =
    verdictProv && verdictProv.chosen
      ? {
          benchProvFromPrecedent: 'past',
          benchProvFromSimilarity: 'similar',
          benchProvFromAi: 'ai',
        }[verdictProv.key] || null
      : null;
  // The decision route itself abstained (found a lead but did not auto-apply, or
  // looked and applied nothing): a Past decision / Similar failures arm then
  // carries the "analyzer did not apply this" suffix (ruling C4). Its p* number
  // never enters the tag; the story reason line is that number's only home.
  const decisionAbstained =
    !!decisionStory && ['O4', 'O5', 'O6', 'O7'].includes(decisionStory.outcomeId);
  const armedFromOffer =
    !!armedCard && (verdictProv.key === 'benchProvFromPrecedent' || verdictProv.key === 'benchProvFromSimilarity');

  // The bridge line (verdict 4.3): abstain (O5/O6/O7) with at least one offer row
  // >= 0.45. The single sanctioned sentence naming both scale words (ruling C2):
  // {x} = the closest match's alike, {p} = the decision's own confidence.
  const abstainWithOffers =
    !!decisionStory &&
    (decisionStory.outcomeId === 'O5' ||
      decisionStory.outcomeId === 'O6' ||
      decisionStory.outcomeId === 'O7') &&
    offerRows.length > 0;
  const topAboveRow = vouchedRows[0] || unlabeledRows[0] || offerRows[0] || null;
  const bridgeX = topAboveRow ? scoreToAlike(topAboveRow.score) : '';
  const bridgeP =
    journeyDecision &&
    typeof journeyDecision.confidence === 'number' &&
    journeyDecision.confidence > 0
      ? journeyDecision.confidence.toFixed(2)
      : (decisionStory && decisionStory.params.p) || '';
  let bridgeText = null;
  if (abstainWithOffers && bridgeX && bridgeP) {
    const bridgeBase = formatMessage(messages.benchStoryBridge, { x: bridgeX, p: bridgeP });
    bridgeText = offers.unlabeledOnly
      ? `${bridgeBase} ${formatMessage(messages.benchStoryBridgeUnlabeled)}`
      : bridgeBase;
  }

  // Failure-band refs (frozen band; the quote-pulse target lines). Their reader was
  // the deleted AI-summary quote chips; kept as valid refs for a future re-wire.
  const fpTopRef = useRef(null);
  const logRowRefs = useRef({});

  const renderPill = (locator) =>
    locator ? <DefectTypeItem type={locator} className={cx('defect-pill')} /> : null;

  // Inline defect badge (summary sentence, burst rule/action). Uses the SAME RP
  // DefectTypeItem as renderPill so every defect label in the modal shares the RP
  // design language; the `.mini` modifier only nudges it to sit on a text line.
  const miniPill = (locator) =>
    locator ? (
      <DefectTypeItem key={locator} type={locator} className={cx('defect-pill', 'mini')} />
    ) : null;

  // Rich rendering for the AI explanation paragraph: an "item N" reference becomes a
  // link to that item's log view when we can resolve it (from a group member's
  // ui_url or a suggest row's own resource, never a fabricated URL), and a defect
  // locator (pb001, si_xxx) becomes a small inline defect label. Plain text otherwise.
  const itemUrlById = new Map();
  (grouping?.members || []).forEach((mem) => {
    if (mem.item_id && mem.ui_url) {
      itemUrlById.set(String(mem.item_id), mem.ui_url);
    }
  });
  parsed.forEach((p) => {
    const r = p.res;
    if (r && r.id && !itemUrlById.has(String(r.id))) {
      const u = getItemLogUrl(r);
      if (u) {
        itemUrlById.set(String(r.id), u);
      }
    }
  });
  const allLocators = [];
  Object.keys(defectTypes || {}).forEach((g) =>
    (defectTypes[g] || []).forEach((t) => t.locator && allLocators.push(t.locator)),
  );
  allLocators.sort((a, b) => b.length - a.length);
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const renderRichText = (text) => {
    if (!text) {
      return null;
    }
    const locAlt = allLocators.map(escapeRe).join('|');
    const re = locAlt ? new RegExp(`(item\\s+#?\\d+)|(${locAlt})`, 'gi') : /(item\s+#?\d+)/gi;
    const out = [];
    let last = 0;
    let mm = re.exec(text);
    let k = 0;
    while (mm !== null) {
      if (mm.index > last) {
        out.push(text.slice(last, mm.index));
      }
      const tok = mm[0];
      const idMatch = tok.match(/item\s+#?(\d+)/i);
      if (idMatch) {
        const url = itemUrlById.get(idMatch[1]);
        out.push(
          url ? (
            <a
              key={k}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cx('rich-item')}
            >
              {tok}
            </a>
          ) : (
            tok
          ),
        );
      } else {
        out.push(
          <span key={k} className={cx('rich-pill')}>
            {miniPill(tok)}
          </span>,
        );
      }
      last = mm.index + tok.length;
      k += 1;
      mm = re.exec(text);
    }
    if (last < text.length) {
      out.push(text.slice(last));
    }
    return out;
  };

  // Provenance line (mockup .prov "d.gumeniuk decided this in launch #266"): names
  // the real person who set the matched neighbour's defect and links its real run
  // number to that item's log view. Real data only: the decider comes from the
  // neighbour's activity log, the run number from its launch. Shown only for a
  // genuinely human-confirmed / auto-analyzed neighbour (an unlabelled one has no
  // decider, so no line). Any part we cannot resolve is simply left out (no note).
  // Resolved "{who}" (capitalized real user, or "The analyzer") + a "launch #N"
  // link for a decided neighbour row. Real data only: a missing user/number
  // simply yields a fallback / no link (see the decidedInfo fetch above).
  const capitalize = (s) =>
    typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const decidedParts = (row) => {
    const res = (row && row.res) || {};
    const info = decidedInfo[res.id] || {};
    const who =
      row && row.provenance === PROVENANCE.HUMAN
        ? capitalize(info.user || formatMessage(messages.benchDecidedSomePerson))
        : formatMessage(messages.benchDecidedTheAnalyzer);
    const logUrl = getItemLogUrl(res);
    const runLink =
      info.launchNumber != null ? (
        logUrl ? (
          <a className={cx('sum-itemlink')} href={logUrl} target="_blank" rel="noopener noreferrer">
            {formatMessage(messages.benchDecidedRun, { number: info.launchNumber })}
          </a>
        ) : (
          <span>{formatMessage(messages.benchDecidedRun, { number: info.launchNumber })}</span>
        )
      ) : null;
    return { who, runLink };
  };

  const renderDecidedBy = (row) => {
    if (
      !row ||
      (row.provenance !== PROVENANCE.HUMAN && row.provenance !== PROVENANCE.AUTO)
    ) {
      return null;
    }
    const res = row.res || {};
    const info = decidedInfo[res.id] || {};
    const who =
      row.provenance === PROVENANCE.HUMAN
        ? info.user || formatMessage(messages.benchDecidedSomePerson)
        : formatMessage(messages.benchDecidedTheAnalyzer);
    const logUrl = getItemLogUrl(res);
    const runLink =
      info.launchNumber != null ? (
        logUrl ? (
          <a className={cx('sum-itemlink')} href={logUrl} target="_blank" rel="noopener noreferrer">
            {formatMessage(messages.benchDecidedRun, { number: info.launchNumber })}
          </a>
        ) : (
          <span>{formatMessage(messages.benchDecidedRun, { number: info.launchNumber })}</span>
        )
      ) : null;
    return (
      <div className={cx('prov')}>
        {runLink
          ? formatMessage(messages.benchDecidedByInRun, { who, run: runLink })
          : formatMessage(messages.benchDecidedBy, { who })}
      </div>
    );
  };

  // Card arming (mockup-mdm-states): the WHOLE card is the arm target, so no per
  // card "Use this answer" button. A click anywhere on the card that is not on a
  // link or button arms it (Compare logs and the Inspector links keep their own
  // behaviour). The "leading" chip marks the card a bare Enter arms first; the
  // armed note appears once the card is loaded into the verdict.
  const armOnCardClick = (armFn) => (e) => {
    if (e.target.closest && e.target.closest('a, button')) {
      return;
    }
    armFn();
  };
  const leadChip = (
    <span className={cx('lean-chip')} title={formatMessage(messages.benchLeadingChipTitle)}>
      {formatMessage(messages.benchLeadingChip)}
    </span>
  );

  // ---- Similar failures card: what the model says about the offer -----------
  // Four states, and only one of them adds anything. UNKNOWN covers a stock or
  // legacy analyzer whose reply we cannot read, and there the card renders
  // exactly as it did before this change.
  const backingChip =
    topSuggestBacking.state === BACKING.BACKED ? (
      <span className={cx('lean-chip', 'backed')}>
        {formatMessage(messages.benchTagModelAgrees)}
      </span>
    ) : topSuggestBacking.state === BACKING.UNKNOWN ? null : (
      <span className={cx('lean-chip', 'unbacked')}>
        {formatMessage(messages.benchTagNotBacked)}
      </span>
    );

  const similarRoleMessage =
    topSuggestBacking.state === BACKING.BACKED
      ? messages.benchSimilarRoleBacked
      : topSuggestBacking.state === BACKING.UNKNOWN
        ? messages.benchCheckSimilarRole
        : messages.benchSimilarRoleUnbacked;

  const MISMATCH_MESSAGE = {
    [MISMATCH.IDENTIFIERS]: messages.benchMismatchIdentifiers,
    [MISMATCH.STATUS_CODES]: messages.benchMismatchStatusCodes,
    [MISMATCH.TEMPLATES]: messages.benchMismatchTemplates,
  };
  // "Logs 0.91 alike" on its own reads as evidence. When the model did not back
  // the offer, the same line carries what failed to match, which is the fact that
  // decides whether the number means anything.
  const mismatchText = (() => {
    if (topSuggestBacking.state === BACKING.BACKED || !topSuggestMismatch.length) {
      return '';
    }
    const parts = topSuggestMismatch.map((id) => formatMessage(MISMATCH_MESSAGE[id]));
    return parts.length === 1
      ? parts[0]
      : formatMessage(messages.benchMismatchJoin, { first: parts[0], second: parts[1] });
  })();
  const alikeLine = topSuggest
    ? mismatchText
      ? formatMessage(messages.benchLogsAlikeBut, {
          score: scoreToAlike(topSuggest.score),
          what: mismatchText,
        })
      : (
          <>
            <b>
              {formatMessage(messages.benchLogsAlike, { score: scoreToAlike(topSuggest.score) })}
            </b>{' '}
            {formatMessage(messages.benchBandSuggest)}
          </>
        )
    : null;

  // The model's own number belongs to the model's own answer. For NOT_BACKED that
  // answer was "no call", so the number is never printed beside the defect pill
  // where it would read as belief in that defect.
  const modelVerdictLine = (() => {
    const { state, confidence, otherGroup } = topSuggestBacking;
    const p = typeof confidence === 'number' ? confidence.toFixed(2) : null;
    const tau =
      typeof journeyDecision?.tau_suggest === 'number'
        ? journeyDecision.tau_suggest.toFixed(2)
        : null;
    if (state === BACKING.BACKED) {
      return p ? (
        <div className={cx('model-verdict', 'good')}>
          {formatMessage(messages.benchModelBacks, { p })}
        </div>
      ) : null;
    }
    if (state === BACKING.NOT_BACKED) {
      return (
        <div className={cx('model-verdict')}>
          {p && tau
            ? formatMessage(messages.benchModelNoCall, { p, tau })
            : formatMessage(messages.benchModelNoCallPlain)}
        </div>
      );
    }
    if (state === BACKING.DIFFERS) {
      const other = groupDisplayName(otherGroup);
      if (!other) {
        return null;
      }
      return (
        <div className={cx('model-verdict')}>
          {p
            ? formatMessage(messages.benchModelDiffers, { other, p })
            : formatMessage(messages.benchModelDiffersPlain, { other })}
        </div>
      );
    }
    return null;
  })();

  // How much the model believes the defect type this card offers. The verdict line
  // above answers a different question: what the model decided about the FAILURE.
  // Rendered on the pill's own line, so it costs no extra line, and only when the
  // analyzer stated the number (an older analyzer sends none and nothing shows).
  // Skipped when the model backed the offer and the verdict line already prints
  // that same number for that same defect type, so the card never says it twice.
  const offeredLabelP = (() => {
    const p = topSuggest ? parseOfferedLabelProbability(topSuggest.suggestRs) : null;
    if (p === null) {
      return null;
    }
    if (
      topSuggestBacking.state === BACKING.BACKED &&
      typeof topSuggestBacking.confidence === 'number'
    ) {
      return null;
    }
    return (
      <span
        className={cx('label-p')}
        title={formatMessage(messages.benchOfferedLabelPTitle)}
      >
        {formatMessage(messages.benchOfferedLabelP, { p: p.toFixed(2) })}
      </span>
    );
  })();

  // Only said when the pool is small enough to explain a thin answer. A mature
  // project never sees this line.
  const thinEvidenceLine =
    topSuggestBacking.state !== BACKING.UNKNOWN && topSuggestEvidence ? (
      <div className={cx('evidence-base')}>
        {formatMessage(messages.benchThinEvidence, { n: topSuggestEvidence })}
      </div>
    ) : null;
  // The armed note is the last thing between a reader and a committed label, and
  // for an offer the model refused it has to say so there, not only higher up the
  // card where nobody re-reads at the moment of pressing Enter. No looping blink:
  // in a project that is still filling up this state is the norm rather than the
  // exception, and a warning that never stops moving is read once and ignored
  // after. A single beat when it arms, then a stable amber resting state.
  const armedNote = (locator, unbacked) => (
    <div className={cx('armed-note', { warn: unbacked })}>
      {formatMessage(messages.benchArmedNote, { defect: defectName(locator) })}
      {unbacked && (
        <span className={cx('armed-warn')}>
          <span aria-hidden>⚠</span> {formatMessage(messages.benchArmedNotBacked)}
        </span>
      )}
    </div>
  );
  const similarUnbacked =
    topSuggestBacking.state === BACKING.NOT_BACKED || topSuggestBacking.state === BACKING.DIFFERS;

  const renderCheck = ({ kind }) => {
    if (kind === 'past') {
      if (precedentRow) {
        const { who, runLink } = decidedParts(precedentRow);
        return (
          <div
            className={cx('check', 'auto', 'actionable', {
              focus: compare && compare === precedentRow,
              armed: armedCard === 'past',
            })}
            role="button"
            tabIndex={0}
            onClick={armOnCardClick(() => adoptClassical(precedentRow))}
          >
            <span className={cx('edge')} />
            <div className={cx('method')}>
              <span className={cx('gl')}>◆</span> {formatMessage(messages.benchCheckPast)}
              {enterLeanRow === precedentRow && leadChip}
            </div>
            <div className={cx('role')}>
              {formatMessage(messages.benchCheckPastRolePerson, { who })}
            </div>
            <div className={cx('verd-pill')}>
              {renderPill(precedentRow.issueType)}
            </div>
            {runLink && (
              <div className={cx('past-run')}>
                {formatMessage(messages.benchCheckPastInRun, { run: runLink })}
              </div>
            )}
            <div className={cx('strength')}>{formatMessage(messages.benchCheckPastStrong)}</div>
            <div className={cx('card-actions')}>
              <button
                type="button"
                className={cx('btn', 'btn-ghost', 'btn-sm')}
                onClick={() => toggleCompare(precedentRow)}
              >
                {formatMessage(messages.benchCompareLogs)}
              </button>
            </div>
            {armedCard === 'past' && armedNote(precedentRow.issueType, false)}
          </div>
        );
      }
      return (
        <div className={cx('check', 'empty')}>
          <span className={cx('edge')} />
          <div className={cx('method')}>
            <span className={cx('gl')}>◆</span> {formatMessage(messages.benchCheckPast)}
          </div>
          <div className={cx('strength')}>{formatMessage(messages.benchCheckPastNoMatch)}</div>
          <div className={cx('prov')}>{formatMessage(messages.benchCheckPastNoMatchProv)}</div>
        </div>
      );
    }
    if (kind === 'similar') {
      if (topSuggest) {
        return (
          <div
            className={cx('check', 'suggest', 'actionable', {
              focus: compare && compare === topSuggest,
              armed: armedCard === 'similar',
              'armed-unbacked': armedCard === 'similar' && similarUnbacked,
            })}
            role="button"
            tabIndex={0}
            onClick={armOnCardClick(() => adoptClassical(topSuggest))}
          >
            <span className={cx('edge')} />
            <InspectorLink
              corner
              href={getInspectorJourneyUrl(topSuggest.suggestRs)}
              label={formatMessage(messages.benchWhy)}
            />
            <div className={cx('method')}>
              <span className={cx('gl')}>≈</span> {formatMessage(messages.benchCheckSimilar)}
              {backingChip}
              {enterLeanRow === topSuggest && leadChip}
            </div>
            <div className={cx('role')}>{formatMessage(similarRoleMessage)}</div>
            <div className={cx('verd-pill')}>
              {renderPill(topSuggest.issueType)}
              {offeredLabelP}
            </div>
            <div className={cx('strength')}>{alikeLine}</div>
            {modelVerdictLine}
            {thinEvidenceLine}
            {renderDecidedBy(topSuggest)}
            <div className={cx('card-actions')}>
              <button
                type="button"
                className={cx('btn', 'btn-ghost', 'btn-sm')}
                onClick={() => toggleCompare(topSuggest)}
              >
                {formatMessage(messages.benchCompareLogs)}
              </button>
            </div>
            {armedCard === 'similar' && armedNote(topSuggest.issueType, similarUnbacked)}
          </div>
        );
      }
      if (belowRows.length) {
        return (
          <div className={cx('check', 'abstain')}>
            <span className={cx('edge')} />
            <div className={cx('method')}>
              <span className={cx('gl')}>≈</span> {formatMessage(messages.benchCheckSimilar)}
            </div>
            <div className={cx('role')}>{formatMessage(messages.benchCheckSimilarRole)}</div>
            <div className={cx('strength')}>
              <b>{formatMessage(messages.benchAlike, { score: scoreToAlike(belowRows[0].score) })}</b>{' '}
              {formatMessage(messages.benchBandAbstain)}
            </div>
            <div className={cx('prov')}>
              {formatMessage(messages.benchDockBestScore, {
                score: scoreToAlike(belowRows[0].score),
              })}
            </div>
          </div>
        );
      }
      return (
        <div className={cx('check', 'empty')}>
          <span className={cx('edge')} />
          <div className={cx('method')}>
            <span className={cx('gl')}>≈</span> {formatMessage(messages.benchCheckSimilar)}
          </div>
          <div className={cx('strength')}>{formatMessage(messages.benchCheckSimilarNone)}</div>
        </div>
      );
    }
    // AI guess
    if (rubricRow) {
      const pct = rubricRow.conf != null ? Math.round(rubricRow.conf * 100) : Math.round(rubricRow.score);
      return (
        <div
          className={cx('check', 'rubric', 'actionable', { armed: armedCard === 'ai' })}
          role="button"
          tabIndex={0}
          onClick={armOnCardClick(() => adoptRubric(rubricRow))}
        >
          <span className={cx('edge')} />
          <InspectorLink
            corner
            href={getInspectorJourneyUrl(rubricRow.suggestRs)}
            label={formatMessage(messages.benchWhy)}
          />
          <div className={cx('method')}>
            <span className={cx('gl')}>✦</span> {formatMessage(messages.benchCheckAi)}
            <span className={cx('tag-nc')}>{formatMessage(messages.benchNotConfirmed)}</span>
          </div>
          <div className={cx('role')}>{aiRoleLine(decisionRuleName)}</div>
          <div className={cx('verd-pill')}>
            {renderPill(rubricRow.issueType)}
          </div>
          <div className={cx('strength')}>{formatMessage(messages.benchAiGuessPct, { pct })}</div>
          {armedCard === 'ai' && armedNote(rubricRow.issueType, false)}
        </div>
      );
    }
    // The hypothesis the journey remembers when the live reply has no rubric row
    // (newer classical rows displaced it, or the guess feature is off). Adoptable
    // exactly like a live rubric card; when the feature is off for this project,
    // the card says so instead of pretending the guess is current.
    if (journeyRubric && journeyRubric.predicted_label) {
      const pct = Math.round((journeyRubric.confidence || 0) * 100);
      const hypoRow = {
        issueType: journeyRubric.predicted_label,
        explanation: journeyRubric.explanation,
      };
      return (
        <div
          className={cx('check', 'rubric', 'actionable', { armed: armedCard === 'ai' })}
          role="button"
          tabIndex={0}
          onClick={armOnCardClick(() => adoptRubric(hypoRow))}
        >
          <span className={cx('edge')} />
          <InspectorLink
            corner
            href={getInspectorJourneyUrlForItem(projectId, currentItem)}
            label={formatMessage(messages.benchWhy)}
          />
          <div className={cx('method')}>
            <span className={cx('gl')}>✦</span> {formatMessage(messages.benchCheckAi)}
            <span className={cx('tag-nc')}>{formatMessage(messages.benchTagHypothesis)}</span>
          </div>
          <div className={cx('role')}>{formatMessage(messages.benchHypothesisNote)}</div>
          {hypothesisRuleName && (
            <div className={cx('role')}>{aiRoleLine(hypothesisRuleName)}</div>
          )}
          <div className={cx('verd-pill')}>{renderPill(journeyRubric.predicted_label)}</div>
          <div className={cx('strength')}>{formatMessage(messages.benchAiGuessPct, { pct })}</div>
          {journeyRubric.source_role_enabled === false && (
            <div className={cx('role')}>{formatMessage(messages.benchHypothesisRoleOff)}</div>
          )}
          {armedCard === 'ai' && armedNote(journeyRubric.predicted_label, false)}
        </div>
      );
    }
    // The record itself is the guess. Same card as a live rubric row, because
    // that is what it is: the analyzer's current answer for this failure, just
    // not carried on the live reply.
    if (journeyOwnGuess) {
      const pct = Math.round((journeyOwnGuess.confidence || 0) * 100);
      return (
        <div
          className={cx('check', 'rubric', 'actionable', { armed: armedCard === 'ai' })}
          role="button"
          tabIndex={0}
          onClick={armOnCardClick(() => adoptRubric(journeyOwnGuess))}
        >
          <span className={cx('edge')} />
          <InspectorLink
            corner
            href={getInspectorJourneyUrlForItem(projectId, currentItem)}
            label={formatMessage(messages.benchWhy)}
          />
          <div className={cx('method')}>
            <span className={cx('gl')}>✦</span> {formatMessage(messages.benchCheckAi)}
            <span className={cx('tag-nc')}>{formatMessage(messages.benchNotConfirmed)}</span>
          </div>
          <div className={cx('role')}>{aiRoleLine(decisionRuleName)}</div>
          <div className={cx('verd-pill')}>{renderPill(journeyOwnGuess.issueType)}</div>
          {pct > 0 && (
            <div className={cx('strength')}>
              {formatMessage(messages.benchAiGuessPct, { pct })}
            </div>
          )}
          {armedCard === 'ai' && armedNote(journeyOwnGuess.issueType, false)}
        </div>
      );
    }
    return (
      <div className={cx('check', 'empty')}>
        <span className={cx('edge')} />
        <div className={cx('method')}>
          <span className={cx('gl')}>✦</span> {formatMessage(messages.benchCheckAi)}
        </div>
        <div className={cx('strength')}>{formatMessage(messages.benchCheckAiNone)}</div>
      </div>
    );
  };

  const renderDock = () => {
    if (!belowRows.length) return null;
    return (
      <div className={cx('dock')}>
        <div
          className={cx('dock-toggle', { open: dockOpen })}
          onClick={() => setDockOpen((o) => !o)}
          role="button"
          tabIndex={0}
        >
          <span className={cx('chev')}>▼</span>
          {formatMessage(messages.benchDockToggle, { count: belowRows.length })}
        </div>
        {dockOpen && (
          <>
            <div className={cx('dock-note')}>{formatMessage(messages.benchDockNote)}</div>
            <div className={cx('dock-items')}>
              {belowRows.map((row) => (
                <div
                  key={row.res.id}
                  className={cx('dock-item', { focus: focusDock === row.res.id })}
                  onClick={() => {
                    setFocusDock(row.res.id);
                    openCompare(row);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={cx('dn')} title={row.res.name}>
                    {row.res.name}
                  </div>
                  <div className={cx('dd')}>
                    <span className={cx('strike')}>{defectName(row.issueType)}</span>{' '}
                    {isDeclineRow(row.suggestRs) && typeof row.conf === 'number'
                      ? formatMessage(messages.benchDockDeclineConf, {
                          p: row.conf.toFixed(2),
                        })
                      : formatMessage(messages.benchDockTooWeak, {
                          score: scoreToAlike(row.score),
                        })}
                  </div>
                  <div className={cx('dact')}>
                    <button
                      type="button"
                      className={cx('dock-adopt')}
                      onClick={(e) => dockAdopt(row, e)}
                    >
                      {formatMessage(messages.benchDockChoose)}
                    </button>
                    <InspectorLink
                      href={getInspectorJourneyUrl(row.suggestRs)}
                      label={formatMessage(messages.benchWhy)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderCompare = () => {
    const leftLines = toLines(currentItem?.logs);
    const rightLines = toLines(compare.logs);
    const relevantLogId = compare.suggestRs?.relevantLogId;
    const leftNorms = new Set(leftLines.map((l) => normalizeLine(l.text)));
    const rightNorms = new Set(rightLines.map((l) => normalizeLine(l.text)));
    const left = leftLines.map((l) => ({ ...l, same: rightNorms.has(normalizeLine(l.text)) }));
    const right = rightLines.map((l) => ({
      ...l,
      same: leftNorms.has(normalizeLine(l.text)),
      star: relevantLogId != null && l.id === relevantLogId,
    }));
    const sameCount = right.filter((l) => l.same).length;
    const diffCount = right.length - sameCount;
    const starLine = right.find((l) => l.star) || null;
    const compareScore = scoreToAlike(compare.score);
    return (
      <div className={cx('compare')}>
        <div className={cx('cmp-head')}>
          <span className={cx('cmp-title')}>{formatMessage(messages.benchCmpTitle)}</span>
          <button type="button" className={cx('btn', 'btn-ghost', 'btn-sm')} onClick={closeCompare}>
            {formatMessage(messages.benchCmpClose)}
          </button>
        </div>
        <div className={cx('cmp-help')}>
          <span>{formatMessage(messages.benchCmpHelp)}</span>
          <span className={cx('cmp-legend')}>
            <span className={cx('lg')}>
              <span className={cx('sw', 'lg-same')} /> {formatMessage(messages.benchCmpSame)}
            </span>
            <span className={cx('lg')}>
              <span className={cx('sw', 'lg-diff')} /> {formatMessage(messages.benchCmpDiff)}
            </span>
          </span>
        </div>
        <div className={cx('cmp-cols')}>
          <div className={cx('cmp-col', 'left')}>
            <div className={cx('cmp-col-head')}>
              {formatMessage(messages.benchCmpLeft)}
              <span className={cx('s')}>{formatMessage(messages.benchCmpLeftSuffix)}</span>
            </div>
            <div className={cx('cmp-body')}>
              {left.map((l, i) => (
                <div key={i} className={cx('cmp-line', l.same ? 'same' : 'diff')}>
                  {l.text}
                  {!l.same && (
                    <span className={cx('sidetag')}>
                      {formatMessage(messages.benchCmpOnlyHere)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className={cx('cmp-col', 'right')}>
            <div className={cx('cmp-col-head')}>
              {formatMessage(messages.benchCmpRight)}
              <span className={cx('s')}>{compare.res?.name}</span>
              <span className={cx('s')}>
                {defectName(compare.issueType)}
                {compareScore ? ` · ${compareScore}` : ''}
              </span>
            </div>
            <div className={cx('cmp-body')}>
              {right.length === 0 && (
                <div className={cx('cmp-nolog')}>{formatMessage(messages.benchCmpNoLog)}</div>
              )}
              {right.map((l, i) => (
                <div key={i} className={cx('cmp-line', l.same ? 'same' : 'diff')}>
                  {l.star && <span className={cx('starwrap')}>★ {formatMessage(messages.similarLog)}: </span>}
                  {l.text}
                  {!l.same && (
                    <span className={cx('sidetag')}>
                      {formatMessage(messages.benchCmpOnlyThere)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={cx('cmp-verdict')}>
          <div className={cx('cv-line')}>
            {formatMessage(messages.benchCmpSame)}: {sameCount}. {formatMessage(messages.benchCmpDiff)}: {diffCount}.
            {starLine && (
              <>
                {' '}
                {formatMessage(starLine.same ? messages.benchCmpKeyMatch : messages.benchCmpKeyDiff)}
              </>
            )}
          </div>
        </div>
        <div className={cx('cmp-foot')}>
          <div className={cx('cmp-foot-left')}>
            <span>{formatMessage(messages.benchCmpNotSame)}</span>
            <button
              type="button"
              className={cx('btn', 'btn-ghost', 'btn-sm')}
              onClick={() => {
                closeCompare();
                setPickerOpen(true);
              }}
            >
              {formatMessage(messages.benchCmpManual)}
            </button>
          </div>
          <InspectorLink
            href={getInspectorJourneyUrl(compare.suggestRs)}
            label={formatMessage(messages.benchInspectorDetails)}
          />
        </div>
      </div>
    );
  };

  // ---- provenance tag + recap (single commit bar) ---------------------------
  const provTag =
    verdictProv && verdictProv.chosen ? (
      <span className={cx('prov-tag', { picked: verdictProv.picked })}>
        {formatMessage(messages[verdictProv.key], verdictProv.params || {})}
        {armedFromOffer && decisionAbstained && (
          <span className={cx('prov-suffix')}>
            {formatMessage(messages.benchProvAbstainSuffix)}
          </span>
        )}
      </span>
    ) : null;

  const selectedItems = modalState.selectedItems || [];
  const breadth = selectedItems.length + 1;

  // Bulk apply is driven by the EXACT launch group (same error_hash) - the same
  // grouping the Inspector and Unique Errors use - NOT the removed fuzzy logSearch
  // list. Still-"To Investigate" siblings are the C1 targets; already-decided
  // members are the G3 two-tier override targets. Each is shaped for the stock
  // commit path (id/itemId + issue).
  const groupTiMembers = useMemo(
    () =>
      (grouping?.members || [])
        .filter((m) => !m.is_self && m.label_group === 'ti')
        .map((m) => ({ id: m.item_id, itemId: m.item_id, name: m.item_name, issue: {} })),
    [grouping],
  );
  // Already-decided members (G3). The mirror gives the collapsed count; the live
  // fetch (overrideLive) re-derives each member's tier and real issue on expand.
  const decidedMembers = useMemo(
    () => groupMembers.filter((m) => m.label_group !== 'ti'),
    [groupMembers],
  );
  const groupDecided = Math.max(0, groupCount - 1 - groupTiMembers.length);
  const decidedShown = decidedMembers.length;
  const decidedTotal = Math.max(groupDecided, decidedShown);
  const groupCapped = groupMembers.length + 1 < groupCount;

  // Live view of a decided member (ruling C6: tier and issue come from live RP
  // data once fetched, the mirror only until then).
  const memberLive = (m) => (overrideLive && overrideLive[m.item_id]) || null;
  const memberIsAuto = (m) => {
    const live = memberLive(m);
    return live ? !!live.autoAnalyzed : !!m.is_auto_analyzed;
  };
  const memberType = (m) => {
    const live = memberLive(m);
    return (live && live.issueType) || m.issue_type || null;
  };
  const memberWho = (m) => {
    const live = memberLive(m);
    return (live && live.who) || null;
  };
  const tierAMembers = decidedMembers.filter((m) => memberIsAuto(m));
  const tierBMembers = decidedMembers.filter((m) => !memberIsAuto(m));

  // Shape a decided member for the commit path: keep its REAL issue object (so a
  // linked BTS issue or other fields survive; the old issue:{} shaping wiped
  // them) and tag it as an override so prepareDataToSend appends the provenance
  // suffix (verdict 9.2).
  const shapeOverrideMember = (m) => {
    const live = memberLive(m);
    return {
      id: m.item_id,
      itemId: m.item_id,
      name: m.item_name,
      issue: live && live.issue ? { ...live.issue } : { issueType: m.issue_type },
      overrideFrom: currentItemId,
    };
  };

  const armedGroupRef = currentIssue.issueType ? groupRef(currentIssue.issueType) : null;
  const memberSameGroup = (m) => {
    const t = memberType(m);
    return !!t && !!armedGroupRef && groupRef(t) === armedGroupRef;
  };
  const tierBCheckedMembers = tierBMembers.filter((m) => tierBIds[m.item_id]);

  // The three scope inputs (C1 checkbox, tier A toggle, tier B checkboxes)
  // compose selectedItems. Unchecking one never clears the others (verdict 6.4).
  const composedSelected = [
    ...(tiOn ? groupTiMembers : []),
    ...(tierAOn ? tierAMembers.map(shapeOverrideMember) : []),
    ...tierBCheckedMembers.map(shapeOverrideMember),
  ];
  const composedSig = composedSelected.map((x) => x.id).join(',');
  useEffect(() => {
    // The burst panel owns selectedItems while open; recompose only outside it.
    if (burstApply) {
      return;
    }
    const currentSig = (modalState.selectedItems || []).map((x) => x.id || x.itemId).join(',');
    if (currentSig !== composedSig) {
      setModalState({ selectedItems: composedSelected });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composedSig, burstApply]);

  // On first expand of the override, fetch the real RP item resource for every
  // decided member in ONE batched call (ruling C6: tier + issue re-derived from
  // live data), then the newest human decider per tier-B member (paged, N+1 only
  // over the rows actually shown). Lazy, session-cached in overrideLive.
  useEffect(() => {
    if (!overrideOpen || overrideLive !== null) {
      return undefined;
    }
    const members = decidedMembers.slice(0, 60);
    if (!members.length) {
      setOverrideLive({});
      return undefined;
    }
    let cancelled = false;
    setOverrideLoading(true);
    fetch(URLS.testItems(activeProject, members.map((m) => m.item_id)))
      .then((resp) => (resp && resp.content) || [])
      .then((items) => {
        if (cancelled) {
          return;
        }
        const map = {};
        items.forEach((it) => {
          map[it.id] = {
            issue: it.issue || {},
            issueType: it.issue && it.issue.issueType,
            comment: it.issue && it.issue.comment,
            autoAnalyzed: !!(it.issue && it.issue.autoAnalyzed),
            name: it.name,
          };
        });
        setOverrideLive(map);
        items
          .filter((it) => !(it.issue && it.issue.autoAnalyzed))
          .forEach((it) => {
            fetch(URLS.logItemActivity(activeProject, it.id))
              .then((r) => (r && r.content) || [])
              .then((acts) => {
                const hit = acts.find(
                  (a) => a.subject_type === 'user' && a.event_name === 'updateItem',
                );
                if (hit && !cancelled) {
                  setOverrideLive((prev) => ({
                    ...(prev || {}),
                    [it.id]: { ...((prev && prev[it.id]) || {}), who: hit.subject_name },
                  }));
                }
              })
              .catch(() => {});
          });
      })
      .catch(() => {
        if (!cancelled) {
          setOverrideLive({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOverrideLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideOpen]);

  const applyToGroup = selectedItems.length > 0;
  const chosenIsProductBug =
    !!currentIssue.issueType &&
    getDefectType(currentIssue.issueType)?.typeRef === DEFECT_TYPES_MAP.PRODUCT_BUG;

  // Names of the human deciders whose different-type decisions this replaces
  // (two names, then "and others"). Unresolved names are dropped, never invented.
  const deciderNames = (members) => {
    const names = members.map((m) => memberWho(m)).filter(Boolean);
    if (names.length === 0) {
      return '';
    }
    if (names.length === 1) {
      return names[0];
    }
    if (names.length === 2) {
      return formatMessage(messages.benchRecapNames2, { a: names[0], b: names[1] });
    }
    return formatMessage(messages.benchRecapNamesMore, { a: names[0], b: names[1] });
  };

  // ---- recap matrix (verdict 6.5): one sentence, fragments never omitted, the
  // worst warning wins the color, warns never disable Apply --------------------
  let recap = null;
  if (verdictProv && verdictProv.pending && !modalHasChanges) {
    recap = { warn: true, text: formatMessage(messages.benchRecapWarnConfirm) };
  } else if (modalHasChanges) {
    const frags = [];
    let warn = 0; // 0 none, 1 amber, 2 strong amber
    const tiCount = tiOn ? groupTiMembers.length : 0;
    const tierACount = tierAOn ? tierAMembers.length : 0;
    const tierBSame = tierBCheckedMembers.filter((m) => memberSameGroup(m));
    const tierBDiff = tierBCheckedMembers.filter((m) => !memberSameGroup(m));

    frags.push(
      formatMessage(messages.benchRecapBase, { type: defectName(currentIssue.issueType) }),
    );
    if (currentIssue.comment && currentIssue.comment.trim()) {
      frags.push(formatMessage(messages.benchRecapFragComment));
    }
    if (tiCount > 0) {
      frags.push(
        groupCapped
          ? formatMessage(messages.benchRecapFragGroupCap, { shown: tiCount, total: groupDecided + tiCount })
          : formatMessage(messages.benchRecapFragGroup, { count: tiCount }),
      );
    }
    if (tierACount > 0) {
      frags.push(formatMessage(messages.benchRecapFragTierA, { count: tierACount }));
      warn = Math.max(warn, 1);
    }
    if (tierBSame.length > 0) {
      frags.push(formatMessage(messages.benchRecapFragTierBSame, { count: tierBSame.length }));
      warn = Math.max(warn, 1);
    }
    if (tierBDiff.length > 0) {
      const names = deciderNames(tierBDiff);
      frags.push(
        names
          ? formatMessage(messages.benchRecapFragTierBDiff, { count: tierBDiff.length, names })
          : formatMessage(messages.benchRecapFragTierBDiffNoNames, { count: tierBDiff.length }),
      );
      warn = 2;
    }
    if (armedFromOffer && decisionAbstained) {
      frags.push(formatMessage(messages.benchRecapAbstain));
      warn = Math.max(warn, 1);
    }
    if (verdictProv && verdictProv.key === 'benchProvDockAdopt' && breadth > 1) {
      frags.push(formatMessage(messages.benchRecapWarnCovers, { count: breadth }));
      warn = Math.max(warn, 1);
    }
    if (burst && applyToGroup && chosenIsProductBug && failedCount > 0) {
      frags.push(
        formatMessage(messages.benchBurstRecapWarn, { count: groupCount, failed: failedCount }),
      );
      warn = Math.max(warn, 1);
    }
    recap = { warn: warn > 0, strong: warn >= 2, text: frags.join(' ') };
  }

  const toggleTi = () => setTiOn((v) => !v);
  const toggleTierA = () => setTierAOn((v) => !v);
  const toggleTierB = (id) => setTierBIds((prev) => ({ ...prev, [id]: !prev[id] }));
  const memberComment = (m) => {
    const live = memberLive(m);
    return (live && live.comment) || '';
  };

  // ---- G3 two-tier override expander (verdict 6.4) -------------------------
  // Collapsed until Review; the Review affordance is disabled until a type is
  // armed. Tier A (auto-decided) is one toggle; tier B (human-decided) is per
  // item, no select-all. Inclusion is only possible here, so no member is ever
  // swept on the mirror; the live fetch re-derives tier and issue.
  const armedForOverride = !!(verdictProv && verdictProv.chosen && currentIssue.issueType);
  const includedCount = (tierAOn ? tierAMembers.length : 0) + tierBCheckedMembers.length;
  const overrideHeadLabel = groupCapped
    ? formatMessage(messages.benchOverrideReviewCap, { shown: decidedShown, total: decidedTotal })
    : formatMessage(messages.benchOverrideReview, { count: decidedTotal });
  const renderOverride = () => {
    if (!overrideOpen) {
      return (
        <div className={cx('override', 'collapsed')}>
          <span className={cx('ov-count')}>
            {overrideHeadLabel}
            {includedCount > 0 && (
              <span className={cx('ov-included')}>
                {', '}
                {formatMessage(messages.benchOverrideIncluded, { included: includedCount })}
              </span>
            )}
          </span>
          <button
            type="button"
            className={cx('ov-review')}
            disabled={!armedForOverride}
            onClick={() => setOverrideOpen(true)}
          >
            {formatMessage(messages.benchOverrideReviewAction)}
          </button>
          {!armedForOverride && (
            <span className={cx('ov-hint')}>{formatMessage(messages.benchOverrideArmFirst)}</span>
          )}
        </div>
      );
    }
    return (
      <div className={cx('override', 'open')}>
        <div className={cx('ov-head')}>
          <span className={cx('ov-count')}>{overrideHeadLabel}</span>
          <button
            type="button"
            className={cx('ov-collapse')}
            onClick={() => setOverrideOpen(false)}
          >
            {formatMessage(messages.benchOverrideCollapse)}
          </button>
        </div>
        {overrideLoading && (
          <div className={cx('ov-loading')}>{formatMessage(messages.benchOverrideLoading)}</div>
        )}
        {tierAMembers.length > 0 && (
          <div className={cx('ov-tier', 'tier-a')}>
            <label className={cx('ov-toggle')}>
              <input type="checkbox" checked={tierAOn} onChange={toggleTierA} />
              <span>
                {formatMessage(messages.benchOverrideTierAToggle, { count: tierAMembers.length })}
              </span>
            </label>
            <ul className={cx('ov-list')}>
              {tierAMembers.map((m) => (
                <li key={m.item_id} className={cx('ov-row', 'readonly')}>
                  <span className={cx('ov-name')}>{m.item_name}</span>
                  {miniPill(memberType(m))}
                  <span className={cx('ov-by')}>
                    {formatMessage(messages.benchOverrideTierADecidedBy)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tierBMembers.length > 0 && (
          <div className={cx('ov-tier', 'tier-b')}>
            <div className={cx('ov-tier-head')}>
              {formatMessage(messages.benchOverrideTierBHead)}
            </div>
            <ul className={cx('ov-list')}>
              {tierBMembers.map((m) => {
                const who = memberWho(m);
                const same = memberSameGroup(m);
                const cmt = memberComment(m);
                return (
                  <li key={m.item_id} className={cx('ov-row')}>
                    <label className={cx('ov-check')}>
                      <input
                        type="checkbox"
                        checked={!!tierBIds[m.item_id]}
                        onChange={() => toggleTierB(m.item_id)}
                      />
                      <span className={cx('ov-name')}>{m.item_name}</span>
                    </label>
                    <span className={cx('ov-by')}>
                      {who
                        ? formatMessage(messages.benchOverrideDecidedBy, { who })
                        : formatMessage(messages.benchOverrideDecidedEarlier)}
                    </span>
                    {miniPill(memberType(m))}
                    <span className={cx('ov-marker', { diff: !same })}>
                      {formatMessage(
                        same ? messages.benchOverrideSameType : messages.benchOverrideDiffType,
                      )}
                    </span>
                    {cmt && (
                      <span className={cx('ov-cmt')} title={cmt}>
                        {cmt}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {tierBCheckedMembers.length > 0 && currentIssue.comment && currentIssue.comment.trim() && (
          <div className={cx('ov-disclosure')}>
            {formatMessage(messages.benchOverrideCommentReplace)}
          </div>
        )}
      </div>
    );
  };

  // ---- C2 burst apply flow --------------------------------------------------
  // The one-gesture answer to a burst: pick the project's System Issue type and
  // fan the decision out over the exact burst group's still-TI members (same
  // error_hash; already-decided siblings are left alone, reported as burstMissing).
  const siLocator = getDefectType('si001') ? 'si001' : null;
  const burstScopeItems = groupTiMembers;
  const burstMissing = groupDecided;
  const adoptBurst = () => {
    if (!siLocator) {
      return;
    }
    const base =
      modalState.decisionType === SELECT_DEFECT_MANUALLY
        ? modalState.selectManualChoice.issue
        : currentItem?.issue || {};
    const issue = { ...base, issueType: siLocator };
    delete issue.comment; // the panel's editor owns the comment (honest contract)
    setModalState({
      decisionType: SELECT_DEFECT_MANUALLY,
      issueActionType: '',
      selectManualChoice: { issue },
      selectedItems: burstScopeItems,
    });
    setActiveTab(SELECT_DEFECT_MANUALLY);
    setDockHighlight('');
    setPrefillNote(false);
    setCommentOpen(true);
    setVerdictProv({ key: 'benchProvFromBurst', picked: true, chosen: true });
    setBurstApply(true);
    bumpComment();
  };
  // SI subtypes of THIS project (custom subtypes appear when configured); the
  // panel's defect pill becomes a dropdown only when there is a real choice.
  const siTypes = defectTypes[DEFECT_TYPES_MAP.SYSTEM_ISSUE] || [];
  const pickBurstSubtype = (locator) => {
    const issue =
      modalState.decisionType === SELECT_DEFECT_MANUALLY
        ? modalState.selectManualChoice.issue
        : {};
    setModalState({
      decisionType: SELECT_DEFECT_MANUALLY,
      issueActionType: '',
      selectManualChoice: { issue: { ...issue, issueType: locator } },
    });
    setSiPickOpen(false);
  };
  useEffect(() => {
    if (!siPickOpen) {
      return undefined;
    }
    const onDown = (e) => {
      if (siPickRef.current && !siPickRef.current.contains(e.target)) {
        setSiPickOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [siPickOpen]);

  // Focus lands in the panel's comment editor (CodeMirror keeps a hidden textarea).
  useEffect(() => {
    if (!burstApply) {
      return undefined;
    }
    const t = setTimeout(() => {
      const node = burstPanelRef.current;
      const ta = node && node.querySelector('.CodeMirror textarea, textarea');
      if (ta) {
        ta.focus();
      }
    }, 60);
    return () => clearTimeout(t);
  }, [burstApply, commentKey]);

  const itemInspector = getInspectorJourneyUrlForItem(projectId, currentItem);
  const savedIssueType = currentItem?.issue?.issueType;

  // Empty-reply state: name the cause that actually applies (see emptyReplyVariant).
  // The analyzer's own signature is the authority on "did it get anything to read":
  // it is what the analyzer built from the ERROR logs. errorLines is the fallback
  // for the moment before the journey lands.
  const emptyVariant = emptyReplyVariant({
    journeyResolved,
    stillWorking: emptyStillWorking,
    analyzerReadLogs: !!journey?.signature || errorLines.length > 0,
  });
  const EMPTY_COPY = {
    working: {
      cap: messages.benchWaitCap,
      title: messages.benchWaitTitle,
      tip: messages.benchWaitTitleTip,
      body: messages.benchWaitBody,
      next: messages.benchWaitNext,
      note: messages.benchWaitNote,
    },
    noHistory: {
      cap: messages.benchNoHistoryCap,
      title: messages.benchNoHistoryTitle,
      tip: messages.benchNoHistoryTitleTip,
      body: messages.benchNoHistoryBody,
      next: messages.benchNoHistoryNext,
      note: messages.benchNoHistoryNote,
    },
    noLogs: {
      cap: messages.benchSilentCap,
      title: messages.benchSilentTitle,
      tip: messages.benchSilentTitleTip,
      body: messages.benchSilentBody,
      next: messages.benchSilentNext,
      note: messages.benchSilentNote,
    },
  };
  const emptyCopy = EMPTY_COPY[emptyVariant];
  // One calm grey hero replaces the whole middle of the Bench; the identity header
  // and the verdict bar (defect picker + Apply) stay, so a manual call is always
  // one click away whichever cause applies.
  const silentHero = (
    <div className={cx('band', 'band-grey', 'silent-hero', { waiting: emptyVariant === 'working' })}>
      <span className={cx('sh-bar')} />
      <span className={cx('sh-glyph')} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor" />
        </svg>
      </span>
      <div className={cx('sh-main')}>
        <div className={cx('sh-cap')}>{formatMessage(emptyCopy.cap)}</div>
        <div className={cx('sh-title')}>
          {formatMessage(emptyCopy.title)}
          <span className={cx('sh-info', 'tip')} title={formatMessage(emptyCopy.tip)}>
            ?
          </span>
        </div>
        <div className={cx('sh-body')}>{formatMessage(emptyCopy.body)}</div>
        <div className={cx('sh-next')}>{formatMessage(emptyCopy.next)}</div>
        <div className={cx('sh-note')}>{formatMessage(emptyCopy.note)}</div>
        {/* The empty state is the one place with nothing to read, and "still
            working" is the hardest to sit through. The Inspector shows what the
            analyzer is actually doing with this item, so offer the way in rather
            than leaving the reader to guess or reopen the modal. */}
        {itemInspector && (
          <div className={cx('sh-link')}>
            <InspectorLink
              href={itemInspector}
              label={formatMessage(messages.benchEmptyInspector)}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cx('bench-modal')}>
      {emptyNoSignal ? (
        silentHero
      ) : (
        <>
      {/* R1 this failure (identity lives in the dark header; the stripe is gone) */}
      <div className={cx('band', 'band-grey', 'failure-panel')}>
        <div className={cx('fp-line')}>
          <span className={cx('fp-bar')} />
          <div className={cx('fp-main')}>
            <div className={cx('fp-cap')}>{formatMessage(messages.benchThisFailure)}</div>
            <div className={cx('fp-top')} ref={fpTopRef}>
              {headerLine || formatMessage(messages.noLogs)}
            </div>
            {failureSub && <div className={cx('fp-sub')}>{failureSub}</div>}
            {soloConfirmed && (
              <div className={cx('fp-solo')}>{formatMessage(messages.benchSoloLine)}</div>
            )}
          </div>
          <div className={cx('fp-actions')}>
            <span
              className={cx('logtoggle', { open: logOpen })}
              onClick={() => setLogOpen((o) => !o)}
              role="button"
              tabIndex={0}
            >
              <span className={cx('chev')}>▶</span>
              {formatMessage(logOpen ? messages.benchHideErrorLog : messages.benchShowErrorLog)}
            </span>
          </div>
        </div>
        {logOpen && (
          <div className={cx('fulllog')}>
            <div className={cx('lg-cap')}>{formatMessage(messages.benchStackAndContext)}</div>
            {restLines.length ? (
              restLines.map((l, i) => (
                <div
                  key={i}
                  className={cx('logrow')}
                  ref={(node) => {
                    logRowRefs.current[i + 1] = node;
                  }}
                >
                  {l.text}
                </div>
              ))
            ) : (
              <div className={cx('logrow')}>{formatMessage(messages.noLogs)}</div>
            )}
          </div>
        )}
      </div>

      {/* context band: C1 shared / C2 burst (one home for launch context) */}
      {showGroup && (
        <div className={cx('band', 'band-white', 'group-band', { burst })}>
          <div className={cx('group-line')}>
            <span className={cx('group-badge')}>{groupCount}</span>
            <div className={cx('group-main')}>
              <div className={cx('group-head')}>
                {formatMessage(messages.benchGroupHead, {
                  count: <b key="c">{groupCount}</b>,
                })}
              </div>
              {failedCount > 0 && (
                <div className={cx('group-fraction')}>
                  {formatMessage(burst ? messages.benchBurstFraction : messages.benchGroupFraction, {
                    count: groupCount,
                    failed: failedCount,
                    pct: Math.round((groupCount / failedCount) * 100),
                  })}
                </div>
              )}
              {burst && (
                <div className={cx('group-rule')}>
                  {formatMessage(messages.benchBurstRule, {
                    gate: BENCH_BURST_SHARE_GATE_PCT,
                    count: groupCount,
                    label: miniPill(siLocator) || 'System Issue',
                  })}
                </div>
              )}
            </div>
            <div className={cx('group-actions')}>
              <button
                type="button"
                className={cx('btn', 'btn-ghost', 'btn-sm')}
                onClick={() => setGroupOpen((o) => !o)}
              >
                {formatMessage(groupOpen ? messages.benchGroupHideTests : messages.benchGroupShowTests)}
              </button>
              {burst && siLocator && (
                <button
                  type="button"
                  className={cx('btn', 'btn-ghost', 'btn-sm', 'burst-apply-btn')}
                  onClick={adoptBurst}
                >
                  {formatMessage(messages.apply)} {miniPill(siLocator)}
                </button>
              )}
            </div>
          </div>
          {groupOpen && (
            <div className={cx('group-members')}>
              <div className={cx('gm-list')}>
                <span className={cx('gm-chip')}>
                  <span className={cx('dot')} style={{ background: defectColor(savedIssueType) }} />
                  {currentItem?.name}{' '}
                  <span className={cx('gm-cur')}>{formatMessage(messages.benchGroupThisTest)}</span>
                </span>
                {groupMembers.map((m) =>
                  m.ui_url ? (
                    <a
                      key={m.item_id}
                      className={cx('gm-chip')}
                      href={m.ui_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={cx('dot')} style={{ background: defectColor(m.issue_type) }} />
                      {m.item_name}
                    </a>
                  ) : (
                    <span key={m.item_id} className={cx('gm-chip')}>
                      <span className={cx('dot')} style={{ background: defectColor(m.issue_type) }} />
                      {m.item_name}
                    </span>
                  ),
                )}
              </div>
              {groupMembers.length + 1 < groupCount && (
                <div className={cx('gm-showing')}>
                  {formatMessage(messages.benchGroupShowing, {
                    shown: groupMembers.length + 1,
                    count: groupCount,
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Act 1: the decision story. Rendered after the group band and before the
          offers region. Its slot height is reserved (.story min-height) so a late
          journey fetch never shifts the rail (R3). Always shown once the journey
          settles and a decision record can exist; the AI paragraph is gated. */}
      <div className={cx('band', 'band-white', 'story', { covered: burstApply })}>
        {decisionStory && (
          <>
            <div className={cx('story-caprow')}>
              <span className={cx('story-cap')}>{formatMessage(messages.benchStoryCap)}</span>
              <span className={cx('story-caprow-right')}>
                <InspectorLink
                  href={itemInspector}
                  label={formatMessage(messages.benchInspectorItem)}
                />
              </span>
            </div>
            <div className={cx('story-head')}>
              {headAsPill ? (
                <span>
                  {formatMessage(messages.benchStoryHeadAppliedPre)}{' '}
                  {miniPill(decisionLocator)}
                </span>
              ) : (
                <span>{formatMessage(messages[decisionStory.headKey], storyParams)}</span>
              )}
              {/* "decided {rel}" removed: opening the modal fires the suggest route
                  which writes a fresh suggestion row (created_at=now), so the journey
                  always reads a just-created decision and the relative time was
                  invariably "just now" — no information for the reader. */}
              {/* Early per-item result: decided while the launch was still
                  running. One small hover icon, no extra text on screen. */}
              {journeyDecision && journeyDecision.source === 'early' && (
                <span
                  className={cx('early-mark')}
                  title={formatMessage(messages.benchEarlyMarkTitle)}
                  aria-label={formatMessage(messages.benchEarlyMarkTitle)}
                >
                  i
                </span>
              )}
            </div>
            <div className={cx('story-reason')}>
              {formatMessage(messages[decisionStory.reasonKey], storyParams)}
            </div>
            {bridgeText && <div className={cx('story-bridge')}>{bridgeText}</div>}
            {aiFresh && (
              <div className={cx('story-ai', { open: storyAiOpen })}>
                <div className={cx('ai-caprow')}>
                  <span className={cx('ai-cap')}>
                    {formatMessage(messages.benchStoryExplCap)}
                  </span>
                  <span className={cx('src-tag')}>
                    {formatMessage(messages.benchStorySrcAi)}
                  </span>
                </div>
                <div className={cx('ai-body')} ref={aiBodyRef}>
                  {renderRichText(aiText)}
                </div>
                {/* Show more only when the clamped text actually overflows 3 lines
                    (a short explanation must not carry a dead toggle). */}
                {(aiOverflow || storyAiOpen) && (
                  <button
                    type="button"
                    className={cx('ai-more')}
                    onClick={() => setStoryAiOpen((o) => !o)}
                  >
                    {formatMessage(
                      storyAiOpen ? messages.benchStoryLess : messages.benchStoryMore,
                    )}
                  </button>
                )}
              </div>
            )}
            {/* The explanation has not been written yet and the analyzer says it
                still can write one. Shown only in that case, never when the LLM
                is off or its breaker is open, and it gives up on its own. */}
            {!aiFresh && explanationWait === 'waiting' && (
              <div className={cx('story-ai', 'ai-pending')}>
                <div className={cx('ai-caprow')}>
                  <span className={cx('ai-cap')}>
                    {formatMessage(messages.benchStoryExplCap)}
                  </span>
                </div>
                <div className={cx('ai-waiting')} role="status">
                  <span className={cx('ai-waiting-dot')} aria-hidden="true" />
                  <span>{formatMessage(messages.benchStoryExplPending)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* C2 burst apply: the focused flow covers everything below the context band */}
      {burstApply && (
        <div className={cx('band', 'band-white', 'burst-panel')} ref={burstPanelRef}>
          <div className={cx('bp-head')}>{formatMessage(messages.benchBurstPanelTitle)}</div>
          <div className={cx('bp-defect')}>
            <span className={cx('flabel')}>{formatMessage(messages.benchVbDefect)}</span>
            {siTypes.length > 1 ? (
              <span className={cx('si-pick-wrap')} ref={siPickRef}>
                <button
                  type="button"
                  className={cx('si-pick-btn')}
                  onClick={() => setSiPickOpen((o) => !o)}
                >
                  {renderPill(currentIssue.issueType || siLocator)}
                  <span className={cx('caret')} aria-hidden>
                    ▾
                  </span>
                </button>
                {siPickOpen && (
                  <div className={cx('si-pick-pop')}>
                    {siTypes.map((t) => (
                      <button
                        key={t.locator}
                        type="button"
                        className={cx('si-opt', {
                          sel: (currentIssue.issueType || siLocator) === t.locator,
                        })}
                        onClick={() => pickBurstSubtype(t.locator)}
                      >
                        <span className={cx('dot')} style={{ background: t.color }} />
                        {t.longName}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            ) : (
              renderPill(currentIssue.issueType || siLocator)
            )}
            <span className={cx('prov-tag')}>{formatMessage(messages.benchProvFromBurst)}</span>
          </div>
          <div className={cx('bp-comment')}>
            <div className={cx('cmt-head')}>
              <span>{formatMessage(messages.comment)}</span>
            </div>
            <MarkdownEditor
              key={commentKey}
              value={currentIssue.comment || ''}
              onChange={setComment}
              placeholder={formatMessage(messages.benchCmtPlaceholder)}
            />
          </div>
          <div className={cx('bp-scope')}>
            {burstScopeItems.length > 0
              ? formatMessage(messages.benchBurstPanelScope, {
                  breadth: burstScopeItems.length + 1,
                  others: burstScopeItems.length,
                })
              : formatMessage(messages.benchBurstPanelOnlySelf)}
            {burstMissing > 0 && (
              <span className={cx('bp-missing')}>
                {' '}
                {formatMessage(messages.benchBurstPanelPartial, {
                  missing: burstMissing,
                  count: groupCount,
                })}
              </span>
            )}
          </div>
          <div className={cx('bp-actions')}>
            <button
              type="button"
              className={cx('btn', 'btn-ghost')}
              onClick={() => setBurstApply(false)}
            >
              {formatMessage(messages.benchBurstPanelBack)}
            </button>
            <button
              type="button"
              className={cx('btn', 'btn-teal')}
              disabled={!modalHasChanges}
              onClick={onApply}
            >
              {formatMessage(
                modalState.issueActionType ? messages.applyAndContinue : messages.apply,
              )}
            </button>
          </div>
        </div>
      )}

      {/* the bench (Act 2 offers). The banner is the offers region head, derived
          from the journey decision route + the live reply (deriveBanner -> B1..BF).
          It replaces the ng37 agree/disagree/coldstart/notsure state machine; the
          Enter hint lives inside the B1/B3/B4e helper copy only. */}
      <div className={cx('band', 'band-white', 'bench-region', { covered: burstApply })}>
        {banner && (
          <div className={cx('region-head', BANNER_TINT[banner.id] || '')}>
            <span className={cx('headline')}>
              {formatMessage(messages[banner.headKey], banner.params)}
            </span>
            <span className={cx('headline-help')}>
              {(() => {
                let kbdIdx = 0;
                return formatMessage(messages[banner.helpKey], {
                  ...banner.params,
                  k: (chunks) => {
                    kbdIdx += 1;
                    return (
                      <span className={cx('kbd')} key={`kbd-${kbdIdx}`}>
                        {chunks}
                      </span>
                    );
                  },
                });
              })()}
            </span>
          </div>
        )}
        <div className={cx('offers-cap')}>{formatMessage(messages.benchOffersCap)}</div>
        <div className={cx('bench-row')}>
          {renderCheck({ kind: 'past' })}
          {renderCheck({ kind: 'similar' })}
          {renderCheck({ kind: 'ai' })}
          {belowRows.length > 0 && (
            <div className={cx('bar-sep')} title={formatMessage(messages.benchLineTooltip)}>
              <span className={cx('bar-rule')} />
              <span className={cx('bar-lbl', 'tip')}>
                {formatMessage(messages.benchLineLabel)}
              </span>
            </div>
          )}
          {renderDock()}
        </div>
      </div>

      {/* Compare view (the grey band is now compare-only; the AI decision summary
          stage band was deleted, its text moved to the Act 1 story). */}
      {compare && (
        <div className={cx('band', 'band-grey', 'stage', { covered: burstApply })}>
          {renderCompare()}
        </div>
      )}
        </>
      )}

      {/* verdict bar: the single commit bar (shared by the normal and empty states) */}
      <div className={cx('band', 'band-white', 'verdict-bar', { covered: burstApply })}>
        <div className={cx('vb-verdict-row')}>
          <span className={cx('flabel')}>{formatMessage(messages.benchVbDefect)}</span>
          <span className={cx('picker-anchor')} ref={pickerWrapRef}>
            <span
              className={cx('defect-select', { empty: !decided })}
              onClick={() => setPickerOpen((o) => !o)}
              role="button"
              tabIndex={0}
            >
              {decided ? (
                <>
                  <span
                    className={cx('dot')}
                    style={{ background: defectColor(currentIssue.issueType) }}
                  />
                  {defectName(currentIssue.issueType)}
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
                {(() => {
                  const pickedLocator =
                    modalState.decisionType === SELECT_DEFECT_MANUALLY
                      ? modalState.selectManualChoice.issue.issueType || ''
                      : currentIssue.issueType || '';
                  return (
                    <div className={cx('pick-groups')}>
                      {Object.keys(defectTypes).map((group) => (
                        <div className={cx('pill-row')} key={group}>
                          {defectTypes[group].map((t) => (
                            <button
                              type="button"
                              key={t.locator}
                              className={cx('pick-pill', {
                                sel: pickedLocator === t.locator,
                                hl: !!dockHighlight && (t.longName || '').toLowerCase() === dockHighlight,
                              })}
                              onClick={() => {
                                selectManual(t.locator);
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
                  );
                })()}
                <div className={cx('manual-help')}>{formatMessage(messages.benchManualHelp)}</div>
              </div>
            )}
          </span>
          {provTag}
        </div>

        {/* comment: collapsed row, expands on demand or on prefill */}
        {commentOpen ? (
          <div className={cx('comment-pane')}>
            <div className={cx('cmt-head')}>
              <span>{formatMessage(messages.comment)}</span>
            </div>
            {prefillNote && (
              <div className={cx('cmt-prefill-note')}>
                {formatMessage(messages.benchCmtPrefillNote)}
              </div>
            )}
            {commentKept && (
              <div className={cx('cmt-prefill-note')}>
                {formatMessage(messages.benchProvCommentKept)}
              </div>
            )}
            <MarkdownEditor
              key={commentKey}
              value={currentIssue.comment || ''}
              onChange={setComment}
              placeholder={formatMessage(messages.benchCmtPlaceholder)}
            />
          </div>
        ) : (
          <button
            type="button"
            className={cx('cmt-collapsed')}
            onClick={() => setCommentOpen(true)}
          >
            <span aria-hidden>+</span> {formatMessage(messages.benchCmtAddReason)}
          </button>
        )}

        {/* commit row: exact-group scope + recap left, Cancel + Apply right */}
        <div className={cx('commit-row')}>
          <div className={cx('commit-left')}>
            {/* executionSection stays mounted (renders nothing here) only for the
                current-item ERROR log fetch that feeds R1. */}
            <div className={cx('exec-mount')} ref={scopeRef}>
              {scopeSection}
            </div>
            {groupTiMembers.length > 0 && (
              <label className={cx('scope-check')}>
                <input type="checkbox" checked={tiOn} onChange={toggleTi} />
                <span>
                  {formatMessage(messages.benchScopeGroupToggle, {
                    count: groupTiMembers.length,
                  })}
                </span>
              </label>
            )}
            {decidedMembers.length > 0 && renderOverride()}
            {groupTiMembers.length === 0 && decidedMembers.length === 0 && (
              <span className={cx('scope-only')}>
                {formatMessage(messages.benchScopeThisOnly)}
              </span>
            )}
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
              {formatMessage(
                modalState.issueActionType ? messages.applyAndContinue : messages.apply,
              )}
            </button>
          </div>
        </div>
        {recap && (
          <div className={cx('vb-recap', { warn: recap.warn, strong: recap.strong })}>
            {recap.text}
          </div>
        )}
      </div>
    </div>
  );
};

Bench.propTypes = {
  suggestedItems: PropTypes.array,
  currentItem: PropTypes.object,
  emptyNoSignal: PropTypes.bool,
  emptyStillWorking: PropTypes.bool,
  modalState: PropTypes.object.isRequired,
  setModalState: PropTypes.func.isRequired,
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  modalHasChanges: PropTypes.bool,
  onAdoptRubric: PropTypes.func.isRequired,
  scopeSection: PropTypes.node,
  scopeRef: PropTypes.object,
  isBulkOperation: PropTypes.bool,
};
Bench.defaultProps = {
  suggestedItems: [],
  currentItem: {},
  emptyNoSignal: false,
  emptyStillWorking: false,
  modalHasChanges: false,
  scopeSection: null,
  scopeRef: null,
  isBulkOperation: false,
};
