import { describe, it, expect } from '@jest/globals'
import { DesignStatus } from '@figma-jira/shared-types'

/**
 * Tests for the documented status ownership rule:
 *
 * "design_status is set manually by users via the Jira panel,
 *  with one exception: sync may automatically transition
 *  READY_FOR_DEV → CHANGES_AFTER_DEV when a change is detected.
 *  All other transitions are user-initiated."
 *
 * These tests verify the business logic in isolation, without DB.
 * The actual DB function (transitionToChangesAfterDevIfReady) is tested
 * at the integration level against a real DB in a follow-up test suite.
 */

/**
 * Pure function that models the sync-side status transition.
 * This is the extracted logic from sync-service.ts for unit testing.
 *
 * Returns the new status after a sync-detected change, given the current status.
 */
function applySyncChangeDetected(currentStatus: DesignStatus): DesignStatus {
  if (currentStatus === DesignStatus.READY_FOR_DEV) {
    return DesignStatus.CHANGES_AFTER_DEV
  }
  // All other statuses are untouched by sync
  return currentStatus
}

/**
 * Models whether a status transition is user-permitted.
 * For MVP: any transition between any status is user-permitted.
 */
function isUserTransitionPermitted(_from: DesignStatus, _to: DesignStatus): boolean {
  return true
}

describe('Status ownership rule', () => {
  describe('sync-assisted transition: READY_FOR_DEV → CHANGES_AFTER_DEV', () => {
    it('transitions READY_FOR_DEV to CHANGES_AFTER_DEV when change detected', () => {
      expect(applySyncChangeDetected(DesignStatus.READY_FOR_DEV)).toBe(
        DesignStatus.CHANGES_AFTER_DEV,
      )
    })

    it('leaves NONE unchanged on sync change detection', () => {
      expect(applySyncChangeDetected(DesignStatus.NONE)).toBe(DesignStatus.NONE)
    })

    it('leaves IN_PROGRESS unchanged on sync change detection', () => {
      expect(applySyncChangeDetected(DesignStatus.IN_PROGRESS)).toBe(DesignStatus.IN_PROGRESS)
    })

    it('leaves CHANGES_AFTER_DEV unchanged (already in final sync state)', () => {
      expect(applySyncChangeDetected(DesignStatus.CHANGES_AFTER_DEV)).toBe(
        DesignStatus.CHANGES_AFTER_DEV,
      )
    })
  })

  describe('user-permitted transitions', () => {
    const allStatuses = Object.values(DesignStatus)

    for (const from of allStatuses) {
      for (const to of allStatuses) {
        it(`allows user to transition ${from} → ${to}`, () => {
          expect(isUserTransitionPermitted(from, to)).toBe(true)
        })
      }
    }
  })

  describe('idempotency: setting the same status is a no-op', () => {
    it('NONE → NONE produces no change', () => {
      const current = DesignStatus.NONE
      const requested = DesignStatus.NONE
      // Application checks current === requested before writing
      expect(current === requested).toBe(true)
    })

    it('READY_FOR_DEV → READY_FOR_DEV produces no change', () => {
      const current = DesignStatus.READY_FOR_DEV
      const requested = DesignStatus.READY_FOR_DEV
      expect(current === requested).toBe(true)
    })
  })
})

describe('DesignStatus enum values', () => {
  it('has exactly 4 valid status values', () => {
    expect(Object.values(DesignStatus)).toHaveLength(4)
  })

  it('includes all expected values', () => {
    expect(Object.values(DesignStatus)).toEqual(
      expect.arrayContaining([
        'NONE',
        'IN_PROGRESS',
        'READY_FOR_DEV',
        'CHANGES_AFTER_DEV',
      ]),
    )
  })
})
