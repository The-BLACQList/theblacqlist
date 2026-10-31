import { createClient } from '@/lib/supabase/server'
import { wantsCountedEmail } from '@/lib/spend/receipt-emails'
import { AccountSettingsForm } from './AccountSettingsForm'
import { ReceiptEmailsSection } from './ReceiptEmailsSection'

/**
 * Account settings. The profile form and the danger zone are client-side; this
 * server shell reads the receipt email switch (ticket 165) so it opens in the
 * right position. The account layout has already sent signed-out visitors away.
 */
export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let countedEmailsOn = true
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('receipt_counted_emails')
      .eq('id', user.id)
      .maybeSingle()
    // Same rule as the send: a failed read shows the switch on.
    countedEmailsOn = wantsCountedEmail(error ? null : data)
  }

  return (
    <AccountSettingsForm>
      <ReceiptEmailsSection initialOn={countedEmailsOn} />
    </AccountSettingsForm>
  )
}
