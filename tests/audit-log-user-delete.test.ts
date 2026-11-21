// Ticket 245: deleting a user SET NULLs admin_audit_log.admin_user_id, which
// the immutability trigger used to reject, so owners couldn't delete their
// account. The trigger now lets exactly that change through and nothing else.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const dir = path.resolve(process.cwd(), 'supabase/migrations')
const SQL = readFileSync(path.join(dir, '20261202000000_audit_log_actor_on_user_delete.sql'), 'utf8')
const INITIAL = readFileSync(path.join(dir, '20260510000000_initial_blacqlist_mvp_schema.sql'), 'utf8')

describe('audit log and account deletion', () => {
  it('the actor foreign key still sets null when the user is deleted', () => {
    expect(INITIAL).toMatch(/admin_user_id\s+uuid\s+REFERENCES auth\.users\(id\) ON DELETE SET NULL/)
  })

  it('allows only the actor going to null, with every other column unchanged', () => {
    expect(SQL).toContain("TG_OP = 'UPDATE'")
    expect(SQL).toContain('OLD.admin_user_id IS NOT NULL')
    expect(SQL).toContain('NEW.admin_user_id IS NULL')
    expect(SQL).toContain("(to_jsonb(NEW) - 'admin_user_id') = (to_jsonb(OLD) - 'admin_user_id')")
  })

  it('still refuses every other update and every delete', () => {
    const afterAllow = SQL.slice(SQL.indexOf('END IF;'))
    expect(afterAllow).toContain("RAISE EXCEPTION 'admin_audit_log records are immutable")
    expect(SQL).not.toMatch(/DROP TRIGGER/i)
  })
})
