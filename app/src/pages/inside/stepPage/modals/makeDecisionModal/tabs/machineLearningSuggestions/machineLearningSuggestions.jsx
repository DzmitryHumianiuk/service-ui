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

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames/bind';
import { useIntl } from 'react-intl';
import { useTracking } from 'react-tracking';
import { TO_INVESTIGATE_LOCATOR_PREFIX } from 'common/constants/defectTypes';
import { DefectTypeItem } from 'pages/inside/common/defectTypeItem';
import { GhostButton } from 'components/buttons/ghostButton';
import { TestItemDetails } from '../../elements/testItemDetails';
import { messages } from '../../messages';
import {
  isRubricHypothesis,
  parseProvenance,
  parseRubricModelVer,
  parseRubricWhy,
  PROVENANCE,
} from '../../analyzerSuggestionMeta';
import styles from './machineLearningSuggestions.scss';

const cx = classNames.bind(styles);

const PROVENANCE_MESSAGE = {
  [PROVENANCE.RUBRIC]: messages.provenanceLlmHypothesis,
  [PROVENANCE.HUMAN]: messages.provenanceHumanNeighbor,
  [PROVENANCE.AUTO]: messages.provenanceAutoNeighbor,
};

export const MachineLearningSuggestions = ({
  modalState,
  itemData,
  eventsInfo,
  onAcceptHypothesis,
}) => {
  const { formatMessage } = useIntl();
  const { trackEvent } = useTracking();

  const item = modalState.suggestChoice;
  const { logs, suggestRs } = item;

  const defectFromTIGroup = itemData.issue?.issueType.startsWith(TO_INVESTIGATE_LOCATOR_PREFIX);

  const onClickExternalLinkEvent = () => {
    trackEvent(eventsInfo.getClickItemLinkEvent(defectFromTIGroup, 'ml_suggestions'));
  };
  const onOpenStackTraceEvent = () => {
    return eventsInfo.getOpenStackTraceEvent(defectFromTIGroup, 'ml_suggestions');
  };

  // analyzer-ng metadata — defensively parsed; a stock analyzer yields null/'' here
  // and only the plain <TestItemDetails> below is rendered (no behaviour change).
  const rubric = isRubricHypothesis(suggestRs);
  const provenance = parseProvenance(suggestRs);
  const provenanceMessage = provenance && PROVENANCE_MESSAGE[provenance];
  const whyText = rubric ? parseRubricWhy(suggestRs?.modelInfo) : '';
  const modelVer = rubric ? parseRubricModelVer(suggestRs?.modelInfo) : '';

  return (
    <>
      <div className={cx('suggestion-meta')}>
        <div className={cx('suggested-defect-row')}>
          <span className={cx('meta-caption')}>{formatMessage(messages.suggestedDefect)}</span>
          {suggestRs?.issueType && (
            <DefectTypeItem type={suggestRs.issueType} className={cx('suggested-defect-pill')} />
          )}
          {provenanceMessage && (
            <span
              className={cx('provenance-chip', { 'provenance-chip-rubric': rubric })}
              title={rubric && modelVer ? modelVer : undefined}
            >
              {formatMessage(provenanceMessage)}
            </span>
          )}
        </div>
        {rubric && whyText && (
          <div className={cx('rubric-why')} data-provenance="ai_suggested">
            <span className={cx('meta-caption')}>{formatMessage(messages.rubricWhyCaption)}</span>
            <p className={cx('rubric-why-text')}>{whyText}</p>
          </div>
        )}
        {rubric && (
          <div className={cx('rubric-accept')}>
            <GhostButton
              onClick={() =>
                onAcceptHypothesis({ issueType: suggestRs.issueType, comment: whyText })
              }
              color="''"
              appearance="topaz"
            >
              {formatMessage(messages.acceptHypothesis)}
            </GhostButton>
          </div>
        )}
      </div>
      <TestItemDetails
        item={item}
        logs={logs}
        highlightedLogId={suggestRs.relevantLogId}
        highlightedMessage={formatMessage(messages.similarLog)}
        showErrorLogs
        eventsInfo={{
          onOpenStackTraceEvent,
          onClickExternalLinkEvent,
        }}
      />
    </>
  );
};

MachineLearningSuggestions.propTypes = {
  modalState: PropTypes.object.isRequired,
  itemData: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  eventsInfo: PropTypes.object,
  onAcceptHypothesis: PropTypes.func,
};
MachineLearningSuggestions.defaultProps = {
  itemData: {},
  eventsInfo: {},
  onAcceptHypothesis: () => {},
};
