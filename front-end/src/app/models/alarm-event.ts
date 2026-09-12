export interface AlarmEvent {
  _id: string;
  controller: string;
  project: string | null;
  flag: string;
  sourceObject: 'unitAlarmStatus1' | 'unitAlarmStatus2' | 'shortAlarmStatus';
  state: 'active' | 'cleared';
  occurredAt: string;
}
