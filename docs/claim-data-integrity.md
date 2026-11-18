# Claim data integrity assessment

Apply the migrations before deploying this slice. In Command Prompt, from the app directory:

```cmd
npx prisma migrate deploy
```

Set `PAYSTACK_SECRET_KEY` as a server-only environment variable in each deployment. Use a test key in Preview and the intended live key only after production approval. Do not set a `NEXT_PUBLIC_` Paystack secret. In **Settings > Accepted banks**, add the Paystack bank code for each accepted bank. This is the `code` returned by Paystack's [List Banks API](https://paystack.com/docs/api/miscellaneous/); it is not assumed to equal the existing sort code. The bank Excel template has an optional third column for this code. Older two-column workbooks still import, but those banks cannot resolve account names until updated.

To assess the slice:

1. Create a claim using a test company with an eligible annual payment. Confirm Form 1 and both Form 2 schedules show that year's verified contribution as read-only. Attempt to send a different `trainingContributionPaid` value to the action; it must not change the stored value.
2. In Form 1, select a bank with a Paystack code, enter exactly ten digits, and use **Verify account**. Confirm the returned account name is visible. Save Form 1 and reload; the name remains recorded. Try nine digits, a wrong account number, a bank without a Paystack code, and a missing Paystack key. None should save new unverified bank details; an employer draft without a saved verified account cannot be submitted. Use only approved test account data in Preview.
3. Download the claim staff-list workbook, enter staff numbers as text (including leading zeroes), names, and Management/Supervisory/Occupational categories. Import it on a draft claim. The import replaces that claim's current staff entries; an invalid row rejects the whole workbook. Add the same staff number in two categories: the employer sees the entries without a duplicate warning, while Area Office/HQ staff see the duplicate flag.
4. Upload a claim payment receipt, training-request payment receipt, registration contribution receipt, and (in Integrated mode) a compliance contribution receipt with issuer and receipt number. Confirm the details appear alongside the evidence in the claim/request/registry views. A receipt without either value must be rejected with an on-page error. Non-receipt evidence does not require those fields.

The receipt metadata is entered by the uploader and is **not** proof that a payment settled. Annual eligibility verification remains the authority for the contribution amount. Paystack account-name resolution confirms the bank/account pair returned by Paystack; it does not, by itself, establish that the account belongs to the employer.
