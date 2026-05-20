/** Short TTS lines Clicky speaks after a successful step submit. */
export const OPEN_ACCOUNT_STEP_HINTS: Record<string, string> = {
  choose_product:
    'Product picked. Next: enter the initial deposit amount in the chosen currency.',
  fund_account: 'Deposit entered. Final step: link KYC and confirm the terms.',
  confirm: 'All steps done. Let me show you the score.',
};

export const DEPOSIT_STEP_HINTS: Record<string, string> = {
  select_account:
    'Account selected. Count the cash denominations so they match the declared total.',
  count_cash: 'Cash counted. Enter the receipt number in DEP-######## format.',
  verify_receipt: 'All steps done. Let me show you the score.',
};

export const TRANSFER_STEP_HINTS: Record<string, string> = {
  select_source:
    'Source account set. Enter the recipient name, IBAN, and amount for screening.',
  enter_recipient:
    'Recipient captured. Review the risk screen and approve or block the transfer.',
  screen_and_confirm: 'All steps done. Let me show you the score.',
};
