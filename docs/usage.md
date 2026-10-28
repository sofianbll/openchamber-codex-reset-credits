# Use your reset credits

Open **Codex resets** in the rail for the full panel, or expand its **Work Status**
section for the sidebar. Both use the same accounts, credits and service.

## Three views

- **Compact** groups credits under collapsible accounts.
- **Tickets** gives each credit a ticket layout; accounts can still collapse.
- **Mini** keeps account tickets visible. Select a ticket to toggle its details;
  Mini account headers do not collapse.

The full-width panel switch changes only the current panel view. Open the gear
to set the **sidebar view** and **default panel view** separately. **View panel**
opens with the default, not the last temporary view. There is no settings menu
inside Work Status. UI labels follow the host’s English/French locale; credit
titles and descriptions stay as Codex returns them.

![Tickets view with fictional reset credits and account details](/screenshots/panel-tickets.png)

## A quieter sidebar

The panel’s gear also sets:

- **Unavailable accounts**: show errored accounts in Mini; off by default.
- **Accounts shown**: a positive maximum, or blank for all accounts.

![Panel gear with separate sidebar, default panel and account-limit settings](/screenshots/panel-settings.png)

The sidebar sorts the selected readable account first, then other accounts with
available resets, readable accounts without resets, and errored accounts. A
nonselected account is not automatically unavailable. Filtering and sorting happen
before the limit; **+N others** reveals the rest. The full panel stays unfiltered
and retains its account order.

![Mini sidebar with fictional accounts and compact credit tickets](/screenshots/sidebar-mini.png)

A summary at the top of the section counts available credits across readable
accounts, regardless of the sidebar limit. An amber indicator flags hidden
unavailable accounts; unknown availability is not zero, and a partial total is
explained on hover. OpenChamber does not let extensions decorate a collapsed
section header, so the summary appears only while the section is expanded.

![Codex resets sidebar summary with available-credit and unavailable-account indicators](/screenshots/sidebar-summary.png)

## Read, confirm, verify

1. Open a credit’s details. Check its account, status and dates. A missing date is
   **Not provided**, not a guarantee of unlimited validity.
2. Choose **Use**, then review the inline confirmation naming the credit and account.
3. Choose **Cancel**, or **Confirm consumption** to consume it irreversibly.
4. The service re-reads availability before sending the request, then the UI
   displays Codex’s result code and refreshes the list. An HTTP 200 is not proof of success.

Expired, used or unknown-status credits cannot be redeemed. Duplicate attempts are
blocked across the panel, sidebar and duplicate logins for the same ChatGPT account.

::: warning Uncertain result? Do not retry.
Refresh and inspect the account’s usage on ChatGPT. The service locks that credit
for its remaining lifetime. Locks are memory-only: restarting or pausing clears
them, but does not establish that consumption failed. [Safety details](privacy.md).
:::

**Refresh** re-reads accounts and credits, bypassing the normal cache (up to 30
seconds). An account sign-in failure is shown as an error, never as zero credits.
