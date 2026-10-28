export const DECISION_COPY = {
  title:'Open-model decision check',
  unavailable:'The open model is unavailable. Showing the saved rule-based review.',
  pending:'Checking the evidence with the open model…',
  supportLabel:'Evidence support',focusLabel:'Practice focus',
  support:{supported:'Supported by the supplied evidence',mixed:'Mixed evidence',insufficient:'Not enough evidence',uncertain:'Model is uncertain'},
  focus:{sizing:'Position sizing',stops:'Stop planning',costs:'Execution costs',evidence:'Reading evidence',patience:'Waiting for confirmation',insufficient:'More evidence needed'},
  note:'This is an experimental model judgment, not a trade win probability. Cash, order limits, and risk calculations remain enforced by code.',
  provenance:'Model details',readout:'Direct option logits · uncalibrated scores',
  feedback:{
    sizing:'Compare the size of the whole position with the cash left available, including any earlier entries.',
    stops:'Compare the stop with the information visible before the decision. Its price is an exit trigger, not a guaranteed fill.',
    costs:'Compare the actual order with its preview. Fees and slippage can change the amount received or spent.',
    evidence:'Separate the observed facts from their interpretation. Identify which evidence actually supports your chosen move.',
    patience:'Define an observable condition that would change your view. Waiting remains a valid choice at a checkpoint.',
    insufficient:'The supplied evidence does not establish a clear teaching focus. Review the source facts before drawing a conclusion.',
  },
} as const;
