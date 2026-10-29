import { addCalendarMonths, nextMaintenance } from './maintenance.service';
describe('warranty and maintenance dates', () => {
  it('clamps month ends, including leap years', () => {
    expect(addCalendarMonths('2024-01-31',1)).toBe('2024-02-29');
    expect(addCalendarMonths('2023-01-31',1)).toBe('2023-02-28');
    expect(addCalendarMonths('2024-01-31',2)).toBe('2024-03-31');
    expect(addCalendarMonths('2024-02-29',12)).toBe('2025-02-28');
  });
  it('keeps an overdue cycle until recorded and advances beyond a late service date', () => {
    expect(nextMaintenance('2024-01-31',1,0,null)).toEqual({cycle:1,due_date:'2024-02-29'});
    expect(nextMaintenance('2024-01-31',1,1,'2024-04-15')).toEqual({cycle:3,due_date:'2024-04-30'});
    expect(nextMaintenance('2024-01-31',1,1,'2024-02-01')).toEqual({cycle:2,due_date:'2024-03-31'});
  });
});
