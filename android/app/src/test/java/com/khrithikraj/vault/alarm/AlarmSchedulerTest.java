package com.khrithikraj.vault.alarm;

import static org.junit.Assert.*;

import org.junit.Test;
import java.util.Calendar;
import java.util.TimeZone;

public class AlarmSchedulerTest {

    @Test
    public void testGetRequestCodeIsDeterministicAndAvoids1001() {
        String id1 = "c1851e24-3450-4d5c-9c76-57778939c36d";
        int code1 = AlarmScheduler.getRequestCode(id1);
        int code2 = AlarmScheduler.getRequestCode(id1);
        assertEquals(code1, code2);
        assertTrue(code1 > 0);
        assertNotEquals(AlarmScheduler.TEST_ALARM_REQUEST_CODE, code1);

        assertEquals(AlarmScheduler.TEST_ALARM_REQUEST_CODE, AlarmScheduler.getRequestCode(null));
        assertEquals(AlarmScheduler.TEST_ALARM_REQUEST_CODE, AlarmScheduler.getRequestCode(""));
    }

    @Test
    public void testComputeNextOccurrenceDailyBeforeTime() {
        // 2026-09-15 08:00:00 UTC = 13:30:00 IST (Tuesday)
        long baseMillis = 1789459200000L;
        // Alarm time 14:00 (later same day)
        long next = AlarmScheduler.computeNextOccurrenceMillis(
            "14:00",
            "Asia/Kolkata",
            "daily",
            null,
            baseMillis
        );
        // 14:00 IST = 08:30 UTC -> 1789461000000L
        assertEquals(1789461000000L, next);
        assertTrue(next > baseMillis);
    }

    @Test
    public void testComputeNextOccurrenceDailyAfterTimeAdvancesToNextDay() {
        // 2026-09-15 08:00:00 UTC = 13:30:00 IST
        long baseMillis = 1789459200000L;
        // Alarm time 13:00 (already passed today)
        long next = AlarmScheduler.computeNextOccurrenceMillis(
            "13:00",
            "Asia/Kolkata",
            "daily",
            null,
            baseMillis
        );
        // Tomorrow 2026-09-16 13:00 IST = 07:30 UTC -> 1789543800000L
        assertEquals(1789543800000L, next);
        assertTrue(next > baseMillis);
    }

    @Test
    public void testComputeNextOccurrenceWeekdaysSkipsWeekend() {
        // Friday 2026-09-18 10:00:00 UTC = 15:30:00 IST
        long fridayAfternoon = 1789725600000L;

        // 14:00 IST already passed on Friday -> next should be Monday 2026-09-21 14:00 IST
        long nextFromFriday = AlarmScheduler.computeNextOccurrenceMillis(
            "14:00",
            "Asia/Kolkata",
            "weekdays",
            null,
            fridayAfternoon
        );
        // Monday 2026-09-21 14:00 IST = 08:30 UTC -> 1789979400000L
        assertEquals(1789979400000L, nextFromFriday);

        // Saturday 2026-09-19 06:00:00 UTC = 11:30 IST
        long saturday = 1789797600000L;
        long nextFromSaturday = AlarmScheduler.computeNextOccurrenceMillis(
            "14:00",
            "Asia/Kolkata",
            "weekdays",
            null,
            saturday
        );
        assertEquals(1789979400000L, nextFromSaturday);

        // Sunday 2026-09-20 06:00:00 UTC = 11:30 IST
        long sunday = 1789884000000L;
        long nextFromSunday = AlarmScheduler.computeNextOccurrenceMillis(
            "14:00",
            "Asia/Kolkata",
            "weekdays",
            null,
            sunday
        );
        assertEquals(1789979400000L, nextFromSunday);
    }

    @Test
    public void testComputeNextOccurrenceWeeklySpecificDay() {
        // Tuesday 2026-09-15 08:00:00 UTC = 13:30:00 IST
        long baseMillis = 1789459200000L;

        // Thursday at 10:00 IST -> 2026-09-17 10:00 IST = 04:30 UTC -> 1789619400000L
        long nextThursday = AlarmScheduler.computeNextOccurrenceMillis(
            "10:00",
            "Asia/Kolkata",
            "weekly",
            "thursday",
            baseMillis
        );
        assertEquals(1789619400000L, nextThursday);

        // Tuesday at 10:00 IST (already passed on Tuesday 13:30) -> next Tuesday 2026-09-22 10:00 IST = 04:30 UTC
        long nextTuesday = AlarmScheduler.computeNextOccurrenceMillis(
            "10:00",
            "Asia/Kolkata",
            "weekly",
            "tuesday",
            baseMillis
        );
        assertEquals(1790051400000L, nextTuesday);
    }

    @Test
    public void testComputeNextOccurrenceWeeklyFallbackToCurrentDay() {
        // Tuesday 2026-09-15 08:00:00 UTC = 13:30:00 IST
        long baseMillis = 1789459200000L;

        // Omitted dayOfWeek falls back to today (Tuesday) -> since 10:00 passed, rolls to next Tuesday
        long nextFallbackNull = AlarmScheduler.computeNextOccurrenceMillis(
            "10:00",
            "Asia/Kolkata",
            "weekly",
            null,
            baseMillis
        );
        assertEquals(1790051400000L, nextFallbackNull);

        long nextFallbackEmpty = AlarmScheduler.computeNextOccurrenceMillis(
            "10:00",
            "Asia/Kolkata",
            "weekly",
            "",
            baseMillis
        );
        assertEquals(1790051400000L, nextFallbackEmpty);
    }

    @Test
    public void testDstTransitionsAcrossTimezones() {
        // America/New_York DST fall-back day: 2026-11-01 (EDT -> EST)
        // 08:00 on 2026-10-31 EDT: 09:00 EDT is 13:00 UTC
        TimeZone ny = TimeZone.getTimeZone("America/New_York");
        Calendar cal = Calendar.getInstance(ny);
        cal.set(2026, Calendar.OCTOBER, 31, 8, 0, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long oct31 = cal.getTimeInMillis();

        long nextOct31 = AlarmScheduler.computeNextOccurrenceMillis(
            "09:00",
            "America/New_York",
            "daily",
            null,
            oct31
        );
        Calendar resCal = Calendar.getInstance(ny);
        resCal.setTimeInMillis(nextOct31);
        assertEquals(9, resCal.get(Calendar.HOUR_OF_DAY));
        assertEquals(0, resCal.get(Calendar.MINUTE));
        assertEquals(31, resCal.get(Calendar.DAY_OF_MONTH));

        // After 09:00 on Oct 31, next daily is Nov 1 at 09:00 EST
        cal.set(2026, Calendar.OCTOBER, 31, 10, 0, 0);
        long oct31After = cal.getTimeInMillis();
        long nextNov1 = AlarmScheduler.computeNextOccurrenceMillis(
            "09:00",
            "America/New_York",
            "daily",
            null,
            oct31After
        );
        resCal.setTimeInMillis(nextNov1);
        assertEquals(9, resCal.get(Calendar.HOUR_OF_DAY));
        assertEquals(0, resCal.get(Calendar.MINUTE));
        assertEquals(1, resCal.get(Calendar.DAY_OF_MONTH));
        assertEquals(Calendar.NOVEMBER, resCal.get(Calendar.MONTH));
    }
}
